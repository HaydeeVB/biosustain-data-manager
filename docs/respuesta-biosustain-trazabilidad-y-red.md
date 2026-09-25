# Respuestas a BioSustain — Trazabilidad regulatoria + Arquitectura de red/sensores

**Preparado por:** Prospyr Prime · **Fecha:** 2026-09-25
**Uso:** Diana quiere comparar con sus propias respuestas y verificar su comprensión.
**Principio:** Respuestas ancladas al código real. Ver nota de precisión al final.

---

## PREGUNTA 1 — Trazabilidad del producto final frente a requisitos regulatorios e internacionales

### Lo que existe hoy en el sistema (verificado en código)

| Primitiva | Estado real |
|---|---|
| **ID único por lote** | ✅ `lote_{timestamp}_{random}` generado al registrar |
| **Cadena de custodia del insumo** | ✅ cada lote guarda `tipo_residuo`, `tipo_sustrato`, `peso_kg`, `cesta_id`, `categoria`, `cliente_id` |
| **Sello temporal de ingreso** | ✅ `fechaIngreso` (ISO 8601) + `fechaProyeccionCosecha` |
| **Telemetría por cesta (hora a hora)** | ✅ `telemetria_cestas` — microclima, NH₃, CO₂, peso en riel, aspersor/extractor |
| **Auditoría de acciones** | ✅ tabla `audit_log` — `accion`, `endpoint`, `ip_address`, `user_agent`, `detalles JSONB` |
| **Registro de consentimiento NDA** | ✅ `nda.ts` guarda versión aceptada + timestamp |
| **Reportes ESG exportables (PDF)** | ✅ `generateEsgReport()` — trazable a datos de lote |
| **Multi-tenant con aislamiento** | ✅ toda consulta filtra por `cliente_id` |

**La columna vertebral de trazabilidad existe.** Cada kilo de residuo que entra se puede seguir
hasta su cesta, su ciclo de telemetría y su lote de salida.

### Lo que NO existe todavía — y hay que decir con claridad

⚠️ **No hay certificación de terceros, ni módulo de cumplimiento normativo, ni integración EUDR.**
El propio sistema legal lo declara (`src/routes/legal.ts`):

> *«Los reportes ESG son **estimaciones preliminares** calculadas con metodologías IPCC; **no
> constituyen certificación de terceros**. El usuario debe verificar cualquier uso regulatorio o
> de auditoría.»*

Esa declaración es correcta y **hay que mantenerla**. Inflar esto ante un jurado es el error más
caro posible — un juez que verifique el sistema lo detecta.

### Respuesta para el jurado — cómo plantearlo

**1. Trazabilidad interna: completa y ya implementada.**
> «Cada lote tiene un identificador único, origen del residuo, cesta asignada, ciclo de telemetría
> completo y sello temporal. La cadena insumo → bioconversión → producto es reconstruible desde la
> base de datos sin intervención manual.»

**2. Trazabilidad regulatoria: es un objetivo, y la arquitectura ya la soporta.**
> «La plataforma está diseñada para que la evidencia de trazabilidad sea exportable y auditable.
> Hoy genera reportes ESG trazables a datos de lote y mantiene un registro de auditoría de cada
> acción. La certificación de terceros es un paso de proceso, no una capacidad pendiente del
> software.»

**3. El punto honesto y fuerte:**
> «Nuestros reportes son estimaciones trazables, no certificaciones. Lo declaramos en los términos
> del propio sistema, porque un dato de sostenibilidad usado para cumplimiento necesita
> verificación independiente — y eso lo asumimos explícitamente.»

### Marcos regulatorios relevantes (para que Diana los tenga mapeados)

| Marco | Exigencia | Qué exige de nosotros |
|---|---|---|
| **EUDR** (UE, deforestación) | Geolocalización de origen, cadena de custodia | Coordenadas del punto de origen del residuo |
| **CSRD / ESRS E5** | Reporte de residuos y economía circular | Los reportes ESG por lote ya alimentan esto |
| **ISO 14040 / 14044** (ACV) | Metodología de análisis de ciclo de vida | Factores por categoría ya son explícitos y versionables |
| **GlobalG.A.P. / certificación orgánica** | Trazabilidad de insumo a producto | Cadena de custodia ya modelada |
| **Reglamento (CE) 1069/2009** (subproductos animales) | Si el residuo es de origen animal | Aplica a estiércoles — control sanitario |

> **Nota para Diana:** el sistema hoy **soporta la evidencia**; la **certificación** es un proceso
> externo. Si el jurado pregunta por EUDR específicamente, la brecha concreta es la
> **geolocalización del origen** — hoy se registra ubicación de cesta, no coordenadas del punto de
> recolección del residuo. Esa es una extensión real y acotada, no un rediseño.

---

## PREGUNTA 2 — Arquitectura de red y sensores en entornos agroindustriales con conectividad limitada

### Lo que existe hoy (verificado en código)

**Endpoint de ingesta:** `POST /api/v1/iot/metrics` (`src/routes/iot.ts`)

```
Autenticación : header X-API-Key (NO JWT — deliberado, para dispositivos tipo ESP32)
                fail-closed: sin IOT_API_KEY configurada responde 503, nunca acceso abierto
Payload       : device_id, timestamp, cesta_id, sensores{}, actuadores{}
Sensores      : humedad_sustrato_pct · temperatura_sustrato_c · amoniaco_ppm
                co2_ppm · peso_riel_kg
Actuadores    : aspersor_auto_status · ventilacion_status
Respuesta     : decisión de control (trigger_sprinkler + mensaje)
```

**Almacenamiento:** tabla `telemetria_cestas` como **hypertable de TimescaleDB**
(`create_hypertable(..., chunk_time_interval => INTERVAL '7 days')`), con **compresión a los 14
días** (~90% de reducción de costo) y **retención de 365 días**.

> **Verificado en vivo (2026-09-25):** `POST /api/v1/iot/metrics` sin credencial → **HTTP 401**
> (autenticación aplicada). La telemetría real fluye: `GET /api/v1/cestas/sparklines/all` devuelve
> series de temperatura y humedad por cesta (ej. `CESTA-01`: 20 puntos de temperatura 26.6–30.3 °C,
> humedad 65–70 %).

### 🔴 BUG ARQUITECTÓNICO ENCONTRADO: el rate limit no soporta más de un dispositivo por IP

**El comentario en `iot.ts` dice «Rate limiting: 1 request por 10 segundos por dispositivo».
Eso NO está implementado.** El único limitador en el código es **global** (`src/server.ts:52`):

```
100 requests / 15 minutos por IP   =  9.600 requests/día por IP
```

Ningún limitador por dispositivo existe. Consecuencia calculada:

| Cestas tras una misma IP | Demanda/día | Presupuesto | Resultado |
|---|---|---|---|
| 1 | 8.640 | 9.600 | ✅ entra (90% consumido) |
| **2** | **17.280** | **9.600** | ❌ **BLOQUEADO** |
| 3 | 25.920 | 9.600 | ❌ bloqueado |
| 6 | 51.840 | 9.600 | ❌ bloqueado |

**Esto es grave y hay que decirlo.** En una planta real hay **varias cestas**, y si comparten salida
a internet (una sola conexión en la nave, un solo router, o un gateway local), **todas menos una
quedan bloqueadas por el limitador global**. La telemetría se pierde silenciosamente a partir del
segundo dispositivo.

**Peor aún:** el limitador devuelve `429 RATE_LIMIT_EXCEEDED`, pero `iot.ts` no lo maneja
especialmente — y como el diseño es «no fallar el request», el dispositivo podría interpretarlo
como fallo de red y perder la lectura sin registro.

**El arreglo es acotado** (ver Fase 0 abajo): el limitador global no debe aplicarse a `/api/v1/iot/`,
que debe tener su propio límite alto **por API key / device_id**, no por IP. El comentario del
código describe la intención correcta — solo que nunca se implementó.

### Diseño de la arquitectura — los cuatro principios

**1. El dispositivo no depende del servidor para operar.**
El endpoint devuelve una *decisión de control*, no una orden bloqueante. El firmware decide
localmente y el servidor solo aconseja. **Si se cae la red, el reactor sigue funcionando.**

**2. Autenticación apropiada al dispositivo.**
API key en header en lugar de JWT, porque un ESP32 no puede gestionar refresh tokens. Decisión
deliberada, no atajo. Y **fail-closed**: sin `IOT_API_KEY` configurada, responde 503 en vez de
permitir acceso.

**3. Escritura tolerante a fallos.**
Si la escritura a la base falla, el request **no falla** — se registra el error y se devuelve igual
la decisión de control:

```js
} catch (err) {
  console.error('[IoT] Error guardando en DB:', err);
  // No fallar el request — el ESP32 necesita la respuesta de control
}
```

**4. Resolución temporal adecuada al control biológico.**
Un ciclo BSF dura ~14 días. La telemetría se comprime a los 14 días y se retiene 365 — es decir,
**se guarda el ciclo completo sin comprimir y se conserva un año entero** para comparación entre
ciclos. Decisión correcta para el caso de uso.


### ⚠️ La brecha real: no hay lógica de operación offline

**Esto hay que decirlo con honestidad.** Hoy **no existe**:

- ❌ Buffer local en el dispositivo (store-and-forward cuando cae la red)
- ❌ Cola de reintentos en el backend para lecturas perdidas
- ❌ Resolución de conflictos para timestamps tardíos
- ❌ Firmware ESP32 versionado en el repositorio

El sistema **asume enlace disponible**. Cuando no lo hay, esa lectura **se pierde** — no se
recupera. El diseño mitiga el impacto (el reactor sigue operando sin conexión), pero no cierra el
ciclo de datos.

### Cómo cerrar la brecha (arquitectura, en orden de esfuerzo)

**Fase 0 — Excluir IoT del limitador global (BUG, hacer primero)**
`app.use('/api/', limiter)` aplica el límite de 100/15min a `/api/v1/iot/metrics` también. Un
limitador propio para esa ruta, **por `device_id` / API key** en vez de por IP, con ventana
generosa. Sin esto, **no pasa de una cesta por conexión** — es un bloqueante, no una mejora.

**Fase 1 — Buffer local en el dispositivo (mayor impacto)**
El ESP32 escribe cada lectura a flash con su timestamp; un worker intenta enviar y solo borra
después de un `200 OK`. Cuando la red vuelve, **envía el backlog**. ~50 líneas de firmware que
resuelven el 90% del problema de conectividad.

**Fase 2 — Idempotencia en el servidor**
El `timestamp` ya viene en el payload. Añadir clave única (`device_id + timestamp`) con
`ON CONFLICT DO NOTHING` permite reenvíos sin duplicar datos. **El esquema actual ya tiene lo
necesario** — es una restricción única y un cambio en el INSERT.

**Fase 3 — Conectividad alterna**
LoRaWAN o celular (2G/4G) con failover. Las zonas agroindustriales raramente tienen una sola
opción, y un módulo LoRa es barato comparado con perder el ciclo.

**Fase 4 — Gateway local + envío por lotes**
Una Raspberry Pi en planta que acumula lecturas de varias cestas y las envía en lote. Reduce la
presión sobre el enlace por un factor de N cestas — y **resuelve de raíz el problema de Fase 0**,
porque todas las cestas salen por un solo canal controlado.


### Respuesta para el jurado — cómo plantearlo

> «El diseño asume que la conectividad en campo **no es confiable** — por eso el dispositivo nunca
> depende del servidor para operar: el servidor aconseja, el firmware decide. La ingesta usa API
> key en lugar de JWT porque un microcontrolador no puede gestionar tokens, y la escritura es
> tolerante a fallos para que un problema de base de datos no detenga el reactor.
>
> Somos explícitos sobre el siguiente paso: hoy el sistema no almacena en buffer las lecturas
> durante cortes de enlace. La hoja de ruta es **store-and-forward en el dispositivo** —
> el ESP32 escribe a flash y sincroniza cuando vuelve la red, con idempotencia por
> `device_id + timestamp` en el servidor para que los reenvíos no dupliquen datos.»

**Por qué esto es la respuesta correcta:** un jurado técnico respeta un arquitecto que **nombra su
propia brecha** y tiene un plan concreto. Es mucho más creíble que afirmar resiliencia total sin
haberla construido — y si inspeccionan el código, encuentran exactamente lo que dijiste.

---

## Resumen para Diana

**Pregunta 1 — Trazabilidad:**
- ✅ La columna vertebral existe: ID único por lote, origen del insumo, cadena de custodia,
  telemetría completa, auditoría, reportes ESG exportables.
- ⚠️ **No hay certificación de terceros.** El sistema legal lo declara correctamente. Manteenlo así.
- 📌 Brecha concreta si preguntan por EUDR: falta **geolocalización del punto de origen** del residuo.

**Pregunta 2 — Red y sensores:**
- ✅ Arquitectura correcta por diseño: el dispositivo **no depende del servidor para operar**
  (el servidor aconseja, el firmware decide); API key en vez de JWT para microcontroladores y
  fail-closed; escritura tolerante a fallos; TimescaleDB con compresión a 14 días y retención de
  365 (un ciclo BSF completo sin comprimir, un año conservado).
- 🔴 **BUG ENCONTRADO: el rate limit no soporta más de una cesta por IP.** El único limitador es
  global (100 req / 15 min por IP = 9.600/día), y una cesta a 1 lectura/10 s ya consume 8.640/día.
  **Dos cestas tras la misma conexión → la segunda queda bloqueada.** El comentario del código dice
  «1 request / 10 segundos por dispositivo», pero eso nunca se implementó. Hay que excluir
  `/api/v1/iot/` del limitador global y darle un límite propio por `device_id`.
- ⚠️ **Falta store-and-forward.** Durante cortes de enlace, las lecturas se pierden.
- 📌 Plan en 5 fases: **(0)** arreglar el rate limit por dispositivo — bloqueante; **(1)** buffer
  local en el ESP32 (~50 líneas); **(2)** idempotencia por `device_id + timestamp` (el esquema ya
  tiene el timestamp); **(3)** LoRaWAN/celular con failover; **(4)** gateway local en planta, que
  además resuelve de raíz el problema de Fase 0.

**Tu instinto es correcto en ambos casos:** la arquitectura está bien orientada, y las brechas son
**extensiones acotadas**, no rediseños. Nombra las brechas — es tu posición más fuerte. Y el bug
del rate limit es exactamente el tipo de detalle que impresiona a un jurado técnico si lo presentas
como *hallazgo propio con arreglo definido*, en vez de esperar a que lo encuentren ellos.


---

## Nota de precisión (importante)

Según la revisión de precisión del pitch ya documentada para este proyecto, el material generado
anteriormente **exageraba** — ADK, Function Calling, fórmula IPCC nivel 2, IoT en tiempo real.
Verificado hoy contra el código: **TimescaleDB SÍ existe** (`CREATE EXTENSION`, `create_hypertable`,
políticas de compresión y retención) — esa afirmación es correcta. **IoT en "tiempo real" no lo es**:
la ingesta es **polling por HTTP cada 10 segundos**, no streaming.

**Usa «telemetría periódica cada 10 segundos», no «tiempo real».** Es preciso y sigue siendo
impresionante.

---

*Fuentes verificadas en `biosustain-data-manager` (commit `19c4615`): `src/routes/iot.ts`,
`scripts/01_schema.sql`, `scripts/02_compression_policies.sql`, `src/routes/lotes.ts`,
`src/routes/legal.ts`, `src/routes/nda.ts`, `src/utils/pdf.ts`.*
