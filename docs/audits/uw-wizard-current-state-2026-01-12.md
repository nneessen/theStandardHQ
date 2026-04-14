# Underwriting Wizard - Current State Assessment

> **Last Updated:** 2026-01-12
> **Status:** NOT PRODUCTION READY
> **Estimated Completion:** 40-50%

---

## Executive Summary

The UW Wizard has significant infrastructure built but critical integration gaps prevent production use. The rule engine v2 (compound predicates) exists but is **not connected** to the decision engine that generates recommendations. Rules can be created and edited but they **don't actually affect underwriting decisions**.

---

## What Actually Exists

### 1. Rule Engine v2 DSL (COMPLETE)
**Files:** `ruleEngineDSL.ts`, `ruleEvaluator.ts`

A well-designed compound predicate system:
- Logical operators: `all`, `any`, `not`
- Field conditions: numeric, date, boolean, string, array, set, null_check, condition_presence
- Tri-state evaluation: `matched`, `failed`, `unknown` (with missing field tracking)
- Proper unknown propagation (conservative - unknown + anything = unknown)
- Health class aggregation (worst rank wins)
- Table rating aggregation (max units, not multiply)

**Status:** Code is solid, well-tested logic. But it's a library sitting unused.

### 2. Rule Management UI (COMPLETE)
**Files:** `RuleSetEditor.tsx`, `RuleEditor.tsx`, `PredicateBuilder.tsx`, `RuleSetList.tsx`

Full CRUD interface:
- Create/edit rule sets with metadata (scope, condition code, carrier)
- Visual predicate builder (drag-and-drop style condition building)
- Outcome editor (health class, table rating, flat extras)
- Rule ordering by priority
- Active/inactive toggle

**Status:** UI works. You can create rules. They just don't do anything.

### 3. Rule Generation RPCs (PARTIALLY WORKING)
**Files:** `generateRulesService.ts`, migrations `20260112_001` through `20260112_007`

Two generation functions:
- `generate_global_knockout_rules()` - Creates rule sets for 15 hardcoded knockout conditions
- `generate_age_rules_from_products()` - Creates age eligibility rules from product min/max age

**Status:**
- Knockout generation: Works but creates **generic templates**, not carrier-specific rules
- Age generation: **BROKEN** - skips all products (needs debugging)

### 4. Database Schema (COMPLETE)
**Tables:**
- `underwriting_rule_sets` - Rule set metadata, review status, carrier/product scoping
- `underwriting_rules` - Individual rules with predicates and outcomes
- `underwriting_health_conditions` - Health condition definitions (15 knockouts seeded)
- `underwriting_rule_evaluation_log` - Audit trail (exists but not populated)

**Status:** Schema is fine. Data is sparse/test-only.

### 5. React Hooks (COMPLETE)
**Files:** `useRuleSets.ts`, `useRules.ts`, `useGenerateRules.ts`, `useRuleWorkflow.ts`

Full TanStack Query integration:
- Query hooks for fetching rule sets/rules
- Mutation hooks for CRUD operations
- Generation mutations for knockout/age rules
- Proper cache invalidation

**Status:** Hooks work correctly.

---

## What's Broken or Missing

### CRITICAL GAP #1: Decision Engine Doesn't Use Rule Engine v2

**The Problem:**
The decision engine (`decisionEngine.ts`) that generates product recommendations uses the **old** `acceptance_rules` table and `acceptanceService.ts`, NOT the new rule engine v2.

```
Current Flow (BROKEN):
Wizard Input → Decision Engine → OLD acceptance_rules → Recommendations

Intended Flow (NOT IMPLEMENTED):
Wizard Input → Decision Engine → Rule Engine v2 → Recommendations
```

**Impact:** All the rules you create in the UI have **zero effect** on underwriting decisions.

**To Fix:** Modify `decisionEngine.ts` to call `evaluateRuleSet()` from `ruleEvaluator.ts` instead of the legacy acceptance lookup.

### CRITICAL GAP #2: No Carrier-Specific Rules

**The Problem:**
The 15 knockout conditions are **hardcoded generic templates** from a migration file:
- AIDS/HIV, ALS, Alzheimer's, Dialysis, etc.
- These are industry-standard guesses, NOT actual carrier underwriting guidelines
- Source: `20260112_004_seed_knockout_conditions.sql`

**Impact:** Rules don't reflect what carriers actually accept/decline. Using these in production would give incorrect recommendations.

**To Fix:** Need a way to import actual carrier underwriting guides and extract carrier-specific rules.

### CRITICAL GAP #3: Age Rule Generation Broken

**The Problem:**
`generate_age_rules_from_products()` skips all products:
```
"Generated 0 age rule sets from 7 products (7 skipped)"
```

**Likely Cause:** Products may already have rule sets (skip_if_exists strategy) or the RPC has a bug in its existence check.

**To Fix:** Debug the RPC, check what's being matched as "existing".

### CRITICAL GAP #4: No Document Import Pipeline

**The Problem:**
There's no way to:
1. Upload a carrier's underwriting guide (PDF)
2. Parse/extract rules from it
3. Convert to rule engine v2 predicates
4. Review and approve extracted rules

**What Exists:**
- `guideStorageService.ts` - File upload to Supabase storage
- `useParseGuide.ts` - Hook exists but calls an Edge Function that may be stubbed
- `GuideManager/` components - UI scaffolding

**Impact:** Can't populate system with real carrier data. Everything is manual entry.

### CRITICAL GAP #5: No Premium Data

**The Problem:**
The premium matrix system exists but has no production data:
- `premium_matrix` table exists
- `premiumMatrixService.ts` has interpolation logic
- `RateEntry/` components allow manual entry

**Impact:** Can't calculate actual premiums. Recommendations are eligibility-only.

### CRITICAL GAP #6: Source Tracking Not Integrated

**The Problem:**
Recently added columns (`source_type`, `needs_review`, `template_version`) for tracking whether rules came from:
- `generic_template` - Auto-generated from hardcoded conditions
- `carrier_document` - Extracted from actual carrier guides
- `manual` - Hand-created by user

**Status:** Columns exist but nothing populates `carrier_document`. Everything is either `generic_template` or `manual`.

---

## What Would Production Look Like

### Minimum Viable Product (MVP)

1. **Wire rule engine v2 to decision engine**
   - Modify `decisionEngine.ts` to use `evaluateRuleSet()`
   - Load approved rule sets for carrier/product/condition
   - Evaluate against client facts
   - Return proper eligibility with reasons

2. **Fix age rule generation**
   - Debug the skip logic
   - Ensure products without rule sets get rules created

3. **Manual rule entry workflow**
   - User creates rule set for carrier + condition
   - User enters rules based on reading carrier guide themselves
   - Rules become active immediately (no approval workflow needed)

4. **Basic validation**
   - Test with known scenarios (diabetic, 65yo, smoker, etc.)
   - Verify rules produce expected outcomes

### Full Production (Future)

1. **Document import pipeline**
   - Upload carrier PDF
   - AI extraction of underwriting criteria
   - Human review and approval
   - Automatic rule generation from extracted criteria

2. **Premium matrix population**
   - Import rate tables from carriers
   - Age/class/amount interpolation
   - Actual premium quotes

3. **Condition-specific rule sets**
   - Diabetes rules (A1C thresholds, medication, etc.)
   - Heart disease rules (time since event, medications, etc.)
   - Cancer rules (type, staging, remission time, etc.)

4. **Product type scoping**
   - Term life vs whole life have different underwriting
   - Rules should be scoped to product types

---

## File Inventory

### Core Services
| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `ruleEngineDSL.ts` | 606 | Complete | Predicate schema and types |
| `ruleEvaluator.ts` | 971 | Complete | Evaluation logic, not used |
| `ruleService.ts` | 621 | Complete | CRUD operations |
| `generateRulesService.ts` | 170 | Partial | Knockout works, age broken |
| `decisionEngine.ts` | 1,161 | **Gap** | Uses old system, needs rewire |
| `acceptanceService.ts` | ~400 | Legacy | Old rules, still in use |

### UI Components
| File | Status | Notes |
|------|--------|-------|
| `RuleSetEditor.tsx` | Complete | Create/edit rule sets |
| `RuleEditor.tsx` | Complete | Edit individual rules |
| `PredicateBuilder.tsx` | Complete | Visual predicate builder |
| `RuleSetList.tsx` | Complete | List/filter rule sets |
| `ApprovalActions.tsx` | Removed | Was approval workflow |
| `fieldRegistry.ts` | Complete | Field definitions |

### Hooks
| File | Status | Notes |
|------|--------|-------|
| `useRuleSets.ts` | Complete | Query/mutate rule sets |
| `useRules.ts` | Complete | Query/mutate rules |
| `useGenerateRules.ts` | Partial | Knockout works, age broken |
| `useRuleWorkflow.ts` | Unused | Approval workflow removed |

### Database
| Table | Status | Notes |
|-------|--------|-------|
| `underwriting_rule_sets` | Has data | Mostly draft/test |
| `underwriting_rules` | Has data | Generated rules |
| `underwriting_health_conditions` | Seeded | 15 knockouts |
| `underwriting_rule_evaluation_log` | Empty | Never populated |

---

## Immediate Next Steps (Priority Order)

1. **Debug age rule generation** - Why are all products being skipped?

2. **Wire decision engine to rule engine v2** - This is the critical integration

3. **Test end-to-end** - Create rules, run wizard, verify rules affect output

4. **Document manual workflow** - How to add real carrier rules without import pipeline

---

## What This System Is NOT

- **NOT a production underwriting system** - Rules are generic templates
- **NOT integrated** - Rule engine exists but isn't used
- **NOT populated with real data** - No actual carrier underwriting guidelines
- **NOT tested** - No validation that rules produce correct outcomes
- **NOT ready for users** - Would give incorrect/misleading recommendations

---

## Honest Assessment

The UW Wizard has good **infrastructure** but poor **integration**. It's like having a powerful engine sitting next to a car but not installed. The parts are quality, the assembly is incomplete.

**Time to MVP:** 2-3 focused development sessions to wire up the integration and fix age rules.

**Time to Production:** Weeks/months depending on how much carrier-specific data needs to be entered and validated.
