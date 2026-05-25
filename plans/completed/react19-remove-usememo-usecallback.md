# Plan: Remove useMemo/useCallback for React 19 Compatibility

## Overview

React 19's compiler (React Forget) handles memoization automatically. Manual `useMemo` and `useCallback` calls are unnecessary and can interfere with compiler optimizations.

**Total instances to remove:** 442 (206 useMemo + 236 useCallback)

---

## Strategy

- **Branch:** `refactor/react19-remove-manual-memoization`
- **Approach:** Phase by feature area, test after each phase
- **Validation:** Build + manual smoke test of affected features after each phase

---

## Phases

### Phase 1: Low-Risk Areas (Settings, Messages)
**Files:** ~15 instances
- `src/features/settings/components/BrandingSettings.tsx` (10)
- `src/features/messages/components/compose/ContactPicker.tsx` (8)

**Why first:** Low traffic features, easy to verify visually.

**Test:**
- Open Settings > Branding, verify color pickers work
- Open Messages > Compose, verify contact search works

---

### Phase 2: Recruiting Module
**Files:** ~20 instances
- `src/features/recruiting/components/interactive/QuizItem.tsx` (8)
- `src/features/recruiting/admin/SortableChecklistItem.tsx` (6)
- `src/features/recruiting/admin/ChecklistItemEditor.tsx` (6)

**Test:**
- Open Recruiting admin, drag/drop checklist items
- Complete a quiz as a recruit

---

### Phase 3: Expenses & Leads
**Files:** ~12 instances
- `src/features/expenses/leads/LeadPurchaseDashboard.tsx` (8)
- Other expense-related files

**Test:**
- Open Lead Purchase Dashboard
- Verify charts and filters work

---

### Phase 4: Email & Workflows
**Files:** ~15 instances
- `src/features/email/components/block-builder/EmailBlockBuilder.tsx` (8)
- `src/features/workflows/components/EventTypeManager.tsx` (7)

**Test:**
- Open Email Builder, drag blocks, edit content
- Open Workflows, create/edit event types

---

### Phase 5: Policies & Hierarchy
**Files:** ~19 instances
- `src/features/policies/PolicyList.tsx` (8)
- `src/features/hierarchy/components/OrgChartVisualization.tsx` (11)

**Test:**
- Open Policies list, filter, sort, paginate
- Open Hierarchy > Org Chart visualization

---

### Phase 6: Underwriting (Highest Risk)
**Files:** ~50+ instances
- `src/features/underwriting/components/UnderwritingWizard.tsx` (18)
- `src/features/underwriting/components/WizardSteps/HealthConditionsStep.tsx` (10)
- `src/features/underwriting/components/RateEntry/PremiumMatrixGrid.tsx` (10)
- `src/features/underwriting/components/QuickQuote/ThreeAmountInputs.tsx` (7)
- `src/features/underwriting/components/QuickQuote/QuickQuoteDialog.tsx` (7)
- `src/features/underwriting/components/WizardSteps/ReviewStep.tsx` (5)
- `src/features/underwriting/components/RuleEngine/RuleConditionBuilder.tsx` (5)
- `src/features/underwriting/components/RuleEngine/RuleCard.tsx` (5)

**Why last:** Most complex, highest instance count, critical business logic.

**Test:**
- Run through full underwriting wizard
- Test Quick Quote dialog
- Verify premium calculations
- Test rule engine builder

---

### Phase 7: Reports & Training
**Files:** ~10 instances
- `src/features/reports/components/ImoPerformanceReport.tsx` (5)
- `src/features/training-hub/components/TrainerDashboard.tsx` (5)

**Test:**
- Open Reports, verify data loads
- Open Training Hub dashboard

---

### Phase 8: Remaining Files
**Files:** ~300 instances across various components

Scan remaining files and clean up in logical batches.

---

## Per-File Process

For each file:

1. **Remove wrapper, keep logic:**
```tsx
// Before
const sorted = useMemo(() => items.sort((a, b) => a.name.localeCompare(b.name)), [items]);

// After
const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
```

2. **Remove from import:**
```tsx
// Before
import { useState, useMemo, useCallback } from 'react';

// After
import { useState } from 'react';
```

3. **Build check:** `npm run build`

4. **Visual smoke test** of the affected component

---

## Rollback Strategy

Each phase is a separate commit. If issues are found:
1. `git revert <commit>` for the specific phase
2. Investigate the specific file causing issues
3. Some edge cases may legitimately need memoization (rare)

---

## Timeline Estimate

| Phase | Files | Instances | Effort |
|-------|-------|-----------|--------|
| 1 | 2 | ~18 | 15 min |
| 2 | 3 | ~20 | 20 min |
| 3 | 2 | ~12 | 15 min |
| 4 | 2 | ~15 | 15 min |
| 5 | 2 | ~19 | 20 min |
| 6 | 8 | ~50 | 45 min |
| 7 | 2 | ~10 | 15 min |
| 8 | ~100 | ~300 | 2-3 hrs |

**Total:** ~4-5 hours of focused work

---

## When to Start

This is non-urgent technical debt. Recommend:
- After current feature work is merged
- When you have time for thorough testing
- Not before a major release

---

## Commands to Run

```bash
# Create branch
git checkout -b refactor/react19-remove-manual-memoization

# After each phase
npm run build
npm run dev  # Manual test

# Commit each phase separately
git add .
git commit -m "refactor: remove useMemo/useCallback from [feature area]"
```
