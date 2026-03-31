# Close KPI / Lead Heat AI Revamp Plan

## Status: READY TO IMPLEMENT

## Date

- Drafted: 2026-03-31

## Objective

Rebuild the Close KPI lead scoring subsystem into a secure, testable, calibrated, and honest-to-market system.

This plan covers:

- Security hardening
- Scoring correctness fixes
- Interim score recalibration
- Replacement of the current pseudo-learning loop with a real supervised scoring pipeline
- LLM model selection and usage rules
- Custom KPI dashboard hardening
- File-by-file implementation guidance with full absolute paths

This document is intentionally prescriptive. It should be treated as the implementation ruleset for all work related to Close KPI lead scoring and AI explanations.

---

## Executive Summary

The current Close KPI lead heat feature is not a true machine learning system to industry standards.

What exists today:

- Tier 1: deterministic heuristic scoring using 17 weighted signals
- Tier 2: Anthropic portfolio summary that recommends multiplier adjustments
- Tier 3: Anthropic per-lead narrative deep dive

What it is not:

- a trained predictive model
- a calibrated conversion-probability model
- a rigorously validated org-specific learning system

Current overall assessment:

- Architecture shape: 6/10
- Security: 3/10
- Scoring correctness: 4/10
- "Learns your business" credibility: 2/10
- Overall: 4/10

The system has a decent decomposition, but it is materially undermined by:

- weak protection around cron-only behavior
- a cross-tenant metadata leak
- a polluted feedback loop
- score calibration that does not match real portfolio behavior
- dead signal capacity
- sparse backend test coverage
- UI copy that currently overstates the sophistication of the system

---

## Scope

### In Scope

- The lead heat scoring backend in `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/`
- The Close KPI edge read model in `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-kpi-data/`
- The Close configuration and lead heat database layer in `/Users/nickneessen/projects/commissionTracker/supabase/migrations/`
- The Close KPI frontend in `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/`
- Product copy that claims personalization, AI learning, or model quality

### Out of Scope

- A full user-authored formula engine for custom KPIs
- End-user prompt editing for the lead heat AI prompts
- A complete re-platforming of the Close KPI feature into a new bounded context in one pass

---

## Current Ground Truth

### Current Runtime Design

1. Tier 1: deterministic score calculation
2. Tier 2: LLM portfolio analysis with weight suggestions
3. Tier 3: LLM deep dive for a selected lead

### Current Production Truths

- The core score is a deterministic additive heuristic, not a trained model.
- `oppStageAdvances` is effectively dead because it is always `0`.
- `aiSimilarityScore` is effectively dead because it is always `null`.
- The "learning" behavior is currently an LLM suggesting multiplier changes, not a statistical or ML training pipeline.
- The current score distribution reported from production is heavily bottom-weighted:

  - Cold: 4,120
  - Cooling: 825
  - Neutral: 54
  - Warming: 1
  - Hot: 0

That distribution strongly suggests the current thresholds are not calibrated to actual reachable score ranges.

### Current File Paths

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/scoring-engine.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/signal-extractor.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/outcome-detector.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/ai-analyzer.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/types.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-kpi-data/index.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/services/closeKpiService.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/hooks/useKpiWidgetData.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/hooks/useCloseKpiDashboard.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/AiHeroSection.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/SetupGuide.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/config/prebuilt-layout.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260329201848_lead_heat_tables.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260329204155_lead_heat_scoring_cron.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260329211328_lead_heat_review_fixes.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260330100310_fix_avg_score_rpc_security.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260331142602_close_config_agency_fallback.sql`

---

## Non-Negotiable Rules

These rules apply to all future work for this feature.

### Security Rules

- No cron-only or internal-only edge function action may be callable without positive verification of the required privilege.
- No `SECURITY DEFINER` RPC callable by `authenticated` may trust a user-provided `p_user_id` without checking `auth.uid() = p_user_id`, unless the function is explicitly documented as an admin-only path.
- No frontend-readable RPC may expose cross-tenant metadata.
- All edge function input must be validated at runtime with a strict schema.
- Close API keys must remain retrievable only by service-role paths.

### Scoring Rules

- LLM output must never directly determine the score, score thresholds, or model weights in the request path.
- The score path must be reproducible from persisted inputs.
- Every served score must carry a versioned scoring model identifier.
- Truncation or partial data must never be silent.
- Every transition from heuristic score to learned score must be measurable against offline evaluation data first.

### Data Rules

- Terminal outcomes used for training must be correct, deduplicated, timestamped, and reproducible.
- Non-terminal status events must not be mixed into "personalization" sample counts unless explicitly labeled as auxiliary-only.
- Org-specific adaptation must be layered on top of a validated global baseline, not implemented as an unconstrained per-user model from sparse data.

### Product Copy Rules

- Do not claim the model "learns your business" until the supervised pipeline is live and gated by real sample-size thresholds.
- Do not claim "personalized" until the personalization criteria are satisfied.
- Use "AI-assisted explanation" or "AI-generated insights" for LLM narrative layers.

### Architecture Rules

- Pure score logic must stay in pure modules with no network or Supabase calls.
- Request handlers must only validate input, orchestrate services, and persist results.
- Query return shape changes must bump query key versions in the frontend.
- UI components must not encode domain scoring rules.

---

## Current Problems To Fix

### P0 Security Defects

1. `score_all_users` is not positively protected as a service-only path.
2. `get_close_connection_status` leaks cross-tenant metadata.

### P1 Correctness Defects

1. The outcome feedback loop is corrupted because previous opportunity state is discarded.
2. Stale-lead logic is undermined because only recent history is fetched.
3. The score distribution is badly calibrated relative to observed data.
4. The deep-dive cache freshness uses the wrong timestamp.
5. "Similar lead/source" context is placeholder logic.

### P2 Product/Architecture Defects

1. The system is marketed as ML/personalized when it is not yet at that standard.
2. Two scoring slots are dead capacity.
3. Large org behavior is biased by silent truncation.
4. Time-of-day KPIs are timezone-naive.
5. The custom KPI dashboard is more accurately "user-configured widgets" than "custom KPIs".

---

## Target End State

### Short-Term End State

- The current system is safe to run in production.
- The heuristic score is correctly calibrated to real portfolios.
- UI copy is honest.
- LLM output is explanation-only.
- Large-org truncation is visible and actionable.

### Long-Term End State

- Lead scoring is a versioned supervised model with:
  - explicit feature snapshots
  - clean terminal outcome labels
  - offline evaluation
  - calibration metrics
  - global baseline plus org-specific adaptation
- LLMs generate explanations, recommendations, and portfolio summaries, but do not own the score.

---

## Recommended Model Strategy

## As Of 2026-03-31

### Core Principle

Use statistical modeling for scoring.

Use LLMs for explanation.

Do not use LLMs to own weight updates for the production score.

### Anthropic Recommendation

- Tier 2 portfolio summary:
  - `claude-haiku-4-5-20251001`
- Tier 3 lead deep dive:
  - `claude-sonnet-4-6`

### OpenAI Evaluation Recommendation

- High-quality deep-dive challenger:
  - `gpt-5.4`
- Lower-cost summary challenger:
  - `gpt-5.4-mini`

### Not Recommended

- Keeping `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/ai-analyzer.ts` on `claude-sonnet-4-20250514` for new work
- Using any LLM to produce production weight updates
- Using an LLM as the source of truth for score calibration

### Why

- Portfolio summaries are a compression and explanation task. Haiku-class models are usually sufficient and cost-efficient.
- Per-lead deep dives benefit from better reasoning, nuance, and structured recommendation quality, so Sonnet 4.6 or GPT-5.4 are worth evaluating.
- None of those choices solve the actual scoring problem by themselves. The architecture must stop asking the LLM to perform the role of the model-training system.

### Official References

- Anthropic models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI models overview: https://developers.openai.com/api/docs/models
- OpenAI pricing: https://openai.com/api/pricing

---

## Recommended Scoring Architecture

### Phase A: Stabilized Heuristic Serving Layer

Keep heuristic scoring temporarily, but only after:

- fixing security
- fixing outcome integrity
- removing dead-signal headroom from thresholds or redistributing it
- recalibrating heat-level bands

### Phase B: Real Supervised Scoring Layer

Adopt a two-layer score architecture:

1. Global baseline model
   - Trained across all eligible org data
   - Regularized logistic regression is the recommended first model
   - Inputs: deterministic lead features
   - Output: calibrated probability of terminal success in a target window

2. Org-specific adaptation layer
   - Start as a calibration layer, not a full independent model
   - Blend org-specific statistics with the global baseline
   - Require minimum sample counts before enabling

This is better than the current per-user multiplier retuning because:

- it handles sparse org data more safely
- it supports proper offline evaluation
- it yields interpretable coefficients and feature attribution
- it can be calibrated and versioned

### Recommended Initial ML Stack

- Feature extraction: deterministic TypeScript or SQL-backed feature generation
- Baseline model: regularized logistic regression
- Calibration: isotonic regression or Platt scaling
- Org adaptation: shrinkage/blending over the global baseline, not free-form per-org retraining

### Why Not Jump Straight To Gradient Boosting

Do not start with a more complex model until the labels, evaluation harness, and serving pipeline are correct.

The current failure mode is not lack of model power. It is lack of data integrity, calibration, and evaluation discipline.

---

## Data Model Direction

### Keep

- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260329201848_lead_heat_tables.sql`
  - `lead_heat_scores`
  - `lead_heat_outcomes`
  - `lead_heat_scoring_runs`
  - `lead_heat_ai_portfolio_analysis`

### Replace Or Deprecate

- `lead_heat_agent_weights`
  - This should not remain the primary "learning" mechanism once the supervised system is introduced.

### Add

Create migrations for the following new or replacement structures:

1. `lead_heat_feature_snapshots`
   - Stores the exact features used for prediction
   - One row per scored lead per scoring run or feature version

2. `lead_heat_model_versions`
   - Stores model metadata
   - Fields:
     - version
     - model_type
     - feature_schema_version
     - calibration_version
     - trained_at
     - trained_on_sample_size
     - evaluation_metrics
     - is_active

3. `lead_heat_predictions`
   - Stores the served prediction output
   - Fields:
     - user_id
     - close_lead_id
     - model_version_id
     - score_probability
     - score_band
     - prediction_generated_at
     - feature_snapshot_id

4. `lead_heat_explanations`
   - Dedicated cache for per-lead and portfolio LLM outputs
   - Must have its own explicit timestamps
   - Must not piggyback on `lead_heat_scores.updated_at`

5. Optional: `lead_heat_training_jobs`
   - Tracks batch training, backfill, and evaluation jobs

### Label Strategy

Use terminal labels for supervised training:

- Positive:
  - won opportunity
  - issued/sold policy, if available and trustworthy

- Negative:
  - lost opportunity
  - explicit terminal negative statuses, only if semantically consistent
  - long-window unresolved stale label if business-approved

Do not treat non-terminal status changes as primary training labels.

---

## Implementation Phases

## Phase 0: Security Hotfixes

### Goals

- Close the externally callable cron path
- Remove the cross-tenant RPC leak

### Required Changes

#### 0.1 Service-only protection for `score_all_users`

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`

Requirements:

- Require a valid service-only credential or signed internal secret for `score_all_users`
- Reject missing token
- Reject invalid token
- Reject user JWTs
- Log denied attempts without leaking secrets

Do not rely on "if `getUser()` resolves, then deny."

Positive verification is required.

#### 0.2 Fix `get_close_connection_status`

Edit via new migration:

- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_close_connection_status_auth_hardening.sql`

Requirements:

- Enforce `p_user_id = auth.uid()` for authenticated callers
- Keep agency-owner fallback semantics only for the caller's own resolved org context
- Keep this RPC non-sensitive

#### 0.3 Audit all Close-config RPCs

Review:

- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260326174902_close_config_rpc.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260331142602_close_config_agency_fallback.sql`

Acceptance criteria:

- No authenticated user can inspect another user's Close integration metadata
- No public caller can trigger org-wide rescoring

---

## Phase 1: Scoring Integrity And Serving Correctness

### Goals

- Make the current heuristic system factually correct before replacing it

### Required Changes

#### 1.1 Preserve previous opportunity state

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/outcome-detector.ts`

Requirements:

- Persist previous opportunity IDs and statuses with the prior score snapshot
- Pass real `previousOpps` into outcome detection
- Ensure terminal outcomes are recorded once and at the correct first-seen transition

#### 1.2 Separate terminal labels from auxiliary events

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/outcome-detector.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_lead_heat_outcome_refactor.sql`

Requirements:

- Distinguish:
  - terminal outcomes
  - auxiliary transitions
  - stale flags
- Do not use non-terminal events to claim personalization readiness

#### 1.3 Fix deep-dive cache semantics

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx`

Requirements:

- Store deep-dive explanation freshness independently
- Do not use `lead_heat_scores.updated_at` as the deep-dive cache TTL source

#### 1.4 Fix placeholder "similar lead" data

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/ai-analyzer.ts`

Requirements:

- Either provide real source/similar-lead cohort stats
- Or remove those prompt claims until real cohorting exists

#### 1.5 Make truncation explicit

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-kpi-data/index.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/services/closeKpiService.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/`

Requirements:

- Return explicit truncation metadata
- Surface partial-data warnings in the UI
- Do not pretend "all leads were scored" when caps were hit

#### 1.6 Fix timezone-naive time analytics

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-kpi-data/index.ts`

Requirements:

- Use the user or org timezone for hourly/day-of-week bucketing
- Make the chosen timezone explicit in the result payload or UI

---

## Phase 2: Interim Score Recalibration

### Goals

- Make the current score useful before the supervised model lands

### Recommended Decision

For the interim release, use percentile-based heat bands within the user's portfolio.

Rationale:

- It immediately fixes the "0 hot leads" failure mode
- It is robust to dead-signal headroom
- It avoids pretending the raw heuristic score is already calibrated to absolute conversion probability

### Interim Serving Strategy

Keep:

- raw heuristic score

Add:

- portfolio percentile rank
- derived heat band based on percentile

Suggested interim bands:

- Hot: top 10%
- Warming: next 15%
- Neutral: next 25%
- Cooling: next 25%
- Cold: bottom 25%

If business wants fixed thresholds instead, they must be data-backed and re-evaluated from observed score distributions.

### Required Changes

Edit:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/scoring-engine.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/AiHeroSection.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx`

Add pure helper modules:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/lead-heat-calibration.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/__tests__/lead-heat-calibration.test.ts`

### Dead Signal Policy

Immediate rule:

- Remove dead signals from the interim threshold budget
- Or redistribute their point budget to live signals

Dead signals currently identified:

- `oppStageAdvances`
- `aiSimilarityScore`

Do not leave unreachable score headroom in a production score banding system.

Acceptance criteria:

- Active portfolios have a usable band distribution
- Hot and warming bands are not structurally empty
- UI copy no longer implies absolute calibrated probability

---

## Phase 3: Replace The Fake Learning Loop With A Real Training Pipeline

### Goals

- Replace LLM-generated weight updates with a validated, versioned model pipeline

### Design

#### 3.1 Feature Extraction

Create a versioned feature schema.

Likely first-pass features:

- engagement counts and rates
- recency metrics
- lead age
- status-transition metrics
- opportunity presence and value
- source priors
- negative contact signals
- timezone-aware contact timing features

Feature extraction must be deterministic and reproducible.

#### 3.2 Label Windows

Define a prediction target such as:

- probability of winning within N days

Recommended starting windows:

- 14-day
- 30-day

Choose one for serving. Keep the other for evaluation if useful.

#### 3.3 Baseline Model

Train:

- regularized logistic regression

Why first:

- interpretable
- cheap to train
- easy to version
- easy to calibrate
- strong enough for a first production baseline

#### 3.4 Org-Specific Adaptation

Do not train a fully independent per-org model at low sample sizes.

Use:

- global model
- org-specific calibration or shrinkage layer

Rules:

- Below minimum terminal labels: serve global model only
- Medium sample size: serve blended calibration
- High sample size: permit stronger org-specific adjustment

#### 3.5 Evaluation

Track at minimum:

- AUC
- PR AUC or precision-at-k
- Brier score
- calibration curve error
- lift for top deciles
- top-k win-rate lift vs the current heuristic baseline

#### 3.6 Serving

Serve:

- probability
- score band
- model version
- prediction timestamp
- feature snapshot ID

The score band should be derived from calibrated probabilities, not arbitrary additive heuristics.

### Required New Files

Planned migration files:

- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_lead_heat_feature_snapshots.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_lead_heat_model_versions.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_lead_heat_predictions.sql`
- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/<timestamp>_lead_heat_explanations.sql`

Planned application helpers:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/lead-heat-evaluation.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/__tests__/lead-heat-evaluation.test.ts`

### Deprecation Plan

Deprecate or repurpose:

- `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260329201848_lead_heat_tables.sql` table `lead_heat_agent_weights`

Do not keep `lead_heat_agent_weights` as the primary personalization mechanism once the supervised system is active.

---

## Phase 4: LLM Explanation Layer

### Goals

- Keep AI where it adds real value
- Remove AI from places where it is pretending to be the model

### Tier 2 Portfolio Summary

Role:

- summarize portfolio patterns
- surface anomalies
- recommend operational actions

Must not:

- update weights
- alter score bands
- claim model learning state

### Tier 3 Deep Dive

Role:

- explain why this lead is high or low priority
- suggest a next action
- summarize risk factors

Must:

- return enums that match the app type contracts
- use validated structured output
- expose the model/version used

### Model Evaluation Harness

Create a human-reviewed eval set with real lead cases:

- top-converting hot leads
- false positives
- false negatives
- stale but salvageable leads
- compliance-sensitive edge cases

Evaluate:

- `claude-sonnet-4-6`
- `gpt-5.4`

Compare on:

- action usefulness
- factual grounding to source features
- structured output reliability
- hallucination rate
- latency
- cost

### Current File To Update

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/ai-analyzer.ts`

Immediate changes:

- upgrade lead deep dive model off `claude-sonnet-4-20250514`
- remove weight-adjustment authority from the portfolio analysis
- fix enum mismatch risks in the deep-dive schema

---

## Phase 5: Custom KPI Dashboard Hardening

### Truth In Naming

The current "custom KPI" feature is mostly:

- user-configured widgets over a fixed metric catalog

It is not:

- a full custom formula engine

Product and internal language should reflect that distinction.

### Current Custom KPI Gaps

1. Some config controls are not honored by the fetch layer.
2. The dashboard still performs one request per widget in the custom path.
3. Some seeded or conceptual widget types are not fully coherent with runtime support.
4. `useKpiDashboard()` currently creates data inside a query function, which is workable but not ideal.

### Required Changes

Edit:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/hooks/useKpiWidgetData.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/hooks/useCloseKpiDashboard.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/services/closeKpiService.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/config-forms/CallAnalyticsConfig.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/config-forms/DateRangeOnlyConfig.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/CustomDashboard.tsx`

Rules:

- Every exposed config option must either be honored or removed
- Query shape changes must bump key versions
- Shared batched read models should be preferred over many per-widget direct calls where economically justified

---

## Product Copy Changes Required

Update the following files to stop overstating ML capability until the supervised system is live:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/config/prebuilt-layout.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/SetupGuide.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/AiHeroSection.tsx`

### Interim Copy Guidance

Allowed:

- "AI-generated insights"
- "AI-assisted lead review"
- "Lead prioritization score"
- "Portfolio patterns and recommendations"

Not allowed until the supervised model is live and validated:

- "Learns your business"
- "Gets smarter over time" as a blanket statement
- "Fully personalized after 50 outcomes"
- "Machine learning model" for the current heuristic + LLM retuning design

---

## Test Strategy

### Immediate Requirement

Backend-critical logic must stop being effectively untested.

### Required Test Coverage

#### Pure Logic Tests

Add or expand tests for:

- score calculation
- calibration / percentile banding
- outcome detection
- truncation behavior
- timezone bucketing
- label generation

Planned files:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/__tests__/lead-heat-calibration.test.ts`
- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/lib/__tests__/lead-heat-evaluation.test.ts`

#### Request/Auth Tests

Refactor request dispatch so auth and routing can be tested without network-heavy edge runtime harnesses.

Target areas:

- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
- `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-kpi-data/index.ts`

#### Regression Tests

Add regression coverage for:

- terminal outcome duplication
- prior opportunity state handling
- deep-dive cache invalidation
- score-band distribution under realistic sample portfolios

### Existing Test Debt

The current frontend suite is not enough.

Known issue:

- `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/__tests__/PrebuiltDashboard.test.tsx`
  - mock drift around `SECTION_TOOLTIPS`

That test file must be repaired, but it is not a substitute for backend correctness coverage.

---

## Acceptance Criteria

## Phase 0 Acceptance

- `score_all_users` cannot be triggered without verified privileged auth
- authenticated users cannot query another user's Close connection status

## Phase 1 Acceptance

- terminal outcomes are recorded correctly and reproducibly
- deep-dive cache uses its own freshness semantics
- large-org truncation is visible, not silent
- best-time-to-call metrics are timezone-aware

## Phase 2 Acceptance

- active portfolios no longer cluster almost entirely in cold/cooling unless that is truly justified by the portfolio
- hot/warming bands are usable
- score-band logic is documented and test-covered

## Phase 3 Acceptance

- supervised model beats the current heuristic baseline on agreed evaluation metrics
- calibration error is acceptable
- every served prediction is versioned
- org adaptation is gated by minimum terminal sample thresholds

## Phase 4 Acceptance

- LLMs no longer control production score weights
- deep dives are schema-consistent and model-versioned
- selected model passes human eval quality gates

## Phase 5 Acceptance

- every custom-widget config control is honored or removed
- "custom KPI" product language is accurate
- custom dashboard read performance is measurably improved or intentionally accepted

---

## Rollout Plan

### Release 1

- security hotfixes
- honest product copy
- deep-dive cache fix
- truncation surfacing

### Release 2

- interim recalibration
- dead-signal removal or redistribution
- timezone fixes
- outcome integrity fixes

### Release 3

- supervised scoring in shadow mode
- offline evaluation and comparison against heuristic
- no user-visible score change yet

### Release 4

- supervised score goes live for a limited cohort
- heuristic score retained for comparison and rollback

### Release 5

- org-specific calibration enabled behind eligibility thresholds
- updated personalization claims only after the gates are met

---

## Risks And Tradeoffs

### Percentile Bands

Pros:

- fast fix
- intuitive ranking
- avoids empty hot bands

Cons:

- relative ranking can still produce "hot" leads in a weak book
- not an absolute conversion-propensity measure

Use this only as the interim solution unless business explicitly wants a relative-rank product.

### Global Baseline + Org Adaptation

Pros:

- safer with sparse org data
- easier to calibrate
- better than low-sample per-user models

Cons:

- more infrastructure than multiplier tuning
- requires real eval discipline

This is still the recommended long-term direction.

---

## Immediate Work Order

Do this in order:

1. Harden auth in `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
2. Harden `/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260331142602_close_config_agency_fallback.sql` behavior via new migration
3. Fix previous opportunity state and outcome integrity in:
   - `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
   - `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/outcome-detector.ts`
4. Fix deep-dive cache semantics in:
   - `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/index.ts`
   - `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx`
5. Ship honest copy updates in:
   - `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/config/prebuilt-layout.ts`
   - `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/SetupGuide.tsx`
   - `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/AiHeroSection.tsx`
   - `/Users/nickneessen/projects/commissionTracker/src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx`
6. Implement interim calibration helpers and tests
7. Design and build the supervised scoring tables and evaluation harness
8. Upgrade the explanation model in `/Users/nickneessen/projects/commissionTracker/supabase/functions/close-lead-heat-score/ai-analyzer.ts`

---

## Final Decision Summary

- Keep AI explanation.
- Remove AI ownership of score updates.
- Fix security before touching models.
- Fix outcome integrity before claiming learning.
- Use percentile or recalibrated bands now.
- Move to supervised scoring next.
- Use LLM upgrades only for explanation quality, not as a substitute for model architecture.

