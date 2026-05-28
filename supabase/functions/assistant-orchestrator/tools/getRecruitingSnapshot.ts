// Recruiting pipeline snapshot: counts for the caller's recruiting leads, via
// get_recruiting_leads_stats (SECURITY DEFINER but scopes to auth.uid() when no
// recruiter id is passed). Counts only — no candidate PII. Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";

async function run(_input: Record<string, unknown>, ctx: AssistantToolContext) {
  const { data, error } = await ctx.db.rpc("get_recruiting_leads_stats", {});
  if (error) return { available: false, reason: "unavailable" };
  const stats = (data ?? null) as Record<string, number> | null;
  if (!stats || (typeof stats.total === "number" && stats.total === 0)) {
    return { available: false, reason: "no_recruiting_data" };
  }
  return { available: true, data: { pipeline: stats } };
}

export const getRecruitingSnapshot: RegisteredTool = {
  name: "getRecruitingSnapshot",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  run,
};
