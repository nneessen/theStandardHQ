// src/features/close-kpi/services/teamPipelineService.ts
// Calls the get_team_pipeline_snapshot + user_can_view_team_tab RPCs.
// Both functions enforce access internally (SECURITY DEFINER + auth.uid()).

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";
import type { TeamPipelineRow } from "../types/team-kpi.types";

type SnapshotRow =
  Database["public"]["Functions"]["get_team_pipeline_snapshot"]["Returns"][number];

export async function fetchTeamPipelineSnapshot(
  targetUserIds?: string[],
): Promise<TeamPipelineRow[]> {
  const { data, error } = await supabase.rpc("get_team_pipeline_snapshot", {
    p_target_user_ids: targetUserIds ?? undefined,
  });
  if (error) throw error;
  return (data ?? []).map((r: SnapshotRow) => ({
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    profilePhotoUrl: r.profile_photo_url,
    isSelf: r.is_self,
    hasCloseConfig: r.has_close_config,
    lastScoredAt: r.last_scored_at,
    totalLeads: r.total_leads ?? 0,
    hotCount: r.hot_count ?? 0,
    warmingCount: r.warming_count ?? 0,
    neutralCount: r.neutral_count ?? 0,
    coolingCount: r.cooling_count ?? 0,
    coldCount: r.cold_count ?? 0,
    avgScore: r.avg_score,
    totalDials: r.total_dials ?? 0,
    totalConnects: r.total_connects ?? 0,
    connectRate: r.connect_rate,
    staleLeadsCount: r.stale_leads_count ?? 0,
    untouchedActive: r.untouched_active ?? 0,
    noAnswerStreak: r.no_answer_streak ?? 0,
    straightToVm: r.straight_to_vm ?? 0,
    activeOppsCount: r.active_opps_count ?? 0,
    openOppValueUsd: r.open_opp_value_usd ?? 0,
  }));
}

export async function fetchCanViewTeamTab(): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_can_view_team_tab");
  if (error) throw error;
  return Boolean(data);
}
