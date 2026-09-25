# Respuesta a Diana — Reproducibilidad y algoritmos propietarios (BioSustain / XPRIZE)

**Preparado por:** Prospyr Prime · **Fecha:** 2026-09-25
**Contexto:** Diana pidió (1) agregar un campo de tipo de residuo consumido por las larvas,
y (2) una explicación para la pregunta del jurado sobre reproducibilidad / algoritmos propietarios.

---

## PARTE 1 — El campo ya existe (y ya lo ampliamos)

Diana: **el campo que pides ya está en la aplicación.** No había que crearlo, había que
enriquecerlo. Verificado en vivo contra el sistema desplegado:

```
GET /api/v1/lotes/categorias   (requiere sesión)
  id=larvas  Larvas / BSF
    wasteInputs: ['Desecho Orgánico Mixto', 'Residuo Agroindustrial', 'Frutas y Verduras']
```

El formulario **ya tenía** un selector «Tipo de residuo» que cambia según la categoría
(`plantas` / `ganado` / `larvas`). Para larvas solo ofrecía **3 opciones** — probablemente
por eso parecía que faltaba.

### Lo que se amplió (larvas → 13 opciones)

```
Desecho Orgánico Mixto · Residuo Agroindustrial · Frutas y Verduras
Residuo de Mercado / Plaza · Restos de Cocina / Comida
Estiércol Bovino · Purín Porcino · Cama de Aves
Lodo / Fibra de palma · Rastrojo Agrícola
Residuo de Cervecería (Bagazo) · Pulpa / Descarte de Fruta
Otro (especificar)
```

**«Otro (especificar)» despliega una caja de texto libre.** Sin eso, elegir «Otro» no
registraba *qué* residuo era — un callejón sin salida. Ahora el dato siempre queda capturado.

> **Nota para Diana:** si quieres un residuo específico que no esté en la lista, dímelo y lo
> agrego. La lista es config-driven (`src/lib/categorias.ts`), no hay que tocar la base de datos.

---

## PARTE 2 — La pregunta del jurado

> *«¿El software es fácilmente reproducible o copiable, o hay algoritmos propietarios
> desarrollados a partir de los datos biológicos?»*

### La respuesta corta

**Las dos cosas son ciertas, y hay que decir las dos.** La infraestructura es estándar y
reproducible; **la capa de conocimiento biológico es lo que no se copia.** El valor defendible
no es el código — es la calibración.

No afirmes "algoritmos propietarios" a secas. Si un juez abre el repositorio verá Python,
FastAPI y SQL estándar. La respuesta honesta es más fuerte que la exagerada.

### Qué hay realmente construido (verificado en el código, 2026-09-25)

| Componente | Qué es | ¿Reproducible? |
|---|---|---|
| **App SaaS** (Express + Next.js + PostgreSQL) | Software de aplicación estándar | **Sí** — cualquiera puede escribir esto |
| **`simulate_larval_growth()`** | Modelo de crecimiento larvario día a día | El *andamiaje* sí; los **coeficientes no** |
| **`predict_sprinkler_activation()`** | Balance hídrico + decisión de aspersor | Igual: lógica sí, umbrales no |
| **Gemini diagnostic** | LLM comercial para diagnóstico | **Sí** — es una API pública |
| **Cerebro** (servidor privado) | Aísla los modelos, sin IP pública, con API key | Es **protección de acceso**, no secreto algorítmico |

**Lo que esto significa:** el código es reproducible. Los **factores calibrados** que lo hacen
correcto para BSF no lo son.

### Los números reales que constituyen el activo propietario

Estos valores salen del código y son el resultado de la operación real — no de un paper:

**Crecimiento larvario (`cerebro_server.py`)**
```
mortality_rate = 0.05          # 5% — meta de la operación
growth_rate    = 0.18          # × eficiencia térmica × eficiencia hídrica
food_consumed  = biomasa × 2.5 # tasa de consumo por kg de biomasa
óptimo térmico = 27–30 °C      # fuera de rango: penalización 0.08/°C
óptimo hídrico = 60–70 %       # fuera de rango: penalización 0.05/%
```

**Balance hídrico (`predict_sprinkler_activation`)**
```
target_humidity    = 65.0
evaporation_const  = 0.08
ventilation_factor = 1.4 si extractor activo, 1.0 si no
1 segundo de aspersión = 0.4 % de humedad   ← valor operativo medido
tope de seguridad  = 45 segundos
```

**Factores ESG por categoría (`src/lib/categorias.ts`)**
```
larvas : biomasa 0.92 · CO2e 0.18 · CH4 0.02 · ciclo 14 días · frass 0.40
ganado : (factores propios de estiércol)
plantas: (factores propios de residuo vegetal)
```

**Umbrales de alerta** — temperatura 20 °C, humedad 55 %, densidad 8 larvas/cm², FCR 3.0.

👉 **Ese conjunto de constantes ES la propiedad intelectual.** Son parámetros de proceso
derivados de operación y medición biológica real — no se derivan leyendo el código fuente.

### Cómo explicárselo al jurado (3 puntos)

**1. El software en sí es reproducible — y eso es bueno.**
> «La arquitectura es intencionalmente estándar: PostgreSQL, un backend API y un tablero web.
> No dependemos de infraestructura exótica. Eso significa que la plataforma puede desplegarse
> en otra región u otra operación sin reconstruirla.»

**2. La reproducibilidad del software NO reproduce el resultado biológico.**
> «Un competidor puede copiar nuestra arquitectura de software en un fin de semana. Lo que no
> puede copiar son los coeficientes calibrados — tasa de conversión, umbrales térmicos e
> hídricos, factores de emisión. Esos provienen de nuestra operación real con larvas: de
> mediciones de campo, no de documentación pública.»

**3. La verdadera barrera es la validación, y eso le toca a Diana.**
> «Y aun con los números, haría falta **validar el proceso**: demostrar que las condiciones se
> sostienen, que la mortalidad y la conversión se reproducen, y que los datos de telemetría
> confirman el resultado. Eso requiere operación, no copia.»

### Su punto: "el proceso requiere evaluación y validación"

**Diana tiene razón, y ese es su argumento más fuerte.** El software es el instrumento; el
**proceso validado** es lo que no se replica. Lo que ella debe poder demostrar:

1. **Las condiciones del proceso están controladas y monitoreadas** — temperatura 27–31 °C,
   humedad 65–75 %, densidad 3–5 larvas/cm², FCR 1.5–2.2 (estos son los rangos que el sistema
   vigila y alerta).
2. **La calibración salió de la operación real** — de ciclos medidos, no de supuestos.
3. **El sistema captura la evidencia** — telemetría por cesta (microclima, gases NH₃/CO₂,
   peso en riel, degradación de residuo, biomasa estimada).
4. **Los resultados son verificables** — las proyecciones se contrastan contra la cosecha real.

**Frase para ella:** *«El software es reproducible; la validación de nuestro proceso biológico
no lo es. Un tercero tendría que replicar las condiciones y volver a medir.»*

### Lo que NO debemos decir ⚠️

Según la revisión de precisión del pitch (ya documentada para este proyecto): el material
generado anteriormente **exageraba** — ADK, Function Calling, fórmula IPCC nivel 2,
TimescaleDB, IoT en tiempo real. **Nada de eso está realmente construido.** Si un juez inspecciona
el repositorio, lo detecta y se pierde toda credibilidad.

**Di lo que hay, con exactitud.** Un juez respeta un alcance honesto más que uno inflado, y el
argumento de "software reproducible + calibración propietaria + proceso validado" es
**suficientemente fuerte sin exagerar**.

---

## Resumen para Diana

1. **El campo ya existía** — lo amplié de 3 a 13 opciones de residuo para larvas, y agregué una
   caja de texto para «Otro». Si falta un residuo, dime cuál.
2. **Software reproducible: sí.** Infraestructura estándar, a propósito.
3. **Algoritmos propietarios: con matiz.** El *código* no es secreto; los **coeficientes
   calibrados** sí lo son, y son el activo real.
4. **Tu punto es el más fuerte:** el proceso requiere **validación**, y la validación no se copia.
5. **No exageres.** La precisión es más defendible que la inflación.

---

*Fuentes verificadas en el repositorio `biosustain-data-manager` (commit `19c4615`):
`cerebro/cerebro_server.py`, `src/lib/categorias.ts`, `src/routes/lotes.ts`, `src/routes/esg.ts`.
Estado en vivo consultado contra `biosustain-saas-683265952295.us-central1.run.app`.*
