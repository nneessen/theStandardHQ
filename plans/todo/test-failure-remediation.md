# Test Failure Remediation Plan (12 failing suites)

Goal: Fix the 12 failing test suites with **correct behavior**, not just green tests. Each fix must be aligned with product/domain expectations, not simply adjusted to satisfy assertions.

## Scope of current failures (from latest `npm run test`)

1. Subscription (repository + service)
   - `SubscriptionRepository.findByUserIdWithPlan` destructures `data` from `undefined`
   - `SubscriptionService.getUsageStatus` returns incorrect limits/overage

2. Expenses service
   - Returned objects/amount types mismatch expected

3. Hierarchy service
   - `validateHierarchyChange` returns invalid when setting upline to null
   - Circular reference checks and missing agent errors not reported as expected
   - `updateAgentHierarchy` fails due to invalid validation

4. Commission rate service
   - Date parsing/UTC handling mismatch
   - Error messages differ from expectations
   - LOW data quality calculation mismatch

5. Comp guide service
   - Error handling returns `Error` objects instead of expected shape
   - Bulk create error path returns different error type/message

6. Override service
   - Supabase mock chain does not support multiple `.eq()` or `.maybeSingle()`

7. Hook tests timing out
   - `useHierarchyTree`, `useMyDownlines`, `useMyOverrides`

## Plan

### 1) Baseline triage (confirm what actually broke)

- Re-run the failing suites individually with `vitest -t` to isolate root causes.
- Capture the exact failure output and stack traces per suite.
- Verify whether failures are logic regressions or mock/fixture issues.

### 2) Subscription failures

- Inspect `SubscriptionRepository.findByUserIdWithPlan` and its tests:
  - Confirm mocked Supabase chain returns `{ data, error }` consistently.
  - Align test mocks with actual repository query shape.
- Inspect `SubscriptionService.getUsageStatus`:
  - Validate expected limit/overage math for each plan tier.
  - Confirm “free vs paid” limits and metric names are correct.
  - Update tests or code only after verifying intended product behavior.

### 3) Expense service failures

- Compare expected output shape vs actual service output:
  - Normalize numeric fields (e.g., `amount`, `premium`) consistently.
  - Ensure any formatting (string vs number) matches intended API contract.
- Fix tests or service only after deciding which representation is correct.

### 4) Hierarchy service failures

- Review `validateHierarchyChange` logic and test setup:
  - Confirm valid root promotion (`upline_id = null`) is allowed.
  - Ensure circular reference detection uses correct hierarchy path logic.
  - Ensure “agent not found” is reported when appropriate.
- Adjust logic or tests to align with the intended hierarchy rules.

### 5) Commission rate service failures

- Review date parsing and timezone handling:
  - Decide whether dates should be normalized to UTC midnight or local time.
  - Update parser or tests accordingly.
- Verify data quality calculation rules for LOW quality:
  - Recompute expected weighted averages and confirm formula.
- Align error messages with public API contract (service vs tests).

### 6) Comp guide service failures

- Decide on error return conventions:
  - Should service return `Error` objects or `{ message }` data?
  - Make the handling consistent across methods.
- Verify bulk create error path:
  - Decide whether constraint violations should be surfaced as message strings or typed errors.

### 7) Override service failures

- Fix Supabase mock chain to support multiple `eq()` and `maybeSingle()`:
  - Update test mock utilities to return chainable methods.
  - Ensure mocks align with actual Supabase client behavior.

### 8) Hook timeouts

- Review each timing-out test:
  - Ensure `queryClient` setup and `waitFor` usage is correct.
  - Confirm mocked services reject/resolve as intended.
  - Add explicit `enabled` or `retry` overrides if tests depend on them.

### 9) Verification

- Re-run targeted suites to confirm each domain is corrected.
- Run full `npm run test` to confirm all tests pass.
- Document any contract changes or expectation updates in test comments.

## Exit Criteria

- All 12 failing suites pass with behavior aligned to the intended domain rules.
- No fixes rely on weakening assertions or hiding errors.
- Any updated tests explicitly reflect the expected business logic.
