# BioSustain — Changelog / Version Log

Tracking platform changes by version until we reach Beta and eventually v1.0.
Convention: **Alpha vX.Y.Z** → Beta → v1.0. Generated 2026-08-12.

## Alpha v0.0.1 — Baseline (2026-08-12)
Current platform state as of this version log:
- **Domain live:** `biosustainlab.com` (Hosted on GCP Cloud Run, SSL active)
- **Categories (3)** with per-category metrics + ESG factors:
  - 🌱 Plantas/Vegetal — N, P, K, Humedad sustrato, pH
  - 🐄 Ganadería/Estercolero — Temp fermentación, Humedad, CO2, CH4
  - 🪲 Larvas/BSF — Temperatura, Humedad sustrato, Densidad, FCR
- **Payments (live):**
  - USDT (Binance Pay, ID 1161600712) — primary
  - Bolívares / Pago Móvil (UbiApp, Bancco Venezolano de Crédito 0104) — dual-rate, +3 USD buffer
  - BCV rate auto-fetched live at charge time
  - Manual reference-validation flow (operator confirms → activates)
- **Billing UI:** payment-method selector (USDT/VES), reference-confirm field, correct active/pending/upgrade state display
- **Rebrand:** "BioSustain — bioconversión inteligente y sostenible" (removed regional "Sur del Lago")
- **Backend:** multi-tenant Express/TypeScript, PostgreSQL (Cloud SQL), 106-test motor baseline elsewhere
- **Auth:** register/login/profile/password, demo account
- **ESG:** report generation (PDF) with IPCC methodology; dashboard with public stats

## Roadmap
- **Beta:** payment automation (requires registered legal entity for Binance Pay merchant + UbiApp merchant API)
- **v1.0:** stable automated payments, mobile webview app (Play Store), expanded integrations

---
*Document ID: CHANGELOG-BIOSUSTAIN · Maintained by Prospyr Prime*
