# BioSustain SaaS — Codebase Handoff for Security Review

## You're reviewing a live production deployment.

**Dashboard:** https://biosustain-dashboard-683265952295.us-central1.run.app
**API:** https://biosustain-saas-683265952295.us-central1.run.app
**GitHub:** https://github.com/HaydeeVB/biosustain-data-manager/tree/saas-platform
**Local repo:** `/root/biosustain-saas`

## What this is

Multi-tenant SaaS platform for BioSustain Research Lab — a bioconversion company using black soldier fly larvae to convert organic waste into biofertilizer. Built for the XPRIZE "Build with Gemini" competition. Deployed on Google Cloud Run with Cloud SQL PostgreSQL.

## Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL (pg), JWT auth, bcrypt, Helmet, Zod validation
- **Frontend:** Next.js, TypeScript, inline styles (no Tailwind), AI-generated video background
- **DB:** Cloud SQL PostgreSQL @ 34.42.215.160:5432 (database: biosustain, user: postgres)
- **Infra:** Google Cloud Run (project: caramelo33, region: us-central1)
- **Deployed via:** gcloud CLI with service account `biosustain-deploy@caramelo33.iam.gserviceaccount.com`

## Key files

```
src/
  server.ts          — Express app entry, middleware, route wiring
  db.ts              — PostgreSQL connection pool
  routes/
    auth.ts          — register, login, GET/PATCH /me, POST /password
    cestas.ts        — multi-tenant bin management
    dashboard.ts     — dashboard summary
    lotes.ts         — manual lot registration + auto-calculations
    billing.ts       — subscription plans + mock payment gateway
    reports.ts       — ESG report PDF export
    nda.ts           — click-wrap NDA
    iot.ts           — ESP32 data ingest
    esg.ts           — ESG metrics
    cerebro.ts       — bridge to Python model server
  middleware/
    auth.ts          — JWT verification
    audit.ts         — audit logging + scraping detection
  utils/
    pdf.ts           — reportlab PDF generation via child_process
  gateways/
    mock-gateway.ts  — mock payment gateway
frontend/
  src/app/page.tsx           — full dashboard SPA (login + dashboard)
  src/app/VideoBackground.tsx — looping video background
  src/app/globals.css        — responsive CSS
scripts/
  01_schema.sql      — DB schema (clientes, cestas, telemetria_cestas, lotes, audit_log, subscriptions)
  03_seed_demo.sql   — demo data
Dockerfile           — Node 20-slim + python3 + reportlab
```

## What to do

1. **Read `SECURITY_SCAN.md`** in the repo root — it has the full scan scope, priorities, and output format.
2. **Clone the branch:** `git clone -b saas-platform https://github.com/HaydeeVB/biosustain-data-manager.git`
3. **Run tests:** `NODE_ENV=test npx jest --verbose --forceExit`
4. **Type check:** `npx tsc --noEmit`
5. **Review every route handler** for: SQL injection, missing auth, tenant isolation gaps, input validation
6. **Check the frontend** for: XSS, exposed secrets, insecure API calls
7. **Check infra:** Dockerfile security, CORS config, Cloud SQL exposure (0.0.0.0/0)

## Output format

For each finding:
- **ID:** SEC-BS-NNN
- **Severity:** Critical / High / Medium / Low
- **File:** path:line
- **Description:** What's wrong
- **Impact:** What could happen
- **Fix:** Specific code change
- **Acceptance:** How to verify

## Known issues (don't waste time on these)

- Cloud SQL authorized networks set to 0.0.0.0/0 (needed for demo, will tighten)
- Mock payment gateway (MercadoPago blocked in Venezuela)
- Cerebro Python server not yet deployed
- `.env.production` has real DB password locally (gitignored, not in repo)

## Rules

- **Do NOT commit or push** — only report findings
- **Do NOT deploy** — this is a read-only review
- **Do NOT modify files** — describe fixes, don't apply them
- All output in English
- Be thorough — this is going to an XPRIZE competition

## Credentials (if needed for testing)

- **Demo login:** demo@biosustain.com / biosustain2026
- **DB:** postgres / Momo_321 @ 34.42.215.160:5432/biosustain
- **Portal API key:** in `/root/.hermes/.env` as PORTAL_API_KEY