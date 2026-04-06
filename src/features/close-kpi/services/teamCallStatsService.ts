// src/features/close-kpi/services/teamCallStatsService.ts
//
// Calls the get-team-call-stats edge function. The edge function fans out
// across team members (caller + downlines), pulls each one's Close call
// activity for the requested date range, and returns aggregated per-agent
// dial/connect/talk-time stats.
//
// All access control happens server-side: the edge function calls
// get_team_member_ids() with the caller's JWT to determine the team set.

import { supabase } from "@/services/base/supabase";
import type { TeamCallStatsResponse } from "../types/team-call-stats.types";

export async function fetchTeamCallStats(params: {
  from: string;
  to: string;
}): Promise<TeamCallStatsResponse> {
  const { data, error } = await supabase.functions.invoke(
    "get-team-call-stats",
    {
      body: { from: params.from, to: params.to },
    },
  );

  if (error) {
    // Surface the actual server error message so the UI can show something
    // useful instead of a generic "FunctionsHttpError".
    let msg = error.message ?? "Failed to load team call stats";
    if ("context" in error && error.context) {
      try {
        const ctx = error.context as { json?: () => Promise<unknown> };
        if (typeof ctx.json === "function") {
          const body = (await ctx.json()) as { error?: string };
          if (body?.error) msg = body.error;
        }
      } catch {
        /* ignore — keep generic msg */
      }
    }
    throw new Error(msg);
  }

  return data as TeamCallStatsResponse;
}
