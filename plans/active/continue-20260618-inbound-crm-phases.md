# CONTINUATION — Inbound-Call CRM (resume here)

**Updated:** 2026-06-18 (session 3 — Phase 3 screen-pop UI). **Branch:** `feat/inbound-crm-phase3` (PR #24).
Deep record: `memory/project_inbound_crm_phase0_build_20260617.md`.

---

## WHERE WE ARE NOW (Phase 3 = the inbound screen-pop INTAKE)
The full-screen client INTAKE that takes over the agent's screen on an inbound call is **built, verified,
and committed LOCALLY** as `b3cabe8d` on `feat/inbound-crm-phase3`. **NOT pushed** — held for owner design
sign-off (the look was rejected 3× before this redesign).

### What `b3cabe8d` contains
- **`src/features/inbound-crm/components/InboundCallModal.tsx`** — rewritten. Full-screen, mounted in
  `App.tsx` inside the authed shell (inherits `.theme-v2`). Layout:
  - PINNED header: caller name + sub-line + status badge (Existing N policies / New caller — now consistent) +
    Close + Save intake.
  - ALWAYS-VISIBLE left **context rail** (360px): Caller card, 3-up stat strip (Policies/Active/Premium),
    Existing Policies (tinted status), Recent Calls history. This is what makes it data-dense (anchored to the
    Policies page) and kills the old bottom-void.
  - RIGHT: 3-tab form **Client · Call Details · Health** (user asked for tabs). Panels **stretch to fill height**
    (`xl:[grid-template-rows:auto_1fr]` / `h-full`) → no vertical scroll within a tab, no bottom void.
- **`src/features/inbound-crm/hooks/useInboundCallIntake.ts`** — `useInboundClientRecord` (now also hydrates
  `clients.intake` jsonb), `useInboundCallHistory` (recent inbound_calls, nulls-last), `useSaveInboundIntake`
  (clientService.update + `crm_set_client_intake` + `crm_set_call_disposition` in one mutation).
- **`src/services/clients/client/ClientService.ts`** — FIX: `getWithPolicies` selected `carriers.logo_url`
  which **does not exist** (Postgres 42703) → it 400'd and silently dropped the client record (name/policies
  never bound). Now `carrier:carriers(id, name)`. NOTE: `getWithPolicies` is consumed ONLY by the inbound
  intake (the deprecated `getClientWithPolicies` wrapper has no callers) → this was harmless until now, NOT a
  live prod-page bug.
- **`scripts/crm-fire-test-call.sh`** — richer demo seed: client is now **Maria Sanchez** (named, DOB, email,
  address) + 2 policies (Aflac whole_life active, term_life lapsed) + 1 prior ENDED call, so the rail shows
  real data. Best-effort/exception-wrapped so a seed failure never aborts the fire.

### New migration (LOCAL ONLY — bundle at go-live)
- `supabase/migrations/20260618185726_inbound_crm_client_intake.sql` — `clients.intake jsonb` +
  `crm_set_client_intake(p_client_id, p_intake)` SECURITY DEFINER (scoped to `clients.user_id = auth.uid()`),
  REVOKE from PUBLIC/anon, GRANT authenticated. Applied LOCAL; NOT on prod.

### Verified this session (LOCAL, real authed browser via Playwright + DB read-back)
- typecheck 0, build green.
- Name/DOB/address/policies/recent-calls all **bind** (was the `logo_url` bug).
- DOB UTC off-by-one fixed (local-date parse).
- **Both save paths persist**: intake → `clients.intake` (15 keys incl. title + reasonForCalling);
  disposition → `inbound_calls` (call_type="Cash Out", carrier="Aflac", notes) via the real dropdowns + Notes
  field. Dropdowns populated (3 call types, 9 carriers for the imo) + render on-brand.
- Screenshots: `/tmp/intake-v5-{client,call,health}.png`, `/tmp/dispo-dropdown.png`.

### Demo it
`bash scripts/crm-fire-test-call.sh` (log in as `epiclife.neessen@gmail.com` first) → Maria Sanchez pop.
Clean leftover ringing rows:
`./scripts/migrations/run-sql.sh "DELETE FROM inbound_calls ic USING clients c WHERE ic.client_id=c.id AND c.phone_e164=public.normalize_phone_e164('555-867-5309') AND ic.status='ringing';"`
(NOTE: local Supabase/Docker had stopped mid-session; if `run-sql.sh` says connection refused, `open -a Docker`
then `npx supabase start`.)

---

## OPEN DECISION (awaiting owner)
Right-side tab panels **stretch to fill** the height. The data-rich ones (Notes, Address, Health Details) look
great; the SPARSE ones (esp. "Birthplace & Tobacco" = 2 fields in a full-height bordered box) carry interior
whitespace. Owner to rule: **stretch-to-fill** vs **natural height** (top-aligned, accept some bottom gap).

## NEXT (do NOT start until owner signs off on the look)
1. Push `b3cabe8d` to PR #24 once approved.
2. **Task #13 (remaining): Capture-New-Policy** — reuse `usePolicyForm` + `transformFormToCreateData(form,
   clientId, userId)` + `useCreatePolicy` with `status:'pending'` (mirror `PolicyDashboard.onSave`). Confirm
   pending policies/commissions are EXCLUDED from earned-production dashboards.
3. **Task #14: Clients page** — sidebar nav (`sidebar-nav.config.ts`, business group, UserCircle) + `/clients`
   & `/clients/$clientId` routes (RouteGuard noRecruits noStaffRoles) + own-book list + detail (reuse
   getWithPolicies + per-client inbound_calls history). Factor a shared `ClientRecord`.
4. **Banking/SSN** section — deferred (needs encrypted storage + access-gating).

---

## GO-LIVE (unchanged; only when owner says go — no staging exists)
0. Apply the **three** LOCAL-only inbound migrations to PROD in order, bundled with go-live:
   `20260618093314_…phase5_hardening` → `20260618132257_…phase3_disposition` → `20260618185726_…client_intake`.
1. Deploy edge fns `crm-oauth-token crm-leads`; add `[functions.*]` blocks with `verify_jwt=false`.
   🔴 COUPLED: add a coarse **IP rate-limit at the gateway** in the SAME change as `verify_jwt=false` on
   `crm-oauth-token` (unauth bcrypt cost-12 in shared Postgres = all-tenant DoS; app limiter fails open).
2. Secrets (prod): `CRM_CALL_PLATFORM_SIGNING_KEY`, `CRM_INSTANCE_URL` (both fail-closed if unset).
3. Issue first Epic Life credential (super-admin) → hand platform client_id + one-time secret + URLs.
4. `database.types.ts` regen (needs `SUPABASE_ACCESS_TOKEN`, not in `.env`) — separate chore commit, when
   frontend consumes the inbound tables.

## Carry-forward gotchas
- `REMOTE_DATABASE_URL` in `.env` is UNEXPORTED — `source .env` then prefix `DATABASE_URL="$REMOTE" ./scripts/…`;
  confirm `Target DB: REMOTE` before any prod op.
- Supabase grant rule: `REVOKE FROM PUBLIC` is insufficient — also `REVOKE FROM anon, authenticated`.
- NEVER change the user's local login (`epiclife.neessen@gmail.com`) for any reason.
- Untracked at repo root: `carrier_product_named.csv` (NOT created by me — leave it; flag to owner) +
  `docs/inbound-lead-feature/client-info-screenshots-dashboard/` (the Salesforce reference screenshots).
