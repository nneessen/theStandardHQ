# Review Findings — IMO-wide feature entitlement (Epic Life), commit `99dce5af`

**Reviewer:** independent audit pass, 2026-05-24
**Scope:** the pushed commit `99dce5af` only (subscription entitlement + app/server wiring). Broader Epic isolation project explicitly out of scope.
**Method:** diff-based review of all 13 changed files + auth-context verification of each edge function + grep for missed gates.

---

## 1. High-Risk Issues (Blocking the *feature*, not data safety)

### H1 — `instagram-oauth-init` IMO bypass is dead code (cannot ever fire)
`supabase/functions/instagram-oauth-init/index.ts:90`

The function builds its client with the **service-role key and no user JWT**:

```ts
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

The new bypass calls the **no-argument** helper:

```ts
const { data: imoGrantsAllFeatures } = await supabase.rpc(
  "current_user_imo_grants_all_features",
);
```

But that helper resolves the caller from `auth.uid()`:

```sql
SELECT i.free_all_features
FROM public.user_profiles up
JOIN public.imos i ON i.id = up.imo_id
WHERE up.id = auth.uid()
```

Under a service-role client with no user token, `auth.uid()` is **NULL** → 0 rows → `COALESCE(..., false)` → the bypass **always returns false**. Epic Life users therefore fall straight through to `user_has_instagram_access(p_user_id)`, which checks their (free) plan and denies them. **The advertised "Epic Life gets Instagram free" path does not work.**

- **Severity of security exposure:** none — it fails *closed* (denies, never grants).
- **Severity of correctness:** high — the feature is non-functional and the handoff (line 144–146) states it works. This is the "typecheck-passing is not verification" pattern: it compiled, but the deployed function was never exercised as an Epic Life user.

**Adjacent pre-existing issue (not introduced by this commit, but the fix collapses both):** `instagram-oauth-init` never calls `auth.getUser()` — it trusts `userId` from the request body under service role. A logged-in user could pass another user's id. The correct fix for the bypass also closes this:

> Verify the JWT, derive `userId` from the token (don't trust the body), and either (a) build a user-scoped anon client carrying the `Authorization` header so `auth.uid()` resolves, or (b) add a `p_user_id uuid` overload of `current_user_imo_grants_all_features` and call it with the verified id.

The other two edge functions (`business-tools-proxy`, `close-ai-builder`) are correct **because** they use user-scoped clients (anon key + `Bearer` JWT in global headers), so `auth.uid()` resolves. Verified by reading both.

---

## 2. Medium-Risk Issues (Should Fix)

### M1 — Frontend/server parity break: UW Wizard
`supabase/functions/underwriting-ai-analyze/index.ts:308` (`can_run_uw_wizard`)

Because `useFeatureAccess` **itself** now bypasses for Epic Life, every consumer shows UW Wizard as unlocked. But `underwriting-ai-analyze` still gates on `can_run_uw_wizard(p_user_id)`, which returns `no_subscription` → **403 "UW Wizard subscription required"**. Net UX: Epic Life user sees the feature, clicks it, gets a server error. This is exactly the server/client parity check the handoff (section 3) asked the reviewer to catch — and it was missed.

**Recommended fix (contained):** bypass *externally* in the edge function — call `current_user_imo_grants_all_features()` on the **user-scoped** `userClient` and skip the quota block when true. Do **not** edit `can_run_uw_wizard` in place: it has other callers (the run-tracking/increment function in `20260307190500_harden_uw_wizard_run_tracking.sql` does `SELECT ... FROM can_run_uw_wizard(...)`), so changing it would alter behavior for all of them.

**Product question to resolve:** the same function also enforces `limit_exceeded` (429, monthly run cap). Should Epic Life be *unlimited* or capped at the top tier's allowance? Decide before implementing — "all features free" doesn't automatically mean "unmetered."

### M2 — `manage-subscription-items` not bypassed (likely intentional — confirm)
`supabase/functions/manage-subscription-items/index.ts:851` — "Active subscription required to purchase phone numbers."

Epic Life free-plan users cannot purchase phone numbers here. Unlike analytics/recruiting, this provisions a **real-cost** Twilio resource, so excluding it from the bypass is defensible. Flagging only so the exclusion is a *decision*, not an oversight.

---

## 3. Low-Risk / Quality

- **L1 — stray backup file:** `src/features/billing/components/PricingCards.backup.tsx` duplicates `PricingCards.tsx`. Pre-existing, but it violates your own standing rule ("stop leaving old files in my project"). Delete it.
- **L2 — dashboard tier label:** `useDashboardFeatures` returns `tier: "team"` for Epic Life. Functionally every `can*` flag is `true`, so it's cosmetic, but if a tier above "team" exists the label understates entitlement.

---

## 4. Security & RLS Analysis

**The security model is intact — this is the strongest argument against rollback.**

- The helper is `SECURITY DEFINER`, `search_path` pinned to `public`, takes **no parameters**, and reads only the *caller's own* `imo_id` via `auth.uid()`. A user cannot query another user's or another IMO's flag. No cross-tenant read path.
- `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated, service_role` is correct.
- The bypass grants **feature-gate** access only. Tenant data is still guarded by RLS, so an Epic Life user with "all features" still sees only Epic Life data. Granting feature access does not widen tenant visibility.
- Confirmed **no role/permission widening**: no change touches `can()`, `is_admin`, `is_super_admin`, or carrier/product management. Admin surfaces remain role-gated. Matches the stated requirement.
- The frontend hook fails closed: `grantsAllFeatures` is `false` while loading and on error.

**Exploit attempts considered:** spoof `imo_id` (can't — derived from `auth.uid()`-keyed profile); call helper for another user (can't — no parameter); anon access (revoked). All closed.

---

## 5. Data Integrity & Migration Review

- Additive and safe: `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT false` + `CREATE OR REPLACE FUNCTION` (new name, replaces nothing). Backward compatible.
- No down migration. Rollback is trivial and manual (`DROP FUNCTION`, `DROP COLUMN`). Acceptable for additive change.
- **Fragility:** the seed is `UPDATE ... WHERE name = 'Epic Life'` — case-sensitive exact match. If the row is renamed or absent, it silently updates 0 rows and the entitlement quietly does nothing. Prefer matching by the known id (`89514211-f2bd-4440-9527-90a472c5e622`, per memory) or assert `GET DIAGNOSTICS` row count. Low risk given the row exists today.
- `database.types.ts` manual patch: `Args: never` is **consistent** with the file's existing generator output (`has_subscription_bypass: { Args: never; Returns: boolean }` sits right beside it). Not a concern. A clean regen is still nice-to-have hygiene but not required for correctness.

---

## 6. React Query & Frontend Data Flow

- Query key `[...subscriptionKeys.all, "imo-all-features", userId]` includes `userId` → correct cache isolation across login/logout. `enabled: !!userId` prevents anon fetch. `staleTime` 5m / `gcTime` 10m reasonable for a near-static flag.
- All `useMemo` dependency arrays were correctly extended with `imoGrantsAllFeatures` + the loading flag in every touched hook. No stale-closure risk.
- Loading-gate ordering is correct everywhere: super-admin bypass precedes the loading guard (super-admins never blocked); the IMO bypass sits after the loading guard, so it can't fire on a default-`false` mid-load value.
- `UsageOverview` correctly switched from raw `subscription.plan.features.email/sms` to `useFeatureAccess("email"/"sms")`, so it now inherits the bypass. Good.

---

## 7. Test Coverage Gaps (must add before calling this done)

- **No runtime verification of any bypass path.** Build/typecheck green ≠ working. Required:
  - `curl` deployed `instagram-oauth-init` as an Epic Life user → currently would prove H1 (denied).
  - `curl` `business-tools-proxy` and `close-ai-builder` as an Epic Life user → confirm 200, not 403.
  - Exercise UW Wizard as an Epic Life user → currently proves M1 (403).
- **No SQL test** asserting `current_user_imo_grants_all_features()` returns `true` for an Epic Life member and `false` for a non-Epic member (RLS/SECURITY DEFINER tenant check).
- **No test** asserting a non-Epic, free-plan user still hits the wall (regression guard that the bypass didn't widen).

---

## 8. Final Verdict

### **Approve with Required Changes**

**Justification.** No security regression: the helper is tenant-safe, fails closed, grants only feature-gating (data stays RLS-protected), and adds zero role/permission escalation. So this is *not* a rollback situation. But two advertised paths are broken:

1. **Required:** Fix `instagram-oauth-init` (H1) — it can never grant access as written. Fold in JWT verification while you're there.
2. **Required:** Close the UW Wizard parity gap (M1) by bypassing in `underwriting-ai-analyze` before `can_run_uw_wizard`; resolve the unlimited-vs-capped product question first.
3. **Should:** Confirm `manage-subscription-items` exclusion is intentional (M2).
4. **Should:** Add the runtime + SQL verification in §7 — this commit is the textbook case where green CI hid a non-functional feature.
5. **Nice:** delete `PricingCards.backup.tsx` (L1).

The frontend hooks, `business-tools-proxy`, `close-ai-builder`, the migration, and the type delta are all correct and safe to keep.
