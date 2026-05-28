// Team production summary: team-level AP/IP/policy counts for the caller's hierarchy,
// via get_team_leaderboard_data (RLS-scoped, no required args). Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const args: Record<string, unknown> = {};
  const start = optionalString(input, "startDate");
  const end = optionalString(input, "endDate");
  if (start) args.p_start_date = start;
  if (end) args.p_end_date = end;

  const { data, error } = await ctx.db.rpc("get_team_leaderboard_data", args);
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as unknown[]) ?? [];
  if (rows.length === 0) return { available: false, reason: "no_team_data" };
  return { available: true, data: { teams: rows } };
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
