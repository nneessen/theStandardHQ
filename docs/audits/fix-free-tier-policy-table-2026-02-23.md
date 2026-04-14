# Fix: Free Tier Policy Table Columns, Lead Source Gating & Commission Status Bug

**Date**: 2026-02-23
**Files Changed**: 4 files modified, 1 migration created
**Scope**: UI feature gating, DB trigger behavior, table layout alignment

---

## Table of Contents

1. [Problem Summary](#problem-summary)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Changes Made](#changes-made)
4. [Verification](#verification)
5. [Edge Cases Considered](#edge-cases-considered)
6. [Files Changed](#files-changed)

---

## Problem Summary

Three related issues were identified and fixed:

### Issue 1: Free Tier Policy Table — Missing Columns
Free tier users were seeing a policies table with missing **Commission** and **Comm Status** columns. The original code gated both columns behind `useFeatureAccess("dashboard")`, which could return `false` during loading states or due to subscription status issues.

**Expected behavior**: Commission *amounts* (dollar values, percentages) are a Pro feature. But the **Comm Status** column (pending/paid/charged_back dropdown) should be visible to all users since it's an operational workflow tool, not a financial insight.

### Issue 2: Lead Source Dialog — Not Gated for Free Tier
The "Track Lead Source" dialog (shown after policy creation) and the "Link to Lead Purchase" menu item in the policy row actions were available to all tiers. Lead source tracking is tied to the expenses/lead purchase page, which is a Pro feature.

### Issue 3: Commission Status Dropdown Goes Blank
When a policy's lifecycle status changed from "pending" to "active", the Comm Status dropdown would render blank. The user expected it to stay at "pending" until manually changed.

---

## Root Cause Analysis

### Issue 1: Overly Broad Feature Gating
In `PolicyList.tsx`, a single `canViewCommissions` boolean was wrapping both the Commission column AND the Comm Status column. The fix required splitting the gating:
- **Commission column** (amount + percentage): Pro only
- **Comm Status column** (status dropdown): All tiers
- **Metrics bar** (earned/pending stats): Pro only

### Issue 2: Missing Feature Gating
`LeadSourceDialog` in `PolicyDashboard.tsx` and the "Link to Lead Purchase" menu item in `PolicyList.tsx` had no `useFeatureAccess` check whatsoever.

### Issue 3: DB Trigger + UI Mismatch (Two Bugs)

**Bug A — DB Trigger auto-promoting status**: Two database trigger functions were automatically changing commission status:

```sql
-- In update_commission_on_policy_status():
-- When lifecycle becomes 'active', auto-set commission to 'earned'
UPDATE commissions SET status = 'earned' WHERE policy_id = NEW.id AND status = 'pending';

-- In update_override_commissions_on_policy_change():
-- Same logic for override commissions
UPDATE override_commissions SET status = 'earned' WHERE policy_id = NEW.id AND status = 'pending';
```

**Bug B — 'earned' not in UI dropdown**: The `commissions.status` column is plain `text` type (not enum-backed), so the DB accepted `'earned'` without error. However, the `<Select>` component in `PolicyList.tsx` only had three selectable options:
- `pending`
- `paid`
- `charged_back`

When the trigger set status to `'earned'`, Radix UI's `<Select>` received `value="earned"` with no matching `<SelectItem>`, causing it to render blank. This is standard Radix behavior — unmatched values display nothing.

**The user's expectation**: Commission status should remain `'pending'` when lifecycle changes to active. The user manually changes it to `'paid'` when payment is received. The auto-promotion to `'earned'` was unwanted and caused the blank dropdown.

---

## Changes Made

### 1. `src/features/policies/PolicyList.tsx`

**What changed**: Refined the `canViewCommissions` gating to only hide commission *amounts*, while keeping the Comm Status column visible to all users.

**Specific changes**:

| Section | Before | After |
|---------|--------|-------|
| Import | `useFeatureAccess` removed | `useFeatureAccess` re-added |
| Hook call | Removed entirely | Re-added: `const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard")` |
| Metrics bar (earned/pending stats) | Ungated | Gated behind `canViewCommissions` |
| Commission column header | Ungated | Gated behind `canViewCommissions` |
| Commission data cell (amount + %) | Ungated | Gated behind `canViewCommissions` |
| Comm Status column header | Was gated | **Ungated** — visible to all |
| Comm Status data cell (dropdown) | Was gated | **Ungated** — visible to all |
| Comm Status legacy `'earned'` value | Rendered blank | **Displays "Earned"** (read-only option) |
| "Link to Lead Purchase" menu item | Only checked `!policy.leadPurchaseId` | Also checks `canViewCommissions` |
| `colSpan` in loading/empty states | Static `9` | `canViewCommissions ? 9 : 8` |
| Comm Status cell alignment | `text-center` on cell | `mx-auto` on SelectTrigger + `block text-center` on fallback text |

**Column visibility matrix**:

| Column | Free Tier | Pro Tier |
|--------|-----------|----------|
| Client | Yes | Yes |
| Carrier | Yes | Yes |
| Product | Yes | Yes |
| Policy # | Yes | Yes |
| Status | Yes | Yes |
| Premium | Yes | Yes |
| **Commission** | **No** | Yes |
| Comm Status | Yes | Yes |
| Date | Yes | Yes |
| Actions | Yes | Yes |

### 2. `src/features/policies/components/PolicyFormPolicySection.tsx`

**What changed**: Added feature gating to the Financial Summary card in the Add/Edit Policy dialog.

**Specific changes**:
- Added imports: `useFeatureAccess` from `@/hooks/subscription`, `Lock` icon from `lucide-react`
- Added hook: `const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard")`
- **Pro users** see the full Financial Summary card: Annual Premium, Commission Rate, Expected Advance (9 mo)
- **Free users** see a reduced card: Annual Premium only, plus a lock icon with "Commission details available on Pro plan" message
- The reduced card uses a muted color scheme (zinc instead of amber) to visually indicate it's a locked feature

### 3. `src/features/policies/PolicyDashboard.tsx`

**What changed**: Added feature gating to the Lead Source attribution dialog.

**Specific changes**:
- Added import: `useFeatureAccess` from `@/hooks/subscription`
- Added hook: `const { hasAccess: canTrackLeadSource } = useFeatureAccess("dashboard")`
- The `LeadSourceDialog` render condition changed from:
  ```tsx
  {pendingLeadSource && !pendingFirstSaleGroup && (
  ```
  to:
  ```tsx
  {canTrackLeadSource && pendingLeadSource && !pendingFirstSaleGroup && (
  ```
- Free tier users will skip the lead source dialog entirely after creating a policy
- Free tier users now immediately continue to first-seller detection after policy creation (instead of waiting on the gated dialog callback)

### 4. `supabase/migrations/20260223140047_remove_auto_earned_promotion.sql`

**What changed**: Removed the automatic `pending → earned` commission status promotion from two trigger functions.

**Functions modified**:

1. **`update_commission_on_policy_status()`**:
   - **Removed**: The `IF NEW.lifecycle_status = 'active'` block that set `status = 'earned'`
   - **Kept**: The `ELSIF NEW.lifecycle_status IN ('cancelled', 'lapsed')` block for chargeback calculation

2. **`update_override_commissions_on_policy_change()`**:
   - **Removed**: The `ELSIF NEW.lifecycle_status = 'active'` block that set `status = 'earned'`
   - **Kept**: The `IF NEW.lifecycle_status IN ('lapsed', 'cancelled')` block for override chargebacks

**Data fix (refined after review)**:
- **No blanket rewrite of `commissions.status = 'earned'`** (to avoid corrupting legitimate `earned` states, e.g. reinstatement/chargeback reversal flows)
- **Targeted override cleanup only**: revert `override_commissions.status = 'earned'` to `pending` **only when the current base commission is not `paid`**

```sql
UPDATE override_commissions AS oc
SET status = 'pending', updated_at = NOW()
FROM commissions AS c
WHERE oc.status = 'earned'
  AND c.policy_id = oc.policy_id
  AND c.user_id = oc.base_agent_id
  AND c.status IS DISTINCT FROM 'paid';
```

**UI compatibility fix included**: The Comm Status dropdown now includes a display-only `Earned` option so legacy rows no longer render blank.

---

## Verification

### Automated
- `npx tsc --noEmit` — zero TypeScript errors
- `./scripts/validate-app.sh` — production build passes, dev server responds with 200
- Migration applied successfully via `./scripts/migrations/run-migration.sh`

### Manual Testing Checklist

1. **Free tier user → Policies table**:
   - [ ] Should see 8 columns (no Commission column)
   - [ ] Comm Status column visible with working dropdown
   - [ ] Metrics bar should NOT show earned/pending commission stats
   - [ ] "Link to Lead Purchase" should NOT appear in row action menu
   - [ ] Loading/empty state should span correct number of columns (8)

2. **Pro tier user → Policies table**:
   - [ ] Should see all 9 columns including Commission
   - [ ] Comm Status dropdown visible and centered under header
   - [ ] Metrics bar shows earned/pending commission stats
   - [ ] "Link to Lead Purchase" appears in row action menu when applicable

3. **Add Policy dialog (Free tier)**:
   - [ ] Financial Summary card shows Annual Premium only
   - [ ] Lock icon with "Commission details available on Pro plan" message
   - [ ] No commission rate or expected advance shown

4. **Add Policy dialog (Pro tier)**:
   - [ ] Full Financial Summary: Annual Premium, Commission Rate, Expected Advance

5. **Lead Source dialog (Free tier)**:
   - [ ] After creating a policy, the lead source dialog should NOT appear
   - [ ] Policy creation should proceed directly to FirstSellerNaming (if applicable)

6. **Commission status on lifecycle change**:
   - [ ] Change lifecycle from "pending" to "active" → Comm Status stays at "pending"
   - [ ] Change lifecycle to "cancelled" → Chargeback calculation still fires correctly
   - [ ] Change lifecycle to "lapsed" → Chargeback calculation still fires correctly

---

## Edge Cases Considered

1. **`useFeatureAccess` loading state**: During the brief moment when `useFeatureAccess` is loading, `hasAccess` returns `false`. This means:
   - Commission column and metrics bar are hidden during loading (acceptable — they appear once loaded)
   - Lead source dialog won't flash then disappear (it simply never shows for free tier)

2. **Existing 'earned' records**: Legacy `earned` commission statuses are now rendered safely in the UI (`Earned` display option) instead of appearing blank. The migration avoids a blanket rewrite of commission data to prevent altering legitimate historical states.

3. **Cancel/Lapse chargebacks preserved**: Only the `pending → earned` auto-promotion was removed. The `cancel/lapse → chargeback` logic remains intact since it serves a different purpose (financial reconciliation on policy termination).

4. **colSpan alignment**: Loading, error, and empty states use `canViewCommissions ? 9 : 8` to ensure the full-width message cells span the correct number of columns regardless of tier.

5. **Comm Status alignment**: Added `mx-auto` to the `SelectTrigger` (fixed `w-[90px]` element) so it centers within the cell rather than left-aligning. The "No commission" fallback text also uses `block text-center` for consistent centering.

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/features/policies/PolicyList.tsx` | Modified | Refined commission gating, added lead source gating, fixed Comm Status alignment, rendered legacy `earned` safely |
| `src/features/policies/components/PolicyFormPolicySection.tsx` | Modified | Added Financial Summary gating with Pro/Free variants |
| `src/features/policies/PolicyDashboard.tsx` | Modified | Added lead source dialog gating |
| `supabase/migrations/20260223140047_remove_auto_earned_promotion.sql` | Created | Removed earned auto-promotion triggers, targeted override cleanup (no blanket commission rewrite) |

**DB Impact**: Two trigger functions modified (`update_commission_on_policy_status`, `update_override_commissions_on_policy_change`). Targeted cleanup only for inconsistent `override_commissions.status = 'earned'` rows (when base commission is not `paid`). No blanket rewrite of `commissions.status`.

**No schema changes** — no new columns, tables, or enums.
