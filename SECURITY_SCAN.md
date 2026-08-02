# BioSustain SaaS — Security Scan Handoff

> **For:** Claude (or any AI agent performing security review)
> **Created:** 2026-08-02
> **Repo:** /root/biosustain-saas
> **Live:** https://biosustain-dashboard-683265952295.us-central1.run.app
> **API:** https://biosustain-saas-683265952295.us-central1.run.app

## What to scan

A full security review of the BioSustain SaaS platform — a multi-tenant
Node.js/Express backend with a Next.js dashboard frontend, deployed on
Google Cloud Run, backed by Cloud SQL PostgreSQL.

## Architecture

### Backend (Express + TypeScript)
- **Entry:** `src/server.ts` — Express app, Helmet, CORS, rate limiting, route wiring
- **Auth:** `src/routes/auth.ts` — JWT auth, bcrypt password hashing, register/login/me/password
- **DB:** `src/db.ts` — PostgreSQL connection pool (pg), individual env vars
- **Routes:**
  - `src/routes/cestas.ts` — multi-tenant cesta (bin) management
  - `src/routes/dashboard.ts` — dashboard summary endpoint
  - `src/routes/lotes.ts` — manual lot registration with auto-calculations
  - `src/routes/billing.ts` — subscription plans, mock payment gateway
  - `src/routes/reports.ts` — ESG report PDF generation
  - `src/routes/nda.ts` — click-wrap NDA acceptance
  - `src/routes/iot.ts` — ESP32 IoT data ingest
  - `src/routes/esg.ts` — ESG metrics endpoint
  - `src/routes/cerebro.ts` — bridge to Python model server
- **Middleware:**
  - `src/middleware/auth.ts` — JWT verification
  - `src/middleware/audit.ts` — audit logging + scraping detection
- **Utils:**
  - `src/utils/pdf.ts` — reportlab PDF generation (via child_process)
  - `src/gateways/mock-gateway.ts` — mock payment gateway

### Frontend (Next.js + TypeScript)
- **Entry:** `frontend/src/app/page.tsx` — single-page app (login + dashboard)
- **Video:** `frontend/src/app/VideoBackground.tsx` — looping video background
- **Styling:** `frontend/src/app/globals.css` — responsive CSS
- **Config:** `frontend/next.config.js` — standalone output, API URL env var
- **Public:** `frontend/public/videos/` — 3 AI-generated background videos

### Database (Cloud SQL PostgreSQL)
- **Schema:** `scripts/01_schema.sql` — tables: clientes, cestas, telemetria_cestas, audit_log, subscriptions, lotes
- **Seed:** `scripts/03_seed_demo.sql` — demo client + cestas + telemetry
- **Connection:** 34.42.215.160:5432, database `biosustain`, user `postgres`
- **Authorized networks:** 0.0.0.0/0 (open — needs tightening)

### Infrastructure (Google Cloud Run)
- **Project:** caramelo33 (683265952295)
- **Region:** us-central1
- **Services:** biosustain-saas (API, port 8080), biosustain-dashboard (port 3000)
- **Service account:** biosustain-deploy@caramelo33.iam.gserviceaccount.com (Owner)

## What to look for

### High priority
1. **SQL injection** — All DB queries use parameterized queries via `pg`, but verify every `$1`, `$2` binding. Check for any string concatenation in SQL.
2. **Auth bypass** — Verify JWT middleware is applied to all protected routes. Check for routes missing `authenticateToken`.
3. **Tenant isolation** — Every query must filter by `cliente_id` from the JWT. Check for endpoints that might leak data across tenants.
4. **Path traversal** — `src/utils/pdf.ts` uses `child_process` for reportlab. Verify no user input reaches file paths or shell commands.
5. **Secrets exposure** — Verify no secrets, tokens, or passwords are committed. Check `.env.production` is gitignored. Check frontend doesn't leak API keys.

### Medium priority
6. **Input validation** — Check all route handlers validate input (Zod schemas or manual). Look for missing validation on body params.
7. **Rate limiting** — Verify rate limiting is configured and sufficient. Check the audit middleware's scraping detection thresholds.
8. **CORS** — Verify CORS is restricted to the dashboard URL, not wildcard.
9. **JWT security** — Check token expiration, secret strength, and refresh mechanism.
10. **NDA enforcement** — Verify the click-wrap NDA actually blocks access until accepted.

### Low priority
11. **Dependency vulnerabilities** — Check `package.json` for known CVEs.
12. **Docker security** — Check Dockerfiles for running as root, missing USER directive, etc.
13. **Cloud SQL exposure** — 0.0.0.0/0 authorized network is too open for production.
14. **Audit log completeness** — Verify all state-changing operations are logged.

## Known issues (already aware)
- `0.0.0.0/0` on Cloud SQL — needed for demo, will tighten before production
- Mock payment gateway — no real payment processing (MercadoPago blocked in Venezuela)
- Cerebro server not yet deployed (Python model server)
- No HTTPS on Cloud SQL connection (using public IP, not Cloud SQL Proxy)
- `.env.production` has real DB password (Momo_321) — gitignored but exists locally

## How to run tests

```bash
cd /root/biosustain-saas
NODE_ENV=test npx jest --verbose --forceExit
```

## How to run lint

```bash
cd /root/biosustain-saas
npx tsc --noEmit
```

## Output format

For each finding, provide:
- **ID:** SEC-BS-NNN
- **Severity:** Critical / High / Medium / Low
- **File:** path:line
- **Description:** What's wrong
- **Impact:** What could happen
- **Fix:** Specific code change needed
- **Acceptance criteria:** How to verify the fix