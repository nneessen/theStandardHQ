# CONTINUATION — Underwriting → Jarvis: Phase 1.3 (wire + deploy the Jarvis underwriting tool)

**Created:** 2026-05-30 · **For:** a fresh session · **Action:** wire the Jarvis underwriting tool/agent, deploy the orchestrator, smoke-test. This is the first session that ends in a **prod edge-function deploy**, so start clean.

> ⚠️ Confirm with the owner before deploying. Everything before the deploy is safe/local; the deploy is the outward step.

---

## 0. Read first (in order)
1. **Reference doc (current):** `docs/underwriting-jarvis-engine-honesty-and-curation.md` — the May 2026 redesign, the engine-honesty design, the curation state, and the remote-apply incident.
2. **Plan:** `plans/active/underwriting-jarvis-redesign-2026-05-30.md` §5.3 (the 6-file Jarvis recipe — mechanically verified) and §5.4 (wizard removal = Phase 1.4).
3. **Prior handoff:** `plans/active/continue-20260530-underwriting-jarvis-phase1.md` §3.3/§3.4 (the same recipe in detail) — but note 3.1/3.2 are DONE (see below).
4. **Memory:** `project_underwriting_jarvis_redesign.md`.

## 1. What's already done (committed to `main`, local-not-pushed, + applied to REMOTE prod)
- **Phase 0** — engine honesty (commits `5c188190`/`510f070f`): `assessable` abstain flag, rank-by-approval-not-price, `alwaysMatch` marker, leak suppression.
- **Phase 1.1** — 142-condition ontology on prod (`underwriting_health_conditions`); the `follow_up_schema` ⇄ `conditionResponseTransformer.ts` contract.
- **Phase 1.2** — first approved AmAm "Term Made Simple" condition rules on prod (commit `bdcbe6ac`): `high_blood_pressure` controlled→Standard / uncontrolled→Decline; `atrial_fibrillation` any→Decline. Hardening fixes (`cb5c87e9`) + a corrective ontology restore (`c0b0c016`).
- **Exported for reuse:** `computeApproval`, `computeAuthoritativeUnderwritingRun`, `evaluateProduct`, `ClientProfile`, `ProductEvaluationContext`, `toRateTableRecommendation`, `INSUFFICIENT_DATA_REASON` (all from `supabase/functions/_shared/underwriting/engine.ts`).

## 2. Load-bearing facts (get these wrong and 1.3 fails silently)
- **Live path = the edge engine.** The Jarvis tool calls `computeAuthoritativeUnderwritingRun` **directly (imported, no HTTP)**, exactly like `run-underwriting-session/index.ts` (use it as the template).
- **Client typing:** do **NOT** add a `fullClient` slot to `AssistantToolContext` (its header bans esm.sh imports so `tools/` stays offline-unit-testable). `index.ts:59` already builds the anon+user-JWT client and narrows it via `db as unknown` at `:149`. In the handler, **cast `ctx.db` back UP to `SupabaseClient<Database>`** at the tool boundary (mirror the existing downcast). RLS-scoped, zero invariant break.
- **`requiredPermissions:[]` is MANDATORY** (`guard.ts:31` denies all non-super-admins for any non-empty value; `index.ts:277` hardcodes user permissions to `[]`).
- **Deploy coupling:** editing the 6 files has **no effect** until you deploy the `assistant-orchestrator` Deno edge function. First smoke check = a **typed text turn** (not voice).
- **Drift caveat:** LOCAL is under-seeded (missing ~131 conditions + the AmAm rules were applied to remote; local has only the 11 reconciled). **The Jarvis tool reads prod (RLS-scoped user JWT), so smoke-test against the deployed function / prod, not local.** If you need local parity, reconcile the drift first (apply the historical condition migrations to local) — but it's not required to deploy+smoke-test.
- **Tenancy caveat (deferred §6.7):** rules are seeded under the sentinel IMO `ffffffff-…`. The loader (`repositories.ts:324`) filters by exact `imo_id`, so they're visible to **Founders (= sentinel, the only reachable consumer today)** but not other IMOs. Fine for the demo; do not "fix" the loader without an owner decision.

## 3. The 6-file recipe (Phase 1.3)
All under `supabase/functions/assistant-orchestrator/`:
1. **`core/types.ts`** — add `"underwriting"` to the `ToolCategory` and `AgentKey` unions.
2. **`core/registry.ts`** — register `getUnderwritingRecommendation`: `category:"underwriting"`, `riskLevel:"read"`, `requiresApproval:false`, **`requiredPermissions:[]`**.
3. **`tools/getUnderwritingRecommendation.ts`** (NEW) — flat model args → build an `UnderwritingRawPayload` (see `_shared/underwriting/payload.ts` + how `run-underwriting-session` builds it) → call **`computeAuthoritativeUnderwritingRun({ client: ctx.db cast-up, payload, imoId, requestId })`** directly. Return the standard `{ available, reason?, data }` `DataSection` (existing `grounding.ts` works unmodified). **Surface the `assessable` flag + `INSUFFICIENT_DATA_REASON`** in the data so abstention reaches the user. Early-abstain (`available:false`) if `imoId` is null.
4. **`core/agents.ts`** — an `underwriting` agent with a **hard anti-hallucination prompt**: never invent approval/decline/class; every verdict traces to a tool result this turn; if products are `unknown`/abstain, **ask the high-value follow-ups** (A1C, exact MI date, AFib control) instead of answering; surface `dataWarning`; advisory read, not a binding decision.
5. **`core/routing.ts`** — an underwriting-intent regex **before** the generic copy matcher.
6. **`tools/__tests__/`** — offline unit tests (mirror `tools.test.ts`/`close-tools.test.ts`): the tool performs no writes, abstains when `imoId` null, and shapes a valid `DataSection`.

**Conditions enum decision (resolve in 1.3):** the tool's `conditions` arg should be an enum the model maps free text into. The pragmatic set = the **transformer-backed codes** (`diabetes, heart_attack, heart_disease, stroke, high_blood_pressure, cancer, copd, depression, anxiety, bipolar`) **+ `atrial_fibrillation`** — these are the codes that can actually produce facts/rules today. (The full 142-code ontology is too large for an enum and most lack transformers/rules → they'd abstain anyway.) Document the choice.

## 4. DoD (Phase 1.3)
- 6 files wired; offline `tools/__tests__/` pass; `deno check` introduces **no new** errors vs HEAD (baseline: engine 5, `run-underwriting-session` 6 — stash-compare); `npm run build` 0 errors; `./scripts/test-underwriting-engine.sh` + `./scripts/test-assistant-edge.sh` green.
- **Deploy `assistant-orchestrator`** (it has no effect until deployed).
- **Live smoke test (typed text turn first):** as the Founders super-admin, a "controlled high blood pressure, 1 med, normal readings" client → Jarvis returns a curated **Standard** for AmAm Term Made Simple (the proven surfacing win). And an impaired/no-rule client → honest "insufficient carrier data — manual review" + the agent asks follow-ups.
- One `code-review` pass on the diff.

## 5. Honest expectations
- The visible demo is **controlled-HBP → curated Standard**. The impaired 55F (AFib + recent MI + diabetes) still **abstains/declines** — AmAm Term Made Simple declines that profile, curated declines are invisible (dropped at `engine.ts:828`), and the graded/GI product that might approve her needs a guide ingested (Phase 2). Do not claim the 55F "who approves her" demo works yet.

## 6. After 1.3 (do NOT bundle): Phase 1.4 = remove the wizard
16 files + 2 barrels + compliance replacement (disclaimer placement, session-history audit, keep `record_uw_wizard_run` quota). See plan §5.4 / prior handoff §3.4. Confirm-dead-then-delete the frontend ranking path (`decisionEngine.ts`/`ruleEngineV2Adapter.ts`/`approval-scoring.ts`). Separate session.
