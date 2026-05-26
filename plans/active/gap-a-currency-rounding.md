# Plan — Gap A: Currency Rounding Layer

**Status:** awaiting approval · **Created:** 2026-05-26 · **Approach:** `roundCurrency()` helper at calculation boundaries (chosen by Nick)

## Problem

Commission math runs in raw IEEE-754 floats; rounding happens only when Postgres coerces to
`NUMERIC(12,2)` on write. Because `amount`, `earned_amount`, and `unearned_amount` are rounded
independently, `earned + unearned` can fail to reconcile to the stored `amount` by a cent, and
in-memory aggregates accumulate sub-cent drift. There is no shared currency-rounding helper.

## Goal & invariant

Every money figure a calculation **returns or persists** is rounded to 2 decimals (half away
from zero), and the reconciliation invariant **`earned + unearned === amount`** holds exactly
at the cent. Intermediate rates stay full-precision — we round only the final money outputs,
never intermediate `monthlyEarningRate` (rounding a rate then multiplying compounds error).

## Approach (confirmed)

`roundCurrency(n)` helper applied at boundaries. JS `number` stays the type; no storage or
entity-type changes. Matches the `Math.round(x*100)/100` pattern already used ad-hoc in
`underwriting/` and `analytics/`.

---

## Phase 1 — TypeScript (no migration, low risk)

### 1.1 New helper: `src/lib/currency.ts`
```ts
/** Round to cents, half away from zero (correct for negative chargebacks). */
export function roundCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return (Math.sign(n) * Math.round(Math.abs(n) * 100)) / 100;
}
```
(Display formatting stays in `lib/format.ts`; this is the storage/calc-side helper.)

### 1.2 `CommissionLifecycleService.ts` — round final outputs only
- `calculateAdvance` → `advanceAmount = roundCurrency(monthlyPremium * advanceMonths * rate)`. Leave `monthlyEarningRate` full-precision (derived helper).
- `calculateCappedAdvance` → round `cappedAdvanceAmount`, `originalAdvance`, `overageAmount`.
- `calculateEarned` → `earned = roundCurrency(monthlyEarningRate * effectiveMonthsPaid)`; then `unearned = roundCurrency(advanceAmount - earned)` (derive from the rounded earned so they reconcile to the input advance).
- `calculateChargeback` → already returns `earnedResult.unearnedAmount`; now rounded by the above.

### 1.3 `src/utils/commissionProgress.ts` — the runtime persistence path
This (not `calculateEarned`) is what `CommissionStatusService.updateMonthsPaid` persists.
- `earnedAmount = roundCurrency(monthlyEarnRate * cappedMonthsPaid)`
- `unearnedAmount = roundCurrency(Math.max(0, input.amount - earnedAmount))`
(It already derives unearned as `amount - earned` — we just round both ends.)

### 1.4 Tests
- Extend `CommissionLifecycleService.test.ts`: a **reconciliation property test** over a matrix of premiums × rates × advanceMonths × monthsPaid asserting `earned + unearned === amount` to the cent and every money output has ≤ 2 decimals. Add a capped-overage reconciliation case.
- Add `src/utils/__tests__/commissionProgress.test.ts` (new) with the same reconciliation assertions.
- `roundCurrency` unit tests incl. negatives, `.005` boundary, `Infinity`/`NaN` → 0.

### 1.5 Validate
`npm run build` (zero TS errors) + `npx vitest run` on the two suites. No data backfill: existing
stored rows are already `NUMERIC(12,2)`; this only makes pre-persist values self-consistent.

---

## Phase 2 — SQL overrides — INVESTIGATED, NOT NEEDED (2026-05-26)

The override amount + earned/unearned have no explicit `ROUND` in the SQL
(`regenerate_override_commissions` RPC, `update_override_commission_earned_amounts` trigger),
so the original plan was to wrap each money expression in `ROUND(expr, 2)`. **Investigation
showed this is unnecessary** — unlike JS `number`, Postgres rounds on assignment by type:

- Verified column types: `override_commissions.{earned_amount,unearned_amount,override_commission_amount,base_commission_amount}` are all `numeric(12,2)`.
- The RPC's working variables are declared `DECIMAL(12,2)`.
- Empirically confirmed `numeric(12,2)` coercion rounds: assigning `333.33 * 1.025 * 9` yields `3074.97`.
- Because `NEW.earned_amount` is a `numeric(12,2)` field, it is already rounded before
  `unearned := override_commission_amount - earned_amount` runs, so the split reconciles by construction.
- Live data check: `override_commissions` has **0 rows**, **0 non-reconciling**, **0 over-2dp**.

The JS-float drift that motivated Gap A structurally cannot occur on the SQL side. An explicit
`ROUND()` migration would change zero computed values while re-touching untested `SECURITY DEFINER`
SQL in production and re-invoking the function-version machinery — net risk, zero benefit. **Decision:
skip.** (A purely self-documenting `ROUND()` pass could be folded into any future functional change
to that RPC — e.g. the override-base-mismatch fix below — but is not worth a standalone migration.)

---

## Out of scope (flag, do not fix here)
- **Override base mismatch**: the RPC computes overrides on `annual_premium * rate` (annual basis)
  while the TS advance model uses `monthlyPremium * advanceMonths * rate`. Possible correctness
  gap independent of rounding — worth its own investigation, not folded into Gap A.
- **Aggregation drift**: summing many already-rounded records still drifts slightly; inherent and
  acceptable, not addressed by per-record rounding.

## Rollback
Phase 1 is pure TS — revert the commits. Phase 2 — a compensating migration restoring the prior
function bodies (the runner blocks downgrades, so bump the version).

## Files
- New: `src/lib/currency.ts`, `src/utils/__tests__/commissionProgress.test.ts`
- Edit: `CommissionLifecycleService.ts`, `commissionProgress.ts`, `CommissionLifecycleService.test.ts`
- Phase 2: one new `supabase/migrations/<ts>_round_override_commission_money.sql`
