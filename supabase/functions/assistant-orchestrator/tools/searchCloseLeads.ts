// searchCloseLeads: free-text search of the user's live Close CRM, returning lean
// matches (name + id + status + recency) — NOT full records. Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import {
  clampLimit,
  type CloseListResponse,
  daysSince,
  leadSearchPath,
  withClose,
} from "./close-helpers.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return { available: false, reason: "missing_query" };
  const limit = clampLimit(input.limit, 10, 25);

  return await withClose(ctx, async (client) => {
    const res = await client.get<CloseListResponse>(
      leadSearchPath(query, limit),
    );
    const rows = Array.isArray(res?.data) ? res.data : [];
    if (rows.length === 0) {
      return { available: false, reason: "no_match" };
    }
    const leads = rows.map((r) => ({
      id: typeof r.id === "string" ? r.id : null,
      name: typeof r.display_name === "string" ? r.display_name : null,
      status: typeof r.status_label === "string" ? r.status_label : null,
      daysSinceUpdate: daysSince(r.date_updated),
    }));
    return {
      available: true,
      data: {
        query,
        matchCount: leads.length,
        totalResults:
          typeof res?.total_results === "number" ? res.total_results : null,
        leads,
      },
    };
  });
}

export const searchCloseLeads: RegisteredTool = {
  name: "searchCloseLeads",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Free-text to search the user's Close leads (a person/business name, or Close search syntax).",
      },
      limit: {
        type: "number",
        description: "Max matches to return (default 10, max 25).",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  run,
};
