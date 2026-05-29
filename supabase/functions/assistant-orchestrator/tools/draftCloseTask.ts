// Draft a Close task for human approval. Creates a pending_approval row; writes
// NOTHING to Close — assistant-action-execute creates the task (with the user's own
// Close key) only after the user approves. The lead is validated at draft time.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString, requireString } from "./types.ts";
import { resolveLeadForDraft } from "./close-helpers.ts";

// Parse an optional due date. Absent -> null (task created with no due date).
// Present -> must be a REAL calendar date in YYYY-MM-DD (round-trips through Date,
// so 2026-13-45 / 2026-02-31 are rejected). An invalid value is rejected (not
// silently dropped) so the user never approves a task whose due date vanished or
// that Close would 400 at execute time.
function parseDueDate(
  input: Record<string, unknown>,
): { ok: true; dueDate: string | null } | { ok: false } {
  const v = optionalString(input, "dueDate");
  if (!v) return { ok: true, dueDate: null };
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false };
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return { ok: false };
  }
  return { ok: true, dueDate: s };
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const leadId = requireString(input, "leadId");
  const text = requireString(input, "text");
  const due = parseDueDate(input);
  if (!due.ok) {
    return {
      ok: false,
      error:
        "dueDate must be a real calendar date in YYYY-MM-DD format (e.g. 2026-06-01), or omitted.",
    };
  }
  const dueDate = due.dueDate;

  const lead = await resolveLeadForDraft(ctx, leadId);
  if (!lead.ok) return { ok: false, error: lead.error };

  const { data, error } = await ctx.db
    .from("assistant_action_requests")
    .insert({
      conversation_id: ctx.conversationId,
      user_id: ctx.userId,
      imo_id: ctx.imoId,
      channel: "close_task",
      tool_name: "draftCloseTask",
      draft_payload: {
        leadId,
        leadName: lead.leadName,
        body: text,
        ...(dueDate ? { dueDate } : {}),
      },
      recipient: null,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the task draft." };
  }

  return {
    ok: true,
    actionRequestId: data.id,
    channel: "close_task",
    status: "pending_approval",
    draft: { leadId, leadName: lead.leadName, text, dueDate },
    note: "Draft created and PENDING the user's approval. The task is created in Close only after the user approves. Do not claim it was created yet.",
  };
}

export const draftCloseTask: RegisteredTool = {
  name: "draftCloseTask",
  inputSchema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description:
          "The Close lead id (lead_...) to create the task on. Look the lead up first if you don't have its id.",
      },
      text: {
        type: "string",
        description: "The task description (what needs to be done).",
      },
      dueDate: {
        type: "string",
        description: "Optional due date as YYYY-MM-DD. Omit if none.",
      },
    },
    required: ["leadId", "text"],
    additionalProperties: false,
  },
  run,
};
