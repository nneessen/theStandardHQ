// Draft a Close note for human approval. Creates a pending_approval row; writes
// NOTHING to Close — assistant-action-execute adds the note (with the user's own
// Close key) only after the user approves. The lead is validated at draft time so
// the human-approved label matches the id that gets written.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { requireString } from "./types.ts";
import { resolveLeadForDraft } from "./close-helpers.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const leadId = requireString(input, "leadId");
  const note = requireString(input, "note");

  const lead = await resolveLeadForDraft(ctx, leadId);
  if (!lead.ok) return { ok: false, error: lead.error };

  const { data, error } = await ctx.db
    .from("assistant_action_requests")
    .insert({
      conversation_id: ctx.conversationId,
      user_id: ctx.userId,
      imo_id: ctx.imoId,
      channel: "close_note",
      tool_name: "draftCloseNote",
      // body carries the note text (shared field with the email/sms drafts so the
      // approval UI and previews reuse the same path). leadId is what gets written.
      draft_payload: { leadId, leadName: lead.leadName, body: note },
      recipient: null,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the note draft." };
  }

  return {
    ok: true,
    actionRequestId: data.id,
    channel: "close_note",
    status: "pending_approval",
    draft: { leadId, leadName: lead.leadName, note },
    note: "Draft created and PENDING the user's approval. The note is added to the lead in Close only after the user approves. Do not claim it was added yet.",
  };
}

export const draftCloseNote: RegisteredTool = {
  name: "draftCloseNote",
  inputSchema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description:
          "The Close lead id (lead_...) to attach the note to. Look the lead up first if you don't have its id.",
      },
      note: {
        type: "string",
        description: "The note text to add to the lead's Close timeline.",
      },
    },
    required: ["leadId", "note"],
    additionalProperties: false,
  },
  run,
};
