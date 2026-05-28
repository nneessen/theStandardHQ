// Lead priorities: the caller's hottest sales leads (and which are going cold), via
// get_lead_priorities (RLS-scoped to own leads). Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.trunc(input.limit)
      : 10;

  const { data, error } = await ctx.db.rpc("get_lead_priorities", {
    p_user_id: ctx.userId,
    p_limit: limit,
  });
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as unknown[]) ?? [];
  if (rows.length === 0) return { available: false, reason: "no_lead_data" };
  return { available: true, data: { leads: rows } };
}

export const getLeadPriorities: RegisteredTool = {
  name: "getLeadPriorities",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description:
          "How many top-priority leads to return (default 10, max 50).",
      },
    },
    additionalProperties: false,
  },
  run,
};
