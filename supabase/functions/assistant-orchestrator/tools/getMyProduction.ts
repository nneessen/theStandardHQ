// Personal production snapshot for the CALLER only (their own book), via
// get_command_center_summary(p_scope:'personal'). The scope is derived server-side
// from auth.uid() (never a caller argument), so the model cannot widen it — tenant-
// and self-safe. Read-only. Returns one aggregate row: AP (annual premium SUBMITTED
// in range), IP (issued-paid: approved + effective in range), approved policy count,
// plus current prospect and lead-scored counts.
//
// This fixes the bug where an agent asking about THEIR OWN production got
// "no_team_data": getTeamProductionSummary's leaderboard only includes 5+-downline
// leaders, so a solo agent had no tool that returned their personal numbers.
//
// An all-zero row means "no production this period" and is available:true — do NOT
// treat zeros as unavailable.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const args: Record<string, unknown> = { p_scope: "personal" };
  const start = optionalString(input, "startDate");
  const end = optionalString(input, "endDate");
  if (start) args.p_start_date = start;
  if (end) args.p_end_date = end;

  const { data, error } = await ctx.db.rpc("get_command_center_summary", args);
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const row = rows[0];
  // The RPC always returns one row (zeros for no production); a missing row is
  // defensive only.
  if (!row) return { available: false, reason: "no_data" };

  return {
    available: true,
    data: {
      totalAp: num(row.total_ap),
      totalIp: num(row.total_ip),
      totalPolicies: num(row.total_policies),
      totalProspects: num(row.total_prospects),
      totalLeadsScored: num(row.total_leads_scored),
    },
  };
}

export const getMyProduction: RegisteredTool = {
  name: "getMyProduction",
  inputSchema: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description:
          "Optional start date YYYY-MM-DD (defaults to the start of the current month).",
      },
      endDate: {
        type: "string",
        description: "Optional end date YYYY-MM-DD (defaults to today).",
      },
    },
    additionalProperties: false,
  },
  run,
};
