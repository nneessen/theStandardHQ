# Underwriting → Jarvis Redesign — Comprehensive Plan (red-team-verified)

**Date:** 2026-05-30 · **Owner:** Nick · **Status:** Plan (pre-implementation)
**Provenance:** Built from a 6-agent A-to-Z code review, then hardened by a 4-agent adversarial red-team that verified every claim against the real code + prod DB. Corrections folded in. Supersedes the Jan–Mar 2026 wiki where they conflict.

---

## 0. The one-paragraph truth

The underwriting **engine is genuinely good** (tri-state rule DSL, recency/numeric operators, worst-case aggregation, build-chart floors, HMAC-signed backend-authoritative persistence, strong RLS). It is **starved of data and unsafe when starved**: 0 approved rule sets, 0 condition-scoped rules, 1 of 15 carriers has any rules at all (American Amicable — 17 *administrative* rules, no medical conditions), and the condition catalog is empty. When it has no data it does not abstain — it **silently maps unknown/refer/decline → "standard" and no-conditions → "preferred,"** and an **unconstrained AI side-path narrates a confident verdict the engine never produced.** So today a 55-year-old woman with a recent heart attack, AFib, and diabetes reads as *average-to-preferred risk with a confident explanation.* That is the failure to fix first.

Your scope decision removes the hardest problem: **we rank by probability of approval, not price.** No premiums, no rate sheets, no `premium_matrix`. That deletes an entire multi-month data workstream and reduces the data problem to **one** knowledge base: per-carrier approval rules.

> **Critical correctness note from red-team:** all live verdict logic lives in the **backend edge engine** `supabase/functions/_shared/underwriting/engine.ts` (the only thing the Jarvis tool and `run-underwriting-session` call). The frontend `src/services/underwriting/{workflows/decisionEngine.ts, workflows/ruleEngineV2Adapter.ts, core/approval-scoring.ts}` ranking path is **wizard-only dead code** (`getRecommendations` has zero live callers) and is **deleted with the wizard — not patched.** Every Phase-0 code change below targets the edge engine.

---

## 1. Scope (locked by owner, 2026-05-30)

| Decision | Answer | Consequence |
|---|---|---|
| Output | **Highest probability of approval** for carrier+product. Agent pulls their own quotes afterward. | **No premium/rate work.** But premium math is *hard-wired into the live scoring function at 0.6 weight* — see 4.2: honoring "no price" requires actively editing the edge engine's scoring, not just declaring premiums out of scope. |
| Consumer UI | **Jarvis only.** Remove the sidebar wizard. | Delete the wizard (16 files + barrel exports); keep + grow the admin curation surface. |
| Ingestion trust | **Confidence-gated auto-commit, with a safety carve-out** (ratified 2026-05-30: *"Safe + fast review"*). | Auto-approve **only global/administrative** rules. **Medical-condition + adverse-outcome rules ALWAYS get a human pass — but a fast one** (confidence-sorted, source-snippet preview, "approve-all-above-τ" bulk action): minutes per carrier, not hours. Lowest E&O risk. (Detail: §6.5.) |
| Data strategy | **Build the PDF→rules pipeline** (ratified 2026-05-30). | Own an automated OCR/vision + confidence-gated pipeline. No third-party feed (those are rate/quote engines — rates are out of scope — and weak on impaired-risk approval knowledge). Reuses ~90% of existing code. |

**North star:** *An agent describes a client in plain language to Jarvis and gets a ranked list of carrier + product combinations by approval probability, with honest abstention where we lack data — and the owner loads new carriers by dropping a PDF with near-zero manual labor.*

> **Honest expectation (red-team reframe):** "rank by probability of approval" is a **Phase-2 deliverable.** With 0 curated condition rules, every product's approval likelihood resolves to a flat 0.5, so Phases 0–1 can only deliver **binary eligible/abstain separation + trustworthy abstention.** The first visible win is *honesty*, not a ranked list.

---

## 2. Verified current state (the numbers)

- `carriers=15` (all active) · `products≈64` (whole_life 31, term_life ~12, par_whole_life ~5–9, IUL 7, UL 2, health 2)
- `underwriting_rule_sets=11` → **8 pending_review, 3 rejected, 0 approved**; **all scope='global', all condition_code=NULL, all American Amicable**, all administrative (third-party-payor age, telephone-interview age, two-policy limit, tobacco class). **None encode a medical condition.**
- `underwriting_rules=17`. **7 of 17 (41%) have predicate `{"root":{}}` → always-match; 6 of those carry the *highest* confidence (0.95) and map to refer/decline.** (This inverts the auto-approve confidence signal — see 6.3.)
- `underwriting_health_conditions=0` (condition picker / NL vocabulary is empty)
- `premium_matrix=0`, `product_rate_table=0` — out of scope, but **on the live code path** (4.2)
- `carrier_build_charts=7` · `underwriting_sessions=0` (never used) · `uw_wizard_usage_log=0` runs
- Guides parsed: **2 of 15 carriers.** AmAm "Term Made Simple" (134k chars, *simplified-issue* product → 17 global rules — and an under-extraction artifact: a single 25k chunk mines only ~19% of it). Foresters "Planright Presentation Slides" (17k chars → **0 rules**; wrong artifact tier). Both guides have `version` and `content_hash` = NULL.
- IMO topology: **exactly 2 IMOs, 1 user each**; all 11 rule sets + 14/15 carriers + 63/64 products under Founders. The only Jarvis-reachable user today is the Founders super-admin. Platform is internal-only.
- Jarvis (`assistant-orchestrator`): **zero** underwriting wiring.

---

## 3. Architecture: AI at the edges, deterministic core, honest abstention

The LLM may *translate* free text → structured facts and *explain* the engine's output — **never originate a verdict.**

```
  ┌─ INTAKE (AI edge) ────────────┐   ┌─ DECISION (deterministic core) ─┐   ┌─ EXPLAIN (AI edge) ──────────┐
  │ Jarvis parses free text →     │   │ EDGE engine evaluates facts vs  │   │ Jarvis explains the engine's │
  │ structured fact object        │ → │ APPROVED condition rules per    │ → │ result in plain language.    │
  │ (age, sex, build, tobacco,    │   │ carrier/product. Ranks by       │   │ NEVER states a verdict the   │
  │ conditions→codes, recency,    │   │ APPROVAL LIKELIHOOD. Returns     │   │ engine didn't produce.       │
  │ severity, meds). Asks         │   │ provenance + missing facts.     │   │ Abstains / asks follow-ups   │
  │ follow-ups for missing facts. │   │ NEVER hallucinates.             │   │ when data is missing.        │
  └───────────────────────────────┘   └─────────────────────────────────┘   └──────────────────────────────┘
                                                    │
                          ┌─ ADVISORY FALLBACK (labeled lower-trust, Phase 3) ─┐
                          │ For carriers/conditions with NO curated rules:     │
                          │ citation-forced RAG over guide text. Answers ONLY  │
                          │ from retrieved passages + cites them + abstains.   │
                          └────────────────────────────────────────────────────┘
```

**Three trust states, always visibly labeled:** **Curated** (matched approved rule → cite rule + page), **Advisory** (RAG, cited, abstaining → "advisory, not a curated decision"), **Abstain** ("no data for this carrier"). This is what lets Jarvis be the front door *and* keep the system precise: Jarvis narrates; the rule engine decides.

---

## 4. Phase 0 — Make it honest (≈1 week, pure code, ZERO data dependency)

**All edits land in `supabase/functions/_shared/underwriting/engine.ts` (the live path).** The frontend `decisionEngine.ts`/`ruleEngineV2Adapter.ts`/`approval-scoring.ts` are deleted in Phase 1, not edited.

**4.1 Abstain, never average (type-safe).**
- `mapHealthClass()` collapses `unknown|refer|decline → 'standard'` at **engine.ts:198–222**. The return type is the **premium-matrix `HealthClass` union** (`preferred_plus|preferred|standard|standard_plus|table_rated|graded|modified|guaranteed_issue`) which has **no** unknown/refer/decline members — so `return 'unknown'` will **not** typecheck. **Fix:** carry abstention in a **dedicated field** — add `assessable: boolean` (or `eligibilityStatus: 'insufficient_data'`) to the approval result, leave `healthClass` null/omitted when not assessable. Do **not** widen the premium union.
- `applyBuildConstraint` (**engine.ts:224–258**, runs after approval ~:773–806) does `severity[ruleEngineClass] ?? 3` → a **second silent collapse to standard.** **Fix:** when the class is non-assessable, pass it through unchanged (apply no build constraint).
- Empty-conditions short-circuit → `likelihood:0.95, healthClass:'preferred'` at **engine.ts:493–503**. **Fix:** distinguish "no conditions entered" from "verified healthy"; do not score Preferred.
- **Renderer (new):** add a consumer that maps the abstain flag → the user-facing string **"insufficient carrier data — manual review"** in `buildSessionRecommendations`/`toRecommendation` (~:1087–1102) **and** in the Jarvis tool `DataSection`. Without this, a correct engine flag still produces no honest UI string.

**4.2 Rank by approval probability, not price — by editing the live scoring.**
Premium is **not** dormant: `computeAuthoritativeUnderwritingRun` calls `fetchPremiumMatrixMap` and `calculateScore`, whose `priceScore` defaults to **0.5 when premium is null** and is weighted **0.6** (**engine.ts:273–292, :1038–1039**). Importing the engine unchanged ships **price-weighted ranking with constant 0.5** — a direct scope violation. **Fix:** branch/gut `priceScore`; rank by `approvalLikelihood × dataConfidence`; **remove the premium filter** and the four price-tagged buckets (`best_value/cheapest/best_approval/highest_coverage` are applied **by array index** at **engine.ts:1087–1102**, not by real price); **group recommendations by product type** (term / whole / IUL / UL / par-whole / GI-graded / AD&D).
> Phase-0 visible result is **eligible vs abstain**, not a probability-ordered list (all likelihoods are 0.5 until condition rules exist). Say so in the DoD.

> **Underwriting-TIER steering is the core value, not a footnote.** For an impaired-risk client like the 55F, the *useful* answer is usually *"she likely declines fully-underwritten term, but here's the simplified-issue / graded-benefit / guaranteed-issue whole life that approves."* So the engine must rank **across underwriting tiers** (fully-underwritten → simplified-issue → graded → GI), and the product taxonomy needs an explicit **GI / graded / AD&D flag** (today they're folded under `whole_life`, so the engine can't distinguish a fully-underwritten WL from a graded final-expense WL). Add this product-type/tier flag in Phase 1 — it's load-bearing for "highest probability of approval," because the whole point is steering to the tier that *will* approve.

**4.3 One source of truth — retire free-reasoning.** `underwriting-ai-analyze` free-reasons over raw guide text and is called **only** by the deleted wizard hook (confirmed not on the authoritative path). The new Jarvis tool calls **only** `computeAuthoritativeUnderwritingRun`. Retire `underwriting-ai-analyze` as a verdict source.

**4.4 Predicate-safety (gates Phase 6.3 auto-approve).** Empty `{root:{}}` predicates always-match (**ruleEvaluator.ts:642–644**; `parsePredicate` unwraps `{version:2,root:{}}→{}`). **Caveat:** empty predicates are an **intentional, sanctioned fallback** today (`validatePredicate` blesses them, ruleEngineDSL.ts:595–600). **Fix:** introduce an explicit `alwaysMatch:true` marker; migrate any legitimate fallback rule to it; then scope "empty → unknown" specifically to the **auto-approve gate** (6.3) so existing fallback behavior isn't silently neutralized.

**Phase-0 exit test:** the 55F AFib/MI/diabetes profile through the **edge engine** returns **"insufficient carrier data — manual review"** (assessable:false), no Preferred/Standard, and no confident AI verdict anywhere. Add a unit test asserting this on the edge engine.

---

## 5. Phase 1 — Condition ontology + Jarvis MVP + wizard removal (≈1.5–2 weeks)

**5.1 Seed `underwriting_health_conditions` (~1 week incl. medical-accuracy review).** Finite, carrier-agnostic, but each row's `follow_up_schema` must be **medically correct** and cross-checked against guide vocabulary + `deriveRuleConditionCodes.ts`. Each row: canonical `condition_code`, display name, category, and follow-up fields (diabetes → `a1c`, `insulin_use`, `years_since_diagnosis`, `complications`; cardiac → `event_date`, `procedure`, `ejection_fraction`; AFib → `type`, `anticoagulated`, `rate_controlled`). Seed the ~80–150 conditions carriers underwrite. **After seeding, run extraction in validation mode against ≥1 guide** to confirm the ontology covers the codes the extractor emits (the extractor validates against this table — uncovered codes fail).

> **Medication→condition facts (the 55F example depends on this).** The old wizard had a **separate 28-field meds step disjoint from condition derivation** — so "metformin / no insulin" never reached diabetes-control logic (verified bug). The Jarvis redesign **moots** that: there is no separate meds step; the intake LLM maps "metformin, no insulin" **directly into the diabetes follow-up facts** (`insulin_use:false`, oral-control). **Action:** the ontology's `follow_up_schema` for medication-driven conditions must include those control fields, and the agent intake prompt (5.3) must explicitly instruct the model to translate stated medications into them. Without this, the owner's own example (T2DM controlled on metformin) cannot be assessed correctly.

**5.2 Seed + APPROVE 3–5 real AmAm condition rules (AFib / MI-recency / T2DM) — so Phase 1 has a demonstrable curated answer.** Without this, **Phase 1 can only demo honest abstention** (0 approved + 0 condition rules exist). This is the difference between "Jarvis correctly said 'manual review'" and "Jarvis gave a curated American Amicable answer." Author these by hand from the AmAm guide, approve them, and use them as the live demo + first golden-test cases.

**5.3 Wire the Jarvis underwriting tool + agent (6 files — recipe verified mechanically accurate).**
- `core/types.ts`: add `"underwriting"` to `ToolCategory` + `AgentKey` unions.
- `core/registry.ts`: `getUnderwritingRecommendation` — `category:"underwriting"`, `riskLevel:"read"`, `requiresApproval:false`, **`requiredPermissions:[]`** (verified load-bearing: `guard.ts:31` denies all non-super-admins for any non-empty value; `index.ts:277` hardcodes user permissions to `[]`).
- `tools/getUnderwritingRecommendation.ts` (new): flat model args → `UnderwritingRawPayload` → **`computeAuthoritativeUnderwritingRun` imported directly** (no HTTP, no envelope). `conditions` is an **enum of seeded codes** so the model maps free text → canonical codes. Returns standard `{available, reason?, data}` `DataSection` (existing `grounding.ts` works unmodified). Early-abstain if `imoId` null.
- **Client typing (corrected):** **Do NOT** add a `fullClient` slot to `AssistantToolContext` — its header mandates no esm.sh imports so `tools/` stays offline-unit-testable. `index.ts:59` already builds the full anon+user-JWT client and only narrows it via `db as unknown` at `:149`. In the handler, **cast `ctx.db` back up to `SupabaseClient<Database>`** at the tool boundary (mirroring the existing downcast). This replicates `run-underwriting-session`'s RLS-scoped client with zero invariant break.
- `core/agents.ts`: `underwriting` agent with a **hard anti-hallucination prompt** — never invent approval/decline/class; every verdict traces to a tool result this turn; if all products are `unknown` with `missingFields`, **ask the follow-up questions** instead of answering; surface `dataWarning`; advisory read, not a binding decision.
- `core/routing.ts`: underwriting intent regex before the generic copy matcher.

**5.4 Remove the consumer wizard — complete checklist (16 files, not 3).**
- Delete: all files under `components/Wizard/`, `components/SessionHistory/WizardSessionHistory.tsx`, `hooks/wizard/useDecisionEngineRecommendations(.test).ts`, `hooks/wizard/useUnderwritingAnalysis.ts`, `utils/wizard/`, and the dead frontend ranking path (`services/underwriting/workflows/decisionEngine.ts`, `workflows/ruleEngineV2Adapter.ts`, `core/approval-scoring.ts` — confirm no non-wizard imports first).
- Update **both barrels** (`hooks/index.ts`, `features/underwriting/index.ts`) — they re-export wizard-only symbols (`useUnderwritingAnalysis`, `useDecisionEngineRecommendations`, `UnderwritingWizardPage`, `WizardSessionHistory`) and will fail the build if left dangling (CLAUDE.md forbids orphaned files).
- **Keep:** `hooks/wizard/useUnderwritingFeatureFlag.ts` (`useCanManageUnderwriting` is used by admin) and `useUWWizardUsage.ts` (quota).
- Nav/routes: `sidebar-nav.config.ts` UW Wizard entry (keep UW Admin); `router.tsx` wizard route + lazy import + registration. (Line numbers drift — locate by symbol.)
- **Compliance replacement (specify, don't hand-wave):** decide where the **disclaimer** shows in the Jarvis flow (one-time modal vs per-underwriting-response header — may be an E&O requirement) and how **session history** is surfaced for audit. **Keep usage-quota gating** — the Jarvis tool records each run via `record_uw_wizard_run` against the same quota/seat/feature-flag entitlements so billing doesn't break.

**Phase-1 exit test (honest):** in Jarvis, the 55F utterance → Jarvis parses it, runs the **edge** engine, and **(a)** for the 3–5 seeded AmAm condition rules returns a curated read with the matched rule + page, **(b)** for everything else returns honest **"no curated rules for these carriers — manual review,"** and **(c)** asks for the high-value missing follow-ups (A1C, exact MI date, AFib control).

---

## 6. Phase 2 — Automated, low-labor ingestion engine (≈4–6 weeks; split 2a/2b)

Center of gravity: **owner drops a carrier PDF → accurate rules populate automatically — with hard safety carve-outs and an eval gate before agent exposure.**

### Phase 2a — Get full, faithful extraction (≈2–3 wk)
**6.1 Fix the bulk extractor.** `scripts/underwriting/extract-all-guides.ts:176` posts only `{guideId}` (chunkOffset 0, no `hasMore` loop) → for the 134k-char AmAm guide it mines only ~19% (≈80% dropped for the biggest guides). Replace with a **server-side chunk loop** (or queue worker mirroring the correct UI loop in `useRuleSetsByGuide.ts`). The 17 existing rules are themselves an under-extraction artifact.
**6.2 OCR/table/vision as a real server-side build (not a config toggle).** OCR (`PaddleOcrAdapter`) runs only at **frontend parse time**, gated on `features.ocr` (set only by tests + a manual UI toggle); the walk-away path operates on **already-parsed text** and never touches the gateway. **Build:** a **server-side parse trigger** with a text-density/table heuristic that auto-routes to OCR/table extraction; for dense charts, a **vision pass** needs page images (persisted `ParsedGuideContent` is text/sections/tables only → re-render PDF pages). The bulk path must **invoke parse**, not assume `parsing_status='completed'`.
**6.3 Idempotent supersede (key fixed).** Persistence is INSERT-only (`extract-underwriting-rules:943/1001`). `version` + `content_hash` are both NULL today, and `condition_code` is NULL (NULL≠NULL defeats a naive key). **Fix:** populate `content_hash` on upload; key supersede on `(carrier_id, product_id, scope, COALESCE(condition_code,''), content_hash)`; supersede = **deactivate prior approved set + insert new as pending** (never auto-delete a human-vetted set); identical hash = no-op. Unify the "conflict" detector with this same key so re-uploads don't flood the review queue.
**6.4 Document-tier guard + prompt caching.** Classify the artifact post-parse; if it's not a UW manual (Foresters slides → 0 rules), tell the owner immediately. Add Anthropic prompt caching to the large stable extraction system prompt (re-sent per chunk today, no `cache_control`, SDK 0.24.0) + bump SDK — proven pattern in this repo's Jarvis orchestrator.

### Phase 2b — Confidence-gated auto-commit, safely (≈2–3 wk; depends on 4.4)
**6.5 The auto-approve gate — with hard carve-outs (red-team critical).**
- **NEVER auto-approve** `scope='condition'` (medical) rules, **or** any rule whose outcome is `decline/substandard/graded/modified/table_rated`, **or** any rule with an empty/trivial predicate — regardless of confidence. (Empirically the most dangerous shape — `{root:{}}` always-match decline/refer — coincides with the **highest** confidence band, so a naive confidence≥τ gate auto-approves exactly the worst rules.) These always go to human review.
- **Auto-approve only** `scope='global'` administrative rules with a **non-empty validated predicate**, and only after 4.4 lands.
- **Cross-check (reframed honestly):** the "source_snippet literally contains the rated value" check is only **partial** — numbers appear spelled-out ("two", "ages 18 to 29") so it needs number-word + range normalization, and **outcome class (decline/refer) is never a literal token** so it **cannot** be snippet-validated. Use it for partial numeric-threshold validation only.
- **LLM judge = defense-in-depth, not approval authority** (correlated error: it shares the extractor's context). 
- **Service-role bypass:** the persist path runs under the **service-role client** (`extract-underwriting-rules:172`) which **bypasses RLS** — so the curator/auto-approve restriction must be enforced in the **edge-function app layer**, not via RLS.
- **Surface confidence + snippet** in `RuleCandidateCard` (shows pages only today) and add **bulk approve / approve-all-above-τ** for the review residue. `τ` requires **iterative tuning against real extraction data** (hence 2b can't be short).
**6.6 Eval gate BEFORE exposure.** The golden-set accuracy eval (was Phase 4) must run **ahead of** auto-approved rules reaching agents — otherwise auto-approved rules hit clients before any eval exists. Wire it as a gate in 2b.
**6.7 Tenancy — drop `is_global`.** It's the wrong mechanism at current scale (2 IMOs, 1 user each, all rules under Founders, only the Founders super-admin reachable). The real concern is **consumer-IMO ≠ data-IMO** (a future non-super-admin Epic Life user would resolve to an IMO with 0 rules) — a **data-placement/gate** problem (curate under the consuming IMO, or adjust the orchestrator access gate), **not** a sharing column. *If* ever adopted, it also requires changing `repositories.ts:324` from `.eq('imo_id', imoId)` to an `.or(imo_id.eq…, is_global.is.true)` (the app query hard-filters `imo_id` with no null branch — the RLS policy alone is not the binding filter). Better: don't adopt it now.

**Phase-2 exit test:** drop a real fully-underwritten carrier UW guide → within minutes its **global administrative** rules auto-approve; its **condition** rules queue for a fast review (bulk-approve the obvious ones); the golden eval passes; the 55F example now returns a curated ranked answer including that carrier.

---

## 7. Phase 3 — RAG advisory fallback tier (≈1–2 weeks)

So Jarvis gives a **useful, honest** answer for all 15 carriers immediately, before full curation.
- Second Jarvis tool `getUnderwritingAdvisory(carrier, clientFacts)`: retrieve relevant guide passages, answer **only** from retrieved text, **force a cited snippet**, **abstain** when not covered.
- **Always labeled "advisory — not a curated decision."** Enforce via `grounding.ts` (the advisory tool's `DataSection` carries a `tier:'advisory'` flag the agent prompt must surface) so it can never masquerade as the deterministic verdict — the exact failure Phase 0 kills.
- Curated engine result always takes precedence where approved rules exist; advisory fills the gap only where they don't.

---

## 8. Phase 4 — Hardening & accuracy QA

- **PII retention/delete.** `underwriting_sessions` stores `client_dob`, `health_responses`, `conditions_reported`, `tobacco_details` **plaintext, no TTL, no delete path.** Add a retention cron + delete path (right-to-delete) + consider column encryption before volume arrives.
- **`.or()` → `.in()`/array filters** (4 sites). Currently mitigated (trusted UUIDs/enums + RLS) → defense-in-depth.
- **Coverage dashboard:** per-carrier × per-condition "curated vs advisory vs none."
- **Accuracy eval harness (the "precise" backbone):** golden set of realistic profiles (55F case + dozens) with known-correct outcomes from the actual guides; automated eval after every ingestion; track precision/recall + regressions. **Stood up in Phase 1 (seed cases) and gated into Phase 2b (6.6), expanded here.**
- **Latency** (single-query only; throughput/scale premature at 0 usage): dynamic-import the heavy engine in the Jarvis tool to protect keep-warm cold-start; cache approved rules per IMO. Existing N+1 per-product loop is fine at this catalog size.

---

## 9. Risks & how each is retired

| Risk | Severity | Mitigation (phase) |
|---|---|---|
| Convincingly-wrong answer (high-risk client → Standard/Preferred + confident AI) | **Critical** | Phase 0 abstain (edge engine) + retire free-reasoning + approval-ranking |
| Auto-approve commits a dangerous always-match decline/refer rule (highest-confidence shape) | **Critical** | 6.5 carve-outs (never auto-approve condition/adverse-outcome/empty-predicate) + 4.4 + 6.6 eval gate |
| Importing engine unchanged ships price-weighted ranking | High | 4.2 edit live scoring |
| Bulk ingestion drops ~80% of large guides | High | 6.1 server-side chunk loop |
| Tables/build charts flattened; scanned guides fail | High | 6.2 server-side OCR/table/vision parse |
| Phase 0 patches dead frontend code; live path still lies | High | §0 note + Phase 0 targets edge engine |
| Owner uploads wrong artifact tier (0 rules) | Medium | 6.4 document-tier guard |
| Health PII accumulates plaintext indefinitely | Medium | Phase 4 retention/delete/encryption |
| Empty-predicate fallback rules silently neutralized by 4.4 | Low | migrate to explicit `alwaysMatch:true`; scope empty→unknown to auto-approve gate only |

---

## 10. Sequencing & effort (single engineer)

| Phase | What | Effort |
|---|---|---|
| **0** | Make it honest — edge engine: abstain (type-safe + build-constraint guard + renderer), approval-ranking, retire free-reasoning, predicate-safety marker | ~1 wk |
| **1** | Condition ontology (incl. medical review) + seed/approve 3–5 AmAm condition rules + Jarvis tool/agent + remove wizard (16 files) + compliance replacement + deploy/types-regen/build/tests | ~1.5–2 wk |
| **2a** | Bulk chunk-loop + server-side OCR/table/vision parse + idempotent supersede + document guard + prompt caching | ~2–3 wk |
| **2b** | Confidence-gated auto-commit with carve-outs + LLM judge + τ-tuning on real data + eval gate | ~2–3 wk |
| **3** | RAG advisory fallback tier | ~1–2 wk |
| **4** | PII retention, security, coverage dashboard, eval-harness expansion | ~1–2 wk |

**Overall ~9–13 weeks.** Phases 0–1 are the MVP (an honest Jarvis underwriting advisor) in ~3–4 weeks; its first visible win is **trustworthy abstention** + a small curated AmAm demo, not a full ranked list. Phase 2 delivers the owner's "automated, low-labor" requirement.

**Per-phase Definition-of-Done discipline (CLAUDE.md):** after any migration run `npx supabase gen types typescript … > src/types/database.types.ts`; `npm run build` to **zero** TS errors; add/maintain **passing unit tests** (abstain + approval-ranking + auto-approve carve-outs); **deploy the `assistant-orchestrator` Deno edge function** (editing the 6 files has no effect until deployed); smoke-test the live path.

## 11. Definition of done

- Jarvis answers a natural-language client description with **eligible/abstain honesty** and, where curated rules exist, a list ranked **by approval probability**, citing the matched rule (curated) or guide snippet (advisory), and **abstains/asks follow-ups** when data is missing — never states a verdict the engine didn't produce.
- Owner adds a carrier by dropping its UW guide; **global** rules auto-populate; **medical/adverse-outcome** rules get a fast review; updated guides supersede cleanly; the golden eval gates exposure.
- Sidebar wizard gone (16 files + barrels clean); admin curation surface remains and is low-labor; compliance (disclaimer, session history, quota) preserved in the Jarvis flow.
- Security intact (user-JWT/RLS for the Jarvis tool via cast-up `ctx.db`; auto-approve restriction enforced in the edge app layer, not RLS; PII retention in place).
- The 55F AFib/MI/diabetes golden case (and the eval set) return correct, stable outcomes after each ingestion.

---

### Out of scope (explicitly, per owner)
Premiums, rate sheets, `premium_matrix`/`product_rate_table` population, bilinear interpolation, dollar quoting. The agent pulls quotes themselves once the carrier+product is chosen. **But note (4.2):** premium math is wired into the live scoring function — honoring "no price" means *editing* that scoring, not merely declaring premiums dormant.

### Multi-IMO sharing — explicitly deferred
Not relevant at current scale (2 IMOs, 1 user each, all data under Founders, only the super-admin reachable). The real future concern is data placement (consumer-IMO must contain the rules), addressed by curation placement / the orchestrator access gate — not an `is_global` column.
