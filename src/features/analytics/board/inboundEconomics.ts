// src/features/analytics/board/inboundEconomics.ts
// Shared inbound-economics math for the individual (InboundEconomicsPanel) and
// team (TeamInboundEconomicsPanel) views. Every inbound call costs a flat
// COST_PER_INBOUND_CALL, so spend = calls × that, and the headline is
// commission-based ROI = (commission earned − spend) ÷ spend. Cost-derived
// metrics return null when no calls are logged, so the UI shows "—" rather than
// implying $0 cost / all-profit. Kept in a .ts (no components) so Fast Refresh
// stays happy.

import { COST_PER_INBOUND_CALL } from "@/constants/financial";

export interface InboundEconomicsInput {
  /** Logged inbound calls — the cost driver (every inbound call is answered). */
  calls: number;
  /** Policies sold in the period. */
  policies: number;
  /** Annual premium written in the period. */
  premium: number;
  /** Collectible commission earned in the period (the cash/advance basis). */
  commission: number;
}

export interface InboundEconomics extends InboundEconomicsInput {
  spend: number | null;
  closeRate: number | null;
  cpa: number | null;
  avgPremium: number | null;
  netProfit: number | null;
  roi: number | null;
  /** No activity at all — neither calls nor sales — so the panel shows empty. */
  isEmpty: boolean;
}

export function computeInboundEconomics({
  calls,
  policies,
  premium,
  commission,
}: InboundEconomicsInput): InboundEconomics {
  const spend = calls > 0 ? calls * COST_PER_INBOUND_CALL : null;
  const closeRate = calls > 0 ? (policies / calls) * 100 : null;
  const cpa = spend != null && policies > 0 ? spend / policies : null;
  const avgPremium = policies > 0 ? premium / policies : null;
  const netProfit = spend != null ? commission - spend : null;
  const roi =
    spend != null && spend > 0 ? ((commission - spend) / spend) * 100 : null;
  const isEmpty = calls === 0 && policies === 0;

  return {
    calls,
    policies,
    premium,
    commission,
    spend,
    closeRate,
    cpa,
    avgPremium,
    netProfit,
    roi,
    isEmpty,
  };
}
