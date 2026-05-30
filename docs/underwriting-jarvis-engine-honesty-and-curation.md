# Underwriting → Jarvis Redesign: Engine Honesty + Curation (Phases 0–1.2)

**Date:** 2026-05-30 · **Status:** Phases 0–1.2 committed to `main` (local, not pushed) and applied to **remote prod** (ontology + AmAm rules). A drift-induced overwrite incident during the remote-apply was caught and remediated (see "Remote-apply incident" below). Jarvis tool/agent not yet wired or deployed (Phase 1.3).

This documents the load-bearing design decisions and correctness facts behind making
the underwriting engine *honest* and seeding the first real curated carrier rules. It
supersedes the Jan–Mar 2026 wiki where they conflict.

## Scope decisions (owner-locked, 2026-05-30)

- **Rank by probability of APPROVAL, not price.** No premiums/rate sheets/`premium_matrix`.
  The agent pulls their own quotes after the engine picks carrier+product. *Consequence:*
  premium math was hard-wired into the live scoring at 0.6 weight, so honoring "no price"
  required actively editing the scoring (not just declaring premiums dormant).
- **Jarvis-only consumer UI.** The sidebar wizard is removed; the admin curation surface stays.
- **Honest abstention.** When the engine lacks curated data it must abstain ("insufficient
  carrier data — manual review"), never fabricate a favorable verdict.
- **Confidence-gated ingestion** (Phase 2) with a safety carve-out: auto-approve only
  global/administrative rules; medical/adverse-outcome rules always get a fast human review.

## The one load-bearing correctness fact

All live verdict logic is in the **backend EDGE engine**
`supabase/functions/_shared/underwriting/engine.ts` — the only thing `run-underwriting-session`
(and the future Jarvis tool) calls via `computeAuthoritativeUnderwritingRun`. The frontend
`src/services/underwriting/{workflows/decisionEngine.ts, workflows/ruleEngineV2Adapter.ts,
core/approval-scoring.ts}` ranking path is **dead wizard code** (`getRecommendations` has no
live callers) and is deleted with the wizard, not patched. Every engine change targets the edge engine.

## Phase 0 — Make the engine honest (committed: 510f070f, build fixes 5c188190)

The engine was well-built but unsafe when data-starved: it silently mapped
`unknown|refer|decline` health classes → `standard` and no-conditions → `preferred 0.95`,
so a 55-year-old with AFib, a recent MI, and diabetes read as average-to-preferred risk.

- **Abstain via a dedicated `assessable: boolean` flag**, not a nullable `healthClass`
  (the premium-matrix `HealthClass` union has no unknown member, and widening it would break
  the dead frontend that must still compile in Phase 0). The signal is
  `allStatedConditionsMatched && aggregated.eligibility === 'eligible' && isAssessableClass(aggregated.healthClass)`
  — **globals-immune**: any stated condition without an approved rule forces abstention
  regardless of administrative global rules (verified: the synthetic no-rule outcome ranks 10
  in `HEALTH_CLASS_RANK`, dominating aggregation). Empty-conditions no longer scores Preferred.
- **Rank by approval probability, not price:** `priceScore` pinned to 0;
  `finalScore = approvalLikelihood × dataConfidence × confidenceMultiplier`; the four
  index-labeled price buckets removed; recommendations grouped by product type.
- **Suppress fabricated class/premium for non-assessable products** at the engine boundary —
  abstention had leaked via `healthClassUsed`/`monthlyPremium`, not `healthClassResult`.
- **`alwaysMatch:true` predicate marker** added to distinguish intentional catch-alls from
  accidental empty predicates (the auto-approve gate that consumes it is Phase 2).

## Phase 1.1 — Condition ontology + the transformer contract (local, uncommitted)

Seeded 11 conditions into `underwriting_health_conditions` (migration `20260530141719`):
`diabetes, heart_attack, heart_disease, atrial_fibrillation, high_blood_pressure, stroke,
cancer, copd, depression, anxiety, bipolar`.

**THE silent-failure contract (most important fact in this area):** the vocabulary ground
truth is `src/services/underwriting/core/conditionResponseTransformer.ts` (imported by the
edge engine at `engine.ts:5`, so it survives the wizard deletion). Each `follow_up_schema`
question `id` must be a field the transformer **READS** (its input), and `select`/`multiselect`
option strings must match the transformer's lookup maps **exactly**. The transformer then
**DERIVES** the fact names rule predicates reference; `buildFactMap` keys facts as
`${conditionCode}.${derivedField}`.

- Example: diabetes collects `treatment` (option `"Oral medication only"` → derived fact
  `diabetes.insulin_use=false`), `a1c_level` (→ `good_control`), `diagnosis_age`
  (→ `years_since_diagnosis`). Collecting a *derived* fact directly leaves it silently
  `undefined` → abstains everything.
- **`atrial_fibrillation` has NO transformer → pass-through:** its field ids ARE the fact
  names, and rule predicates match the raw option values verbatim (e.g. `rate_controlled="Yes"`).
- Scope is honestly the 11 conditions the engine can transform today — NOT the plan's nominal
  80–150 (which would be medically unreviewed). `acceptance_key_fields`/`knockout_category`/
  `risk_weight` left NULL (no business reader).

## Phase 1.2 — First real American Amicable curated rules (local, uncommitted)

Migration `20260530152642` seeds the first approved condition-scoped rules, transcribed from
the "Term Made Simple" Medical Impairment Guide:
`high_blood_pressure` controlled (well_controlled + not stage-2 + ≤2 meds) → **Standard**;
uncontrolled or ≥3 meds → Decline; `atrial_fibrillation` any → Decline (`alwaysMatch`).

**Curated declines are INVISIBLE in the engine output** (verified, `engine.ts:828`): a declined
product gets `likelihood:0` → dropped from recommendations. The only parsed carrier (AmAm Term
Made Simple, simplified-issue) declines the impaired 55F on all three conditions, and a graded/GI
product that *might* approve her (e.g. Dignity Solutions) has no parsed guide. So the demo was
pivoted to a **surfacing profile**: a controlled-hypertension client gets a real curated
**Standard** approval (proven end-to-end through `evaluateProduct`, not just `computeApproval`).

## Adversarial review (6 dimensions, 25 agents) + fixes

A multi-agent review before any prod push found 18 confirmed issues. Fixed: a **critical**
FK violation (`source_guide_id` referenced a local-only guide → set NULL; snippet keeps
provenance); a **high** end-to-end gap where an empty `premium_matrix` + a selected term dropped
the demo product before rules fired (term availability now only gates when a matrix exists —
consistent with "rank by approval, not price"); plus hardening (`assessable` requires eligible
aggregation; `getHealthClassRank` malformed default → `unknown`; a case-insensitive mental-health
hospitalization fix; the HBP Standard predicate enforces "readings normal").

## Remote-apply incident + remediation (local↔remote drift)

During the production apply, the ontology migration surfaced a real problem. Remote prod
**already had a curated ~142-condition ontology** (seeded by `20260109_002...` in Jan 2026)
that was **never applied to local** — a local↔remote migration drift. Phase 1.1 was authored
against a local DB where the table was empty, so its `ON CONFLICT (code) DO UPDATE`
**overwrote 10 pre-existing production conditions'** `follow_up_schema`/`name`/`category`.
The field IDs matched (so the transformer and the new rules were unaffected), but it dropped
options/labels on the still-live wizard. Only `atrial_fibrillation` was genuinely new.

**Remediation:** verified `20260109_002` is the *sole* authoritative definer of those 10 codes
(009/003/004 and the deactivation migration do not touch them), then wrote
`20260530172834_restore_overwritten_condition_ontology.sql` copying the 10 rows verbatim from
`002`. Applied to local + remote; prod is restored to 142 authoritative rows + `atrial_fibrillation`,
with the AmAm rules intact. The corrective has a later timestamp than the seed, so it also wins
on any fresh replay.

**Lesson:** check the **remote** target before an idempotent-UPDATE seed — "local is empty"
does not imply "remote is empty" under drift. Prefer `ON CONFLICT DO NOTHING` for seeds onto
possibly-populated tables.

## Open / deferred

- **Loader tenancy (plan §6.7):** `repositories.ts` filters condition rule sets by exact
  `imo_id` (no OR-null/sentinel), so sentinel-IMO rules are invisible to non-sentinel IMOs
  (e.g. Epic Life). Works for the Founders demo (Founders = sentinel); cross-IMO data placement
  is a later decision.
- **Coverage:** diabetes/heart_attack ontology rows have no rules; the AmAm 10-year knockout
  question is unencoded. The literal 55F resolves by AFib-decline-drop, not a curated diabetes/MI
  verdict — do not overclaim the curated path.
- **Broader local drift (separate from the incident):** local is still missing the other ~131
  conditions and many historical condition migrations (they were never applied to local). Only
  the 10 overwritten codes + `atrial_fibrillation` were reconciled. Full local reconciliation is
  a pre-existing, out-of-scope follow-up.
- **Not yet live as a Jarvis demo:** the ontology + AmAm rules are now on remote prod, but the
  Jarvis underwriting tool/agent is not wired or deployed (Phase 1.3). The curated win is proven
  at the engine level, not yet through a Jarvis turn. The extractor validation-mode gate
  (different vocabulary) is Phase 2.

## Key files

- Edge engine: `supabase/functions/_shared/underwriting/engine.ts`
- Vocabulary ground truth: `src/services/underwriting/core/conditionResponseTransformer.ts`
- Rule DSL + aggregation: `src/services/underwriting/core/{ruleEngineDSL.ts, ruleEvaluator.ts}`
- Migrations: `supabase/migrations/{20260530141719_seed_underwriting_condition_ontology.sql,
  20260530152642_seed_amam_term_condition_rules.sql}`
- Tests: `supabase/functions/_shared/underwriting/__tests__/{engine,curated-rules}.test.ts`;
  `src/services/underwriting/__tests__/condition-ontology-factmap.test.ts`
- Plan + handoff: `plans/active/{underwriting-jarvis-redesign-2026-05-30.md,
  continue-20260530-underwriting-jarvis-phase1.md}`
