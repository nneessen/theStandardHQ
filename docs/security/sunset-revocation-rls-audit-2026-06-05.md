# Sunset / Revocation RLS Audit — 2026-06-05

> ## ⚠️ CORRECTION (post-verification) — READ FIRST
> Most queries in this report unknowingly ran against the **LOCAL dev DB**, not prod, due to a
> runner-targeting footgun (`$REMOTE_DATABASE_URL` is unset in a fresh shell, so
> `DATABASE_URL="$REMOTE_DATABASE_URL" ./run-sql.sh` without first `source .env` silently used
> `.env`'s local `DATABASE_URL=127.0.0.1:54322`). Local and prod have diverged. After
> re-verifying against **actual prod** (`source .env` first; `host(inet_server_addr())` = IPv6):
>
> - **Finding D (privilege escalation): CONFIRMED on prod and FIXED.** `escalated_on_prod = t`
>   before; guard trigger `20260605080009` applied to prod and validated (escalation pinned,
>   normal edits work). This finding stands.
> - **Finding C (anon reads `app_config.service_role_key`): DOES NOT EXIST on prod — local-only.**
>   Prod has only `Service role can manage config` + `revocation_deny` policies; the
>   `"Postgres can read config"` USING(true) policy is **absent** on prod; `SET ROLE anon` returns
>   0 rows; the June-1 drop (`20260601063530`) **is** recorded on prod. The leak persists only on
>   LOCAL (which still carries the stale Dec-2025 policy). The "regression" / "never applied to
>   prod" / "rotate again" claims below are **WRONG for prod** — they were local observations.
> - Finding B (`communication_consent/suppression`) and the Section A counts were also measured on
>   local; re-verify on prod before acting.
> - Migrations `20260605080010` (app_config) and `20260605083542` (vault) were applied to **local
>   only** and are **not needed for prod** (the vault one was deleted — it would fail a fresh prod
>   replay since prod has no `service_role_key` vault secret).
>
> Treat everything below as a LOCAL audit except Finding D, which is confirmed + fixed on prod.

Scope: confirm whether a revoked ("sunset") user — who keeps a valid, refreshable JWT
because they must log in to run the data export — can reach data beyond their own
account via the API, independent of the React `SunsetGate`. **(Targeting caveat: see CORRECTION
banner above — most of this ran against local, not prod.)**

---

## Verdict

- **Is the sunset/revocation flow exploitable? → YES, indirectly — two CRITICALs, both proven on prod.**
- The revocation *mechanism* is well-built in isolation (blanket restrictive RLS on 192/199
  tables + IMO gate + caller-scoped edge functions — Section A). **But it is defeated by a
  broader privilege-escalation hole (Finding D): any authenticated user — including a revoked
  one — can set their own `user_profiles.is_super_admin = true` with a single `UPDATE`, and a
  super-admin is exempt from revocation.** So a revoked user can escape revocation entirely.
- **Separately and worse (no auth required):** `app_config.supabase_service_role_key` is
  readable by **anonymous** callers via the public REST API (Finding C — the June-1 incident,
  regressed). Full DB compromise from an unauthenticated request.
- **Both are CRITICAL and need immediate action.** Finding C (anon → service-role key) has the
  widest reach (no login); Finding D (self-escalation) requires any login but is trivially
  exploitable and nullifies all RLS/tenancy, not just revocation.

---

## A. Revocation enforcement — well-built in isolation (but see Finding D)

> The mechanics below are correct and comprehensive. They are nonetheless **bypassable** via
> the self-escalation in Finding D — a revoked user can promote to super-admin (exempt from
> revocation) and walk through all of it. Treat "Section A is sound" as true only *once
> Finding D is fixed.*


**Gate functions (prod definitions):**
- `get_effective_imo_id()` returns the all-zeros sentinel `00000000-…-000000000000` for a
  revoked non-super-admin (matches no real row → deny). Super-admins are never revoked.
- `get_my_imo_id()` = `COALESCE(get_effective_imo_id(), real_imo_id)`. Because the sentinel
  is **non-null**, the COALESCE cannot fall back to the real IMO. Correct.
- `is_access_revoked(uid)` = `NOT is_super_admin() AND EXISTS(imo.access_revoked_at <= now())`.
  IMO-level, `SECURITY DEFINER`.

**Blanket revocation gate:** a **RESTRICTIVE** policy `revocation_deny`
(`USING (NOT is_access_revoked(auth.uid()))`, `FOR ALL`, role `authenticated`) exists on
**192 of 199** policied tables. Restrictive ⇒ AND-ed with every permissive policy ⇒ a
revoked user is denied all access on those 192 tables regardless of their other policies.
This is why my first-pass "ungated policy" list (carrier_*, clients, agency_slack_credentials,
user_documents, user_emails, …) is moot — every one of those tables carries `revocation_deny`.

**The 7 tables WITHOUT `revocation_deny` are safe by design:**
| Table | Why a revoked user is still contained |
|---|---|
| `imos`, `agencies` | Scoped by `get_my_imo_id()`/`super_admin_in_scope` → sentinel → 0 rows. (Verified: `imos` returns 0 rows for the revoked user — the original console 406.) |
| `user_profiles` | `user_profiles_select_consolidated` = `auth.uid() = id OR (is_super_admin AND …)` → self-row only. Required for export + for `is_access_revoked` itself. |
| `jarvis_memory`, `assistant_audit_log` | Caller's own rows only. |
| `communication_consent`, `communication_suppression` | See Finding B. |

**Edge functions (service-role, RLS-bypassing) — caller-scoped:**
- `generate-user-export-bundle`: JWT caller ⇒ `targetUserId = callerId`; a mismatched
  `body.userId` is rejected. Only true service-role may pass an arbitrary `userId`.
- `confirm-and-wipe-account`: non-super-admin JWT caller ⇒ `targetUserId = callerId`
  (self only); super-admin or service-role may target a named user.
- ⇒ a revoked user can only export / delete **their own** account.

**Recruiter-PII angle (raised, then closed):** `user_documents`, `user_emails`,
`onboarding_phases`, `user_activity_log` are recruiter-readable and scope by `recruiter_id`
(not `imo_id`), so they don't *enforce* same-IMO. But (1) all four carry `revocation_deny`
→ a revoked recruiter is denied; and (2) cross-IMO recruiter→recruit links currently = **0**.
Latent only; no action required for revocation.

**`rate_limits`** has RLS disabled but **no** anon/authenticated grant → unreachable via the
anon/authenticated REST API. Fine.

---

## B. MODERATE (pre-existing, not revocation-specific): cross-tenant read of consent ledgers

`communication_consent` and `communication_suppression` have a `{authenticated} USING(true)`
SELECT policy and **no** `revocation_deny`. ⇒ **any authenticated user (any tenant, incl. a
revoked one) can read every tenant's** consent + suppression rows (emails/phone numbers +
consent state). `anon` is *not* affected (no anon policy → default deny; the anon table grant
is moot without a matching policy).

This affects all authenticated users, so it's a tenancy-design issue rather than a revocation
hole, but a revoked user is included in the blast radius. Recommend scoping these to the
caller's IMO (or at minimum adding `revocation_deny`), unless global suppression reads are an
intentional compliance requirement — in which case restrict to the columns actually needed.

---

## C. CRITICAL (pre-existing regression): service-role key readable by anon

**Proven on prod** via `SET ROLE anon`: an anonymous caller can `SELECT` the
`supabase_service_role_key` row from `public.app_config` (164-char value returned).

**Cause:**
- `app_config` policy **`Postgres can read config`** — PERMISSIVE, role `{public}`,
  `SELECT`, `USING (true)`.
- `anon` (and `authenticated`) hold a `SELECT` table grant on `app_config`.
- The `revocation_deny` restrictive policy on `app_config` is role `{authenticated}` only, so
  it does nothing for `anon`.

**Impact:** the `service_role` key bypasses **all** RLS. The public `anon` API key ships in
every frontend bundle, so any unauthenticated visitor can call
`/rest/v1/app_config?key=eq.supabase_service_role_key` and obtain full read/write/delete over
every tenant's data. This is the same exposure logged in the June-1 incident
(`project_app_config_service_role_key_leak`); the key rotation was recorded as still pending,
and a `{public} USING(true)` policy is live again.

**The row is NOT vestigial — do NOT delete it.** 6 `SECURITY DEFINER` functions owned by
`postgres` read `app_config.value` to get the key for `net.http_post` to edge functions:
`invoke_account_lifecycle_daily`, `invoke_ai_smart_view_sync`, `invoke_lead_heat_scoring`,
`invoke_slack_auto_complete_first_sale`, `invoke_slack_ip_leaderboard`,
`notify_slack_on_policy_insert`. They bypass RLS (definer/postgres-owned), so dropping the
public policy and revoking anon/authenticated grants does **not** affect them — but deleting
the row, or letting the stored value drift from the live key, would 401 all 6.
(The earlier "no code reads it" note reflected an app-code grep only; the readers are SQL
functions, found via `pg_get_functiondef ILIKE '%app_config%'`.)

**Regression note.** The June-1 fix `20260601063530_drop_app_config_public_read_policy.sql`
IS committed (`d7b7e97e`), yet `"Postgres can read config"` is live again on prod → something
re-introduced it after June 1 (likely an early baseline/consolidation migration that recreates
app_config policies and keeps getting re-applied). Re-dropping it may not stick unless the
source migration that recreates it is also fixed.

**Remediation (urgent):**
1. **Rotate** the `service_role` key in the Supabase dashboard (owner-only; assume the current
   key is fully compromised — it's been anon-readable). In the **same** change, update
   `app_config.value` for `supabase_service_role_key` to the new key, or the 6 cron/trigger
   functions above will 401.
2. **Drop** policy `"Postgres can read config"` on `app_config`, and trace + fix whatever
   migration recreates it (else it regresses again).
3. **Revoke** `SELECT` on `app_config` from `anon` and `authenticated` (leave `service_role`;
   the definer functions are unaffected). This alone closes the anon read even if the policy
   reappears.
4. **Long-term:** move the key out of a queryable table into Supabase Vault and have the 6
   functions read it from there, so a service-role key never lives in `public.*` again.

Steps 2–3 ship as one migration via `scripts/migrations/run-migration.sh`; steps 1 and 4 are
owner/dashboard actions.

---

## D. CRITICAL (proven): any authenticated user can self-escalate to super-admin

**Proven on prod** (rolled-back transaction, impersonating a regular non-super-admin via
txn-local `request.jwt.claims` + `SET ROLE authenticated`):
`UPDATE user_profiles SET is_super_admin = true WHERE id = auth.uid()` → **`UPDATE 1`,
`is_super_admin` returned `true`.** The write passed grant, RLS, and all triggers.

**Why it works (every layer is open):**
- `is_super_admin()` is `SELECT EXISTS(... WHERE id=auth.uid() AND is_super_admin=true)` — it
  reads the **column**, so flipping the column = instant super-admin for every RLS check.
- The `authenticated` role holds **column-level `UPDATE` grants** on `is_super_admin`, `roles`,
  `imo_id`, `agency_id`.
- RLS policy `user_profiles_update_own` is `USING/WITH CHECK (auth.uid() = id)` — row-scoped
  only, **no column restriction**; the escalated row still satisfies `auth.uid() = id`.
- `user_profiles` is one of the 7 tables **without** `revocation_deny`, and no `BEFORE UPDATE`
  trigger pins privileged columns (`enforce_user_profile_imo_consistency` only validates
  `imo_id` vs. agency; audit/webhook triggers don't block).

**Impact:**
- Total, app-wide privilege escalation: any logged-in user (any tenant) → super-admin →
  full read/write across all tenants. Reachable from the browser via
  `PATCH /rest/v1/user_profiles?id=eq.<self>` with body `{"is_super_admin":true}`.
- **Defeats revocation:** `is_access_revoked()` is `NOT is_super_admin() AND …`, so a revoked
  user who self-escalates is no longer "revoked" and the 192 restrictive policies stop denying
  them. This is the escape hatch that inverts Section A.
- Same path likely allows `roles` self-grant and `imo_id` tenant-hop (the trigger keeps a
  user-supplied `imo_id` when it doesn't conflict with an agency; clearing `agency_id` removes
  even that check) — not separately exercised, but the grant + policy shape is identical.

**Remediation (urgent):** privileged columns must not be writable through the user-facing
self-update path. Recommended (defense in depth, both):
1. `REVOKE UPDATE (is_super_admin, roles, imo_id, agency_id) ON public.user_profiles FROM
   authenticated;` — then route legitimate role/super-admin/tenant changes through
   `SECURITY DEFINER` RPCs that authorize the caller explicitly. (Column REVOKE is blunt and
   will break in-app admin edits of these columns until those move to RPCs — verify the admin
   flows first.)
2. Add a `BEFORE UPDATE` trigger that forces `NEW.is_super_admin := OLD.is_super_admin`,
   `NEW.roles := OLD.roles`, `NEW.imo_id := OLD.imo_id` unless the caller is authorized for
   that specific change (super-admin, or the matching IMO/contracting admin per the existing
   `user_profiles_update_admin` / `IMO admins…` policies). A trigger is more precise than the
   column REVOKE and preserves legit admin edits.

Until fixed, the revocation feature and all tenant isolation are advisory only for any user
willing to send one API call.

---

## Method / queries (read-only, prod)
`pg_get_functiondef` for the gate fns; `pg_policies` classification by `qual` and
`permissive`; `information_schema.role_table_grants` for anon/authenticated grants;
`SET ROLE anon` to prove the `app_config` read; `pg_class.relrowsecurity` for RLS-off tables;
`information_schema.column_privileges` for per-column write grants; and a rolled-back
`BEGIN … SET LOCAL ROLE authenticated … UPDATE … ROLLBACK` (txn-local `request.jwt.claims`)
to prove the self-escalation without persisting any change.
