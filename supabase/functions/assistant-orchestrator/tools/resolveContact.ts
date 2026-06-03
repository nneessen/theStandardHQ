// resolveContact — resolve a person's NAME to masked contact candidates ("which Bob?"),
// scoped by RLS to the caller's own clients / recruiting leads / team (via the
// assistant_resolve_contact SECURITY INVOKER RPC). Read-only; returns only MASKED values
// (never the raw phone/email). The recipient is still entered + approved by the human in the
// modal — this just lets Jarvis confirm WHO the user means before drafting.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const name = optionalString(input, "name");
  if (!name) return { available: false, reason: "name_required" };
  const channel =
    optionalString(input, "channel") === "email" ? "email" : "sms";

  const { data, error } = await ctx.db.rpc("assistant_resolve_contact", {
    p_name: name,
    p_channel: channel,
  });
  if (error) return { available: false, reason: "unavailable" };

  const rows = (data as Array<Record<string, unknown>>) ?? [];
  if (rows.length === 0) return { available: false, reason: "no_match" };

  return {
    available: true,
    data: {
      channel,
      candidates: rows.map((r) => ({
        displayName: r.display_name,
        contactKind: r.contact_kind,
        maskedValue: r.masked_value,
      })),
    },
  };
}

export const resolveContact: RegisteredTool = {
  name: "resolveContact",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Person/contact name to resolve (e.g. 'Bob Smith').",
      },
      channel: {
        type: "string",
        enum: ["sms", "email"],
        description: "Which contact method to look up. Defaults to 'sms'.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  run,
};
