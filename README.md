# BioSustain: Plataforma SaaS de Bioconversión

Plataforma SaaS para el monitoreo y gestión de operaciones de bioconversión de residuos orgánicos, con motor de categorías (Plantas/Ganado/Larvas BSF), cálculo de impacto ambiental (CO₂e y metano evitado) y reportes ESG.

**Desarrollado para el desafío global Build with Gemini XPRIZE.**

---

## Qué hace

- **Motor de 3 categorías de bioconversión** — Plantas/Vegetal, Ganadería/Estercolero, y Larvas BSF (mosca soldado negra), cada una con sus residuos, unidades, parámetros monitoreados y factores ESG propios.
- **Cálculo de impacto ambiental** — CO₂e reducido y metano evitado por lote, según factores por categoría alineados a metodología IPCC.
- **Reportes ESG** — métricas de residuos reconvertidos, frass estimado, CO₂e reducido y metano evitado, exportables a PDF (estimaciones preliminares, no certificación de terceros).
- **Registro de lotes** — entrada manual de residuos orgánicos con proyecciones automáticas de biomasa, cosecha y frass.
- **Suscripciones y pagos** — planes Básico/Pro/Enterprise con pago en **USDT (Binance Pay)** o **Bolívares (Pago Móvil / UbiApp)** con tasa BCV oficial automática.
- **Dashboard en tiempo real** — monitoreo de cestas (temperatura, humedad), eficiencia del sistema y alertas.

## Arquitectura

- **Backend:** Node.js + TypeScript + Express, API REST en `/api/v1`.
- **Base de datos:** PostgreSQL (Google Cloud SQL).
- **Frontend:** Next.js (App Router), dashboard dark-mode con identidad verde.
- **Despliegue:** Google Cloud Run (serverless), contenedores Docker.
- **Pagos:** adaptadores intercambiables (USDT, VES/Pago Móvil, Zinli, Stripe, mock) vía una interfaz común `IPaymentGateway`.

```
Cliente (Next.js) → API REST (Express) → PostgreSQL (Cloud SQL)
                        └── Gateways de pago (USDT / VES / Stripe)
```

## Estructura del repositorio

```
src/
  routes/        # API REST (auth, billing, lotes, cestas, esg, reports, iot, nda)
  gateways/      # Adaptadores de pago (usdt, ves, zinli, stripe, mock)
  lib/           # Motor de categorías (categorias.ts)
  middleware/    # Auth + auditoría
  utils/         # Generación de PDF (reportlab)
  db.ts          # Conexión PostgreSQL
frontend/
  src/app/       # Dashboard Next.js (page.tsx, VideoBackground, components/ui)
  public/videos/ # Videos de fondo del login
scripts/         # Esquema SQL + seed demo
Dockerfile       # Backend (Cloud Run)
frontend/Dockerfile  # Frontend (Cloud Run)
```

## Cómo ejecutar

```bash
# Backend
npm install
cp .env.example .env   # llenar credenciales
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Pruebas

Los tests corren contra una base PostgreSQL real (`biosustain_test`), no en memoria: así las
consultas SQL se ejercitan de verdad. **Nunca** contra producción — `src/__tests__/setup-env.ts`
aborta si el nombre de la base no termina en `_test`.

```bash
# una vez (y de nuevo cuando cambie el esquema)
psql -c "CREATE DATABASE biosustain_test;"
psql -d biosustain_test -f scripts/05_test_db.sql

npm test
```

`setup-env.ts` también ignora cualquier `DATABASE_URL` heredada del entorno. Eso no era
cosmético: con una `DATABASE_URL` vieja apuntando a otra base, 19 de 26 tests fallaban con
`relation "clientes" does not exist` y parecía que el código estaba roto.

## Equipo (BioSustain Research Lab)

- **Haydee Zulay Viteri Bernal** — CEO & Fundadora, Estrategia
- **Wiston Ricardo Viteri Bernal** — Lead Technical & Research
- **Sharon Guillen** — Strategy & UX
- **Diana Paola Contreras Sanchez** — Lab & Production Data

## Colaboración técnica

- **Franklin J. Bryant IV** — Prospyr 305 / ALBS — Arquitectura de sistemas de IA, backend SaaS, despliegue en Google Cloud Run, motor de categorías, integración de pagos (USDT/VES) y seguridad.

---

*Desarrollado bajo estándares de grado industrial para el desafío global Build with Gemini XPRIZE.*
