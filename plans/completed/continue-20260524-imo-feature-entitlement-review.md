# Continuation / Review Prompt — IMO-wide feature entitlement (Epic Life)

**Generated:** 2026-05-24  
**Repo:** `nneessen/theStandardHQ`  
**Branch:** `main`  
**Pushed commit:** `99dce5af` (`feat(subscription): grant Epic IMO full feature access`)  
**Remote status:** pushed to `origin/main`

Paste this prompt into a new third-party review session if you want an independent audit of the work.

---

## Objective

Review the IMO-wide subscription entitlement work for **Epic Life**.

Business requirement:
- Epic Life is an internal IMO.
- Epic Life users should get **all subscription-gated features for free**.
- This bypass is **only** for subscription/feature walls.
- It must **not** grant admin/system/super-admin permissions.
- Admin/system access must remain role-gated.

This work was done because Epic Life users were still hitting upgrade walls even though they should function as fully entitled internal users.

---

## What was already true before the code change

A migration was created and applied that adds an IMO-level entitlement:
- `public.imos.free_all_features boolean not null default false`
- `public.current_user_imo_grants_all_features() returns boolean`

Migration file:
- [20260524092115_imo_free_all_features_entitlement.sql](/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260524092115_imo_free_all_features_entitlement.sql:1)

Important deployment fact:
- The migration had already been applied to both local and remote DB before the app-layer wiring was finished.
- The repo then had to be updated so the application actually honors that DB flag.

The migration sets:
- Epic Life (`name = 'Epic Life'`) to `free_all_features = true`

Intent of the SQL helper:
- Read the current user’s own IMO
- Return whether that IMO grants all subscription features
- Avoid changing role-based admin permissions

---

## What was implemented

### 1. New shared client hook

Added a single shared hook that calls the DB helper:
- [useImoAllFeaturesAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useImoAllFeaturesAccess.ts:1)

Behavior:
- Calls `current_user_imo_grants_all_features()`
- Returns `grantsAllFeatures`, `isLoading`, `error`
- Uses React Query and keys under the existing subscription namespace

Reason:
- Avoid duplicating direct RPC logic across multiple feature-gating consumers

---

### 2. Subscription feature gates now honor the IMO bypass

Updated:
- [useFeatureAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useFeatureAccess.ts:130)
- [useAnalyticsSectionAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useAnalyticsSectionAccess.ts:88)
- [useDashboardFeatures.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/dashboard/useDashboardFeatures.ts:47)

Effect:
- If `current_user_imo_grants_all_features()` is true, paid subscription features are treated as accessible
- This applies to:
  - single-feature checks
  - any/all feature aggregations
  - analytics section access
  - dashboard feature helpers

Display label used for this path:
- `"IMO Access"`

Important nuance:
- This bypass sits alongside existing:
  - super-admin bypass
  - owner-downline feature access
  - temporary access config
- It does **not** alter role checks

---

### 3. Sidebar navigation was patched

Updated:
- [useSidebarNavigation.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/navigation/useSidebarNavigation.ts:1)

Why this mattered:
- The route/page guards were no longer enough
- Sidebar visibility still used raw plan feature flags directly
- Without this fix, Epic Life users could still have hidden nav entries even though routes/components would allow access

Effect:
- Sidebar feature visibility now also honors `useImoAllFeaturesAccess()`

This was a real user-facing inconsistency and was fixed after the first entitlement pass.

---

### 4. Billing UI status was patched

Updated:
- [CurrentPlanCard.tsx](/Users/nickneessen/projects/commissionTracker/src/features/billing/components/CurrentPlanCard.tsx:1)
- [UsageOverview.tsx](/Users/nickneessen/projects/commissionTracker/src/features/billing/components/UsageOverview.tsx:1)

Why:
- Epic Life users were still visually presented as “Free” / locked in some billing surfaces

Effect:
- `CurrentPlanCard` now shows:
  - `IMO Access`
  - `Included by your IMO`
- `UsageOverview` now uses feature gating instead of raw `subscription.plan.features.email/sms`

This avoids misleading UI where the entitlement exists but the billing screen still looks locked.

---

### 5. Server-side edge-function gates were patched

Updated:
- [business-tools-proxy/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/business-tools-proxy/index.ts:126)
- [close-ai-builder/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/close-ai-builder/index.ts:185)
- [instagram-oauth-init/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/instagram-oauth-init/index.ts:90)

Reason:
- Some product flows do not rely only on frontend route gating
- They perform their own server-side feature checks
- Those checks would have continued to deny Epic Life users even after client changes

What changed:
- Each of those functions now checks `current_user_imo_grants_all_features()`
- If true, they bypass the subscription feature wall
- They still do **not** grant admin/super-admin behavior

Important note:
- `instagram-oauth-init` was found during the second pass, after identifying remaining direct upgrade-required behavior

---

### 6. Types were updated

Updated:
- [database.types.ts](/Users/nickneessen/projects/commissionTracker/src/types/database.types.ts:4170)

Added:
- `imos.free_all_features`
- `Functions.current_user_imo_grants_all_features`

Important caveat:
- Full local type regeneration was attempted but the local CLI flow was brittle in this shell and temporarily truncated the file
- The checked-in file was restored from `HEAD`
- Then the minimal correct schema delta was patched manually

This should be reviewed carefully:
- The manual type delta is small and targeted
- But it was not produced by a clean full regeneration pass

---

## Validation performed

Validation was run multiple times during the pass.

Confirmed:
- `npm run typecheck` passed
- `npm run build` passed

Build warnings remained, but they were pre-existing style/chunking warnings:
- Vite dynamic import warnings
- large chunk warnings
- Browserslist staleness notice

No new blocking errors were introduced by this entitlement work.

---

## Git / deployment state

Commit created and pushed:
- `99dce5af` `feat(subscription): grant Epic IMO full feature access`

Remote:
- pushed to `origin/main`

This means:
- code changes are in GitHub
- migration file is in the repo
- migration had already been applied before final code push

---

## Exact files changed in the pushed commit

Included in commit `99dce5af`:
- [src/hooks/subscription/useImoAllFeaturesAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useImoAllFeaturesAccess.ts:1)
- [src/hooks/subscription/index.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/index.ts:1)
- [src/hooks/subscription/useFeatureAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useFeatureAccess.ts:1)
- [src/hooks/subscription/useAnalyticsSectionAccess.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/subscription/useAnalyticsSectionAccess.ts:1)
- [src/hooks/dashboard/useDashboardFeatures.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/dashboard/useDashboardFeatures.ts:1)
- [src/hooks/navigation/useSidebarNavigation.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/navigation/useSidebarNavigation.ts:1)
- [src/features/billing/components/CurrentPlanCard.tsx](/Users/nickneessen/projects/commissionTracker/src/features/billing/components/CurrentPlanCard.tsx:1)
- [src/features/billing/components/UsageOverview.tsx](/Users/nickneessen/projects/commissionTracker/src/features/billing/components/UsageOverview.tsx:1)
- [src/types/database.types.ts](/Users/nickneessen/projects/commissionTracker/src/types/database.types.ts:1)
- [supabase/functions/business-tools-proxy/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/business-tools-proxy/index.ts:1)
- [supabase/functions/close-ai-builder/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/close-ai-builder/index.ts:1)
- [supabase/functions/instagram-oauth-init/index.ts](/Users/nickneessen/projects/commissionTracker/supabase/functions/instagram-oauth-init/index.ts:1)
- [supabase/migrations/20260524092115_imo_free_all_features_entitlement.sql](/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260524092115_imo_free_all_features_entitlement.sql:1)

---

## What still needs independent review

Please review for:

1. **Correctness of entitlement boundaries**
- Does the IMO bypass only affect subscription-gated features?
- Is there any accidental widening into admin-only or system-only flows?

2. **Coverage gaps**
- Are there any remaining direct feature checks that should also honor the IMO bypass?
- Search patterns worth reviewing:
  - `user_has_feature(`
  - `subscription.plan.features`
  - `upgradeRequired`
  - `"not available on your plan"`
  - `"subscription required"`

3. **Server/client parity**
- Do all important server-side feature gates now match frontend feature access expectations?
- Especially review:
  - Business Tools
  - Close AI Builder
  - Instagram OAuth init

4. **Type safety**
- Confirm the manual patch to `database.types.ts` is sufficient and accurate
- If you prefer stricter hygiene, rerun full Supabase type generation in a stable local environment and diff the result

5. **UI consistency**
- Confirm Epic Life users now:
  - see the correct sidebar entries
  - see unlocked billing usage panels where appropriate
  - do not see misleading upgrade prompts for included features

6. **Security / privilege isolation**
- Verify that the bypass does **not** enable:
  - admin pages for agents
  - system settings
  - carrier/product management
  - super-admin impersonation behavior

---

## Suggested reviewer commands

Use these locally:

```bash
git show 99dce5af
git diff 99dce5af^ 99dce5af -- src supabase/functions supabase/migrations
npm run typecheck
npm run build
```

Search for possible remaining gates:

```bash
rg -n "user_has_feature\\(|subscription\\.plan\\.features|upgradeRequired|not available on your plan|subscription required" src supabase/functions -S
```

Inspect pushed commit on GitHub if preferred:

```bash
git rev-parse HEAD
```

Expected pushed commit:

```text
99dce5af
```

---

## Remaining broader project work not addressed by this commit

This commit does **not** complete the rest of the original Epic isolation project.

Still pending from the larger handoff:
- book duplication from FFG accounts to Epic accounts
- FFG-agent to `epiclife.*` mapping confirmation
- carrier/product/catalog shared-vs-owned decision
- broader Epic-vs-FFG isolation audit beyond this subscription entitlement issue

So this review should focus specifically on:
- IMO-wide subscription entitlement
- app/server wiring
- regression/security risk of this change set

---

## Requested output from reviewer

Please provide:

1. Findings ordered by severity
2. Any missed gating paths or regressions
3. Any security or authorization concerns
4. Whether `database.types.ts` should be fully regenerated instead of manually patched
5. A final verdict:
- safe to keep as-is
- safe with follow-up fixes
- not safe / requires rollback or patch

