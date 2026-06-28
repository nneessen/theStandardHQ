// src/features/kpi/hooks/useTeamDailyMetrics.ts
// Team rollup over kpi_daily_call_metrics — me + my downline. Unlike the
// self-scoped useDailyMetrics, this pulls every agent_id in `teamIds`. RLS still
// applies: kpi_daily_call_metrics lets an upline read its downline's rows
// (policy is_upline_of(agent_id), migration 20260606135121), so an out-of-team
// id simply returns nothing rather than erroring. Aggregation reuses the same
// summarizeDailyMetrics helper the individual summary uses.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { kpiKeys } from "./kpiKeys";
import { summarizeDailyMetrics } from "./useDailyMetrics";
import type { DailyCallMetricRow, DateRange } from "../types/kpi.types";

async function fetchTeamDailyMetrics(
  teamIds: string[],
  range: DateRange,
): Promise<DailyCallMetricRow[]> {
  const { data, error } = await supabase
    .from("kpi_daily_call_metrics")
    .select("*")
    .in("agent_id", teamIds)
    .gte("metric_date", range.from)
    .lte("metric_date", range.to)
    .order("metric_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Aggregate the team's daily metrics over a range into the dashboard summary. */
export function useTeamDailyMetrics(teamIds: string[], range: DateRange) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: kpiKeys.teamDailyMetrics(teamIds, range),
    queryFn: () => fetchTeamDailyMetrics(teamIds, range),
    enabled: !!user?.id && teamIds.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const summary = useMemo(
    () => (query.data ? summarizeDailyMetrics(query.data) : null),
    [query.data],
  );

  return { ...query, summary };
}
