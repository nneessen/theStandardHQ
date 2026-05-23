# Epic Life IMO Isolation — Completion Plan

**Generated:** 2026-05-22
**Status:** Planning only. No code, migrations, or deploys this session.
**Predecessors:**
- Master strategy: `/Users/nickneessen/.claude/plans/ok-so-i-am-magical-conway.md`
- Prior continuation: `plans/continuation-prompts/continue-20260522_060018.md`
- Live migration: `supabase/migrations/20260521213701_harden_imo_scoped_operational.sql`

---

## Executive summary

Three layers of code shipped (RLS hardening, super-admin override, hardcoded-email cleanup). What remains is **proof and hardening**, not new features. The work splits into:

- **One blocker** (H4 — service-role edge function audit). Until this lands, any service-role insert into `user_profiles` / `policies` / `commissions` that omits `imo_id` will hit a `check_violation` from the new triggers. Silent recruit-create failure in prod is the failure mode. Must land before any test recruit is added to Epic Life.
- **One proof** (Layer 1 RLS verification). Until this passes, every layer above is built on an unproven foundation.
- **One trigger event** (Epic Life IMO creation on remote). Gates the proof step.
- **Three defensive items** (H5 Storage RLS, H6 down-migration, tests). Necessary, not blocking.
- **One legal prerequisite** (FFG agent-agreement review). Out-of-band, gates *real* recruiting activity but does not gate technical work.

---

## Sequencing (do in this order)

```
       ┌──────────────────────────────────────────────────┐
       │  #5  FFG/Founders agreement review (Nick, async) │
       │       — gates real recruiting, not tech work     │
       └──────────────────────────────────────────────────┘

  ┌─► #4a  H4 service-role edge function audit  ─────────────┐
  │        (blocker for #2/#3 — silent insert failure risk)  │
  │                                                          │
  │   ┌─► #2  Create Epic Life IMO on remote ◄───────────────┘
  │   │        (UI path; gives audit evidence)
  │   │
  │   │   ┌─► #2b  Seed canary rows under Epic Life
  │   │   │       (positive control for #1)
  │   │   │
  │   │   │   ┌─► #1  Layer 1 RLS verification harness ◄────┐
  │   │   │   │        (the proof — non-super-admin JWTs)   │
  │   │   │   │                                             │
  │   │   │   │   ┌─► #3  Notification silence test ◄───────┘
  │   │   │   │   │       (depends on Epic Life existing)
  │   │   │   │   │
  │   │   │   │   │  Once #1 + #3 pass: technical readiness ✓
  │   │   │   │   │
  └───┴───┴───┴───┴─► #4b  Tests (RLS integration, triggers, ImoContext)
                  └─► #4c  H5 Storage RLS audit
                  └─► #4d  H6 paired down-migration
```

**Critical paths:**
- `H4 → Epic Life create → seed → verification → notification test` is the linear critical path to "Epic Life can safely receive a real recruit."
- `#4b/c/d` can land in parallel with the critical path once H4 is clear.
- `#5` is Nick's responsibility and runs independently; it gates **recruiting**, not **shipping**.

---

## Item 1 — Layer 1 RLS verification harness

### Scope
Confirm that non-super-admin JWTs (admin, trainer, contracting_manager) cannot SELECT Epic Life rows from `user_profiles`, `policies`, or `commissions` via direct PostgREST. UI-layer hiding without RLS-layer hiding is worthless; this is the only test that proves Layer 1 worked.

### Files / artifacts to create
- `scripts/verify-imo-isolation.sh` — repeatable harness. Takes a JWT and an excluded-IMO UUID, hits three REST endpoints, asserts excluded IMO does not appear. Exits non-zero on any leak.
- `scripts/mint-test-jwt.sh` (optional) — wraps `supabase auth admin generateLink` or a service-role-signed JWT for a named test user, so the harness can be re-run after future RLS changes without manual devtools dumping.
- `docs/imo-isolation-verification.md` — short runbook documenting the test users, expected output, and pass/fail criteria.

### Test user strategy (decision needed from Nick)
Three options, in increasing order of operational realism:

| Option | Realism | Risk | Effort |
|--------|---------|------|--------|
| Mint short-lived JWTs via service-role for synthetic test users | Low (synthetic) | None — test users only exist for harness | S |
| Create three real test users in remote prod via Admin UI, dump JWT from devtools | High (real auth) | Three extra rows in `user_profiles`; cleanup needed later | M |
| Borrow JWTs from existing real users (with consent) | Highest | Touching real colleague accounts; do not do this | — |

**Recommendation:** Option 2 once for initial proof, then Option 1 for ongoing CI-style re-runs. Document the test user emails in the runbook so future audits know what they're for.

### Pass/fail criteria
For each of `admin`, `trainer`, `contracting_manager` JWT:
- `GET /rest/v1/user_profiles?select=id,imo_id&imo_id=eq.<EPIC_LIFE_UUID>` → must return `[]`
- `GET /rest/v1/policies?select=id,imo_id&imo_id=eq.<EPIC_LIFE_UUID>` → must return `[]`
- `GET /rest/v1/commissions?select=id,imo_id&imo_id=eq.<EPIC_LIFE_UUID>` → must return `[]`
- For positive control, the same user querying their own IMO (Founders/Self Made) must return >0 rows. Without the positive control, "empty" might mean "policy works" or "the database has no rows at all."

### Dependencies
- Item #4a (H4) — service-role audit must be clean OR explicitly waived for the canary inserts, since `#2b` seeds Epic Life rows via service-role.
- Item #2 — Epic Life IMO exists on remote.
- Item #2b — at least one canary row each in `user_profiles`, `policies`, `commissions` attributed to Epic Life.

### Owner: Claude (write scripts + runbook); Nick (run against prod, judge pass/fail).
### Effort: M (3-5 hrs including test-user provisioning).
### Risk: Low. The migration is already live; this only observes behavior.

---

## Item 2 — Create Epic Life IMO on remote

### Scope
Local DB has Epic Life at `2fd256e9-9abb-445e-b405-62436555648a`. Remote does not. Need one row in remote `imos` table to act as the test tenant.

### Decision needed from Nick: creation path

| Path | Pros | Cons |
|------|------|------|
| **UI** (Settings → IMO Management → New IMO) | Audits the IMO-create flow under the new RLS; matches how a future real IMO would be created; visible diff in app logs | UUID is non-deterministic; if local UUID matters anywhere, this diverges |
| **One-shot migration** | Idempotent; can pin to same UUID as local for parity; reviewable via git | Bypasses the create-flow audit; one more migration file forever |

**Recommendation:** UI. The IMO-create flow is part of what's being trusted; exercising it on remote is itself a useful test. If UUID parity with local matters later (it probably doesn't — UUIDs are opaque), copy the local UUID into a future seed.

### Seeding agencies
**Recommendation: leave Epic Life bare initially.** Nick is the only agent for now. An empty Epic Life is the cleanest possible blast radius for the notification silence test (#3) — if zero `slack_integrations`, zero `pipeline_automations`, zero downstream rows exist, there is literally nothing to fire.

### Layer 2 integration check (do during this step)
- After creating Epic Life, log in as Nick and confirm the new IMO appears in the sidebar IMO switcher dropdown.
- Switch to Epic Life. Confirm `effectiveImoId` flips (devtools React DevTools or temporary console log).
- Switch back to Founders. Confirm session state restores cleanly.

### Dependencies
- Item #4a (H4) — must clear FIRST. `create-auth-user` and any onboarding edge function that inserts a user_profile must explicitly handle `imo_id` before Nick is the first user in a fresh IMO. If H4 surfaces a gap, fix it before creating Epic Life.

### Files affected
- None (UI-driven) OR one migration if Nick chooses migration path.

### Owner: Nick (UI clicks); Claude (verifies post-state via `run-sql.sh`).
### Effort: S (15 min).
### Risk: Low. IMO creation is reversible (delete the row) if it goes wrong.

### Item 2b — Seed canary rows (sub-task)
After Epic Life exists, seed exactly:
- One `user_profiles` row attributed to Epic Life (Nick's super-admin profile cloned, or a synthetic "epic-life-canary@thestandardhq.com").
- One `policies` row attached to that user.
- One `commissions` row attached to that policy.

This is the positive control for #1. Without it, the verification step cannot distinguish "RLS correctly hides Epic Life" from "Epic Life simply has nothing in it." Use `./scripts/migrations/run-sql.sh` with explicit `imo_id = '<EPIC_LIFE_UUID>'`. Service-role insert paths bypass RLS, so these inserts will land regardless of whether the user JWT could see them.

**This is also a live trigger test:** the canary inserts exercise `enforce_user_profile_imo_consistency` and `enforce_commission_reference_imo_consistency` in prod for the first time on a non-Founders IMO. If they reject, the trigger logic has a bug.

---

## Item 3 — End-to-end notification silence test

### Scope
Trigger every notification event under Epic Life and confirm zero side-effects to FFG/Self Made users. Notification channels in scope: Slack, Mailgun (email), SMS (Twilio), in-app notifications table.

### Configuration audit (do FIRST — before any trigger)
For each notification surface, confirm Epic Life has zero rows in its config table:

| Notification | Config table | Verify |
|---|---|---|
| Recruit add → Slack auto-post | `slack_integrations` filtered to Epic Life | `SELECT count(*) FROM slack_integrations WHERE imo_id = '<EPIC_LIFE_UUID>'` → 0 |
| Phase advance → Slack | `slack_integrations` + `pipeline_automations` | 0 rows in both |
| Policy log → Slack daily summary | `daily_sales_logs.integration_id` joined to Epic Life integrations | 0 |
| Milestone → SMS | `milestone_notifications` / `pipeline_automation_rules` | 0 |
| Recruit invitation email | `recruit_invitation_templates` per IMO | 0 |
| In-app notifications | `in_app_notifications` rows targeting non-Epic-Life users | 0 *after* test |

If any pre-test counts are non-zero, **stop and investigate** — that's a config leak, not something the silence test would catch.

### Trigger sequence
For each event below, perform under Epic Life (with `actingImoId = Epic Life`), then monitor for 5 minutes for any FFG/Self Made-visible side effect:

1. **Recruit add** — Add canary recruit via AddRecruitDialog. Expect: zero Slack messages in any channel, zero emails in Mailgun outbound log, zero rows added to `in_app_notifications` for non-Epic-Life user IDs.
2. **Phase advance** — Move the canary recruit through every phase (lead → in-progress → onboarded etc.). Expect: silence as above.
3. **Policy log** — Log a test policy under the canary user. Expect: no daily-log auto-post.
4. **Milestone** — Trigger a milestone (e.g. first policy = $X). Expect: no SMS, no Slack milestone post.
5. **Email pipeline automation** — If any exist, trigger one. Expect: no Mailgun delivery.

### Observation surfaces
- **Slack**: open The Standard / Self Made workspaces. Watch every channel the platform has ever posted to. (Channels the bot is NOT in are safe by definition.)
- **Mailgun**: `https://app.mailgun.com/app/sending/domains/.../logs` — filter by last 5 minutes after each trigger.
- **In-app**: `./scripts/migrations/run-sql.sh "SELECT user_id, created_at, type FROM in_app_notifications WHERE created_at > now() - interval '10 minutes'"` — every row's `user_id` must belong to Epic Life or be Nick's super-admin id.

### Pass/fail criteria
Pass: zero observable notifications to any non-Epic-Life identifier across all 5 events.
Fail: any leak. Document which event leaked into which channel. The plan ALSO surfaces a fallback (a per-IMO `notification_kill_switch` boolean column) but as a separate workstream — fixing the leaky surface at the source is preferred to a global gag.

### Dependencies
- Item #2 + #2b — Epic Life must exist with at least the canary recruit.
- Item #4a (H4) — service-role edge functions used by notification jobs must be safe.

### Files affected
None during the test itself. If a leak is found, add a `# Leak: <surface>` section to `plans/active/epic-life-isolation-completion-plan.md` with files-to-modify in a follow-up.

### Owner: Nick (clicks); Claude (queries + observation scripts).
### Effort: M (1-2 hrs end-to-end).
### Risk: Low to the system, **high to the project's premise** — a leak here means Layer 3 is wrong.

---

## Item 4 — Deferred review items (H4, H5, H6, tests)

### 4a — H4: Service-role edge function audit (BLOCKER)

**Why this is the first thing to do after this plan.** Service-role connections bypass RLS but DO fire BEFORE INSERT/UPDATE triggers. The two new triggers (`enforce_user_profile_imo_consistency`, `enforce_commission_reference_imo_consistency`) raise `check_violation` if `imo_id` cannot be derived. Any edge function that INSERTs without explicit `imo_id` is now broken in production.

#### Files to audit (greppable list)
```
supabase/functions/create-auth-user/index.ts        # creates user_profile rows
supabase/functions/stripe-webhook/index.ts          # writes user_profile (free plan), commissions?
supabase/functions/send-password-reset/index.ts     # writes user_profiles? (probably read-only)
supabase/functions/manage-subscription-items/       # touches user state
supabase/functions/business-tools-proxy/index.ts    # reads only?
supabase/functions/close-ai-builder/index.ts        # reads only?
supabase/functions/<any backfill/import/seed function>
```

#### Audit method
For each function:
1. `grep -nE "user_profiles|policies|commissions" supabase/functions/<name>/index.ts`
2. For every INSERT, confirm one of: (a) `imo_id` explicitly passed, (b) `agency_id`/`recruiter_id`/`upline_id` set such that the trigger can derive, (c) the function uses `get_my_imo_id()` via authenticated context.
3. For every UPDATE that touches `agency_id` or `imo_id`, confirm the trigger's update branch will accept it.

#### Pass/fail criteria
Every service-role write path either passes `imo_id` explicitly or has an upstream field set such that the trigger derives it. Test by invoking each function in local with an Epic Life context and confirming no `check_violation` errors in `supabase functions logs`.

#### Effort: M-L (4-8 hrs depending on how many functions exist).
#### Owner: Claude (audit + fixes), Nick (deploys after review).

### 4b — Tests

#### Scope: enumerate the test gap, prioritize what's critical
| Test | Location | Critical? |
|---|---|---|
| RLS isolation integration test (mirrors `scripts/verify-imo-isolation.sh` as a Vitest test) | `src/__tests__/integration/rls-imo-isolation.test.ts` | Yes — catches future RLS regressions |
| Trigger rejection unit tests (mismatched imo_id on commission INSERT, etc.) | `supabase/migrations/<test_helper>` or pgTAP if used | Yes — locks down the new triggers |
| `ImoContext` unit tests (sessionStorage persist, super-admin gate, cleanup on demotion, `queryClient.invalidateQueries` on switch) | `src/contexts/__tests__/ImoContext.test.tsx` | Yes — Layer 2 has zero tests |
| `AddRecruitDialog` agency-mismatch test (acting foreign IMO → omits `agencyId`) | existing dialog test file | Yes — easy regression to introduce |
| Service-role edge function smoke tests (post-H4) | per-function `__tests__/` | Medium — hard to write without local Supabase context |

#### Effort: L (1-2 days for the full set).
#### Owner: Claude.
#### Risk if skipped: every future migration touching RLS could silently re-leak. No regression net.

### 4c — H5: Storage RLS audit

#### Scope
`useUnderwritingGuides` and any other Storage upload path that uses `effectiveImoId`. Storage RLS lives in `storage.objects` policies; need to confirm:
1. Read policies on `underwriting-guides` bucket check `imo_id` (likely encoded in the path prefix).
2. Super-admin override is honored OR the upload path correctly writes to the `actingImoId` prefix.

#### Files to check
- `src/features/underwriting/hooks/guides/useUnderwritingGuides.ts` — confirms `effectiveImoId` used in upload path
- `supabase/migrations/<storage RLS migration>` — find via `grep -rn 'storage.objects' supabase/migrations`

#### Pass/fail criteria
Non-super-admin in IMO A cannot list/download objects under IMO B's prefix in `underwriting-guides`.

#### Effort: S-M (2-3 hrs).
#### Owner: Claude.
#### Priority: After tests but before Epic Life adds any guide uploads.

### 4d — H6: Paired down-migration

#### Scope
Write `supabase/migrations/YYYYMMDDHHMMSS_revert_harden_imo_scoped_operational.sql` that restores pre-Layer-1 RLS verbatim. Documentation artifact only — never run unless we discover Layer 1 was catastrophically wrong.

#### Content sketch
- DROP each of the new "in own IMO" policies, CREATE the original leaky ones (paste from `20260217123227_optimize_rls_auth_function_calls.sql`).
- DROP the two new triggers.
- DO NOT undo the backfills or the NOT NULL — data integrity gains are kept.

#### Effort: S (1 hr).
#### Owner: Claude.
#### Priority: Lowest. File exists as insurance; no one expects to run it.

---

## Item 5 — FFG/Founders agent agreement review (legal prerequisite)

### Scope
RLS protects against application-layer cross-tenant reads. It does NOT shield Nick from contractual obligations to FFG / Founders / individual carriers. The master plan flagged this as the actual legal exposure that technical work cannot solve.

### Documents to locate
- Nick's FFG / Founders Financial Group agent agreement (most likely in Nick's personal files, Founders agent portal, or Self Made onboarding packet).
- Self Made Financial agency agreement (if separate from the FFG agreement).
- Any individual carrier appointment agreements that contain non-solicit / non-compete language (these are usually carrier-specific, not IMO-specific, but worth checking).

### Clauses to flag
| Clause type | What to look for | Why it matters for Epic Life |
|---|---|---|
| **Non-solicit** | "shall not solicit / induce / attempt to recruit any agent of [FFG]" | Determines whether Nick can recruit existing FFG agents to Epic Life at all |
| **Non-compete** | "shall not directly or indirectly engage in [insurance distribution business]" with geographic + temporal scope | Determines whether Epic Life can operate AT ALL while Nick is still contracted to FFG |
| **Work-product / IP** | Anything assigning code, processes, templates, or "developments" created during the contract to FFG | Directly threatens The Standard HQ ownership claim |
| **Confidentiality** | Limits on reuse of FFG processes, agent lists, training materials | Limits what content can be ported to Epic Life |
| **Term & termination** | Notice periods, garden leave, post-termination restrictions | Determines timing of Epic Life launch |
| **Assignment / change of control** | Whether obligations survive Nick's transition | Determines whether even leaving FFG cleanly resolves the issue |

### Who to consult
**Almost certainly an insurance/employment attorney with non-compete experience in Colorado** (per existing Terms governing-law clause). Nick should not self-interpret these clauses — the cost of being wrong (injunctive relief, tortious interference claim) vastly exceeds attorney fees.

### Decision gate
The contract review outcome may invalidate or reshape the entire Epic Life recruiting plan. Three possible outcomes:

1. **Clear runway** — no non-solicit, narrow non-compete that doesn't cover Epic Life's activity. Proceed.
2. **Restricted runway** — non-solicit covers FFG agents only, but Nick can recruit greenfield. Proceed with named-exclusion list of off-limits agents.
3. **Blocked** — broad non-compete or IP claim threatens Epic Life itself. Halt all recruiting. Technical infrastructure still has value (it's Nick's IP regardless), but live operation must wait.

### Hard prerequisite
**No real Epic Life recruiting activity until this review is complete and the outcome is documented.** Technical readiness (#1–#4) can proceed in parallel, but the moment a real candidate is contacted under the Epic Life banner, contractual exposure begins. Add a written go/no-go note from Nick (or counsel) before that line is crossed.

### Owner: Nick (sole owner — Claude cannot help with this).
### Effort: External — depends on attorney availability.
### Priority: Begin immediately, runs async to all other work.

---

## Risk callouts (from prior session's strict review)

These review findings were deferred from the prior session. Each is now scheduled above, but worth restating:

| Finding | Status | Resolved by |
|---|---|---|
| **H1** — Layer 1 has no verification | Open | Item #1 (verification harness) |
| **H4** — Service-role edge function audit | Open / BLOCKER | Item #4a |
| **H5** — Storage RLS for underwriting guides | Open | Item #4c |
| **H6** — Paired down-migration | Open | Item #4d |
| **Tests** — Zero tests added in prior session | Open | Item #4b |

---

## Effort summary

| Item | Effort | Owner | Blocks recruiting? |
|---|---|---|---|
| #4a — H4 audit | M-L | Claude | **Yes** |
| #2 — Create Epic Life | S | Nick | Yes |
| #2b — Seed canary rows | S | Claude | Yes (gates #1) |
| #1 — RLS verification | M | Claude + Nick | Yes |
| #3 — Notification silence | M | Nick + Claude | Yes |
| #4b — Tests | L | Claude | No (defensive) |
| #4c — H5 Storage | S-M | Claude | No (gates UW guide use) |
| #4d — H6 Down-migration | S | Claude | No (paperwork) |
| #5 — Agreement review | External | Nick + attorney | **Yes** (separate gate) |

**Two gates to "Epic Life can safely receive a real recruit":**
1. Technical: #4a → #2/#2b → #1 → #3 all green.
2. Legal: #5 green.

Both must clear independently. Either alone is insufficient.

---

## Decisions needed from Nick before execution

1. **Test user provisioning for #1**: synthetic short-lived JWTs vs. real test accounts in prod? (Recommendation: real once, synthetic ongoing.)
2. **Epic Life creation path for #2**: UI vs. migration? (Recommendation: UI.)
3. **Seed Epic Life with any agencies, or leave bare?** (Recommendation: bare.)
4. **Attorney for #5**: existing relationship or new engagement?
5. **Acceptable timeline**: is the technical critical path (#4a → ... → #3) targeted for this week, or stretched to allow tests (#4b) to land in parallel?

---

## Out of scope for this plan

- Separate Supabase project / separate deployment. The master plan flagged this as the maximum-isolation option; out of scope until contractual review concludes.
- Vercel deployment logs, Mailgun history, Slack history, git history scrubbing. Non-code risks per the master plan.
- Multi-IMO support for agents (one agent, many IMOs). Current architecture is one-IMO-per-user with super-admin override; this plan does not extend that.
- Any UI rework around the IMO switcher beyond what shipped in Layer 2.
