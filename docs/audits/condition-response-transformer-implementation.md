# Condition Response Transformer Implementation

## Code Review Document

**Date:** 2026-01-13
**Feature:** Fix Follow-Up Data Mismatch in Underwriting Wizard
**Branch:** uw-wizard
**Author:** Claude (AI-assisted implementation)

---

## Executive Summary

This implementation fixes a critical data flow issue where underwriting wizard follow-up responses were not reaching the rule evaluation engine. The wizard collected user responses (e.g., "treatment: Insulin only") but the rule engine expected different field names (e.g., "insulin_use: true"), causing "Missing data to evaluate" warnings for all products.

### Solution Approach

Created a **transformation layer** that:
1. Converts wizard field names to rule-compatible fact keys
2. Preserves undefined semantics (missing data stays undefined, never converted to false/[])
3. Normalizes human-readable values to canonical rule values

---

## Problem Statement

### Before (Broken)

```
Wizard Collects               Rule Engine Expects
─────────────────             ───────────────────
treatment: "Insulin only"  →  diabetes.insulin_use: true
a1c_level: 7.8             →  diabetes.is_controlled: false
complications: ["Retinopathy (eye)"]  →  diabetes.complications: ["retinopathy"]
diagnosis_age: 45          →  diabetes.years_since_diagnosis: 10
```

**Two issues:**
1. `conditionResponses` field was never populated in `transformWizardToDecisionEngineInput()`
2. Field names and value formats didn't match between wizard schema and rule predicates

### After (Fixed)

The transformation layer now:
- Wires condition responses into the decision engine input
- Transforms field names and values to match rule expectations
- Passes transformed data to `buildFactMap()` which flattens to dot-notation keys

---

## Files Changed

### 1. NEW: `src/services/underwriting/conditionResponseTransformer.ts`

**Purpose:** Transform wizard follow-up responses to rule-engine-compatible fact keys.

**Key Functions:**

```typescript
// Main entry point
export function transformConditionResponses(
  conditions: ConditionResponse[],
  clientAge: number,
): TransformedConditionResponses

// Diabetes-specific transformation
function transformDiabetes(
  responses: Record<string, unknown>,
  clientAge: number,
): Record<string, unknown>

// Normalize complication labels
function normalizeDiabetesComplications(complications: string[]): string[]
```

**Critical Semantics:**

```typescript
// CORRECT - Missing input produces undefined output
if (treatment !== undefined) {
  result.insulin_use = treatment.includes("Insulin");
}
// If treatment is undefined, insulin_use stays undefined (NOT false)

// WRONG - This would treat missing as negative
insulin_use: treatment?.includes('Insulin') ?? false  // DON'T DO THIS
```

**Diabetes Field Mappings:**

| Wizard Field | Transformed Field | Transformation |
|--------------|-------------------|----------------|
| `treatment` | `insulin_use` | `true` if contains "Insulin" or equals "Insulin pump" |
| `a1c_level` | `is_controlled` | `true` if < 7.5 (ADA threshold) |
| `a1c_level` | `a1c_level` | Pass-through (preserved) |
| `complications` | `complications` | Normalized array (see below) |
| `diagnosis_age` | `years_since_diagnosis` | `clientAge - diagnosisAge` |
| `type` | `type` | Pass-through |

**Complication Normalization:**

```typescript
"Retinopathy (eye)"     → "retinopathy"
"Neuropathy (nerve)"    → "neuropathy"
"Nephropathy (kidney)"  → "nephropathy"
"Amputation"            → "amputation"
"Heart disease"         → "heart_disease"
"None"                  → (filtered out)
```

**Fallback for Unknown Conditions:**

```typescript
default:
  console.warn(`[ConditionTransformer] No transformer for "${code}". ...`);
  return { code, transformed: responses, isRaw: true };
```

---

### 2. MODIFIED: `src/features/underwriting/hooks/useDecisionEngineRecommendations.ts`

**Changes:**
- Added import for `transformConditionResponses`
- Updated `transformWizardToDecisionEngineInput()` to populate `conditionResponses`

**Before:**
```typescript
return {
  client: {
    age: clientInfo.age,
    gender,
    // ...
    healthConditions,
    // conditionResponses was NOT included
  },
  // ...
};
```

**After:**
```typescript
// Transform wizard follow-up responses to rule-compatible fact keys
const conditionResponses = transformConditionResponses(
  healthInfo.conditions,
  clientInfo.age,
);

return {
  client: {
    age: clientInfo.age,
    gender,
    // ...
    healthConditions,
    conditionResponses,  // NOW INCLUDED
  },
  // ...
};
```

---

### 3. NEW: `src/services/underwriting/conditionResponseTransformer.test.ts`

**23 unit tests covering:**

1. **Complete transformation** - All fields provided, verify correct output
2. **Undefined preservation** - Missing treatment → undefined insulin_use (NOT false)
3. **Undefined preservation** - Missing A1C → undefined is_controlled (NOT false)
4. **Undefined preservation** - Missing complications → undefined (NOT [])
5. **A1C thresholds** - 6.5 → controlled, 7.8 → uncontrolled
6. **Insulin detection** - Various treatment strings
7. **Complication normalization** - All mappings verified
8. **"None" handling** - Filtered out, results in []
9. **Edge cases** - Empty responses, diagnosis_age > clientAge
10. **Fallback behavior** - Unknown conditions pass through with warning
11. **Multiple conditions** - Diabetes transformed, others passed through

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WIZARD UI                                         │
│  User fills: treatment="Insulin only", a1c=7.8, complications=["Retinopathy"]│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               transformWizardToDecisionEngineInput()                        │
│  (useDecisionEngineRecommendations.ts:42-89)                                │
│                                                                             │
│  1. Calls transformConditionResponses(conditions, clientAge)                │
│  2. Populates client.conditionResponses with transformed data               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               transformConditionResponses()                                  │
│  (conditionResponseTransformer.ts:55-76)                                    │
│                                                                             │
│  Input:  { treatment: "Insulin only", a1c_level: 7.8, ... }                │
│  Output: { insulin_use: true, is_controlled: false, ... }                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DecisionEngineInput.client                              │
│  {                                                                          │
│    age: 55, gender: "male", tobacco: false,                                │
│    healthConditions: ["diabetes"],                                          │
│    conditionResponses: {                                                    │
│      diabetes: { insulin_use: true, is_controlled: false, ... }            │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        buildFactMap()                                        │
│  (ruleEvaluator.ts:921-957)                                                 │
│                                                                             │
│  Flattens conditionResponses to dot-notation:                               │
│  {                                                                          │
│    "client.age": 55,                                                        │
│    "client.gender": "male",                                                 │
│    "conditions": ["diabetes"],                                              │
│    "diabetes.insulin_use": true,        ← FROM TRANSFORMER                  │
│    "diabetes.is_controlled": false,     ← FROM TRANSFORMER                  │
│    "diabetes.complications": ["retinopathy"]                                │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    evaluatePredicate()                                       │
│  (ruleEvaluator.ts)                                                         │
│                                                                             │
│  Rule predicate: { field: "diabetes.insulin_use", operator: "eq", value: true }│
│  Fact value: true                                                           │
│  Result: MATCHED ✓                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Design Decisions

### 1. Missing Data = Undefined (Not False/Empty)

**Rationale:** Rule evaluation uses three-state logic:
- `matched` - Condition satisfied
- `failed` - Condition not satisfied
- `unknown` - Cannot evaluate (missing data)

If missing `treatment` became `insulin_use: false`, rules would incorrectly evaluate as if the patient definitely doesn't use insulin, when in fact we don't know.

### 2. No Date Synthesis

**Rationale:** Converting `diagnosis_age: 45` to a calendar date like `2015-03-15` is fragile:
- We don't know the exact diagnosis date
- Calendar date math has edge cases
- Rules should use `years_since_diagnosis` (numeric) instead

### 3. Transformation Layer vs Schema Update

**Alternatives considered:**
- **Option A:** Update wizard `follow_up_schema` in database to collect rule-compatible fields
- **Option B (chosen):** Add transformation layer
- **Option C:** Rewrite rules to use wizard field names

**Why Option B:**
- Keeps wizard UX friendly (dropdowns with readable options)
- Keeps rule predicates semantically clear (`insulin_use` vs `treatment === "Insulin only"`)
- Encodes domain knowledge in one place (what A1C level means "controlled")
- Can be extended per-condition without database migrations

### 4. A1C Threshold = 7.5

Based on American Diabetes Association guidelines. Documented as a constant:

```typescript
const DIABETES_CONTROLLED_A1C_THRESHOLD = 7.5;
```

---

## Testing Strategy

### Unit Tests (23 tests)

```bash
npx vitest run src/services/underwriting/conditionResponseTransformer.test.ts
```

**Key test categories:**
1. **Positive cases:** Complete data transforms correctly
2. **Undefined preservation:** Critical tests that verify missing → undefined
3. **Normalization:** Complication labels mapped correctly
4. **Edge cases:** Empty data, invalid data, boundary conditions
5. **Fallback:** Unknown conditions pass through with warning

### Integration Verification

1. Run wizard with diabetic client
2. Fill follow-up: Treatment "Insulin only", A1C 7.8
3. Check console logs for transformed fact keys
4. Verify no "Missing data to evaluate" warnings

---

## Verification Checklist

- [x] TypeScript typecheck passes (`npm run typecheck`)
- [x] All 23 unit tests pass
- [x] `conditionResponses` wired into `DecisionEngineInput`
- [x] Transformer preserves undefined for missing inputs
- [x] Fallback emits warning for unknown conditions
- [x] Complication normalization handles all known labels

---

## Future Work

### Add Transformers for Other Conditions

```typescript
case "heart_disease":
  return { code, transformed: transformHeartDisease(responses, clientAge), isRaw: false };
case "cancer":
  return { code, transformed: transformCancer(responses, clientAge), isRaw: false };
case "hypertension":
  return { code, transformed: transformHypertension(responses, clientAge), isRaw: false };
```

**Potential fields:**
- **Heart Disease:** `years_since_event`, `ejection_fraction`, `stable`
- **Cancer:** `years_since_diagnosis`, `in_remission`, `stage`
- **Hypertension:** `controlled`, `medication_count`

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| A1C threshold varies by carrier | Low | Threshold is documented; can be made carrier-specific later |
| Unknown conditions get raw data | Medium | Console warning alerts developers; rules may not match |
| Transformer bugs silently fail | Low | Comprehensive unit tests; logs in development |

---

## Appendix: Type Definitions

### ConditionResponse (Input)

```typescript
// src/features/underwriting/types/underwriting.types.ts
export interface ConditionResponse {
  conditionCode: string;              // e.g., "diabetes"
  conditionName: string;              // e.g., "Diabetes"
  responses: Record<string, string | number | string[]>;
}
```

### TransformedConditionResponses (Output)

```typescript
// src/services/underwriting/conditionResponseTransformer.ts
export type TransformedConditionResponses = Record<
  string,                             // condition code
  Record<string, unknown>             // transformed field → value
>;
```

### ClientProfile (Consumer)

```typescript
// src/services/underwriting/decisionEngine.ts
export interface ClientProfile {
  age: number;
  gender: GenderType;
  state?: string;
  bmi?: number;
  tobacco: boolean;
  healthConditions: string[];
  conditionResponses?: Record<string, Record<string, unknown>>;  // ← Populated now
}
```
