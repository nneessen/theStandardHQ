// Per-member production leaderboard for the CALLER's OWN team — the caller plus
// their downline subtree — via get_my_team_leaderboard. The scope is derived
// server-side from auth.uid() (no caller argument) and intersected with the caller's
// imo_id, so it can NEVER surface another team's members. This fixes the bug where
// "how is my team / who is leading" pulled the whole IMO's leaderboard.
//
// Read-only. Each row: member name, issued-paid premium, AP, approved policy count,
// and rank. The RPC caps the list at its top N plus the caller's own row, so a
// large downline never floods the model context. member_id is intentionally dropped
// (not needed by the model; keeps UUIDs out of the context). Audit redaction further
// reduces the array to {count} so names aren't warehoused.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const args: Record<string, unknown> = {};
  const start = optionalString(input, "startDate");
  const end = optionalString(input, "endDate");
  if (start) args.p_start_date = start;
  if (end) args.p_end_date = end;

  const { data, error } = await ctx.db.rpc("get_my_team_leaderboard", args);
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  if (rows.length === 0) return { available: false, reason: "no_team_data" };

  const members = rows.map((r) => ({
    name: r.member_name,
    ipTotal: num(r.ip_total),
    apTotal: num(r.ap_total),
    policyCount: num(r.policy_count),
    rank: num(r.rank_overall),
  }));

  return { available: true, data: { members } };
}

export const getTeamLeaderboard: RegisteredTool = {
  name: "getTeamLeaderboard",
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
