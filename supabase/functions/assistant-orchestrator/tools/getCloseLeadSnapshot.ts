// getCloseLeadSnapshot: a compact, live read on ONE Close lead — by close_lead_id or
// by name (searched first). Returns status, contact-channel PRESENCE (counts, never
// the raw email/phone values), and an open-opportunity summary. Read-only.
// Mirrors getClientSnapshot's PII-drop discipline.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import {
  type CloseListResponse,
  contactChannelSummary,
  leadSearchPath,
  summarizeOpportunity,
  withClose,
} from "./close-helpers.ts";

const LEAD_FIELDS =
  "id,display_name,status_label,contacts,opportunities,date_created,date_updated";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const leadId = typeof input.leadId === "string" ? input.leadId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!leadId && !name) {
    return { available: false, reason: "missing_lead_identifier" };
  }

  return await withClose(ctx, async (client) => {
    let id = leadId;
    let matchCount = 1;

    // Resolve a name to a lead id via a lean search; take the first match.
    if (!id) {
      const found = await client.get<CloseListResponse>(
        leadSearchPath(name, 5),
      );
      const rows = Array.isArray(found?.data) ? found.data : [];
      if (rows.length === 0) {
        return { available: false, reason: "lead_not_found" };
      }
      const first = rows[0] as Record<string, unknown>;
      id = typeof first.id === "string" ? first.id : "";
      matchCount = rows.length;
      if (!id) return { available: false, reason: "lead_not_found" };
    }

    const lead = await client.get<Record<string, unknown>>(
      `/lead/${encodeURIComponent(id)}/?_fields=${LEAD_FIELDS}`,
    );

    const opportunities = Array.isArray(lead.opportunities)
      ? lead.opportunities
      : [];
    const openOpps = opportunities
      .map(summarizeOpportunity)
      .filter((o) => o.statusType === "active");

    return {
      available: true,
      data: {
        id: typeof lead.id === "string" ? lead.id : id,
        name: typeof lead.display_name === "string" ? lead.display_name : null,
        status:
          typeof lead.status_label === "string" ? lead.status_label : null,
        matchedByName: !leadId,
        matchCount,
        contacts: contactChannelSummary(lead.contacts),
        opportunities: {
          total: opportunities.length,
          open: openOpps.length,
          openSummary: openOpps,
        },
      },
    };
  });
}

export const getCloseLeadSnapshot: RegisteredTool = {
  name: "getCloseLeadSnapshot",
  inputSchema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description: "A Close lead id (lead_...). Preferred when known.",
      },
      name: {
        type: "string",
        description:
          "Lead/contact name to look up when the id is unknown (first match is used).",
      },
    },
    additionalProperties: false,
  },
  run,
};
