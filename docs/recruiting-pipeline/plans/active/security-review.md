# Active-Agent Recruiting Pipeline Security / DB Blocking Review

Date: 2026-03-14

Decision: `BLOCKED`

## Scope

- Primary focus: the shared active-agent recruiting pipeline at `/recruiting`, protected by `RouteGuard permission="nav.recruiting_pipeline" noRecruits` in `src/router.tsx:446-461`.
- Active-agent behavior is the target. Trainer / contracting-manager specific workflows and super-admin-only surfaces were not reviewed as primary scope, except where they share the same RPCs, edge functions, or data paths used by active agents.
- Review focus: RPC and edge-function authorization, RLS bypass risk, cross-tenant write risk, and query/mutation patterns that could recreate connection pressure or “DB lockup” symptoms.

## Skills and Review Lenses Used

All session-available skills were reviewed and applied as relevant:

- `security-baseline`, `supabase-backend-rules`, `supabase-rls-rpc-hardening`: primary lens for auth, RLS, `SECURITY DEFINER`, tenant isolation, and DB safety.
- `react-tanstack-dataflow`, `hierarchy-performance`: primary lens for query fan-out, invalidation breadth, and connection/load amplification.
- `architecture-ddd-enforcement`, `web-ddd-architecture`: used to trace UI -> hook -> service -> repository/RPC boundaries and identify direct Supabase access and trust-boundary leaks.
- `resend-email-module`, `unified-messaging-domain`: applied to the invite / registration / auth-email portions of the recruiting flow.
- `skill-creator`, `skill-installer`: reviewed for process completeness; they did not add code-specific findings for this repository.

## Executive Summary

The recent “transaction-safe” recruiting work moved several hot paths from 6 to 14 round trips down to single RPC calls. That is the right direction for preventing connection pool exhaustion, and the surrounding React Query cancellation / local mutation lock work is also directionally correct.

I would not sign off on the active-agent recruiting pipeline in its current state. The most serious issues are not raw SQL lock bugs anymore; they are trust-boundary failures:

1. a service-role edge function for auth-user creation is effectively callable from the browser and performs a full auth-user scan per request;
2. the new phase-management RPCs are `SECURITY DEFINER` and granted to `authenticated` without internal authorization checks;
3. a high-volume read RPC also runs as `SECURITY DEFINER` without validating recruit ownership.

Those issues create a worse failure mode than the original client-side fan-out: the code is now faster per request, but several critical mutation paths can be called with too much privilege.

Since the initial review pass, the worktree has been hardened to close those top trust-boundary failures. The updated edge functions have now been deployed to the linked Supabase project. Approval is still blocked because the DB-side migrations are not yet applied and the full flows have not been exercised end to end against the linked project.

## Remediation Status (Current Worktree)

Fixed in code:

- Critical 1: `create-auth-user` now requires a real authenticated caller JWT, enforces recruiting vs user-management permissions, rejects direct password registration on that endpoint, validates payload shape, and no longer scans all auth users with `listUsers()`. The updated edge function has been deployed.
- Critical 2: public invite registration now validates the invitation before auth-user creation in `supabase/functions/complete-recruit-registration/index.ts`, and rolls the auth user/profile back on downstream failure. The new edge function has been deployed.
- Critical 3: the recruiting phase mutation RPCs were hardened in `supabase/migrations/20260314103000_harden_recruiting_pipeline_rpc_auth.sql` with internal actor checks and explicit `EXECUTE` revokes/grants.
- High 4: `get_recruits_checklist_summary` was hardened in the same migration with actor checks and a hard cap on requested recruit IDs.
- High 5: invitation creation and public registration were further hardened in `supabase/migrations/20260314162000_harden_recruit_invitation_and_public_registration.sql` by validating recruiting access, validating same-IMO `upline_id`, and revoking direct anon/authenticated execution of `submit_recruit_registration(UUID, JSONB, UUID)`.
- UI exposure was reduced in `src/features/recruiting/components/AddRecruitDialog.tsx` so non-user-managers no longer see admin / skip-pipeline controls in the add-recruit flow.

Still open after this pass:

- Medium 6: broad read/query invalidation patterns still amplify load after recruiting mutations.
- Medium 7: recruiting checklist/external links still need the shared safe-URL validation path applied consistently.
- Operational step: the DB migrations have not been pushed yet, so the linked project remains blocked until that happens and the flows are verified in situ.

## What Already Improved

- `src/services/recruiting/checklistService.ts:173-184`, `268-276`, and `349-358` now collapse multi-step pipeline mutations into single RPCs.
- `src/features/recruiting/hooks/useRecruitProgress.ts:137-156` and `197-217` cancel in-flight phase queries before advance / revert mutations.
- `src/services/recruiting/checklistService.ts:50-53` adds a local mutation lock to reduce sync-vs-mutation contention.

These changes likely reduced the specific 2026-02-27 pool-exhaustion pattern. They do not yet make the pipeline safe to approve.

## Findings

### Critical 1: `create-auth-user` is effectively a public service-role user-creation endpoint and does a full auth-user scan per request

Evidence:

- `supabase/functions/create-auth-user/index.ts:194-238` creates a service-role client and starts processing the request without first authenticating or authorizing the caller.
- `supabase/functions/create-auth-user/index.ts:237-245` calls `supabaseAdmin.auth.admin.listUsers()` for every request, then scans users in memory by email.
- `src/services/recruiting/recruitingService.ts:125-142` calls this function directly from the browser with `Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}`.
- The same function is also reachable from the recruiting auth-user helper in `src/services/recruiting/authUserService.ts:42-55` and from public registration in `src/services/recruiting/recruitInvitationService.ts:378-401`.

Impact:

- Any caller holding the public anon key can reach a service-role-backed account-creation path unless Supabase platform config is separately blocking it.
- The function can create auth users and update profiles with elevated privilege.
- `listUsers()` on every request is a poor scaling pattern and can become an auth-service hot spot under invite waves, double-submits, or abuse.

Required fix:

- Treat this as an emergency hardening item.
- Validate the caller identity and permission before any service-role action.
- Remove browser `fetch(.../functions/v1/create-auth-user)` calls that rely on the anon key for authorization.
- Replace `listUsers()` with a narrower lookup strategy and add rate limiting / idempotency.

### Critical 2: public registration creates the auth user before the invitation token is validated

Evidence:

- `src/services/recruiting/recruitInvitationService.ts:370-401` creates the auth account through `create-auth-user`.
- Only after that does `src/services/recruiting/recruitInvitationService.ts:445-452` call `submit_recruit_registration` with the invitation token.

Impact:

- Invalid, expired, or replayed invites can still create confirmed auth users and profile data before the invite is rejected.
- This allows orphaned accounts/profile rows and turns the invite form into an account-creation surface.
- In volume, this creates avoidable auth churn and table bloat even when registration should fail.

Required fix:

- Move invite validation ahead of auth-user creation.
- Preferred pattern: a single trusted server-side flow that validates the invite, reserves/returns the correct profile ID, then creates the auth user idempotently.
- Add cleanup or rollback handling for already-created orphaned auth/profile records.

### Critical 3: the new “transaction-safe” phase RPCs prevent client-side fan-out, but they are `SECURITY DEFINER` and lack internal auth / tenant checks

Evidence:

- `supabase/migrations/20260227145536_transaction_safe_phase_operations.sql:18-129` defines `advance_recruit_phase(...)` as `SECURITY DEFINER` and grants it to `authenticated` at `:129-130`, with no `auth.uid()` / same-IMO / recruiter-or-upline guard.
- `supabase/migrations/20260227145536_transaction_safe_phase_operations.sql:141-222` defines `check_and_auto_advance_phase(...)` as `SECURITY DEFINER` and grants it to `authenticated` at `:221-222`, with no caller validation before delegating to `advance_recruit_phase(...)` at `:207-214`.
- `supabase/migrations/20260227145536_transaction_safe_phase_operations.sql:232-328` defines `initialize_recruit_progress(...)` as `SECURITY DEFINER` and grants it to `authenticated` at `:327-328`, with no actor validation.
- `supabase/migrations/20260227144143_revert_phase_rpc.sql:8-103` defines `revert_recruit_phase(...)` as `SECURITY DEFINER`, grants it to `authenticated` at `:102-103`, and contains no internal authorization checks.
- Active-agent code calls these RPCs from `src/services/recruiting/checklistService.ts:173-184`, `273-276`, `355-358`, and `534-537`.

Impact:

- Any authenticated caller who can invoke these RPCs directly can attempt to initialize, advance, auto-advance, or revert another recruit’s pipeline if they know or can guess IDs.
- Because these are `SECURITY DEFINER`, the function body is the real security boundary. That boundary is currently missing.
- From a DB safety standpoint, these are now high-powered write endpoints. They use fewer round trips, but they also make it easier to mutate shared rows with elevated privilege and create lock contention on hot recruits if abused.

Required fix:

- Do not rely on underlying table RLS here.
- Add explicit caller checks inside every recruiting mutation RPC:
  - reject when `auth.uid()` is null;
  - verify the actor is allowed to manage the target recruit;
  - enforce IMO / agency consistency;
  - reject cross-tenant or unrelated recruiter/upline access.
- Re-evaluate whether these can be `SECURITY INVOKER`. If not, keep `SECURITY DEFINER` but encode the full authorization policy inside the function.
- Revoke `EXECUTE` from `authenticated` until those checks exist.

### High 4: `get_recruits_checklist_summary` is a `SECURITY DEFINER` read RPC with no recruit-ownership validation

Evidence:

- `supabase/migrations/20260220135021_add_recruits_checklist_summary_rpc.sql:5-47` defines `get_recruits_checklist_summary(recruit_ids UUID[])` as `SECURITY DEFINER` with no caller validation.
- `src/features/recruiting/hooks/useRecruitsChecklistSummary.ts:22-25` calls it directly with arbitrary `recruitIds`.
- I did not find an explicit `GRANT` / `REVOKE` for this function in current migrations, which makes the effective exposure dependent on default function privileges.

Impact:

- If executable by regular authenticated users, it can leak phase/checklist progress for arbitrary recruit IDs.
- It also accepts an unconstrained array input, which can become an expensive multi-recruit summary call.

Required fix:

- Make it `SECURITY INVOKER` if table RLS is sufficient, or add explicit ownership/tenant validation inside the function.
- Enforce a hard cap on `recruit_ids` array size.
- Add explicit `GRANT` / `REVOKE` so exposure is not left to defaults.

### High 5: active-agent invite flow trusts arbitrary `upline_id`, creating cross-tenant and data-integrity risk

Evidence:

- `src/features/recruiting/components/SendInviteDialog.tsx:80-93` submits `upline_id` from the form.
- `src/features/recruiting/components/SendInviteDialog.tsx:185-201` lets the active-agent user choose any matching user from `UserSearchCombobox`, including roles `["agent", "admin", "trainer"]`.
- `supabase/migrations/20260129100106_allow_reinvite_same_email.sql:61-63` sets `v_upline := COALESCE(p_upline_id, v_inviter_id)` without validating that the supplied upline is allowed.
- Registration persists that value in `supabase/migrations/20260210120000_remove_linkedin.sql:229-232` and `:305-307`.
- `supabase/migrations/20260219174007_upline_pipeline_read_policy_imo_guard.sql:1-7` explicitly references a previous cross-IMO recruit-enrollment integrity problem.

Impact:

- An active agent can assign a recruit to an arbitrary upline, including across IMO boundaries if another guard does not stop it elsewhere.
- That creates downstream data leakage and incorrect pipeline access relationships.

Required fix:

- Validate `p_upline_id` server-side against the inviter’s allowed hierarchy and IMO.
- Reject or coerce invalid uplines to `auth.uid()`.
- Add tests for cross-IMO rejection and unauthorized upline assignment.

### Medium 6: broad row fetches and broad React Query invalidation still amplify DB load

Evidence:

- `src/services/recruiting/repositories/RecruitRepository.ts:103-120` loads `select("*")` from `user_profiles` for everyone with a `recruit` role, then filters in JavaScript.
- `src/services/recruiting/repositories/RecruitRepository.ts:127-176` then performs a second joined query for the filtered IDs.
- `src/services/recruiting/repositories/RecruitRepository.ts:285-328` repeats a broad `select("*")` pattern for stats.
- `src/features/recruiting/hooks/useRecruitProgress.ts:147-156` and `:214-217` invalidate all `recruits` queries after phase mutations.
- `src/features/recruiting/hooks/useRecruitProgress.ts:255-277` invalidates all recruits plus five appointment query families after each checklist item update.

Impact:

- This is not the same bug as the original 2026-02-27 incident, but it is still a load amplifier.
- Under concurrent checklist activity, broad invalidation can re-trigger large read bursts immediately after writes.
- Client-side filtering also means the database does more work than necessary and the browser does avoidable post-processing.

Required fix:

- Move active-agent recruiting reads and stats to narrower SQL/RPC read models.
- Filter on the server for “actual recruits” instead of fetching wide candidate sets and filtering in JS.
- Use tighter query keys and invalidate only the recruit / summaries / appointments actually affected by the mutation.

### Medium 7: recruiting checklist links are opened without using the existing safe-URL validation helper

Evidence:

- `src/features/recruiting/components/PhaseChecklist.tsx:498-507` renders `item.external_link` directly into an anchor.
- `src/features/recruiting/components/interactive/ExternalLinkItem.tsx:32-38` calls `window.open(metadata.url, "_blank")`.
- `src/features/recruiting/components/interactive/FileDownloadItem.tsx:36-41` calls `window.open(metadata.file_url, "_blank")`.
- `src/features/recruiting/admin/ExternalLinkConfig.tsx:114-125` and `src/features/recruiting/admin/ChecklistItemFormDialog.tsx:565-575` accept URLs but do not apply the shared validator.
- The safe helper already exists in `src/lib/recruiting-validation.ts:40-72`.

Impact:

- Misconfigured or malicious metadata can open unsafe URL schemes.
- This is lower priority than the RPC/auth issues, but it violates the app’s own existing safe-link pattern.

Required fix:

- Apply `safeUrlSchema` / `isValidSafeUrl` when writing recruiting link metadata and before opening/rendering it.
- Reject non-HTTP(S) URLs in both admin config and runtime rendering.

## DB Blocking / Lockup Assessment

### What is better now

- The move from sequential client mutations to single transaction RPCs is the correct fix for the original connection-pool exhaustion pattern.
- Query cancellation before advance / revert is a meaningful mitigation.
- The local `phaseMutationInProgress` guard reduces mutation-vs-sync competition.

### What still makes this unsafe to approve

- The system now concentrates more power into fewer RPCs, but those RPCs are missing authorization checks.
- `create-auth-user` still performs an expensive, globally-scoped `listUsers()` on every call.
- Active checklist mutations still trigger broad query invalidations and wide follow-up reads.
- Because active-agent actions can also trigger auth-user creation and automation fan-out, burst activity can still create avoidable pressure even if the original 14-call chain is gone.

Bottom line: the pipeline is less likely to hit the exact old lockup pattern, but it is not yet safe to certify as “no realistic DB lock / blocking risk.”

## Verification Performed

- Static review of the active-agent route, dashboard, hooks, recruiting services, repositories, migrations, and edge functions.
- `npm run typecheck`
  - Passed.
- `npx eslint src/features/recruiting/components/AddRecruitDialog.tsx src/features/recruiting/hooks/useRecruitInvitations.ts src/services/recruiting/recruitInvitationService.ts src/services/recruiting/recruitingService.ts src/services/users/userService.ts`
  - Passed.
- `npm run test:run -- src/features/recruiting/components/__tests__/RecruitActionBar.test.tsx src/features/recruiting/components/__tests__/RecruitDetailHeader.test.tsx src/features/recruiting/utils/__tests__/recruit-action-policy.test.ts`
  - Passed: 56 tests across 3 files.
- `python3 /Users/nickneessen/.codex/skills/supabase-rls-rpc-hardening/scripts/rls_index_audit.py --root /Users/nickneessen/projects/commissionTracker`
  - Flagged non-recruiting warnings only: `elevenlabs_config` missing `imo_id` index, `recommendation_outcomes` missing `user_id` index, `training_user_stats` missing `user_id` index, and `pipeline_automations` RLS not enabled.
  - Those warnings are outside the active-agent recruiting pipeline changes in this pass.
- `supabase functions deploy create-auth-user complete-recruit-registration --use-api`
  - Passed. The updated edge functions are deployed to project `pcyaqwodnyrpkaiojnpz`.

Limitations:

- I did not run live Supabase load tests or database-level contention tests in this pass.
- `deno` is not installed in this environment, so I could not run `deno check` directly against the two modified edge functions here.
- The pass is therefore strong on static authorization / architecture / query-shape risk, but not a substitute for staged concurrency testing after fixes land.

## Recommended Next Steps

1. Apply the two new recruiting hardening migrations to the linked project.
2. Run one authenticated active-agent recruit-create flow and one public invite-registration flow end to end against the linked project.
3. Add regression coverage for auth/tenant isolation around recruit creation, invitation creation, and phase RPC access.
4. Tackle the remaining lower-priority load and safe-link findings (Medium 6 and Medium 7).

## Minimum Regression Tests to Add Before Re-approval

- RPC authorization tests proving an unrelated authenticated user cannot initialize, advance, auto-advance, revert, or summarize another recruit’s pipeline.
- Invite tests proving an invalid/expired token does not create an auth user or profile.
- Invitation tests proving cross-IMO / unauthorized `upline_id` assignments are rejected.
- Load-oriented integration test proving checklist completion no longer invalidates the entire recruiting/appointment surface unnecessarily.

## Approval Gate

This review remains `BLOCKED` until, at minimum:

- the pending migrations are applied to the linked project;
- the affected flows have regression coverage for auth, tenant isolation, and invite sequencing;
- a staged end-to-end verification confirms the active-agent and public invite flows behave correctly after deployment.
