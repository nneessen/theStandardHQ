// src/features/kpi/lib/kpi-derivations.ts
// Pure derivation helpers for the KPI dashboard.
//
// CONTRACT: every helper returns `null` when a required input is null/undefined
// or a denominator is 0 — so the UI suppresses the tile instead of rendering
// NaN / Infinity / a misleading dash. A real computed 0 is returned as 0.

import { COST_PER_INBOUND_CALL } from "@/constants/financial";

type Num = number | null | undefined;

function isUsable(n: Num): n is number {
  return n != null && Number.isFinite(n);
}

/**
 * Closing rate = clients sold / total inbound calls, as a percentage (0–100).
 * Null when calls is null or 0 (no denominator), or clients is null.
 */
export function closingRate(
  clientsSold: Num,
  totalInboundCalls: Num,
): number | null {
  if (!isUsable(clientsSold) || !isUsable(totalInboundCalls)) return null;
  if (totalInboundCalls === 0) return null;
  return (clientsSold / totalInboundCalls) * 100;
}

/**
 * Policies per client = policies sold / clients sold.
 * Null when clients is null or 0, or policies is null.
 */
export function policiesPerClient(
  policiesSold: Num,
  clientsSold: Num,
): number | null {
  if (!isUsable(policiesSold) || !isUsable(clientsSold)) return null;
  if (clientsSold === 0) return null;
  return policiesSold / clientsSold;
}

/**
 * Cost per acquisition for the inbound model = (inbound calls × flat per-call
 * cost) / clients sold. Every inbound call costs COST_PER_INBOUND_CALL, so spend
 * is derived from call volume rather than entered by hand — there is no per-record
 * lead/marketing spend. Null when calls or clients is null, or clients is 0.
 */
export function costPerAcquisition(
  totalInboundCalls: Num,
  clientsSold: Num,
): number | null {
  if (!isUsable(totalInboundCalls) || !isUsable(clientsSold)) return null;
  if (clientsSold === 0) return null;
  return (totalInboundCalls * COST_PER_INBOUND_CALL) / clientsSold;
}

/**
 * Connect rate = answered / total, as a percentage (0–100).
 * Null when total is null or 0, or answered is null.
 */
export function connectRate(answered: Num, total: Num): number | null {
  if (!isUsable(answered) || !isUsable(total)) return null;
  if (total === 0) return null;
  return (answered / total) * 100;
}
