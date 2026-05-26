// src/lib/currency.ts
//
// Storage/calculation-side money rounding. Commission math runs in raw floats;
// without rounding at the calculation boundary, independently-rounded amount /
// earned / unearned can fail to reconcile by a cent once Postgres coerces each to
// NUMERIC(12,2). Apply roundCurrency to the FINAL money outputs only — never to
// intermediate rates (rounding a rate then multiplying compounds error).
//
// Display formatting (symbols, K/M/B abbreviation) lives in lib/format.ts; this is
// purely the numeric rounding used before persistence and reconciliation.

/**
 * Round a monetary value to cents (2 decimals), half away from zero.
 *
 * Half away from zero is the correct convention for currency and keeps negative
 * values (e.g. chargeback adjustments) symmetric with positive ones — unlike
 * Math.round, which rounds -0.005 toward zero.
 *
 * Non-finite inputs (NaN, Infinity) collapse to 0 so a malformed upstream value
 * can never be persisted as money.
 *
 * @example
 * roundCurrency(4612.504)  // 4612.5
 * roundCurrency(1537.505)  // 1537.51
 * roundCurrency(-0.005)    // -0.01
 * roundCurrency(NaN)       // 0
 */
export function roundCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return (Math.sign(n) * Math.round(Math.abs(n) * 100)) / 100;
}
