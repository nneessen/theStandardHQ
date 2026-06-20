# CRM inbound-call — GO-LIVE RUNBOOK

**Updated:** 2026-06-20 · **Prod project:** `pcyaqwodnyrpkaiojnpz` ("The Standard HQ")
**Branch:** `sec/crm-oauth-dos-ratelimit` (commit `61a44cdf` + this runbook + the GC migration)

---

## DONE (already on prod)
- ✅ Fail-closed DoS rate-limit on `crm-oauth-token` — built, 12 Deno tests, **opus security-auditor → SHIP**.
- ✅ `crm-oauth-token` + `crm-leads` **deployed to prod INERT** (`--no-verify-jwt` — CLI 2.23.4 ignores the
  per-fn `config.toml`, so the flag is REQUIRED on every deploy). Verified live: bogus creds → 401
  `invalid_client`; burst → 10×401 then 429 + `Retry-After` (gate fires before bcrypt); `crm-leads` → 401
  `invalid_token`. No credentials exist → nobody can authenticate.

## REMAINING (do ALL before real traffic — owner chose "deploy fns, hold NetTrio creds")

### 1. Gateway/WAF IP limit (the auditor's residual — the reason creds are held)
The in-function limiter closes the bcrypt CPU-DoS but a pure volumetric flood still spins an isolate +
a cheap `rate_limits` write per request. Put a coarse IP limit IN FRONT. NetTrio reaches the functions
through **Vercel rewrites** (`/oauth/token`, `/api/v1/leads` proxy to the supabase fns), so traffic flows
*through Vercel* — a **Vercel Firewall** rate-limit rule is the right layer (Pro/Enterprise feature):
- Vercel Dashboard → Project → **Firewall** → Rate Limiting:
  - `path = /oauth/token` → ~**10 req / 60s / IP** (token mints are ~1/day per client; be tight).
  - `path = /api/v1/leads` → ~**100 req / 60s / IP** (per-call lookups; looser).
- **Tell NetTrio to use the APP ORIGIN for BOTH endpoints** (`https://<app>/oauth/token` and
  `https://<app>/api/v1/leads`) — NOT the raw `*.supabase.co` URL — or the Vercel limit is bypassed.
- (Alternative if the domain is fronted by Cloudflare: a CF rate-limit rule on the same paths.)

### 2. Set the two prod secrets (BOTH — the handler fails closed without `CRM_INSTANCE_URL`)
Values are stashed in `.env` (gitignored): `CRM_CALL_PLATFORM_SIGNING_KEY` (real, generated 2026-06-20)
and `CRM_INSTANCE_URL` (**placeholder — edit `.env` first** to the prod app origin, e.g.
`https://app.thestandardhq.com`; this is what NetTrio prepends to `/api/v1/leads`).
```bash
cd <repo>
# 1) edit CRM_INSTANCE_URL in .env to the real app origin, then:
set -a; source .env; set +a
supabase secrets set CRM_CALL_PLATFORM_SIGNING_KEY="$CRM_CALL_PLATFORM_SIGNING_KEY" --project-ref pcyaqwodnyrpkaiojnpz
supabase secrets set CRM_INSTANCE_URL="$CRM_INSTANCE_URL" --project-ref pcyaqwodnyrpkaiojnpz
supabase secrets list --project-ref pcyaqwodnyrpkaiojnpz   # confirm both present
```
(No fn redeploy needed — edge secrets are read at runtime.)

### 3. Issue NetTrio's credential (super-admin-gated; secret shown ONCE)
`crm_issue_credential(p_imo_id, p_label, p_scopes)` requires a super-admin JWT, so impersonate one in a
prod psql tx. Epic Life `imo_id = 89514211-f2bd-4440-9527-90a472c5e622`; super-admin uid
`d0d3edea-af6d-4990-80b8-1765ba829896` (nickneessen@thestandardhq.com). Scope `crm:leads` (the only one;
not yet enforced). Put this in `issue-cred.sql`:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"d0d3edea-af6d-4990-80b8-1765ba829896","role":"authenticated"}', true);
SELECT * FROM public.crm_issue_credential(
  '89514211-f2bd-4440-9527-90a472c5e622', 'NetTrio', ARRAY['crm:leads']);
COMMIT;
```
```bash
set -a; source .env; set +a
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f issue-cred.sql
```
**Capture `client_id` + `client_secret` from the output — the secret is bcrypt-hashed and never shown
again. Hand BOTH to NetTrio over a secure channel, then delete `issue-cred.sql`.** (Lost secret →
`crm_rotate_credential(credential_id)`.)

### 4. Apply the `rate_limits` GC cron migration (auditor follow-up; already written)
```bash
set -a; source .env; set +a
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh \
  supabase/migrations/20260620135826_rate_limits_gc_cron.sql
```
(Safe to apply now even before go-live — it only GCs `rate_limits` rows older than 2 days.)

### 5. Final live smoke (with the real credential)
```bash
# token mint via the APP ORIGIN (proves Vercel rewrite + secrets + mint)
curl -s -X POST https://<app-origin>/oauth/token \
  -d "grant_type=client_credentials&client_id=<from step 3>&client_secret=<from step 3>"
#   → 200 { access_token, instance_url, ... }
# then GET /api/v1/leads?ani=+1... with  Authorization: Bearer <access_token>  → 200/204
# and confirm a real inbound call fires a screen-pop to a test agent.
```

## Also: merge the branch to main
Prod runs code that's only on `sec/crm-oauth-dos-ratelimit` — a future deploy *from main* would regress
the gate. The branch is conflict-free with `origin/main` (main advanced 2 commits, none touching these
files). Merge via PR: https://github.com/nneessen/theStandardHQ/pull/new/sec/crm-oauth-dos-ratelimit
