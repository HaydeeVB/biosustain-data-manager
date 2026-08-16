# BioSustain SaaS — Full Security Review (Claude, 2026-08-02)

## Summary
- **Critical:** 3 (SEC-BS-001, 002, 003)
- **High:** 6 (SEC-BS-004, 005, 006, 007, 008, 009)
- **Medium:** 9 (SEC-BS-010-018)
- **Low:** 8 (SEC-BS-019-026)
- **Total:** 26 findings
- **SQL injection:** None ✅
- **XSS:** None ✅
- **Tenant isolation (read paths):** Solid ✅
- **Tenant isolation (write paths):** Broken ❌

## Suggested fix order (from Claude)
1. SEC-BS-003 — .gitignore fix (1 line, exposure grows every commit)
2. SEC-BS-001 + SEC-BS-004 — IoT auth + tenant isolation (one exploit chain, live now)
3. SEC-BS-002 — JWT secret fallbacks (rotate + delete defaults)
4. SEC-BS-005 + SEC-BS-006 — Client-controlled pricing + broken password change (pre-demo)
5. SEC-BS-007+ — Normal cadence

## All findings

### Critical
- SEC-BS-001: IoT API key auth fails open (confirmed live)
- SEC-BS-002: Hardcoded fallback JWT secrets (two different ones)
- SEC-BS-003: .gitignore malformed, .env.production not ignored

### High
- SEC-BS-004: No tenant isolation on telemetry (any device → any bin)
- SEC-BS-005: Client controls unit price in hardware checkout
- SEC-BS-006: authenticateToken not mounted on /api/v1/auth (password change broken)
- SEC-BS-007: TLS cert verification disabled on DB connection
- SEC-BS-008: Rate limiting global on Cloud Run (no trust proxy)
- SEC-BS-009: Container runs as root, build failures swallowed

### Medium
- SEC-BS-010: NDA never enforced, in-memory only
- SEC-BS-011: JWT payload contract violated, no revocation, plan limits unenforced
- SEC-BS-012: Deactivated accounts can still log in
- SEC-BS-013: Unvalidated request bodies on profile/password
- SEC-BS-014: Audit logging gaps + unbounded memory
- SEC-BS-015: PDF generation leaks PII to /tmp via shell exec
- SEC-BS-016: JWT in localStorage, no CSP on dashboard
- SEC-BS-017: Cerebro bridge issues (no ownership, prompt injection, key-in-URL)
- SEC-BS-018: Fabricated ESG figures presented as audit-ready

### Low
- SEC-BS-019: lotes table has no migration, schema drift
- SEC-BS-020: Frontend Dockerfile copies entire tree, no .dockerignore
- SEC-BS-021: Telemetry limit parsing broken
- SEC-BS-022: CORS defaults to localhost, credentials unnecessary
- SEC-BS-023: Account enumeration, no lockout, no password reset
- SEC-BS-024: Test suite asserts against contracts code doesn't implement
- SEC-BS-025: Subscription state in memory while DB table unused
- SEC-BS-026: bcryptjs cost 10 (should be 12+ or argon2id)

## What came out clean
- All SQL queries use parameterized bindings — no injection
- Read-path tenant isolation well done (cestas, dashboard, lotes, reports filter by cliente_id from token)
- No XSS sinks in React (no dangerouslySetInnerHTML, no eval)
- Helmet on API, express.json limit 100kb
- Generic error handler, no stack trace leaks
- No secrets in frontend bundle