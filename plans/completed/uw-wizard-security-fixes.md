# UW Wizard Security & Correctness Audit - Implementation Tracking

## Status: ✅ COMPLETE - Ready for Merge
**Created:** 2026-01-15
**Completed:** 2026-01-15
**Branch:** refactor/consolidate-us-states-constant

---

## Summary

This plan tracks the completion of security and correctness fixes for the Underwriting Wizard feature. The audit identified 5 critical blocking issues (Fixes 1-5), which have been implemented. This document tracks the remaining required changes and RLS policy verification.

---

## RLS Policy Audit Results ✓ VERIFIED

All 5 tenant-scoped tables have proper RLS policies enforcing `imo_id` binding to authenticated users.

### 1. premium_matrix
- **RLS Enabled:** ✓
- **Policies:** SELECT, INSERT, UPDATE, DELETE all bound to `imo_id IN (SELECT imo_id FROM user_profiles WHERE id = auth.uid())`
- **Defined in:** `20260110_015_premium_matrix.sql:64-109`
- **Status:** ✓ SECURE

### 2. carrier_condition_acceptance
- **RLS Enabled:** ✓
- **Policies:** SELECT, INSERT, UPDATE, DELETE all bound to `imo_id IN (SELECT imo_id FROM user_profiles WHERE id = auth.uid())`
- **Fixed in:** `20260110_014_fix_decision_engine_rls.sql` (corrected `profiles` → `user_profiles`)
- **Status:** ✓ SECURE

### 3. carrier_underwriting_criteria
- **RLS Enabled:** ✓
- **SELECT:** Bound to user's IMO
- **INSERT/UPDATE/DELETE:** Bound to user's IMO + requires `imo_admin` or `imo_owner` role
- **Fixed in:** `20260110_010_fix_criteria_rls_policies.sql` (corrected `role` → `roles` array)
- **Status:** ✓ SECURE

### 4. underwriting_decision_trees
- **RLS Enabled:** ✓
- **Policies:** Use `get_my_imo_id()` helper function and `is_imo_admin()` for mutations
- **Defined in:** `20260109_001_underwriting_wizard_tables.sql:214-230`
- **Status:** ✓ SECURE

### 5. underwriting_guides
- **RLS Enabled:** ✓
- **Policies:** Use `get_my_imo_id()` helper function and `is_imo_admin()` for mutations
- **Defined in:** `20260109_001_underwriting_wizard_tables.sql:195-211`
- **Status:** ✓ SECURE

---

## Implemented Fixes

### Fix 1: Out-of-Range Bounds Checking ✓
- **File:** `src/services/underwriting/premiumMatrixService.ts`
- **Change:** Reject age/face amounts outside matrix range (no silent clamping)
- **Tests:** 42 tests passing in `premiumMatrixService.test.ts`

### Fix 2: Single-Face CPT Scaling Disabled ✓
- **File:** `src/services/underwriting/premiumMatrixService.ts`
- **Change:** Require exact face match for single-face matrices (no extrapolation)
- **Tests:** Covered in `premiumMatrixService.test.ts`

### Fix 3: Term Determined Before Eligibility ✓
- **File:** `src/services/underwriting/decisionEngine.ts`
- **Change:** Same `effectiveTermYears` used for both eligibility AND pricing
- **Tests:** Pending - see Required Changes below

### Fix 4: JWT Verification & Tenant Ownership ✓
- **File:** `supabase/functions/underwriting-ai-analyze/index.ts`
- **Changes:**
  - JWT verification via `userClient.auth.getUser()`
  - IMO derived from `user_profiles` table
  - Cross-tenant access blocked
  - Decision tree IMO check added
- **Tests:** Pending - see Required Changes below

### Fix 5: Premium Validation ✓
- **File:** `src/services/underwriting/premiumMatrixService.ts`
- **Change:** Reject NaN, Infinity, negative, and >$100k/month premiums
- **Tests:** Covered in `premiumMatrixService.test.ts`

---

## Required Changes (Blocking)

### 1. Edge Function HTTP Status Codes ✓ COMPLETE
**Status:** ✅ DONE
**File:** `supabase/functions/underwriting-ai-analyze/index.ts`

Fixed to return proper status codes:
- Missing/invalid JWT → 401 Unauthorized ✓
- Cross-tenant access attempt → 403 Forbidden ✓
- User profile not found → 401 Unauthorized ✓

### 2. Decision Engine Unit Tests for Fix 3 ✓ COMPLETE
**Status:** ✅ DONE
**File:** `src/services/underwriting/__tests__/decisionEngine.test.ts`

21 test cases implemented:
- [x] Uses same term for eligibility and pricing
- [x] Rejects product when face amount exceeds term-specific max
- [x] Handles permanent products (null term)
- [x] Falls back to longest term when none specified
- [x] Requested term not available → product skipped
- [x] Regression test for the bug scenario

---

## Recommended Before Production

### 3. Edge Function Integration Tests
- Test full auth flow with mock JWT
- Verify cross-tenant blocking in Deno test environment

### 4. Monitoring for Premium Rejection Rate
- Log/track when premium lookup returns null
- Alert on significant increase post-deployment

### 5. Clean Up Unused Token Variable
- Line 189 extracts token but line 191 validates authHeader format
- Consider using token directly or removing unused variable

---

## Files Modified in This Audit

| File | Changes |
|------|---------|
| `src/services/underwriting/premiumMatrixService.ts` | Added validatePremium(), bounds checking, CPT safety gate |
| `src/services/underwriting/decisionEngine.ts` | Moved term determination before eligibility check |
| `supabase/functions/underwriting-ai-analyze/index.ts` | JWT verification, IMO ownership validation |
| `src/services/underwriting/__tests__/premiumMatrixService.test.ts` | 42 test cases for Fixes 1, 2, 5 |

---

## Behavioral Changes (Expected)

1. **Products that previously returned fake premiums will now return null**
   - Products with face amounts outside matrix range
   - Products with ages outside matrix range

2. **Products with single-face matrices only quote exact matches**
   - No more cost-per-thousand scaling for mismatched face amounts

3. **Products may become ineligible if face amount exceeds term-specific limits**
   - Term is now determined FIRST, then used for both eligibility and pricing

---

## Acceptance Criteria

- [x] All RLS policies verified ✓
- [x] Edge function returns 401/403 for auth failures ✓
- [x] Decision engine tests verify term consistency ✓
- [x] `npm run build` passes with zero errors ✓
- [x] `npm run test` passes with zero failures (63 tests) ✓
- [x] App runs without loading errors ✓

---

## Next Steps

All required changes have been completed:
1. ~~Implement edge function 401/403 status codes~~ ✅
2. ~~Create decision engine unit tests~~ ✅
3. ~~Run full build and test suite~~ ✅
4. Create PR for merge ← **Ready**

**Files to commit:**
- `supabase/functions/underwriting-ai-analyze/index.ts` (401/403 status codes)
- `src/services/underwriting/__tests__/decisionEngine.test.ts` (21 new tests)
- `plans/active/uw-wizard-security-fixes.md` (tracking document)
