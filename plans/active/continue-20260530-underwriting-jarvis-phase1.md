# CONTINUATION — Underwriting → Jarvis redesign: Phase 1 (Phase 0 is DONE)

**Created:** 2026-05-30 · **For:** the next Claude Code session · **Action:** implement Phase 1 ONLY after owner go-ahead.

> ⚠️ **Do NOT auto-start.** Phase 0 is complete; Phase 1 is large (condition ontology + real rules + Jarvis wiring + deleting the wizard + compliance) and needs the owner's explicit green-light. Confirm before beginning.

---

## 0. Read these first (in order)
1. **Plan (source of truth):** `plans/active/underwriting-jarvis-redesign-2026-05-30.md` — §5 is Phase 1. Read fully; it's code-verified + red-teamed.
2. **Memory:** `~/.claude/projects/-Users-nickneessen-projects-commissionTracker/memory/project_underwriting_jarvis_redesign.md` (has the "PHASE 0 IMPLEMENTED" section — load-bearing).
3. Do NOT trust the Jan–Mar 2026 underwriting wiki — stale, superseded by the plan.

## 1. What Phase 0 already delivered (don't redo it)
All in the **live edge engine** `supabase/functions/_shared/underwriting/engine.ts` (UNCOMMITTED on main; not deployed):
- Dedicated **`assessable: boolean`** abstain flag on the approval result + optional `assessable?` on shared `ApprovalResult` / `Recommendation` / `SessionRecommendationInput`. Signal = `allStatedConditionsMatched && isAssessableClass(aggregated.healthClass)` (globals-immune).
- Exported for reuse/tests: `computeApproval`, `ClientProfile`, `ApprovalComputation`, `toRateTableRecommendation`, **`INSUFFICIENT_DATA_REASON`** (= `"Insufficient carrier data — manual review"`).
- Price removed from ranking (`finalScore = approvalLikelihood × dataConfidence × confidenceMultiplier`; 4 price buckets gone; grouped by product type).
- `alwaysMatch?:true` predicate marker added (type + Zod + `evaluatePredicate`); **its auto-approve gate use is Phase 2, not Phase 1.**
- Non-assessable products surface NO quoted class/premium (leak via `healthClassUsed`/`monthlyPremium` was found in review + fixed at the engine boundary).
- Tests: `supabase/functions/_shared/underwriting/__tests__/engine.test.ts` (5) via `scripts/test-underwriting-engine.sh`.
- Build is now GREEN (the 2 pre-existing unrelated errors in `contactService.ts`/`documentStorageService.ts` were fixed 2026-05-30 so deploys pass).

**Phase 0 only separates eligible vs abstain.** Every likelihood is 0.5 until curated condition rules exist (Phase 1 §5.2 seeds the first ones). A real probability ranking is Phase 2.

## 2. Load-bearing facts (easy to get wrong)
- **Live path = the edge engine.** The Jarvis tool calls `computeAuthoritativeUnderwritingRun` **directly (imported, no HTTP)**, exactly like `run-underwriting-session`. The frontend `src/services/underwriting/{workflows/decisionEngine.ts, workflows/ruleEngineV2Adapter.ts, core/approval-scoring.ts}` ranking path is DEAD — DELETE it in 5.4, do not wire it.
- **`deno check` baselines (pre-existing, NOT yours):** `engine.ts` = 5 errors, `run-underwriting-session/index.ts` = 6. The new `assistant-orchestrator` tool will import the engine too → expect the same propagated errors. The contract is **introduce no NEW deno-check errors** (compare against HEAD by stashing). `npm run build` (frontend tsc) does NOT cover edge code; `deno check` is the edge type gate.
- **Client typing (verified):** do **NOT** add a `fullClient` slot to `AssistantToolContext` (its header bans esm.sh imports so `tools/` stays offline-unit-testable). `index.ts:59` already builds the anon+user-JWT client and narrows it via `db as unknown` at `:149`. In the handler, **cast `ctx.db` back UP to `SupabaseClient<Database>`** at the tool boundary (mirror the existing downcast). RLS-scoped, zero invariant break.
- **`requiredPermissions:[]` is MANDATORY** for the tool (`guard.ts:31` denies all non-super-admins for any non-empty value; `index.ts:277` hardcodes user permissions to `[]`).
- **Editing the 6 orchestrator files has NO effect until you DEPLOY the `assistant-orchestrator` Deno edge function.** Smoke-test the live path after deploy (typed text turn first).

## 3. Phase 1 work (plan §5) — checklist

### 3.1 Condition ontology — seed `underwriting_health_conditions` (~1 wk incl. medical review)
- Migration via the runner: `./scripts/migrations/run-migration.sh supabase/migrations/$(date +%Y%m%d%H%M%S)_seed_uw_conditions.sql`.
- ~80–150 canonical conditions; each row: `condition_code`, display name, category, `follow_up_schema`. The schema must be **medically correct** and cross-checked against guide vocabulary + `src/services/underwriting/core/derivedConditionCodes.ts` (the extractor validates emitted codes against this table — uncovered codes fail).
- **Medication→condition facts (the 55F example depends on it):** there is NO separate meds step in the Jarvis flow. `follow_up_schema` for med-driven conditions MUST include the control fields (diabetes → `a1c`, `insulin_use`, `years_since_diagnosis`, `complications`; cardiac → `event_date`, `procedure`, `ejection_fraction`; AFib → `type`, `anticoagulated`, `rate_controlled`). The intake prompt (3.3) must translate stated meds ("metformin, no insulin") → `insulin_use:false` / oral-control.
- After seeding: run extraction in **validation mode against ≥1 guide** to confirm the ontology covers the extractor's emitted codes.
- After any migration: regen `database.types.ts` (`npx supabase gen types typescript --project-id pcyaqwodnyrpkaiojnpz > src/types/database.types.ts`) and commit.

### 3.2 Seed + APPROVE 3–5 real American Amicable condition rules (AFib / MI-recency / T2DM)
Author by hand from the AmAm guide; set `review_status='approved'`. Without these, Phase 1 can ONLY demo abstention (0 approved condition rules exist). These become the live demo + first **golden-test** cases. Honest expectation: this is what turns "Jarvis correctly said manual review" into "Jarvis gave a curated AmAm answer."

### 3.3 Wire the Jarvis underwriting tool + agent — 6 files (recipe verified)
- `core/types.ts`: add `"underwriting"` to `ToolCategory` + `AgentKey` unions.
- `core/registry.ts`: `getUnderwritingRecommendation` — `category:"underwriting"`, `riskLevel:"read"`, `requiresApproval:false`, **`requiredPermissions:[]`**.
- `tools/getUnderwritingRecommendation.ts` (NEW): flat model args → `UnderwritingRawPayload` → **`computeAuthoritativeUnderwritingRun` imported directly**. `conditions` is an **enum of the seeded codes** (model maps free text → canonical codes). Returns standard `{available, reason?, data}` `DataSection` (existing `grounding.ts` works unmodified). Early-abstain if `imoId` null. **Surface the `assessable` flag + `INSUFFICIENT_DATA_REASON`** in the `DataSection` so abstention reaches the user.
- Client: cast `ctx.db` UP to `SupabaseClient<Database>` at the boundary (see §2). NO `fullClient` slot.
- `core/agents.ts`: `underwriting` agent with a **hard anti-hallucination prompt** — never invent approval/decline/class; every verdict traces to a tool result this turn; if all products are `unknown`/abstain, **ask the follow-up questions** (A1C, exact MI date, AFib control) instead of answering; surface `dataWarning`; advisory read, not a binding decision.
- `core/routing.ts`: underwriting intent regex BEFORE the generic copy matcher.
- Offline unit tests in `tools/__tests__/` (mirror existing). Then **DEPLOY assistant-orchestrator** + smoke test.

### 3.4 Remove the consumer wizard — 16 files + 2 barrels (plan §5.4)
- **Confirm-dead-then-delete:** before deleting `services/underwriting/workflows/decisionEngine.ts`, `workflows/ruleEngineV2Adapter.ts`, `core/approval-scoring.ts`, grep for non-wizard importers (`approval-scoring.ts` is read by `RecommendationsStep.tsx`; all should be wizard-only).
- Delete: `components/Wizard/*`, `components/SessionHistory/WizardSessionHistory.tsx`, `hooks/wizard/useDecisionEngineRecommendations(.test).ts`, `hooks/wizard/useUnderwritingAnalysis.ts`, `utils/wizard/*`, the 3 dead ranking files above.
- **Update BOTH barrels** (`hooks/index.ts`, `features/underwriting/index.ts`) — they re-export wizard-only symbols; dangling exports fail the build.
- **KEEP:** `hooks/wizard/useUnderwritingFeatureFlag.ts` (`useCanManageUnderwriting` used by admin) and `useUWWizardUsage.ts` (quota).
- Nav/routes: remove UW Wizard entry in `sidebar-nav.config.ts` (KEEP UW Admin); remove wizard route + lazy import in `router.tsx` (locate by symbol — line numbers drift).
- Also retire `underwriting-ai-analyze` as a verdict source (its only caller is the deleted `useUnderwritingAnalysis.ts`).
- **Compliance replacement (don't hand-wave):** decide where the disclaimer shows in the Jarvis flow (one-time modal vs per-response header — may be E&O); decide how session history is surfaced for audit; **KEEP usage-quota gating** — the Jarvis tool records each run via `record_uw_wizard_run` against the same quota/seat/feature-flag entitlements so billing doesn't break.

## 4. Phase 1 exit test (honest)
In Jarvis, the 55F utterance → Jarvis parses it, runs the **edge** engine, and **(a)** for the 3–5 seeded AmAm condition rules returns a curated read with the matched rule + page, **(b)** for everything else returns honest **"no curated rules for these carriers — manual review,"** and **(c)** asks for the high-value missing follow-ups (A1C, exact MI date, AFib control).

## 5. Per-phase DoD discipline (CLAUDE.md)
Migration via runner → regen `database.types.ts` → `npm run build` zero errors → add/maintain passing unit tests (ontology coverage, curated-vs-abstain) → run `./scripts/test-underwriting-engine.sh` + `./scripts/test-assistant-edge.sh` → **DEPLOY assistant-orchestrator** (no effect until deployed) → live smoke test (typed text turn first). One `code-review` pass on the diff.

## 6. Do NOT start without owner go-ahead. After Phase 1, get sign-off before Phase 2 (ingestion engine).
