# Continuation: Underwriting Wizard Rebuild - Tri-State Eligibility

## Status: Phase 1-4 Infrastructure Complete, Phase 5 Integration In Progress

## Context
Rebuilding the underwriting wizard to handle uncertainty properly with:
- Tri-state eligibility (eligible/ineligible/unknown) per product
- Provenance tracking and review workflow for acceptance rules
- AI extraction always creates draft rules (never auto-approved)
- Derived confidence penalty for scoring (not a fixed constant)

## Completed Work

### Database Migrations (Ready to Apply)
```
supabase/migrations/20260111_001_eligibility_tristate.sql
supabase/migrations/20260111_002_acceptance_provenance.sql
supabase/migrations/20260111_003_condition_field_requirements.sql
```

### Service Layer
- `src/services/underwriting/conditionMatcher.ts` - NEW: Zod-validated rule DSL
- `src/services/underwriting/acceptanceService.ts` - Updated with:
  - `lookupAcceptance()` filters by review_status=approved
  - `getDraftRulesForConditions()` for FYI display
  - `createDraftRuleFromExtraction()` - AI rules always draft

### Types
- `src/features/underwriting/types/underwriting.types.ts` - Added:
  - EligibilityStatus, EligibilityResult, ScoreComponents
  - RuleProvenance, ConditionDecision, DraftRuleInfo
  - SessionRecommendation

### Build Status
Build passes with zero TypeScript errors.

## Remaining Tasks

### 1. Update decisionEngine.ts (CRITICAL)
File: `src/services/underwriting/decisionEngine.ts`

Changes needed:
1. Update `checkEligibility()` to return `EligibilityResult` with tri-state
2. Add data completeness assessment for condition follow-ups
3. Update `calculateScore()` with derived confidence penalty:
   ```typescript
   const confidenceMultiplier = eligibility.status === 'unknown'
     ? 0.5 + (eligibility.confidence * 0.5)  // Range: 0.5 to 1.0
     : 1.0;
   ```
4. Update `calculateApproval()` to:
   - Only use approved rules for likelihood
   - Collect draft rules separately for FYI
5. Keep unknown eligibility products in results (don't filter out)
6. Return ScoreComponents breakdown in recommendations

### 2. Update RecommendationsStep.tsx
File: `src/features/underwriting/components/WizardSteps/RecommendationsStep.tsx`

Changes needed:
1. Add `UnknownEligibilityCard` component with yellow styling
2. Display "Verification Needed" badge for unknown status
3. List missing fields that need answers
4. Show draft rules as FYI (not affecting score)
5. Add ProvenanceTooltip for approved rules

## Key Design Decisions (Do Not Change)
- Eligibility is per-product, not per-session
- TEXT + CHECK instead of ENUM for flexibility
- `user_profiles` reference, not `auth.users`
- Derived confidence penalty (not constant 0.3)
- Page arrays (INTEGER[]) for multi-page rules
- Zod-validated rule DSL with schema versioning
- RLS: Only admins see/modify draft rules

## Reference Files
- Plan: `/Users/nickneessen/.claude/plans/validated-toasting-pebble.md`
- Types: `src/features/underwriting/types/underwriting.types.ts`
- Condition Matcher: `src/services/underwriting/conditionMatcher.ts`

## Next Steps
1. Read `decisionEngine.ts` to understand current implementation
2. Update `checkEligibility()` for tri-state return
3. Update `calculateScore()` with derived confidence
4. Update `getRecommendations()` to keep unknown products
5. Test build passes
6. Update RecommendationsStep.tsx for UI display
