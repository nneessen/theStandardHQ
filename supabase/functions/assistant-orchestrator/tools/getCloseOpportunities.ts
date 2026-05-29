// getCloseOpportunities: open opportunities in the user's live Close pipeline for
// triage — value, status, age, and how long they've been stalled. Most-stalled
// first. Names + money + status only (no PII). Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import {
  clampLimit,
  type CloseListResponse,
  summarizeOpportunity,
  withClose,
} from "./close-helpers.ts";

const OPP_FIELDS =
  "id,lead_id,lead_name,status_label,status_type,value,value_period,value_formatted,confidence,date_created,date_updated";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const limit = clampLimit(input.limit, 15, 50);

  return await withClose(ctx, async (client) => {
    // Ask Close for active opportunities directly; fetch a little extra so the
    // stalled-first sort is meaningful, then trim to the requested limit.
    const res = await client.get<CloseListResponse>(
      `/opportunity/?status_type=active&_fields=${OPP_FIELDS}&_limit=${Math.min(100, limit * 2)}`,
    );
    const rows = Array.isArray(res?.data) ? res.data : [];
    // Trust-but-verify the server-side status_type filter (defense-in-depth:
    // a future param typo must never let won/lost deals show as open).
    const active = rows
      .map(summarizeOpportunity)
      .filter((o) => o.statusType === "active");
    if (active.length === 0) {
      return { available: false, reason: "no_open_opportunities" };
    }
    // Most stalled first (longest since last update), then highest value.
    const opps = active
      .sort((a, b) => {
        const su =
          ((b.daysSinceUpdate as number) ?? 0) -
          ((a.daysSinceUpdate as number) ?? 0);
        if (su !== 0) return su;
        return ((b.value as number) ?? 0) - ((a.value as number) ?? 0);
      })
      .slice(0, limit);

    // True open count comes from Close's total_results (independent of our page
    // limit); fall back to what we fetched. returnedValue is the $ sum of ONLY
    // the opps below — NOT the whole pipeline — so the model can't overstate it.
    const openCount =
      typeof res?.total_results === "number"
        ? res.total_results
        : active.length;
    const returnedValue = opps.reduce(
      (s, o) => s + (typeof o.value === "number" ? o.value : 0),
      0,
    );

    return {
      available: true,
      data: {
        openCount,
        returned: opps.length,
        truncated: openCount > opps.length,
        returnedValue,
        opportunities: opps,
      },
    };
  });
}

export const getCloseOpportunities: RegisteredTool = {
  name: "getCloseOpportunities",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description:
          "Max open opportunities to return, most-stalled first (default 15, max 50).",
      },
    },
    additionalProperties: false,
  },
  run,
};
