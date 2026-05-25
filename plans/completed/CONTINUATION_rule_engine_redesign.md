# Continuation Prompt: Carrier Acceptance Rules UI Redesign

## Context

The current Carrier Acceptance Rules (Rule Engine v2) feature has a fundamentally broken UX. While the backend data model is correct, the UI presents a confusing "generic predicate builder" that doesn't reflect how real insurance underwriting works.

## The Problem

### Current (Wrong) Mental Model
The UI treats health conditions as generic boolean checks: "Does client have diabetes? yes/no"

### Correct Mental Model
Real insurance underwriting works like this:
1. Client discloses: "I have Diabetes Type 2"
2. Carrier asks **follow-up questions**: "When were you diagnosed?", "What's your A1C?", "Are you on insulin?", "Any complications?"
3. Rules evaluate **answers to those questions** to determine eligibility

### Current UX Issues
1. **No visual hierarchy** - Everything looks the same, no clear sections
2. **No guidance** - User has no idea what "Predicate", "Outcome", "Filters" mean
3. **Wrong emphasis** - Client demographics (age, BMI) shown equally with condition-specific questions
4. **Hidden structure** - The condition-specific fields exist in code but aren't surfaced properly
5. **Developer-facing language** - "Predicate", "treatNullAs" instead of insurance terminology

---

## Existing Files to Reference/Modify

### UI Components (need redesign)
```
src/features/underwriting/components/RuleEngine/
├── RuleSetEditor.tsx      # Sheet for creating/editing rule sets - REDESIGN
├── RuleSetList.tsx        # List of rule sets - MINOR UPDATES
├── RuleEditor.tsx         # Dialog for individual rules - REDESIGN
├── PredicateBuilder.tsx   # Wrapper with visual/JSON toggle - KEEP
├── PredicateGroupBuilder.tsx  # Recursive group builder - SIMPLIFY
├── PredicateLeafBuilder.tsx   # Single condition row - REDESIGN
├── OutcomeEditor.tsx      # Outcome fields editor - KEEP (styling only)
├── fieldRegistry.ts       # Field definitions - KEEP (data source)
├── ApprovalActions.tsx    # Approval workflow - MAY REMOVE (single-user)
├── ProvenanceTooltip.tsx  # AI extraction info - KEEP
├── PredicateJsonEditor.tsx # JSON editor fallback - KEEP
└── index.ts
```

### Field Registry Structure (already correct)
The `fieldRegistry.ts` already has the right data model:

```typescript
// CLIENT_FIELDS - Demographics (age, gender, BMI, state, tobacco, conditions array)
// CONDITION_FIELDS - Per-condition follow-up questions:
//   diabetes_type_2: { a1c, diagnosis_date, insulin_use, oral_meds_only, complications, well_controlled }
//   diabetes_type_1: { a1c, diagnosis_date, complications, pump_use, cgm_use }
//   hypertension: { systolic, diastolic, controlled, medication_count, end_organ_damage }
//   cancer: { type, stage, diagnosis_date, treatment_status, remission_date, metastatic }
//   heart_disease: { type, ejection_fraction, lvef, nyha_class, cabg, stent, last_event_date }
//   copd: { fev1_percent, gold_stage, oxygen_use, hospitalizations_last_year }
//   sleep_apnea: { ahi, severity, cpap_compliant, treatment }
//   depression: { severity, hospitalizations, suicide_attempt, stable_on_meds, working }
//   anxiety: { severity, panic_attacks, stable_on_meds }
```

### Database Tables (already exist)
```sql
-- underwriting_rule_sets
-- - id, carrier_id, imo_id, product_id, name, description
-- - scope ('global' | 'condition'), condition_code, is_active
-- - review_status, source_type, version, variant, default_outcome, created_by

-- underwriting_rules
-- - id, rule_set_id, priority, name, description
-- - predicate (JSONB - compound predicate v2 format)
-- - age_band_min, age_band_max, gender
-- - outcome_eligibility, outcome_health_class, outcome_table_rating
-- - outcome_flat_extra_per_thousand, outcome_flat_extra_years
-- - outcome_reason, outcome_concerns
```

---

## Target Design

### Main View: Condition Rule Set Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DIABETES TYPE 2                                         [Status: Draft] │
│ Carrier: Prudential                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ╔═══════════════════════════════════════════════════════════════════╗   │
│ ║ FOLLOW-UP QUESTIONS                                               ║   │
│ ║ When applicant discloses this condition, collect this info:       ║   │
│ ╠═══════════════════════════════════════════════════════════════════╣   │
│ ║  • A1C Level (%)              • Using Insulin?                    ║   │
│ ║  • Date of Diagnosis          • Oral Medications Only?            ║   │
│ ║  • Complications              • Well Controlled?                  ║   │
│ ╚═══════════════════════════════════════════════════════════════════╝   │
│                                                                         │
│ ╔═══════════════════════════════════════════════════════════════════╗   │
│ ║ ACCEPTANCE RULES                     [evaluated in priority order] ║   │
│ ╠═══════════════════════════════════════════════════════════════════╣   │
│ ║                                                                    ║   │
│ ║  1│ DECLINE — Complications Present                    [Edit][Del]║   │
│ ║    │ IF complications includes [nephropathy]                      ║   │
│ ║    │ → Decline · "Diabetic nephropathy high mortality risk"       ║   │
│ ║    └──────────────────────────────────────────────────────────────║   │
│ ║                                                                    ║   │
│ ║  2│ TABLE RATE — Insulin + High A1C                    [Edit][Del]║   │
│ ║    │ IF insulin_use = true AND a1c >= 7.5                         ║   │
│ ║    │ → Table B, Standard · "Insulin with elevated A1C"            ║   │
│ ║    └──────────────────────────────────────────────────────────────║   │
│ ║                                                                    ║   │
│ ║  3│ ELIGIBLE — Well Controlled                         [Edit][Del]║   │
│ ║    │ IF a1c < 7.0 AND oral_meds_only = true                       ║   │
│ ║    │ → Standard · "Well-controlled with oral meds"                ║   │
│ ║    └──────────────────────────────────────────────────────────────║   │
│ ║                                                                    ║   │
│ ║  [+ Add Rule]                                                      ║   │
│ ╚═══════════════════════════════════════════════════════════════════╝   │
│                                                                         │
│ ╔═══════════════════════════════════════════════════════════════════╗   │
│ ║ DEFAULT OUTCOME (if no rules match)                               ║   │
│ ║ → Refer for manual review                                         ║   │
│ ╚═══════════════════════════════════════════════════════════════════╝   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Rule Editor Dialog (Add/Edit)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ADD RULE FOR: Diabetes Type 2                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Rule Name *: [________________________________________]                │
│  Priority:    [10 ▼]  (lower = evaluated first)                        │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ WHEN THESE CONDITIONS ARE MET:                                    │   │
│ │                                                                   │   │
│ │ ▾ Diabetes Type 2 Answers                        [match: ALL ▼]   │   │
│ │   ┌─────────────────────────────────────────────────────────────┐ │   │
│ │   │ [A1C Level ▼]      [>= ▼]    [7.5]  %              [×]      │ │   │
│ │   │ [Insulin Use ▼]    [is ▼]    [☑ Yes]               [×]      │ │   │
│ │   └─────────────────────────────────────────────────────────────┘ │   │
│ │   [+ Add condition from diabetes answers]                         │   │
│ │                                                                   │   │
│ │ ▸ Client Demographics (optional)                                  │   │
│ │   [+ Add filter (age, gender, state, etc.)]                       │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ THEN APPLY THIS DECISION:                                         │   │
│ │                                                                   │   │
│ │ Eligibility:  [Table Rated ▼]    Health Class: [Standard ▼]       │   │
│ │ Table Rating: [Table B ▼]                                         │   │
│ │                                                                   │   │
│ │ Reason *: [Insulin-dependent diabetes with elevated A1C         ] │   │
│ │           [indicates increased mortality risk                   ] │   │
│ │                                                                   │   │
│ │ Concerns: [insulin_dependent, elevated_a1c] (comma-separated)     │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                           [Cancel]  [Save Rule]         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Requirements

### 1. Visual Hierarchy with Clear Sections
- Use bordered cards/boxes for each section
- Section headers with explanatory subtext
- Visual distinction between condition-specific fields and client demographics
- Color-coded outcome badges (green=eligible, red=decline, yellow=refer/table)

### 2. Insurance-Friendly Language
| Current (Developer)     | New (Insurance)                    |
|-------------------------|-------------------------------------|
| Predicate               | "When these conditions are met"     |
| Outcome                 | "Then apply this decision"          |
| Filters                 | "Client Demographics (optional)"    |
| treatNullAs             | Hidden or "If unknown: [Refer/Fail]"|
| condition_code          | Health Condition                    |

### 3. Condition-First Flow
- When scope = "condition", prominently display the condition name
- Show the condition's follow-up questions in a reference section
- Default the predicate builder to condition-specific fields (not client.age)

### 4. Rule Cards (not table rows)
Each rule displayed as a visual card showing:
- Priority number
- Rule name + outcome badge
- Human-readable condition summary ("IF a1c >= 7.5 AND insulin = true")
- Outcome summary ("→ Table B, Standard")
- Edit/Delete actions on hover

### 5. Compact, Professional Styling
Per project standards:
- Small text (10-11px)
- Minimal padding (Tailwind 1/2/3 scale)
- Muted colors, subtle borders
- Data-dense layout

---

## Files to Create/Modify

### New Components
```
src/features/underwriting/components/RuleEngine/
├── ConditionRuleSetView.tsx    # Main redesigned view
├── RuleCard.tsx                # Individual rule display card
├── ConditionInfoPanel.tsx      # Shows follow-up questions for condition
├── ConditionFieldSelector.tsx  # Condition-first field picker
└── RuleConditionBuilder.tsx    # Simplified predicate builder
```

### Modify Existing
```
RuleSetEditor.tsx       # Refactor to use new components
RuleEditor.tsx          # Simplify, better section layout
PredicateLeafBuilder.tsx # Better field grouping UI
OutcomeEditor.tsx       # Minor styling updates
```

---

## Technical Constraints

1. **No backend changes needed** - The data model is correct
2. **Keep existing hooks** - `useRuleSets`, `useRules`, mutations all work
3. **Maintain JSON predicate format** - Visual changes only
4. **Keep JSON editor fallback** - Power users can still edit raw predicates
5. **Single-user system** - Remove/hide approval workflow complexity

---

## Acceptance Criteria

1. User can create a rule set for a health condition
2. The condition's follow-up questions are clearly displayed
3. Rules are built using condition-specific fields by default
4. Client demographics are available as optional filters
5. Rules display as readable cards, not cryptic JSON
6. The UI uses insurance terminology, not developer jargon
7. Visual hierarchy clearly separates sections
8. Compact, professional styling per project standards

---

## Starting Point

Begin by creating `ConditionRuleSetView.tsx` as the main redesigned component, then refactor `RuleSetEditor.tsx` to use it when `scope === "condition"`.
