# CONTINUATION — Underwriting → Jarvis redesign: start Phase 0

**Created:** 2026-05-30 · **For:** the next Claude Code session · **Action:** begin implementation of Phase 0.

---

## 0. Read these first (in order)

1. **The plan (source of truth):** `plans/active/underwriting-jarvis-redesign-2026-05-30.md` — read it fully. It is code-verified (6-agent review) and adversarially red-teamed (4-agent). Do not re-derive it.
2. **Memory:** `~/.claude/projects/-Users-nickneessen-projects-commissionTracker/memory/project_underwriting_jarvis_redesign.md` (load-bearing correctness facts) and the MEMORY.md index line.

Do NOT trust the Jan–Mar 2026 underwriting wiki — it is stale and superseded by the plan.

---

## 1. Locked context (owner-ratified 2026-05-30 — do not relitigate)

- **Goal:** an agent describes a client in plain language to Jarvis → ranked carrier+product list by **probability of APPROVAL** (NOT price). The agent pulls their own quotes after. North star example: *"55-year-old female, AFib, heart attack 3 years ago, type 2 diabetes on metformin (no insulin), 5'5"/150lb, non-smoker — who approves her?"*
- **No premiums/rates** — `premium_matrix` work is out of scope (but premium math is wired into the live scoring at 0.6 weight, so it must be actively edited out — see Phase 0.2).
- **Jarvis-only** consumer UI; remove the sidebar wizard (Phase 1). Keep + grow the admin curation surface.
- **Ingestion (Phase 2):** confidence-gated auto-commit with a safety carve-out — auto-approve only global/administrative rules; medical/adverse-outcome rules always get a FAST human review. **Build** the PDF→rules pipeline (no third-party feed).
- **Architecture:** AI at the edges (parse + explain), deterministic core (decide), honest abstention; curated vs advisory(RAG) vs abstain trust tiers.

## 2. THE load-bearing correctness fact (get this wrong and Phase 0 is worthless)

All live verdict logic is in the **BACKEND EDGE engine** `supabase/functions/_shared/underwriting/engine.ts` — the only thing `run-underwriting-session` (and the future Jarvis tool) calls. The frontend `src/services/underwriting/{workflows/decisionEngine.ts, workflows/ruleEngineV2Adapter.ts, core/approval-scoring.ts}` ranking path is **DEAD wizard code** (`getRecommendations` has no live callers) — it gets DELETED with the wizard in Phase 1, **not patched.** **Every Phase-0 edit targets the edge engine.**

**FIRST STEP, before touching anything:** re-confirm the dead/live split with a quick call-graph grep (cheap insurance):
```
grep -rn "getRecommendations(" src supabase | grep -v "function getRecommendations\|export"
grep -rn "computeAuthoritativeUnderwritingRun" supabase src
```
Expect: `getRecommendations` has no real call sites; `computeAuthoritativeUnderwritingRun` is called by `run-underwriting-session` (and will be by the new Jarvis tool). If that's NOT what you find, STOP and re-evaluate before editing.

---

## 3. Phase 0 — Make the engine honest (~1 week, pure code, NO data dependency)

Today the engine silently scores a no-data / high-risk client as **Standard/Preferred** and an unconstrained AI path narrates a confident verdict. The 55F example currently reads as average-to-preferred. Fix all of this in `_shared/underwriting/engine.ts`:

**3.1 Abstain, never average (type-safe).**
- `mapHealthClass()` (≈engine.ts:198–222) collapses `unknown|refer|decline → 'standard'`. Its return type is the premium-matrix `HealthClass` union which has **no** unknown/refer/decline members, so you CANNOT `return 'unknown'`. **Add a dedicated `assessable: boolean` (or `eligibilityStatus: 'insufficient_data'`) field** to the approval result; leave `healthClass` null/omitted when not assessable. Do not widen the premium union.
- `applyBuildConstraint()` (≈engine.ts:224–258, runs ≈:773–806) does `severity[class] ?? 3` → a SECOND silent collapse to standard. When the class is non-assessable, pass it through unchanged (apply no build constraint).
- Empty-conditions short-circuit → `likelihood:0.95, healthClass:'preferred'` (≈engine.ts:493–503). Distinguish "no conditions entered" from "verified healthy"; do not score Preferred.
- **Renderer (new):** map the abstain flag → user-facing string **"insufficient carrier data — manual review"** in `buildSessionRecommendations`/`toRecommendation` (≈:1087–1102). (The Jarvis-tool `DataSection` consumer comes in Phase 1.)

**3.2 Rank by approval probability, not price.**
- `calculateScore` `priceScore` defaults to 0.5 (premium null) weighted **0.6** (≈engine.ts:273–292, :1038–1039), and the four recommendation buckets (best_value/cheapest/best_approval/highest_coverage) are labeled **by array index** with no real price filter (≈:1087–1102). **Gut/branch the priceScore; rank by `approvalLikelihood × dataConfidence`; remove the premium filter; strip the four price buckets; group recommendations by product type.**
- **Honest expectation:** with 0 curated condition rules every likelihood is 0.5, so Phase 0's *visible* result is **eligible vs abstain**, NOT a probability-ordered list. A real ranking arrives in Phase 2 when condition rules land. Reflect this in any test assertions / messaging.

**3.3 One source of truth.** Ensure nothing surfaces a verdict from `underwriting-ai-analyze` (free-reasoning over raw guide text). It is called only by the wizard hook being deleted in Phase 1; in Phase 0 just confirm the authoritative path is the edge engine and no AI verdict is rendered. Full retirement happens with the wizard deletion.

**3.4 Predicate safety (gates Phase 2 auto-approve; coordinate carefully).** Empty `{root:{}}` predicates always-match (`ruleEvaluator.ts:642–644`). These are an INTENTIONAL sanctioned fallback today (`validatePredicate` blesses them). Introduce an explicit `alwaysMatch:true` marker and migrate legitimate fallbacks to it; scope any "empty → unknown" treatment to the **auto-approve gate only** (Phase 2) so you don't silently neutralize existing fallback rules. If this proves entangled, it's acceptable to land only the `alwaysMatch:true` marker in Phase 0 and complete the gate logic in Phase 2 — note the decision.

---

## 4. Phase 0 Definition of Done

- **Unit test on the edge engine:** the 55F AFib/MI/diabetes profile → returns `assessable:false` / "insufficient carrier data — manual review" (NOT Standard/Preferred). Add it; it must pass.
- `npm run build` → **zero** TypeScript errors (Vercel strict).
- All existing Vitest + edge tests pass (CLAUDE.md mandates 100%).
- No migration in Phase 0 → no `database.types.ts` regen needed.
- The edge engine change affects `run-underwriting-session`; its real user-visible effect lands in Phase 1 (Jarvis tool). Deploy `run-underwriting-session` if you want it live now, but it's not required for Phase 0 sign-off.
- **One code-review pass** before declaring done: a single `code-reviewer` subagent on the diff, or run `/code-review`. (Ultracode/multi-agent fan-out is NOT needed for this focused task.)

## 5. What comes after (do NOT start without owner go-ahead)
Phase 1 = condition ontology seed + seed/approve 3–5 real American Amicable condition rules + Jarvis tool/agent (6-file recipe in plan §5.3, note the `ctx.db` cast-up — do NOT add a `fullClient` slot) + remove the wizard (16 files + barrels) + compliance replacement. See plan §5. Phases 2–4 in the plan. **Stop after Phase 0 and report; let the owner green-light Phase 1.**

## 6. Gotchas
- Edge code is Deno (`_shared/underwriting/*`, `supabase/functions/*`). Frontend mirror in `src/services/underwriting/*` is being deleted — don't waste effort keeping it in sync; confirm-dead-then-delete in Phase 1.
- Use `node scripts/dbtype.mjs <name>` / `--list` for schema; never read `src/types/database.types.ts` whole (a hook blocks it). Read-only SQL via `./scripts/migrations/run-sql.sh`.
- The owner's example depends on medications mapping into diabetes follow-up facts (metformin → oral control, no insulin) — relevant to Phase 1's ontology + intake prompt, not Phase 0.
