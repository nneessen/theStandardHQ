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

### 3.1 Condition ontology — ✅ DONE (2026-05-30, LOCAL only, UNCOMMITTED)
**Migration:** `supabase/migrations/20260530141719_seed_underwriting_condition_ontology.sql` — seeds **11** conditions (idempotent `ON CONFLICT(code)`): `diabetes, heart_attack, heart_disease, atrial_fibrillation, high_blood_pressure, stroke, cancer, copd, depression, anxiety, bipolar`. **Contract test:** `src/services/underwriting/__tests__/condition-ontology-factmap.test.ts` (transform→buildFactMap; 2 pass). Build green; 283 underwriting vitest pass.

**Load-bearing learnings (correct the plan's simplifications):**
- The ground truth for the vocabulary is **`src/services/underwriting/core/conditionResponseTransformer.ts`** (imported by the edge engine at `engine.ts:5`, so it survives wizard deletion). It handles exactly these codes: diabetes, heart_disease, heart_attack, stroke, high_blood_pressure, cancer, copd, depression, anxiety, bipolar. **`atrial_fibrillation` has NO transformer → pass-through** (field ids ARE fact names; rules match raw option values verbatim, e.g. `atrial_fibrillation.rate_controlled = "Yes"`).
- **THE contract (silent failure if wrong):** `follow_up_schema.questions[].id` = the transformer's **READ (input)** fields, with `options` matching the transformer maps **exactly**. The transformer **DERIVES** the fact names rules reference. e.g. diabetes collects `treatment` (option `"Oral medication only"` → fact `diabetes.insulin_use=false`), `a1c_level` (→ `good_control`), `diagnosis_age` (→ `years_since_diagnosis`); heart_attack collects `date_of_event` (→ `years_since_event`). **Never collect a derived fact directly** — the transformer ignores it → fact silently `undefined` → abstains. The intake prompt (3.3) MUST emit these exact option strings.
- **Scope narrowed honestly to 11** (the conditions the engine can transform today) — NOT the plan's nominal 80–150 (which would be medically-unreviewed). Breadth is added later alongside new transformers. `acceptance_key_fields`/`knockout_category`/`risk_weight` left NULL (no business reader; verified).
- No `database.types.ts` regen needed (pure data seed, no DDL).

**STILL TODO for 3.1 (handoff):**
- **Apply the migration to REMOTE** (prod `pcyaqwodnyrpkaiojnpz`) — it is LOCAL-only right now. The Jarvis tool reads prod, so the ontology must be on prod before 3.3 can demo. (Re-run the runner against the remote `DATABASE_URL`, or apply via the prod path.)
- **DEFERRED (plan's 3.1 validation gate):** running the **extractor** in validation mode is a different vocabulary (extractor-emitted codes ≠ transformer codes) and belongs with Phase 2 ingestion — NOT done this session, do not claim it.

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
