// src/features/kpi/hooks/kpiKeys.ts
// TanStack Query key factory + the shared identity helper for KPI mutations.

import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/hooks/imo";
import type { DateRange } from "../types/kpi.types";

export const kpiKeys = {
  all: ["kpi"] as const,
  dailyMetrics: (agentId: string, range: DateRange) =>
    [...kpiKeys.all, "daily-metrics", agentId, range.from, range.to] as const,
  teamDailyMetrics: (agentIds: string[], range: DateRange) =>
    [
      ...kpiKeys.all,
      "team-daily-metrics",
      [...agentIds].sort().join(","),
      range.from,
      range.to,
    ] as const,
  summary: (agentId: string, range: DateRange) =>
    [...kpiKeys.all, "summary", agentId, range.from, range.to] as const,
  recordings: (agentId: string) =>
    [...kpiKeys.all, "recordings", agentId] as const,
  wordTracks: (ownerId: string) =>
    [...kpiKeys.all, "word-tracks", ownerId] as const,
  // agentId scopes the cache: a specific id = that agent only; null = the full
  // RLS-visible set (own + downline + admin).
  callAnalytics: (range: DateRange, agentId: string | null) =>
    [
      ...kpiKeys.all,
      "call-analytics",
      agentId ?? "all",
      range.from,
      range.to,
    ] as const,
  wordTrackEffectiveness: (range: DateRange) =>
    [...kpiKeys.all, "wt-effectiveness", range.from, range.to] as const,
};

/**
 * Resolve the identity used for KPI inserts (Phase 1 = self only).
 *
 * - `userId`  → agent_id / owner_id / entered_by / created_by / uploader_id
 * - `imoId`   → imo_id. Uses `effectiveImoId` from the IMO context, which
 *   reduces to the user's own imo_id for a regular agent and honors the acting
 *   IMO for a super-admin — matching the `get_my_imo_id()` value the RLS
 *   WITH CHECK pins inserts to.
 */
export function useKpiIdentity(): {
  userId: string | null;
  imoId: string | null;
  isReady: boolean;
} {
  const { user } = useAuth();
  const { effectiveImoId } = useImo();

  const userId = user?.id ?? null;
  const imoId = effectiveImoId ?? user?.imo_id ?? null;

  return { userId, imoId, isReady: !!userId && !!imoId };
}
