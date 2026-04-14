# UW Wizard Technical Assessment

> **Date:** 2026-01-12
> **Status:** NOT PRODUCTION READY (~40% complete)
> **Blocking Issues:** 2 critical, 1 major

---

## Executive Summary

The UW Wizard has a well-designed rule engine v2 that is **completely disconnected** from the decision engine that generates recommendations. Rules created in the UI have zero effect on underwriting decisions. Additionally, the age rule generation is broken (skipping all products).

---

## Architecture Overview

```
CURRENT FLOW (BROKEN):
┌──────────────────┐      ┌─────────────────────┐      ┌─────────────────────────────┐
│ UnderwritingWizard│ ──► │ decisionEngine.ts   │ ──► │ carrier_condition_acceptance │
│ (WizardFormData)  │      │ getRecommendations()│      │ (OLD TABLE - acceptanceService)│
└──────────────────┘      └─────────────────────┘      └─────────────────────────────┘

INTENDED FLOW (NOT WIRED):
┌──────────────────┐      ┌─────────────────────┐      ┌─────────────────────────────┐
│ UnderwritingWizard│ ──► │ decisionEngine.ts   │ ──► │ underwriting_rule_sets      │
│ (WizardFormData)  │      │ getRecommendations()│      │ (NEW - ruleEvaluator.ts)    │
└──────────────────┘      └─────────────────────┘      └─────────────────────────────┘
```

---

## Critical Gap #1: Decision Engine Uses Wrong System

### The Problem

`decisionEngine.ts:374` calls `lookupAcceptance()` from `acceptanceService.ts`, which queries the **old** `carrier_condition_acceptance` table:

```typescript
// decisionEngine.ts:371-379
// Evaluate each condition using only approved rules
for (const conditionCode of healthConditions) {
  // lookupAcceptance defaults to approved rules only
  const acceptance = await lookupAcceptance(  // <-- OLD SYSTEM
    carrierId,
    conditionCode,
    imoId,
    productType,
  );
```

### What Should Happen

Should call `evaluateRuleSet()` from `ruleEvaluator.ts` using data from `underwriting_rule_sets` table.

### Files Involved

| File                   | Purpose                                | Status                   |
| ---------------------- | -------------------------------------- | ------------------------ |
| `decisionEngine.ts`    | Main recommendation engine             | Uses OLD system          |
| `acceptanceService.ts` | Queries `carrier_condition_acceptance` | Legacy, still in use     |
| `ruleEvaluator.ts`     | Evaluates compound predicates          | Complete, NOT USED       |
| `ruleService.ts`       | CRUD for `underwriting_rule_sets`      | Complete, NOT INTEGRATED |

### Integration Point

```typescript
// decisionEngine.ts needs to be modified to:
// 1. Import from ruleService:
import { loadApprovedRuleSets } from "./ruleService";
import {
  evaluateRuleSet,
  buildFactMap,
  aggregateOutcomes,
} from "./ruleEvaluator";

// 2. Replace lookupAcceptance() calls with:
const ruleSets = await loadApprovedRuleSets(imoId, carrierId, productId, {
  scope: "condition",
  conditionCodes: healthConditions,
});

const facts = buildFactMap(client, healthConditions, conditionResponses);
const outcomes = ruleSets.map((rs) => evaluateRuleSet(rs, facts));
const aggregated = aggregateOutcomes(outcomes, globalOutcome);
```

---

## Critical Gap #2: Age Rule Generation Broken

### The Problem

`generate_age_rules_from_products()` skips all 7 products:

```
"Generated 0 age rule sets from 7 products (7 skipped)"
```

### Root Cause Analysis

The RPC checks for existing rule sets matching ALL these criteria:

```sql
-- From 20260112_002_fix_generate_rules_user_table.sql:279-289
SELECT id INTO v_existing_id
FROM underwriting_rule_sets
WHERE carrier_id = p_carrier_id
  AND imo_id = p_imo_id
  AND product_id = v_product.id
  AND scope = 'global'
  AND condition_code IS NULL
  AND source = 'imported'           -- <-- This filter
  AND name LIKE 'Age Eligibility:%' -- <-- And this filter
ORDER BY version DESC NULLS LAST
LIMIT 1;
```

**Likely causes:**

1. Rule sets already exist from previous generation attempts
2. Or products don't have `min_age`/`max_age` set (filtered on line 274)

### Debug Query

```sql
-- Check if products have age limits
SELECT id, name, min_age, max_age, is_active
FROM products
WHERE carrier_id = '<carrier_id>'
AND is_active = true;

-- Check existing age rule sets
SELECT id, name, product_id, scope, source, review_status
FROM underwriting_rule_sets
WHERE carrier_id = '<carrier_id>'
AND scope = 'global'
AND condition_code IS NULL;
```

### Fix Options

1. **Clear existing rule sets** and regenerate
2. **Use `upsert_draft` strategy** instead of `skip_if_exists`
3. **Fix the existence check** to be less strict

---

## Major Gap #3: 15 Knockout Conditions are Hardcoded

### Source Location

`supabase/migrations/20260112_001_generate_rules_rpc.sql:25-47`

```sql
CREATE OR REPLACE FUNCTION get_knockout_conditions()
RETURNS knockout_condition_def[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    ROW('aids_hiv', 'AIDS/HIV', 'absolute', ...)::knockout_condition_def,
    ROW('als', 'ALS (Lou Gehrig''s Disease)', 'absolute', ...)::knockout_condition_def,
    -- ... 13 more hardcoded conditions
  ];
$$;
```

### The 15 Conditions

| Code                       | Name                            | Severity    |
| -------------------------- | ------------------------------- | ----------- |
| `aids_hiv`                 | AIDS/HIV                        | absolute    |
| `als`                      | ALS (Lou Gehrig's Disease)      | absolute    |
| `alzheimers`               | Alzheimer's Disease             | absolute    |
| `organ_transplant_waiting` | Awaiting Organ Transplant       | absolute    |
| `dialysis`                 | Currently on Dialysis           | absolute    |
| `hospice`                  | Hospice Care                    | absolute    |
| `intravenous_drug_use`     | IV Drug Use (Current)           | absolute    |
| `metastatic_cancer`        | Metastatic Cancer               | absolute    |
| `oxygen_therapy`           | Continuous Oxygen Therapy       | absolute    |
| `wheelchair_bound`         | Wheelchair Bound                | conditional |
| `dementia`                 | Dementia                        | absolute    |
| `parkinsons_advanced`      | Advanced Parkinson's Disease    | absolute    |
| `stroke_recent`            | Stroke (within 12 months)       | conditional |
| `heart_attack_recent`      | Heart Attack (within 12 months) | conditional |
| `substance_abuse_active`   | Active Substance Abuse          | absolute    |

**These are industry-standard guesses, NOT actual carrier underwriting guidelines.**

---

## Data Flow Analysis

### Wizard → Decision Engine Input

```typescript
// useDecisionEngineRecommendations.ts:34-72
export function transformWizardToDecisionEngineInput(
  clientInfo: ClientInfo,
  healthInfo: HealthInfo,
  coverageRequest: CoverageRequest,
  imoId: string,
): DecisionEngineInput {
  return {
    client: {
      age: clientInfo.age,
      gender,
      state: clientInfo.state || undefined,
      bmi: bmi > 0 ? bmi : undefined,
      tobacco: healthInfo.tobacco.currentUse,
      healthConditions, // string[] of condition codes
    },
    coverage: {
      faceAmount: coverageRequest.faceAmount,
      productTypes: coverageRequest.productTypes,
    },
    imoId,
  };
}
```

### Rule Engine v2 Expected Input (FactMap)

```typescript
// ruleEngineDSL.ts:465-478
export interface FactMap {
  "client.age": number;
  "client.gender": "male" | "female";
  "client.bmi": number;
  "client.state": string;
  "client.tobacco": boolean;
  conditions: string[]; // condition codes present
  [key: `${string}.${string}`]: unknown; // condition-specific fields
}
```

### Gap: Missing Condition Responses

The wizard collects health condition codes but NOT the detailed responses needed for condition-specific rules (A1C levels, diagnosis dates, etc.). The `buildFactMap()` function expects:

```typescript
// ruleEvaluator.ts:918-948
export function buildFactMap(
  client: { age; gender; bmi; state; tobacco },
  healthConditions: string[],
  conditionResponses: Record<string, Record<string, unknown>>, // <-- NOT COLLECTED
): FactMap;
```

---

## Database Schema Summary

### Tables Used

| Table                              | Purpose                  | Status                  |
| ---------------------------------- | ------------------------ | ----------------------- |
| `underwriting_rule_sets`           | Rule set metadata        | Has data (mostly draft) |
| `underwriting_rules`               | Individual rules         | Has generated rules     |
| `underwriting_health_conditions`   | Condition definitions    | Seeded with knockouts   |
| `underwriting_rule_evaluation_log` | Audit trail              | Empty                   |
| `carrier_condition_acceptance`     | **OLD** acceptance rules | Used by decision engine |

### Key Enums

```sql
-- rule_review_status: draft | pending_review | approved | rejected
-- rule_set_scope: condition | global
-- health_class: preferred_plus | preferred | standard_plus | standard | substandard | refer | decline | unknown
-- table_rating: none | A-P (16 levels)
```

### RLS Policies

- Rule sets: Agents see approved only, admins see all
- Rules: Inherit from parent rule set
- Evaluation log: IMO-scoped, append-only

---

## File Inventory

### Services (Business Logic)

| File                      | Lines | Status   | Integration                   |
| ------------------------- | ----- | -------- | ----------------------------- |
| `ruleEngineDSL.ts`        | 607   | Complete | Types only, used by evaluator |
| `ruleEvaluator.ts`        | 971   | Complete | **NOT CALLED**                |
| `ruleService.ts`          | 621   | Complete | Used by UI only               |
| `generateRulesService.ts` | 170   | Partial  | Knockout works, age broken    |
| `decisionEngine.ts`       | 1,161 | **Gap**  | Uses old system               |
| `acceptanceService.ts`    | 599   | Legacy   | Still in production use       |

### Hooks

| File                                  | Status   | Notes                 |
| ------------------------------------- | -------- | --------------------- |
| `useRuleSets.ts`                      | Complete | CRUD queries          |
| `useRules.ts`                         | Complete | CRUD mutations        |
| `useGenerateRules.ts`                 | Partial  | Age generation broken |
| `useDecisionEngineRecommendations.ts` | Complete | Calls old system      |

### UI Components

| File                   | Status   | Notes                     |
| ---------------------- | -------- | ------------------------- |
| `RuleSetEditor.tsx`    | Complete | Approval workflow removed |
| `RuleEditor.tsx`       | Complete | Predicate builder         |
| `PredicateBuilder.tsx` | Complete | Visual AND/OR/NOT         |
| `fieldRegistry.ts`     | Complete | Field definitions         |

---

## Immediate Action Items

### 1. Fix Age Rule Generation (30 min)

```sql
-- Option A: Clear existing and regenerate
DELETE FROM underwriting_rule_sets
WHERE scope = 'global'
AND condition_code IS NULL
AND carrier_id = '<carrier_id>';

-- Then call generate_age_rules_from_products() again
```

### 2. Wire Decision Engine to Rule Engine v2 (2-4 hours)

Modify `decisionEngine.ts`:

1. Import `loadApprovedRuleSets`, `evaluateRuleSet`, `buildFactMap`, `aggregateOutcomes`
2. Replace `lookupAcceptance()` loop with rule set evaluation
3. Map aggregated outcome to existing `ConditionDecision` format
4. Handle missing fields / unknown results

### 3. Collect Condition-Specific Responses (4-8 hours)

The wizard needs follow-up questions for each health condition:

- Diabetes: A1C level, diagnosis date, insulin use
- Heart disease: Event date, ejection fraction
- Cancer: Stage, treatment status, remission date

The `fieldRegistry.ts` already defines these fields.

---

## What Works Today

1. ✅ Create/edit rule sets in UI
2. ✅ Build compound predicates visually
3. ✅ Generate knockout rules (15 hardcoded conditions)
4. ✅ Rule evaluation logic (`evaluateRuleSet()`)
5. ✅ Outcome aggregation (health class, table rating)
6. ✅ CRUD operations with proper RLS

## What Doesn't Work

1. ❌ Rules have no effect on recommendations
2. ❌ Age rule generation skips all products
3. ❌ No carrier-specific rules (only generic templates)
4. ❌ No condition-specific follow-up questions
5. ❌ No document import pipeline
6. ❌ No premium data

---

## Estimated Effort to MVP

| Task                              | Hours    | Blocker          |
| --------------------------------- | -------- | ---------------- |
| Fix age rule generation           | 0.5      | None             |
| Wire decision engine to v2        | 4        | None             |
| Test end-to-end flow              | 2        | Depends on above |
| Add condition follow-up questions | 8        | UI work          |
| **Total to basic MVP**            | **14.5** |                  |

| Future Work                | Hours | Notes            |
| -------------------------- | ----- | ---------------- |
| Document import pipeline   | 40+   | AI extraction    |
| Premium matrix population  | 20+   | Data entry       |
| Comprehensive rule library | 80+   | Per-carrier work |
