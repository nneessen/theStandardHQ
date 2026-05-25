# Continuation: Review State Availability Display in Criteria Tab

## Context

The PDF parsing and criteria extraction feature is now working:
- ✅ PDF parsing fixed using `unpdf` library with correct esm.sh imports
- ✅ Criteria delete RLS policy fixed (added admin/super-admin roles)
- ✅ Guide edit/rename feature added
- ✅ Re-extract criteria button added

**⚠️ NOTE: There is a larger extraction issue documented in `extraction-schema-redesign.md`**

## Issue to Investigate

In the **Criteria tab** when reviewing extracted data, the **State Availability** section shows confusing UI:

**Example**: Transamerica FE Express SolutionSM and Transamerica Graded FE Express SolutionsSM UW Guide
- Shows a red badge saying "4 excluded"
- User is unclear what this means or represents

## Questions to Answer

1. What does the "4 excluded" badge represent?
2. Is this showing `unavailableStates` from the extracted criteria?
3. Is the display format intuitive for users?
4. Should it show the actual state names/abbreviations instead of just a count?

## Files to Review

| File | Purpose |
|------|---------|
| `src/features/underwriting/components/CriteriaReview/` | Criteria review UI components |
| `src/features/underwriting/types/underwriting.types.ts` | Type definitions for criteria |
| `supabase/functions/extract-underwriting-criteria/index.ts` | AI extraction schema |

## Extracted Criteria Schema (for reference)

```typescript
stateAvailability?: {
  availableStates: string[];    // States where product IS available
  unavailableStates: string[];  // States where product is NOT available
}
```

## Tasks

1. [ ] Find the component rendering "4 excluded" badge
2. [ ] Review the criteria data structure for state availability
3. [ ] Verify the AI is extracting states correctly
4. [ ] Improve the UI to be more informative (show state names, not just count)
5. [ ] Consider adding tooltip or expandable view for full state list

## Start Command

```
Continue from: plans/active/criteria-state-availability-review.md

Investigate the state availability display in the Criteria tab. A red badge shows "4 excluded" for some guides - review what this represents and whether the UI is clear and informative for users.
```
