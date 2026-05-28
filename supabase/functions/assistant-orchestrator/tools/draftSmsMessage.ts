// Draft an SMS for human approval. Creates a pending_approval row in
// assistant_action_requests. Sends NOTHING — assistant-action-execute performs the
// send only after the user approves in the UI.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString, requireString } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const body = requireString(input, "body");
  const to = optionalString(input, "to");

  const { data, error } = await ctx.db
    .from("assistant_action_requests")
    .insert({
      conversation_id: ctx.conversationId,
      user_id: ctx.userId,
      imo_id: ctx.imoId,
      channel: "sms",
      tool_name: "draftSmsMessage",
      draft_payload: { body },
      recipient: to,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the SMS draft." };
  }

  return {
    ok: true,
    actionRequestId: data.id,
    channel: "sms",
    status: "pending_approval",
    draft: { body, to },
    note: "Draft created and is PENDING the user's approval. Nothing has been sent. Tell the user it's ready to review/approve; do not claim it was sent.",
  };
}

export const draftSmsMessage: RegisteredTool = {
  name: "draftSmsMessage",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description:
          "Optional recipient phone (E.164); the user confirms before sending.",
      },
      body: {
        type: "string",
        description: "Short, natural SMS text. Avoid fake urgency.",
      },
    },
    required: ["body"],
    additionalProperties: false,
  },
  run,
};
