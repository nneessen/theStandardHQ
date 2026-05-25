# Continuation: Commission Not Updating on Policy Edit

## Problem Statement
When editing a policy (changing carrier, product, or premium), the commission amount in the policy table is NOT updating. The annual premium (AP) column updates correctly, but the commission amount column stays the same.

**What works:** Dialog shows correct values after edit
**What's broken:** Table row commission amount doesn't update

## What Was Already Tried (Did NOT Fix It)
1. Renamed `hasPremiumChanges()` → `requiresCommissionRecalc()` to check carrier/product changes
2. Added `fullRecalculate` parameter to `recalculateCommissionByPolicyId()`
3. Changed field from `advanceAmount` to `amount` in the update call
4. Added `invalidateQueries` before `refetchQueries` for commissions cache
5. All TypeScript compiles, build succeeds

## Key Files to Investigate

### Data Flow (Policy Edit → Commission Display)
1. **PolicyForm.tsx** - Form submission, calls `updatePolicy(policyId, submissionData)`
2. **useUpdatePolicy.ts** - Hook that calls `policyService.update()` then `commissionService.recalculateCommissionByPolicyId()`
3. **CommissionCalculationService.ts** - `recalculateCommissionByPolicyId()` method that updates commission
4. **CommissionCRUDService.ts** - `update()` method that writes to DB
5. **CommissionRepository.ts** - `transformToDB()` and DB operations
6. **useCommissions.ts** - Hook that fetches commissions for the table (queryKey: `["commissions", user?.id]`)
7. **PolicyList.tsx** - Table that displays `policyCommission?.amount`

### Critical Questions to Answer
1. Is `recalculateCommissionByPolicyId()` actually being called? (Check console logs)
2. Is the commission record in the database actually being updated?
3. Is `useCommissions` refetching after the update?
4. Is the `amount` field being returned correctly from the refetch?
5. Is there a mismatch between what's stored in DB vs what's transformed back?

### Database Schema Check
- Commissions table has `amount` column (the one being updated)
- The table display uses `policyCommission?.amount`
- `transformFromDB` maps `dbRecord.amount` → `Commission.amount`
- `transformToDB` maps `data.amount` → `dbData.amount`

## Debugging Steps
1. Add console.log in `recalculateCommissionByPolicyId()` to verify it's called with correct values
2. Add console.log after `commissionCRUDService.update()` to see what's returned
3. Check browser Network tab - is the commissions query being refetched?
4. Check the refetched data - does it contain the new amount?
5. Query the database directly to verify the commission record was updated

## Possible Root Causes to Investigate
1. **The commission update isn't being awaited properly** - maybe returning before DB write completes
2. **The query refetch is happening but returning cached/stale data** - Supabase caching issue?
3. **The transformFromDB is using wrong field** - maybe reading from different column
4. **Race condition** - refetch happens before DB write is committed
5. **The useCommissions query key doesn't match** - refetch targets wrong query
6. **PolicyList is using different data source** - maybe not using useCommissions result

## Code Locations (Line Numbers from Last Session)
- `useUpdatePolicy.ts:163` - calls `requiresCommissionRecalc()`
- `useUpdatePolicy.ts:175-180` - calls `recalculateCommissionByPolicyId()`
- `useUpdatePolicy.ts:198-200` - invalidate and refetch commissions
- `CommissionCalculationService.ts:559-566` - update call with `amount` field
- `CommissionRepository.ts:500` - `transformToDB` maps `data.amount` → `dbData.amount`
- `CommissionRepository.ts:74-78` - `transformFromDB` reads `dbRecord.amount`
- `PolicyList.tsx:674` - displays `policyCommission?.amount`
- `useCommissions.ts:23` - queryKey is `["commissions", user?.id]`

## Next Steps
1. Add extensive console logging throughout the update chain
2. Verify each step is executing with correct data
3. Check if DB is actually being updated (query directly)
4. Check if the issue is read-side (transformFromDB) or write-side (transformToDB)
5. Consider if there's a realtime subscription overwriting data
