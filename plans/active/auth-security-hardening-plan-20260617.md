# Auth & Security Hardening — Comprehensive Plan

> **Status:** Planning only — nothing here is implemented. For owner review after the meeting; we decide then what (if anything) to build.
> **Date:** 2026-06-17
> **Researched against:** account-creation paths, existing auth/security RPCs + RLS, repository/service/types layer, and scalability.

---

## 1. Context & scope

A security review of the current auth system found a small number of real issues. This plan covers the **permanent fixes and broader hardening**, designed to **reuse existing primitives** (RPCs, triggers, RLS helpers) and stay scalable.

**Already resolved (not re-planned):**
- 🟠 **Self-promote-to-admin** — FIXED + deployed to prod (`20260617064225_guard_user_profiles_admin_columns.sql`): the guard trigger now pins `is_admin` + `approval_status` on self-edits. Verified live (rolled-back attack test).
- 🔴 **Open public signup** — MITIGATED: owner turned off Supabase `disable_signup`. The public self-signup endpoint is closed, neutralizing the live attack vector.

**This plan (priority order):**
| Pri | Item | Risk to ship | Note |
|---|---|---|---|
| **P0** | Permanent backstop for signup metadata-injection (`handle_new_user`) | Medium (touches creation path) | Prerequisite for ever re-enabling signup |
| **P1** | Least-privilege on `user_profiles` privileged columns | **High** (can break ordinary profile saves) | The migrations' own stated follow-up |
| **P2** | Password-reset account enumeration + rate-limit | Low | |
| **P3** | Remove world-writable leftover `test_workflows_real` | Low | Verify it exists on prod first |
| **P4** | `ApprovalGuard` hardcoded bypass email | Low (cosmetic; RLS is the real gate) | |
| **P5** | MFA / 2FA for privileged accounts | Medium (rollout lockout) | Net-new, larger |

---

## 2. Current auth architecture (baseline)

- **Login:** email + password via Supabase GoTrue; passwords hashed by Supabase. JWT (~1h) + refresh token in `localStorage`. `is_access_revoked()` checked at login; `SunsetGate` + RLS sentinel back it up.
- **Account creation:** invite-only — `create-auth-user` (admin "Add User/Agent") and `complete-recruit-registration` (recruit invite), both service-role `auth.admin.createUser`. Public `signUp()` exists in `AuthContext` but is **unused legacy** and signup is now disabled.
- **Tenant isolation:** Postgres RLS keyed on `get_my_imo_id()`; single live IMO (Epic Life).
- **No MFA.**

---

## 3. Findings by layer

### 3a. Account-creation paths (the P0 core)
Every creation path converges on **`handle_new_user`** (`20260522080218`, AFTER INSERT on `auth.users`, `SECURITY DEFINER`, `SET LOCAL row_security=off`). It copies `roles` (`raw_user_meta_data->'roles'`, default `['agent']`) and `imo_id`/`agency_id`/`recruiter_id`/`upline_id` from **`user_metadata`** verbatim, hardcodes `is_admin=false` (and omits `is_super_admin` → false), and inserts the `user_profiles` row.

- **Both legitimate creators pass `roles`/`imo_id` via `user_metadata`** — `create-auth-user` (~L851) and `complete-recruit-registration` (~L286) — the **same field a public `signUp()` writes**. So there is **no trigger-only way** to distinguish a trusted admin-create from a malicious signup today.
- **The one reliable trust boundary is `app_metadata` (`raw_app_meta_data`)**: only the service-role Admin API can set it; public `supabase.auth.signUp` **cannot**. No edge function sets it today → adopting it is small but net-new.
- **`enforce_user_profile_imo_consistency`** (BEFORE on `user_profiles`) safely derives `imo_id` (agency → recruiter → upline → caller → Founders fallback) — so **nulling `imo_id` at signup does not break creation.**
- **Legacy `submit_recruit_registration` RPC** has an old direct-`INSERT` path that bypasses the trigger; its `imo_id` comes from the inviter (DB-derived, not attacker-controlled) — lower risk, audit/deprecate.

### 3b. Existing auth/security RPC + RLS building blocks (REUSE — don't reinvent)
- **Role/authority predicates that read columns an attacker could set:** `is_super_admin()` (reads `is_super_admin` col), `is_admin()` (reads `is_admin` col), **`is_imo_admin()` (reads the free-form `roles` array — `roles && ARRAY['admin','imo_admin','superadmin']`)**. ⚠️ **This is the live escalation route:** injected `roles:['imo_admin']` ⇒ `is_imo_admin()=true` everywhere. The fix is to protect the *columns/roles* at creation, not change these helpers.
- **Tenancy chokepoints:** `get_my_imo_id()` → `get_effective_imo_id()` (NULL = super-admin "see-all"; revoked → sentinel UUID). Used by ~135+ RLS policies. Reuse as-is.
- **Acting-scope guards (the existing privileged-write pattern to mirror):** `assert_in_acting_scope(target_imo)` raises `42501` on cross-IMO while acting; called at the top of write RPCs **`admin_set_admin_role`, `admin_approve_user`, `admin_deny_user`, `hard_delete_user`, `update_user_metadata`**, etc. `row_in_acting_scope()` / `super_admin_in_scope()` for reads.
- **`guard_user_profile_privileged_columns`** (`20260617064225`): BEFORE INSERT/UPDATE; branch (a) **`auth.uid() IS NULL` → pass-through** (service-role/signup), (b) super-admin → anything, (c) non-super INSERT → pin `is_super_admin`/`is_admin` false, self-edit UPDATE → pin `roles`/`imo_id`/`agency_id`/`is_admin`/`approval_status`. **Caveat that shapes P0:** because a public-signup `user_profiles` INSERT runs with `auth.uid()=NULL`, it hits branch (a) pass-through — so the guard trigger *cannot* gate signup. The signup fix must live in `handle_new_user`, keyed on `app_metadata`.
- **`user_profiles_update_own`** RLS is **row-scoped only** (`auth.uid()=id`), no column restriction — which is why the guard trigger exists and why column GRANTs are the real least-privilege lever.

### 3c. Repository / service / hooks / types impact
- **Legit mutation surface today:** `src/services/users/` (`UserService.ts`, `UserRepository.ts`, `userSearchService.ts`), `src/features/admin/components/EditUserDialog.tsx`, and the `admin_*` SECURITY DEFINER RPCs. Auth consumption: `AuthContext.tsx`, route guards (`RouteGuard`/`ProtectedRoute`/`ApprovalGuard`/`SunsetGate`), `usePermissionCheck`.
- **Client code that references privileged columns** (must be audited before any column-grant revoke — P1): `AuthContext.tsx`, `features/settings/components/UserProfile.tsx`, `features/admin/components/EditUserDialog.tsx`, `services/agency/AgencyService.ts` + `AgencyRepository.ts`, `services/imo/ImoService.ts`, `services/permissions/PermissionRepository.ts`, `services/recruiting/recruitingService.ts` (+ `pipelineAutomationService`, `brandingSettingsService`), `features/recruiting/pages/MyRecruitingPipeline.tsx`. *(Heuristic match — each needs per-file confirmation of whether it actually `.update()`s a privileged column vs. reads it.)*
- **`database.types.ts`:** `user_profiles` carries `is_admin: boolean`, `is_super_admin: boolean | null`, `roles`, `approval_status: string`, `imo_id`, `agency_id`. **Trigger/grant changes do NOT change generated types; new RPCs/columns DO** → regen `database.types.ts` only when P1's new RPCs land.

### 3d. Remaining items + scalability
- **MFA:** none anywhere (`grep` for mfa/aal/totp/factor = 0). Supabase TOTP is platform-supported but unbuilt.
- **Password reset:** `send-password-reset` returns a verbose `404` ("No auth account found for {email}… exists in user_profiles but NOT in auth.users…") → **account enumeration + internal-detail leak**; **no rate-limiting** (the `check_rate_limit` RPC exists and is service-role-callable).
- **`test_workflows_real`:** **CONFIRMED world-writable on prod** (live query: `rowsecurity=f`, full `INSERT/SELECT/UPDATE/DELETE/TRUNCATE` to **`anon` + `authenticated`**) and **not in any migration** (created ad-hoc). Drop it (test data only). `rate_limits` (the other no-RLS table) is correctly locked to `service_role` — **confirmed non-finding.**
- **`ApprovalGuard.tsx` L38–54:** hardcoded `ADMIN_EMAIL='nickneessen@thestandardhq.com'` bypass (client-side only; server RLS is the real gate).
- **Scalability (good news):** `is_super_admin`/`is_admin`/`get_my_imo_id` are `STABLE SECURITY DEFINER`, O(1) PK lookups on `user_profiles(id)`; `imo_id` is indexed; the `(select auth.uid())` per-query optimization was applied to 596 policies (`20260217123227`). **No scaling concern at current scale.**

---

## 4. P0 — Signup metadata-injection permanent backstop  *(the main item)*

**Goal:** make account creation safe even if `disable_signup` is ever turned back on, without breaking the two real admin creation paths.

**Design (app_metadata trust marker — the only unforgeable signal):**
1. **Edge functions stamp the marker.** In `create-auth-user` (~L851) and `complete-recruit-registration` (~L286), add to the `auth.admin.createUser({...})` call:
   `app_metadata: { provisioned_by_admin: true }` (alongside the existing `user_metadata`). *(Service-role only — a public `signUp` physically cannot set this.)*
2. **`handle_new_user` honors metadata only when the marker is present.** New migration recreating the function so that:
   - If `NEW.raw_app_meta_data->>'provisioned_by_admin' = 'true'` → behave exactly as today (honor `roles`/`imo_id`/`agency_id`/`recruiter_id`/`upline_id` from `user_metadata`).
   - Else (untrusted / public signup) → **neuter, don't reject:** `v_roles := ARRAY['agent']` (non-privileged default), `v_imo_id := NULL` (let `enforce_user_profile_imo_consistency` derive it). Keep `is_admin=false`; never read `is_super_admin` from metadata.
   - **Graceful neuter, not a hard `RAISE`** — a path that ever forgets the marker degrades to a safe agent account rather than failing creation outright.

**Rejected alternative (and why):** extending `guard_user_profile_privileged_columns` branch (c) to pin `roles`/`imo_id` on INSERT **does not work** — a public-signup `user_profiles` INSERT runs with `auth.uid()=NULL`, hitting the guard's branch (a) *pass-through*. The signup constraint can only live in `handle_new_user`, gated on `app_metadata`. (Do **not** tighten branch (a) — it's load-bearing for service-role/seeds/cron.)

**Creation-path safety matrix (post-fix):**
| Path | Sets `app_metadata` marker? | Result |
|---|---|---|
| `create-auth-user` (admin) | yes (after change) | roles/imo honored — unchanged |
| `complete-recruit-registration` (invite) | yes (after change) | recruit role + inviter imo honored — unchanged |
| Public `signUp()` (legacy, disabled) | **no (cannot)** | neutered → `roles=['agent']`, imo derived |
| `submit_recruit_registration` legacy direct-INSERT | n/a (bypasses trigger; imo from inviter) | safe; audit/deprecate separately |
| Seeds / cron / direct service-role INSERT | n/a (auth.uid()=NULL, not via signup) | unaffected |

**Deploy ordering (CRITICAL — get this wrong and admin creates silently get wrong roles/imo):**
1. **Verify assumptions first** (see below).
2. **Deploy the two edge functions first** (`supabase functions deploy create-auth-user complete-recruit-registration`) — they start stamping the marker; the *old* trigger ignores it (still works).
3. **Then** apply the `handle_new_user` migration (via `./scripts/migrations/run-migration.sh`). Now admin creates carry the marker → honored; signups → neutered.
4. **Rollback:** re-apply the prior `handle_new_user` (the runner blocks downgrades, so ship as a new timestamped migration that restores prior behavior if needed).

**Assumptions to verify BEFORE building (cheap, do first):**
- `auth.admin.createUser({ app_metadata })` lands in `auth.users.raw_app_meta_data` **and is readable as `NEW.raw_app_meta_data` inside the AFTER-INSERT `handle_new_user` trigger.** ⚠️ **Biggest risk:** if GoTrue writes `app_metadata` in a *separate UPDATE after* the INSERT (known behavior in some versions), `NEW.raw_app_meta_data` is **NULL** in the AFTER-INSERT trigger → **every admin-created user silently degrades to a neutered agent.** Gate test: create a user with `{app_metadata:{provisioned_by_admin:true}}` on local/staging with a temporary `RAISE LOG 'aam: %', NEW.raw_app_meta_data;` in the trigger; inspect logs. **If NULL → pivot** to a sub-`SELECT raw_app_meta_data FROM auth.users WHERE id=NEW.id` inside the trigger, or move the gate to a BEFORE trigger on `user_profiles`.
- Public `supabase.auth.signUp` **cannot** set `app_metadata`. (Known true; confirm on current SDK.)
- No code calls `admin.updateUserById` to let a user edit *their own* `app_metadata` (grep found none — confirm).

**Test matrix (local, then prod rolled-back where possible):**
1. Admin create (with marker, `roles:['agent_admin'?]`, real `imo_id`) → profile gets exact roles/imo. ✅
2. Recruit invite create (marker, `roles:['recruit']`, inviter imo) → recruit + correct imo. ✅
3. Simulated untrusted signup (no marker, `roles:['imo_admin']`, foreign `imo_id`) → profile lands `roles=['agent']`, imo derived, `is_imo_admin()=false`. ✅
4. Existing users unaffected (trigger only fires on new inserts). ✅

---

## 5. P1 — Least-privilege on privileged columns  *(higher risk — stage last)*

The migrations themselves name this follow-up. Today `authenticated` holds column `UPDATE` on `is_super_admin`/`is_admin`/`roles`/`imo_id`/`agency_id`/`approval_status`, and `user_profiles_update_own` is row-scoped only — the guard trigger is the *only* thing stopping escalation. Defense-in-depth: make it physically impossible at the grant layer too.

**⚠️ Two hazards that make this a careful, staged change (not a one-liner):**
1. **Postgres column GRANTs are allow-lists — and the table-level grant is CONFIRMED.** Live prod check: **`authenticated` AND `anon` both hold a *table-level* `UPDATE` grant** on `user_profiles` (Supabase default), so a column-only `REVOKE` is a **silent no-op**. The migration MUST be: **`REVOKE UPDATE ON TABLE public.user_profiles FROM authenticated, anon;`** then **`GRANT UPDATE (<every safe column>) ON public.user_profiles TO authenticated;`**. Safe columns = everything EXCEPT `is_admin`/`is_super_admin`/`roles`/`imo_id`/`agency_id`/`approval_status` — per current schema: `first_name, last_name, phone, city, state, street_address, zip, resident_state, date_of_birth, profile_photo_url, headshot_url, instagram_url, instagram_username, facebook_handle, personal_website, custom_recruiting_url, recruiter_slug, license_number, license_expiration, npn, linkedin_url, terms_accepted_at, terms_version, password_set_at` (**re-derive against the live schema — the migration must be schema-aware**). Getting this wrong no-ops the fix or **locks out all profile self-edits org-wide**.
2. **Latent client writers break.** Any client `.update()` that includes a now-revoked column in its SET list will error. **Audit + fix every writer first** (candidates in §3c: `EditUserDialog`, `recruitingService`, `AgencyService`, `ImoService`, `UserProfile` settings, `AuthContext`, `PermissionRepository`, …).

**Approach:**
1. Inspect live grants on prod (`run-sql.sh`).
2. Enumerate + fix all client writers of privileged columns — strip those columns from client `.update()` payloads.
3. Add SECURITY DEFINER mutation RPCs, **mirroring `admin_set_admin_role` exactly**: e.g. `set_user_roles(target_user_id, roles)` and `set_user_imo(target_user_id, imo_id)` that (a) authZ via `is_admin()`/`is_super_admin()`, (b) call `assert_in_acting_scope(target's imo)`, (c) perform the update; `GRANT EXECUTE TO authenticated`. Regen `database.types.ts`.
4. Then `REVOKE` (with the allow-list correction from hazard 1). Keep the guard trigger as belt-and-suspenders.
5. Regression assert (rolled-back txn): self-`UPDATE` of each privileged column is a no-op/error.

---

## 6. P2–P4 — Smaller hardening

**P2 — Password-reset enumeration + rate-limit** (`send-password-reset/index.ts`):
- Return a **generic 200** ("If that email is registered, a reset link has been sent.") for both found and not-found; move the diagnostic to **server logs only**. (Optionally add an admin RPC to list `user_profiles` rows lacking an `auth.users` match, replacing the leaked diagnostic.)
- Add `check_rate_limit` (existing RPC) at handler top — bucket `ratelimit:req:send-password-reset:<normalized-email>`, e.g. 5 / 15 min → `429` on exceed.

**P3 — Remove `test_workflows_real`** (CONFIRMED world-writable on prod — **can ship early, independent of everything else**):
- `SELECT COUNT(*) FROM test_workflows_real;` (export if any real data — expected none), then migration `DROP TABLE IF EXISTS public.test_workflows_real CASCADE;` via the runner.
- Add a guardrail query to `verify-tracking.sh`: flag any public table with `rowsecurity=false` (excluding `schema_migrations`/`function_versions`) or any `anon`/`authenticated` grant. (`rate_limits` is fine — confirmed.)

**P4 — `ApprovalGuard` hardcoded email** (`ApprovalGuard.tsx` L38–54):
- Replace the `ADMIN_EMAIL` comparison with the existing `is('super_admin')` from `usePermissionCheck` (server-authoritative). Cosmetic (RLS is the real gate) but removes a fragile hardcoded identity.

---

## 7. P5 — MFA / 2FA (optional, larger — later phase)
- Enable Supabase MFA; build **enroll** (`auth.mfa.enroll` → QR) + **verify** (`challenge`+`verify`) screens in Settings.
- **Gate privileged routes** (admin / super-admin) via `auth.mfa.getAuthenticatorAssuranceLevel()` → redirect to verify when `nextLevel==='aal2'` and a factor is enrolled. **Require enrollment for `is_admin`/`is_super_admin` first; not regular agents in v1.**
- **Do NOT enforce AAL2 at RLS in v1** (locks out un-enrolled admins). Provide an **admin recovery path** (super-admin unenrolls a factor via Admin API). If later enforced for privileged *actions*, mirror server-side, not just in the React guard.

---

## 8. Scalability review
- Auth hot-path helpers are already `STABLE`, O(1) PK lookups, with the `(select auth.uid())` optimization across 596 policies and an `imo_id` index → **no action needed at current scale.**
- **Optional at 1000+ concurrent:** covering index `CREATE INDEX … ON user_profiles(id) INCLUDE (is_super_admin, is_admin, imo_id)` for index-only scans; benchmark with `EXPLAIN ANALYZE` first.
- **Regression guard:** add a CI check for bare `auth.uid()` (not `(select auth.uid())`) in policy `USING`/`WITH CHECK` to prevent silent per-row re-eval regressions.
- **Known structural weakness (flag, don't fix now):** `is_imo_admin()` derives admin-ness from the free-form `roles` array, so any future untrusted write to `roles` re-opens escalation. Deriving admin-ness from the `is_admin`/`is_super_admin` booleans instead is a larger refactor (roles is read in many sites) — note as tech-debt.

---

## 9. Deployment & verification (applies to every DB change)
- **All migrations via `./scripts/migrations/run-migration.sh`** (never `psql`). Edge functions via `supabase functions deploy`.
- **Regen `database.types.ts` only when signatures/columns change** (new P1 RPCs) — trigger/grant changes don't alter generated types.
- **Verify each fix on prod** with rolled-back-txn tests (the proven pattern), before declaring done.
- **Sequencing (coordinated with the inbound feature — see `plans/active/MASTER-implementation-plan-20260617.md`):** auth **P3** (drop world-writable table) + **P2** + **P4** + **P0** first (low blast radius, no/minimal schema change) → **the entire Inbound-Call feature** (its own Phases 0–5, single `generate:types` at the end) → auth **P1 LAST** (highest blast radius: table-grant revoke + new RPCs + final regen). This avoids interleaving migrations/type-regens and lands the inbound `imo_agent_external_ids → user_profiles` FK before any `user_profiles` grant changes. **P5 (MFA)** is a separate later initiative.

---

## 10. Open questions / decisions for the owner
1. **Re-enable public signup ever?** If "no, permanently invite-only," P0 becomes lower-urgency defense-in-depth (the toggle already closes it). If "maybe," P0 is the prerequisite.
2. **Default role for an untrusted/neutered signup:** `['agent']` vs `['recruit']` vs none/pending. (Recommend `['recruit']` — least privilege.)
3. **Appetite for P1 (column-grant revoke)?** Real hardening but the highest chance of breaking ordinary profile saves; trigger-only (current) is already solid. Do we want the extra layer, or defer?
4. **MFA scope & timing** — admins only, v1? When?
5. **Confirm the `app_metadata` assumptions** (§4) — quick verification task; everything in P0 rides on them.
6. **Priority/sequencing** — which of P0–P5 to actually implement, and in what order.

---

*Sources: 3-agent layer research (creation paths, RPC/RLS, scalability) + direct review of client `user_profiles` writers. The repository/service sweep partially failed in automation and was completed manually (§3c).*
