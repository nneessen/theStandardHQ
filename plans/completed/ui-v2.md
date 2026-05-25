# Carrier Acceptance Rules UI v2 - Implementation Plan

## Status: READY TO IMPLEMENT

## Objective

Rebuild the Carrier Acceptance Rules UI to use the v2 rule engine (`underwriting_rule_sets`, `underwriting_rules`) with compound predicates, approval workflow, and proper TanStack Query integration.

---

## Constraints

- Keep existing carrier selector/navigation pattern
- No new auth assumptions - enforce via RLS, handle permission errors gracefully
- TanStack Query for all server state - no local cache hacks
- MVP visual builder with Advanced JSON fallback (not perfection)
- Multi-tenant via RLS (don't pass imo_id from client unless existing pattern)

---

## File Structure

### New Files
```
src/features/underwriting/
├── hooks/
│   ├── useRuleSets.ts              # Query hooks for rule sets
│   ├── useRules.ts                 # Query hooks for rules
│   └── useRuleWorkflow.ts          # Approval workflow mutations
├── components/
│   └── RuleEngine/
│       ├── RuleSetList.tsx         # List of rule sets with status badges
│       ├── RuleSetEditor.tsx       # Create/edit rule set + rules list
│       ├── RuleEditor.tsx          # Single rule editor (predicate + outcome)
│       ├── PredicateBuilder.tsx    # Visual predicate builder (MVP)
│       ├── PredicateGroupBuilder.tsx  # Recursive group builder
│       ├── PredicateLeafBuilder.tsx   # Single condition row
│       ├── PredicateJsonEditor.tsx    # Advanced JSON toggle
│       ├── OutcomeEditor.tsx       # Eligibility, health class, table rating, etc.
│       ├── ApprovalActions.tsx     # Submit/Approve/Reject buttons
│       ├── ProvenanceTooltip.tsx   # Source guide, pages, confidence
│       └── fieldRegistry.ts        # Predefined field definitions
```

### Modified Files
```
src/features/underwriting/components/AcceptanceRules/
├── AcceptanceRulesTab.tsx          # Replace entirely with v2 implementation
└── AcceptanceRuleForm.tsx          # DELETE or deprecate
```

---

## Implementation Phases

### Phase 1: Query/Mutation Hooks

#### 1.1 useRuleSets.ts
```typescript
// Hooks:
// - useRuleSets(carrierId, productId?) → list rule sets
// - useRuleSet(ruleSetId) → single rule set with rules
// - useCreateRuleSet()
// - useUpdateRuleSet()
// - useDeleteRuleSet()

// Query keys:
// - ['rule-sets', carrierId, productId]
// - ['rule-set', ruleSetId]
```

#### 1.2 useRules.ts
```typescript
// Hooks:
// - useCreateRule()
// - useUpdateRule()
// - useDeleteRule()
// - useReorderRules(ruleSetId, ruleIds[])

// Invalidation: parent rule set query
```

#### 1.3 useRuleWorkflow.ts
```typescript
// Hooks:
// - useSubmitForReview()
// - useApproveRuleSet()
// - useRejectRuleSet()
// - useRevertToDraft()

// All call RPCs from ruleService.ts
```

### Phase 2: Field Registry

#### 2.1 fieldRegistry.ts
```typescript
// Define available fields for predicates:
export const FIELD_REGISTRY = {
  // Condition-specific fields (dot notation: condition.field)
  'diabetes_type_2.a1c': { type: 'numeric', label: 'A1C Level', unit: '%' },
  'diabetes_type_2.diagnosis_date': { type: 'date', label: 'Diagnosis Date' },
  'diabetes_type_2.insulin_use': { type: 'boolean', label: 'Uses Insulin' },
  'diabetes_type_2.complications': { type: 'array', label: 'Complications' },
  
  // Applicant fields
  'applicant.age': { type: 'numeric', label: 'Age', unit: 'years' },
  'applicant.gender': { type: 'string', label: 'Gender', options: ['male', 'female'] },
  'applicant.tobacco_use': { type: 'boolean', label: 'Tobacco Use' },
  'applicant.bmi': { type: 'numeric', label: 'BMI' },
  
  // ... more fields per condition
};

// Operator registry by type:
export const OPERATORS_BY_TYPE = {
  numeric: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'before', 'after', 'years_since_gte', 'years_since_lte'],
  boolean: ['eq'],
  string: ['eq', 'neq', 'in', 'contains'],
  array: ['contains_any', 'contains_all', 'not_contains'],
};
```

### Phase 3: Core UI Components

#### 3.1 RuleSetList.tsx
- Table/list of rule sets for selected carrier
- Columns: name, scope, condition, status badge, is_active toggle, updated_at, actions
- Status badges: draft (gray), pending_review (yellow), approved (green), rejected (red)
- Click row → open RuleSetEditor
- "Create Rule Set" button

#### 3.2 RuleSetEditor.tsx
- Sheet/dialog for editing rule set
- Metadata form:
  - name (required)
  - description
  - scope: condition | global
  - condition_code selector (if scope=condition)
  - product_id selector (All Products vs specific)
  - is_active toggle
- Rules list (sorted by priority):
  - Drag-to-reorder OR up/down buttons
  - Each row: priority, name, outcome summary, predicate summary, edit/delete
  - "Add Rule" button
- Approval actions at bottom (based on review_status)

#### 3.3 RuleEditor.tsx
- Dialog for creating/editing a single rule
- Tabs or sections:
  - **Predicate** → PredicateBuilder
  - **Outcome** → OutcomeEditor
  - **Filters** → age_band_min/max, gender
  - **Provenance** → extraction_confidence, source_pages, source_snippet (read-only if AI-extracted)
- Save/Cancel buttons
- Validation before save

#### 3.4 PredicateBuilder.tsx
- Toggle: Visual | Advanced JSON
- Visual mode: PredicateGroupBuilder (root)
- JSON mode: PredicateJsonEditor
- Round-trip sync when valid

#### 3.5 PredicateGroupBuilder.tsx
- Recursive component for ALL/ANY/NOT groups
- Group type selector (ALL/ANY/NOT)
- List of children (groups or leaves)
- "Add Condition" / "Add Group" buttons
- Delete group button

#### 3.6 PredicateLeafBuilder.tsx
- Field selector (from registry, grouped by condition)
- Operator selector (filtered by field type)
- Value input (type-aware):
  - numeric: number input
  - date: date picker
  - boolean: checkbox
  - string: text input or select if options defined
  - array: multi-select or tag input
- treatNullAs selector (default: "unknown")
- Delete condition button

#### 3.7 PredicateJsonEditor.tsx
- Textarea with JSON
- Real-time Zod validation
- Error display
- "Apply" button to sync back to visual

#### 3.8 OutcomeEditor.tsx
- eligibility: select (eligible/ineligible/refer)
- health_class: select (from enum)
- table_rating: select (none, A-P)
- flat_extra_per_thousand: number input
- flat_extra_years: number input
- reason: textarea (required)
- concerns: tag input

#### 3.9 ApprovalActions.tsx
- Based on review_status and current user:
  - draft: "Submit for Review" button
  - pending_review: "Approve" / "Reject" buttons (reject shows notes dialog)
  - approved: "Edit as New Draft" button (creates new version)
  - rejected: "Edit Draft" button
- Disable self-approval (check created_by vs current user)
- Handle RPC errors gracefully

#### 3.10 ProvenanceTooltip.tsx
- Hover/click tooltip showing:
  - source (manual/ai_extracted/imported)
  - source_guide_id (link to guide)
  - source_pages
  - source_snippet
  - extraction_confidence (percentage)

### Phase 4: Replace AcceptanceRulesTab

#### 4.1 AcceptanceRulesTab.tsx (rewrite)
```tsx
// Structure:
// 1. Carrier selector (keep existing pattern)
// 2. Product filter (optional)
// 3. RuleSetList for selected carrier
// 4. Empty state if no carrier selected
// 5. Loading/error states
```

---

## Query Key Strategy

```typescript
export const ruleEngineKeys = {
  all: ['rule-engine'] as const,
  ruleSets: (carrierId: string, productId?: string) => 
    [...ruleEngineKeys.all, 'rule-sets', carrierId, productId] as const,
  ruleSet: (ruleSetId: string) => 
    [...ruleEngineKeys.all, 'rule-set', ruleSetId] as const,
};

// Invalidation:
// - Create/delete rule set → invalidate ruleSets(carrierId)
// - Update rule set → invalidate ruleSet(id) + ruleSets(carrierId)
// - Create/update/delete/reorder rule → invalidate ruleSet(parentId)
// - Workflow actions → invalidate ruleSet(id) + ruleSets(carrierId)
```

---

## Error Handling

1. **Permission denied (403)**: Show "You don't have permission to perform this action"
2. **Validation errors**: Inline field errors + block save
3. **Priority collision**: Show toast, refetch rules, let user retry
4. **Self-approval blocked**: Show "You cannot approve your own rule set"
5. **Network errors**: Toast with retry option

---

## Empty States

1. **No carrier selected**: "Select a carrier to manage acceptance rules"
2. **No rule sets**: "No acceptance rules yet. Create your first rule set."
3. **No rules in set**: "Add rules to define acceptance criteria"
4. **Permission denied**: "You don't have access to manage rules for this carrier"

---

## Implementation Order

1. **Hooks** (useRuleSets, useRules, useRuleWorkflow)
2. **Field Registry** (fieldRegistry.ts)
3. **OutcomeEditor** (simplest, no recursion)
4. **PredicateLeafBuilder** (single condition)
5. **PredicateGroupBuilder** (recursive)
6. **PredicateJsonEditor** (advanced mode)
7. **PredicateBuilder** (wrapper with toggle)
8. **RuleEditor** (combines predicate + outcome)
9. **ApprovalActions** (workflow buttons)
10. **ProvenanceTooltip** (info display)
11. **RuleSetEditor** (metadata + rules list)
12. **RuleSetList** (table view)
13. **AcceptanceRulesTab** (replace existing)

---

## Testing Checklist

- [ ] Create rule set with condition scope
- [ ] Create rule set with global scope
- [ ] Add rules with compound predicates (nested AND/OR)
- [ ] Edit predicate in visual builder
- [ ] Edit predicate in JSON editor
- [ ] Round-trip visual ↔ JSON
- [ ] Reorder rules
- [ ] Delete rule
- [ ] Submit for review
- [ ] Approve (as different user)
- [ ] Reject with notes
- [ ] Revert to draft
- [ ] Verify RLS blocks cross-tenant access
- [ ] Verify self-approval blocked
- [ ] Handle permission errors gracefully
- [ ] Empty states display correctly

---

## Dependencies

- shadcn/ui components (already installed)
- TanStack Query (already installed)
- Zod (already installed, used in ruleEngineDSL.ts)
- ruleService.ts (already implemented)
- ruleEngineDSL.ts (already implemented)

---

## Notes

- Start with basic visual builder - cover 80% of cases
- JSON editor is the escape hatch for complex predicates
- Don't over-engineer the first version
- Ship, get feedback, iterate
