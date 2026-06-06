// src/lib/currency.ts

export function roundCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return (Math.sign(n) * Math.round(Math.abs(n) * 100)) / 100;
}
