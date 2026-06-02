// Team production AGGREGATE for the CALLER's OWN team — the caller plus their
// downline subtree — via get_command_center_summary(p_scope:'team'). The scope is
// derived server-side from auth.uid() and intersected with the caller's imo_id, so
// it returns ONLY this team's totals and can never leak another team's numbers.
// (The previous get_team_leaderboard_data call returned every team leader in the
// whole IMO — that was the "my team pulls other teams" bug.) Read-only.
//
// This tool answers "how is my team doing" with one aggregate row. For a per-member
// ranked breakdown ("who is leading on my team", coaching) use getTeamLeaderboard.
// An all-zero row is available:true (no team production this period), not unavailable.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const args: Record<string, unknown> = { p_scope: "team" };
  const start = optionalString(input, "startDate");
  const end = optionalString(input, "endDate");
  if (start) args.p_start_date = start;
  if (end) args.p_end_date = end;

  const { data, error } = await ctx.db.rpc("get_command_center_summary", args);
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const row = rows[0];
  if (!row) return { available: false, reason: "no_team_data" };

  return {
    available: true,
    data: {
      team: {
        totalAp: num(row.total_ap),
        totalIp: num(row.total_ip),
        totalPolicies: num(row.total_policies),
        totalProspects: num(row.total_prospects),
        totalLeadsScored: num(row.total_leads_scored),
      },
    },
  };
}

export const getTeamProductionSummary: RegisteredTool = {
  name: "getTeamProductionSummary",
  inputSchema: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description: "Optional start date YYYY-MM-DD.",
      },
      endDate: { type: "string", description: "Optional end date YYYY-MM-DD." },
    },
    additionalProperties: false,
  },
  run,
};
