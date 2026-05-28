// Draft an email for human approval. Creates a pending_approval row in
// assistant_action_requests. Sends NOTHING — assistant-action-execute performs the
// send only after the user approves in the UI.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString, requireString } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const subject = requireString(input, "subject");
  const body = requireString(input, "body");
  const to = optionalString(input, "to");

  const { data, error } = await ctx.db
    .from("assistant_action_requests")
    .insert({
      conversation_id: ctx.conversationId,
      user_id: ctx.userId,
      imo_id: ctx.imoId,
      channel: "email",
      tool_name: "draftEmailMessage",
      draft_payload: { subject, body },
      recipient: to,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the email draft." };
  }

  return {
    ok: true,
    actionRequestId: data.id,
    channel: "email",
    status: "pending_approval",
    draft: { subject, body, to },
    note: "Draft created and is PENDING the user's approval. Nothing has been sent. Tell the user it's ready to review/approve; do not claim it was sent.",
  };
}

export const draftEmailMessage: RegisteredTool = {
  name: "draftEmailMessage",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description:
          "Optional recipient email; the user confirms before sending.",
      },
      subject: { type: "string", description: "Email subject line." },
      body: {
        type: "string",
        description: "Email body, natural and non-robotic.",
      },
    },
    required: ["subject", "body"],
    additionalProperties: false,
  },
  run,
};
