# Handoff: Recruit Creation Fix for Pro/Team Subscribers

**Date:** 2026-05-20
**Author:** Nick (implemented by Codex agent, verified by Claude)
**Status:** Code complete, **not yet deployed**, no production data repair yet
**Reviewer goal:** Independently confirm the fix is correct, safe to deploy, and
that no agent (Pro, Team, Super-admin) is left unable to add recruits.

---

## 1. Symptom Reported

> "All Pro/Team subscribers cannot add recruits — I thought this was already fixed."

Recruits appeared to be created successfully in the UI but never enrolled in the
pipeline. On the local DB we found a recently-created recruit
(`nick.neessen@gmail.com`, 2026-05-20 13:40 UTC) with:
- `recruiter_id: null`
- `upline_id: null`
- `agency_id: null`
- `pipeline_template_id: null`
- `enrolled: false`

That row was the smoking gun.

---

## 2. Root Cause (Two Bugs, Compounding)

### Bug A — Silent partial success in `create-auth-user` edge function

`supabase/functions/create-auth-user/index.ts` did:

1. `auth.admin.createUser(...)` → succeeds, returns auth user.
2. `user_profiles.update(...)` with the recruiter/upline/IMO/agency fields →
   **could fail**, was only logged, did not throw.
3. Returned HTTP **200** with `profile: null` and the message
   `"Profile update may have failed - check logs"`.

The client (`src/services/recruiting/recruitingService.ts`) then **fabricated a
`UserProfile` from the local request payload** when `result.profile` was missing
and emitted `RECRUIT_CREATED` — so the UI looked fine.

The DB was left with:
- An `auth.users` row.
- A minimal `user_profiles` row (created by the `handle_new_user` trigger) with
  no ownership fields.

### Bug B — Pro plan does not initialize the pipeline

Pro users hit `BasicRecruitingView` (because their plan feature
`recruiting_custom_pipeline=false` routes them away from `PostAddRecruitWizard`).
That view called `createRecruit` but **never called
`initialize_recruit_progress`**. Team users got enrolled because the wizard
explicitly calls it.

Combined: Bug A meant ownership fields were missing → `initialize_recruit_progress`
authorization (`recruiting_actor_can_manage_recruit`) would have rejected
enrollment anyway, but Bug B meant Pro users never even attempted enrollment.

---

## 3. Changes Made

### 3.1 Edge function: `supabase/functions/create-auth-user/index.ts`

| Behavior | Before | After |
|---|---|---|
| Profile update fails | Logs, returns 200, `profile: null` | Deletes the auth user + transient profile, returns **HTTP 500** with `details` |
| Caller has `canManageUsers` but is not super-admin | Could pass arbitrary `upline_id` / `pipeline_template_id` / `agency_id` across tenants | Clamped to **caller's IMO**; cross-tenant upline/template silently dropped (returns `null`) |
| Super-admin (`is_super_admin = true`) | Same path as admin | Explicit branch: can assign cross-tenant; `recruiter_id` defaults to caller |
| Non-super-admin caller with no `imo_id` | Allowed | Returns **HTTP 403** ("Current user is not assigned to an IMO") |
| Return shape | `profileUpdateError: "Profile update may have failed - check logs"` (lying) | `profileUpdateError: null` on success, real error string on failure (but failure now returns 500 not 200) |

**SELECT change:** caller-profile query now also reads `is_super_admin`, so the
hardened branches can fire. Verified column exists in `public.user_profiles`
(see §6 verification).

### 3.2 Client service: `src/services/recruiting/recruitingService.ts`

`createRecruit` now:
- Treats `profileUpdateError` (any truthy) **or** missing `profile` as a hard
  failure → throws.
- No longer synthesizes a fake `UserProfile` from the request body.

### 3.3 `BasicRecruitingView.tsx` (Pro flow)

- Loads templates via `useTemplates()`, filters with
  `filterUserSelectableTemplates`, picks one with `selectDefaultRecruitTemplate`.
- After `createRecruit` succeeds, calls `useInitializeRecruitProgress()` with
  the chosen DEFAULT template id.
- New inline error surfaces (`errors._form`) for: templates still loading,
  no DEFAULT template available, or the create/initialize call failing.

### 3.4 Shared helper: `src/features/recruiting/utils/template-filters.ts`

Extracted `selectDefaultRecruitTemplate(templates, isLicensed)` so both
`PostAddRecruitWizard` (Team) and `BasicRecruitingView` (Pro) use the same
selection rule: licensed → "Licensed Agent" template, otherwise →
"Non-Licensed" template, fallback → `is_default` flag, then first.

### 3.5 New tests

- `src/services/recruiting/__tests__/recruitingService.createRecruit.test.ts`
  - Rejects edge partial-success (`profile: null` + `profileUpdateError`).
  - Emits `RECRUIT_CREATED` only when persisted profile is returned.
- `src/features/recruiting/utils/__tests__/template-filters.test.ts`
  - DEFAULT filter only keeps `DEFAULT*`-named templates.
  - Licensed/unlicensed picker returns the expected template.

---

## 4. Files Touched (just this fix)

```
M  src/features/recruiting/components/BasicRecruitingView.tsx
M  src/features/recruiting/components/PostAddRecruitWizard.tsx
M  src/features/recruiting/utils/template-filters.ts
M  src/services/recruiting/recruitingService.ts
M  supabase/functions/create-auth-user/index.ts
?? src/features/recruiting/utils/__tests__/template-filters.test.ts
?? src/services/recruiting/__tests__/recruitingService.createRecruit.test.ts
```

> **Note:** the working tree contains a separate, larger IMO tenant-isolation
> diff (carriers/products/comp-guide/agency settings + new migration
> `20260519090000_harden_imo_scoped_settings.sql`). That work is **adjacent**,
> not the cause of this bug, and should be reviewed independently — see §8.

---

## 5. What to Verify (Reviewer Checklist)

### 5.1 Read the diffs
- [ ] `git diff supabase/functions/create-auth-user/index.ts` — confirm:
  - Profile-update failure path returns 500 and calls `auth.admin.deleteUser`.
  - The `if (callerResult.caller.isSuperAdmin) { … } else { … }` branch clamps
    `imo_id`/`agency_id` to the caller's tenant for non-super-admins.
  - `resolveAssignableUpline` returns `null` (not the requested id) when a
    `canManageUsers`-but-not-super-admin caller picks an upline from a different
    IMO.
  - `resolveAssignablePipelineTemplate` no longer trusts `canManageUsers`
    callers; only `isSuperAdmin` skips the per-template tenant check.
- [ ] `git diff src/services/recruiting/recruitingService.ts` — confirm
  `edgeResult.profileUpdateError || !edgeResult.profile` is a thrown error,
  not silently swallowed.
- [ ] `git diff src/features/recruiting/components/BasicRecruitingView.tsx` —
  confirm `initializeProgress.mutateAsync` is called after `createRecruit`
  succeeds, and the disabled state covers both pending mutations + template
  loading.

### 5.2 Run the tests locally
```bash
npx vitest run \
  src/services/recruiting/__tests__/recruitingService.createRecruit.test.ts \
  src/features/recruiting/utils/__tests__/template-filters.test.ts \
  src/features/recruiting/utils/__tests__/recruit-create-assignment.test.ts
npm run typecheck
```
Expected: 9 tests pass, typecheck zero errors.

### 5.3 Smoke-test in browser (golden path + 2 failure paths)
Run `npm run dev` then for each role, click **Add Recruit**:

1. **Pro agent (recruiting_basic only)** — fill the basic form, submit.
   - DB: `user_profiles` for the recruit has `recruiter_id`, `upline_id`,
     `imo_id`, `agency_id`, and a row in `recruit_phase_progress` for the
     selected DEFAULT template.
   - UI: dialog closes, recruit appears in the list.
2. **Team agent (recruiting_custom_pipeline)** — go through
   `PostAddRecruitWizard`.
   - DB: same as above, but template id matches whichever the user picked.
3. **Failure path — force `create-auth-user` to fail profile update.**
   - Easiest: temporarily NOT NULL a column the form does not send (e.g. via
     local-only SQL), submit, confirm the UI shows the error toast and **no**
     orphan `auth.users` or `user_profiles` row is left behind.
   - Revert the local-only NOT NULL.
4. **Failure path — no DEFAULT templates seeded.**
   - In a clean test IMO, deactivate or rename the DEFAULT templates and
     confirm the Pro form shows the inline error
     `"No default pipeline template is available…"`.

### 5.4 Tenant-isolation regression
- [ ] Log in as an agent who has `canManageUsers` but is **not**
  `is_super_admin`. In a tool like Postman, call the deployed `create-auth-user`
  with a `profileData.upline_id` pointing at a user from a **different IMO**.
  Expected: the recruit is created with `upline_id: null` (and the request still
  succeeds for the same-tenant fields), not with a cross-tenant upline.
- [ ] Same caller, pass a `pipeline_template_id` belonging to a different IMO.
  Expected: 400 (`Pipeline template … is not assignable`).

---

## 6. Things I Verified Already

- Targeted Vitest suite: **3 files, 9 tests passing**.
- `npm run typecheck`: **0 errors**.
- `is_super_admin` column exists on `public.user_profiles` (local DB confirmed).
- Local DB has both DEFAULT templates: `DEFAULT Licensed Agent Pipeline`,
  `DEFAULT Non-Licensed Recruit Pipeline`.
- Pro plan features in local `subscription_plans`:
  `recruiting_basic=true, recruiting_custom_pipeline=false`. Confirms Pro goes
  to `BasicRecruitingView` — which is exactly the path that lacked enrollment.

---

## 7. NOT Done — Reviewer / Next Step Required

1. **Edge function not deployed.** Run:
   ```bash
   supabase functions deploy create-auth-user
   ```
   (no `--no-verify-jwt` — this function uses standard auth.)
2. **App not deployed.** Vercel deploys from `main`; the client-side rejection
   of partial success will not take effect until the next merge to `main`.
3. **Production data audit not done.** We did not query production. Recommended
   audit query (read-only):
   ```sql
   -- Recruits in last 30d missing ownership or enrollment
   SELECT id, email, created_at,
          recruiter_id IS NULL AS no_recruiter,
          upline_id    IS NULL AS no_upline,
          imo_id       IS NULL AS no_imo,
          agency_id    IS NULL AS no_agency,
          (SELECT COUNT(*) FROM recruit_phase_progress
             WHERE user_id = up.id) = 0 AS no_progress
   FROM user_profiles up
   WHERE roles @> ARRAY['recruit']::text[]
     AND created_at > now() - interval '30 days'
   ORDER BY created_at DESC;
   ```
   If rows come back, decide per-row whether to (a) backfill ownership from
   `auth.users.created_by` (if known) + the recruiter's IMO/agency, then call
   `initialize_recruit_progress`, or (b) hard-delete the orphan and ask the
   recruiter to re-add.
4. **Production edge-function logs not pulled.** The local env only points at
   local Supabase; we have no direct evidence from prod confirming the
   `profileError` line was the one firing. The local repro pattern matches,
   but production confirmation would harden the diagnosis. Pull logs via:
   ```bash
   supabase functions logs create-auth-user --project-ref <ref>
   ```
   and grep for `Profile update failed` in the last 7 days.

---

## 8. Adjacent Risk: IMO Tenant-Isolation Diff in the Same Working Tree

The same `git status` shows ~30 modified files under `src/features/settings/**`,
`src/services/settings/**`, `src/hooks/**`, plus a new
`src/services/base/TenantScopedRepository.ts` and migration
`supabase/migrations/20260519090000_harden_imo_scoped_settings.sql`.

**This is NOT part of the recruit fix.** It is the IMO settings hardening work.
Do not lump them into a single commit/PR. Specifically, the migration sets
`carriers.imo_id`, `products.imo_id`, and `comp_guide.imo_id` to `NOT NULL` —
if production has any global/null rows, the migration will fail or break
queries. Review and deploy that work in its own change set.

---

## 9. Behavior Change to Flag for Stakeholders

The edge function previously let any `canManageUsers` caller assign uplines,
templates, IMOs, and agencies freely. After this fix, only `is_super_admin`
callers can cross tenant boundaries. **If your org has admins who legitimately
manage recruits across multiple IMOs but are not flagged `is_super_admin`, they
will lose the ability to assign cross-tenant uplines/templates** — those
assignments will silently fall back to caller's IMO (for upline) or be rejected
(for template). Confirm whether any users fit that description before deploying.

---

## 10. Final Verdict (from initial review)

**Request Revisions → Now Implemented.**
Code looks correct, tests pass, but reviewer should still independently:
1. Confirm tenant-isolation behavior change is acceptable.
2. Decide on prod data audit & repair before/after deploying edge function.
3. Decide whether to deploy this fix and the IMO settings work as separate PRs
   (recommended) or together.
