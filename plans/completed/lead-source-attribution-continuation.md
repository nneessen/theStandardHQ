# Lead Source Attribution - Continuation Prompt

## Context

We implemented a Lead Source Attribution feature that shows a dialog after policy submission to track which lead purchase pack the policy came from. The database schema, triggers, services, and hooks are complete and working. However, **the UI components need to be redesigned** to match the application's existing design patterns.

## What's Done (Working)

### Database (Complete)
- Migration: `supabase/migrations/20260116_004_lead_source_attribution.sql`
- Added `lead_purchase_id` and `lead_source_type` columns to `policies` table
- Auto-ROI triggers that update `policies_sold` and `commission_earned` on `lead_purchases` when policies are linked/unlinked

### Backend (Complete)
- `src/services/policies/policyService.ts` - `updateLeadSource()` method
- `src/services/policies/PolicyRepository.ts` - transforms handle new fields
- `src/types/policy.types.ts` - `LeadSourceType`, `leadPurchaseId`, `leadSourceType` fields
- `src/types/lead-purchase.types.ts` - `LeadSourceType`, `LeadSourceSelection` types

### Hooks (Complete)
- `src/features/policies/hooks/useUpdatePolicyLeadSource.ts` - mutation hook
- Exported from `src/features/policies/hooks/index.ts`

### Integration (Complete)
- `src/features/policies/PolicyDashboard.tsx` - shows `LeadSourceDialog` after policy creation, before `FirstSellerNamingDialog`

## What Needs Redesign

### 1. LeadSourceDialog (`src/features/policies/components/LeadSourceDialog.tsx`)

Current implementation uses generic radio buttons and doesn't match the application's design language. Needs to be redesigned following the application's compact, professional, data-dense UI patterns.

**Reference files for styling:**
- `src/features/policies/components/FirstSellerNamingDialog.tsx` - dialog styling pattern
- `src/features/expenses/leads/LeadPurchaseDialog.tsx` - form patterns
- Other dialogs throughout the codebase for consistent look/feel

### 2. LeadPurchaseSelector (`src/features/policies/components/LeadPurchaseSelector.tsx`)

Current implementation is functional but styling doesn't match the app. Needs redesign to be more compact and professional.

### 3. LeadPurchaseDialog ROI Fields Need Removal/Replacement

**Critical Change**: Since we now auto-calculate `policies_sold` and `commission_earned` via database triggers when policies are linked, the manual entry fields in `src/features/expenses/leads/LeadPurchaseDialog.tsx` should be:

- **Removed** from the create/edit form (lines ~61-63, ~76-77, ~103-105 - `policiesSold` and `commissionEarned` form fields)
- **Replaced** with read-only display showing the auto-calculated values
- Keep the ROI percentage display but make it clear it's auto-calculated from linked policies

The form currently has:
```typescript
policiesSold: "0",
commissionEarned: "0",
```

These should no longer be user-editable since the database triggers handle this automatically.

## Design Requirements

Per CLAUDE.md, the UI should be:
- Compact, professional, data-dense layout
- Minimal padding/margins (Tailwind 1/2/3 scale)
- Small readable text
- Muted palette; subtle borders and shadows
- Desktop-optimized but responsive
- No unnecessary animations
- High information density without clutter

## Files to Modify

1. `src/features/policies/components/LeadSourceDialog.tsx` - Full redesign
2. `src/features/policies/components/LeadPurchaseSelector.tsx` - Full redesign
3. `src/features/expenses/leads/LeadPurchaseDialog.tsx` - Remove manual ROI entry, show as read-only
4. Possibly `src/features/expenses/leads/LeadPurchaseDashboard.tsx` - May need updates to reflect auto-calculated ROI

## How to Test

1. Create a new policy - LeadSourceDialog should appear after submission
2. Select a lead purchase pack from the list
3. Click Save
4. Check the lead_purchases table - `policies_sold` should increment by 1, `commission_earned` should include the policy's commission
5. Go to Expenses → Lead Purchases tab → Edit a purchase - ROI fields should be read-only/display-only

## Key Components to Study for Styling

Look at these files for design patterns:
- `src/features/expenses/leads/LeadPurchaseDialog.tsx` - current lead purchase form
- `src/features/expenses/leads/VendorCombobox.tsx` - combobox pattern
- `src/features/policies/components/FirstSellerNamingDialog.tsx` - dialog pattern
- `src/components/ui/` - all UI primitives (Dialog, Button, Input, Label, etc.)

## Session Goal

Redesign the LeadSourceDialog and LeadPurchaseSelector to match the application's design language, and update LeadPurchaseDialog to remove manual ROI entry (now auto-calculated).
