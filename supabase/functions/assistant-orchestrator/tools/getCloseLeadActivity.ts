// getCloseLeadActivity: recent activity timeline for ONE Close lead — calls, emails,
// SMS, notes, meetings, status changes — summarized to type + date + direction/
// duration/status. Bodies, subjects, and contact values are dropped. Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import {
  clampLimit,
  type CloseListResponse,
  summarizeActivity,
  withClose,
} from "./close-helpers.ts";

// Project only the fields we summarize, so Close never sends message bodies,
// subjects, contact values, or recording URLs into edge memory in the first
// place (the output is already allowlisted, but this keeps raw PII off the wire).
// `_type` is a meta field Close always returns on the mixed /activity/ feed.
const ACTIVITY_FIELDS = "id,_type,direction,status,duration,date_created";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const leadId = typeof input.leadId === "string" ? input.leadId.trim() : "";
  if (!leadId) return { available: false, reason: "missing_lead_id" };
  const limit = clampLimit(input.limit, 15, 50);

  return await withClose(ctx, async (client) => {
    const res = await client.get<CloseListResponse>(
      `/activity/?lead_id=${encodeURIComponent(leadId)}&_limit=${limit}&_fields=${ACTIVITY_FIELDS}`,
    );
    const rows = Array.isArray(res?.data) ? res.data : [];
    if (rows.length === 0) {
      return { available: false, reason: "no_activity" };
    }
    const activities = rows.map(summarizeActivity);
    // Compact count by type so the model can lead with the shape of the timeline.
    const byType: Record<string, number> = {};
    for (const a of activities) {
      const t = typeof a.type === "string" ? a.type : "Unknown";
      byType[t] = (byType[t] ?? 0) + 1;
    }
    return {
      available: true,
      data: {
        leadId,
        count: activities.length,
        byType,
        mostRecent:
          typeof activities[0]?.date === "string" ? activities[0].date : null,
        activities,
      },
    };
  });
}

export const getCloseLeadActivity: RegisteredTool = {
  name: "getCloseLeadActivity",
  inputSchema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description: "The Close lead id (lead_...) whose activity to fetch.",
      },
      limit: {
        type: "number",
        description: "Max recent activities to return (default 15, max 50).",
      },
    },
    required: ["leadId"],
    additionalProperties: false,
  },
  run,
};
