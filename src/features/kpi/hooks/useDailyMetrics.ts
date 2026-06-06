// src/features/kpi/hooks/useDailyMetrics.ts
// Query + mutation hooks for kpi_daily_call_metrics (self-scoped, Phase 1).

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { kpiKeys, useKpiIdentity } from "./kpiKeys";
import {
  closingRate,
  connectRate,
  costPerAcquisition,
  policiesPerClient,
} from "../lib/kpi-derivations";
import type {
  AgentKpiSummary,
  DailyCallMetricInsert,
  DailyCallMetricRow,
  DateRange,
} from "../types/kpi.types";

// ─── Read: daily metric rows for the current agent over a date range ────────

async function fetchDailyMetrics(
  agentId: string,
  range: DateRange,
): Promise<DailyCallMetricRow[]> {
  const { data, error } = await supabase
    .from("kpi_daily_call_metrics")
    .select("*")
    // Explicit self-scope: RLS would otherwise let an upline/admin pull the
    // whole team into this Phase-1 "my metrics" view.
    .eq("agent_id", agentId)
    .gte("metric_date", range.from)
    .lte("metric_date", range.to)
    .order("metric_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useDailyMetrics(range: DateRange) {
  const { user } = useAuth();
  const agentId = user?.id ?? "";

  return useQuery({
    queryKey: kpiKeys.dailyMetrics(agentId, range),
    queryFn: () => fetchDailyMetrics(agentId, range),
    enabled: !!agentId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

// ─── Aggregate: derive the dashboard summary from the daily rows ────────────

/**
 * Sum a numeric column across rows, returning null when there is no usable
 * value (no rows, or every value null) so the UI suppresses the tile. A real
 * 0 (at least one row contributed) is returned as 0.
 */
function sumNullable(
  rows: DailyCallMetricRow[],
  key: keyof DailyCallMetricRow,
): number | null {
  let sum = 0;
  let seen = false;
  for (const row of rows) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      sum += raw;
      seen = true;
    }
  }
  return seen ? sum : null;
}

export function summarizeDailyMetrics(
  rows: DailyCallMetricRow[],
): AgentKpiSummary {
  const totalInboundCalls = sumNullable(rows, "total_inbound_calls");
  const answeredCalls = sumNullable(rows, "answered_calls");
  const missedCalls = sumNullable(rows, "missed_calls");
  const leadsReceived = sumNullable(rows, "leads_received");
  const clientsSold = sumNullable(rows, "clients_sold");
  const policiesSold = sumNullable(rows, "policies_sold");
  const premiumWritten = sumNullable(rows, "premium_written");
  const leadSpend = sumNullable(rows, "lead_spend");
  const marketingSpend = sumNullable(rows, "marketing_spend");
  const totalTalkTimeSeconds = sumNullable(rows, "total_talk_time_seconds");

  return {
    rowCount: rows.length,
    totalInboundCalls,
    answeredCalls,
    missedCalls,
    leadsReceived,
    clientsSold,
    policiesSold,
    premiumWritten,
    leadSpend,
    marketingSpend,
    totalTalkTimeSeconds,
    connectRate: connectRate(answeredCalls, totalInboundCalls),
    closingRate: closingRate(clientsSold, totalInboundCalls),
    policiesPerClient: policiesPerClient(policiesSold, clientsSold),
    costPerAcquisition: costPerAcquisition(
      leadSpend,
      marketingSpend,
      clientsSold,
    ),
  };
}

/** Aggregate the agent's daily metrics over a range into the dashboard summary. */
export function useAgentKpiSummary(range: DateRange) {
  const query = useDailyMetrics(range);
  const summary = useMemo(
    () => (query.data ? summarizeDailyMetrics(query.data) : null),
    [query.data],
  );
  return { ...query, summary };
}

// ─── Write: upsert one day's metric row (conflict on agent_id + metric_date) ─

export type DailyMetricUpsertInput = Omit<
  DailyCallMetricInsert,
  "imo_id" | "agent_id" | "entered_by"
> & { metric_date: string };

export function useUpsertDailyMetrics() {
  const queryClient = useQueryClient();
  const { userId, imoId } = useKpiIdentity();

  return useMutation({
    mutationFn: async (input: DailyMetricUpsertInput) => {
      if (!userId || !imoId) {
        throw new Error("Your account is not linked to an IMO yet.");
      }
      const payload: DailyCallMetricInsert = {
        ...input,
        imo_id: imoId,
        agent_id: userId,
        entered_by: userId,
      };

      const { data, error } = await supabase
        .from("kpi_daily_call_metrics")
        .upsert(payload, { onConflict: "agent_id,metric_date" })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as DailyCallMetricRow;
    },
    onSuccess: () => {
      toast.success("Daily metrics saved");
      queryClient.invalidateQueries({ queryKey: kpiKeys.all });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save metrics",
      );
    },
  });
}
