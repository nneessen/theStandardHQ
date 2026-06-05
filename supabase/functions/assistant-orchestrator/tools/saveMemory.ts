// Save a durable memory for the user (Jarvis "second brain" Phase A).
//
// Unlike the draft* tools (which create a PENDING approval row in
// assistant_action_requests), this commits the user's own jarvis_memory row
// DIRECTLY — it has no external effect and is RLS-scoped to the caller, so there
// is nothing to approve. The saved fact/preference is injected into the system
// prompt on every future session (see core/memory.ts).

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString, requireString } from "./types.ts";

// Allowed memory kinds (TS-enforced; the DB column has no CHECK per convention).
const KINDS = ["fact", "preference", "goal", "context"] as const;
type MemoryKind = (typeof KINDS)[number];

function normalizeKind(input: Record<string, unknown>): MemoryKind {
  const raw = optionalString(input, "kind");
  return (KINDS as readonly string[]).includes(raw ?? "")
    ? (raw as MemoryKind)
    : "fact";
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const content = requireString(input, "content");
  const kind = normalizeKind(input);
  const pinned = input.pinned === true;

  const { data, error } = await ctx.db
    .from("jarvis_memory")
    .insert({
      // user_id comes from the VERIFIED context, never from tool input — the model
      // cannot save memory onto another user (RLS would reject it anyway).
      user_id: ctx.userId,
      imo_id: ctx.imoId,
      content,
      kind,
      // memory_key stays null in Phase A: keyed-upsert needs an ON CONFLICT path
      // (the uq_jarvis_memory_user_key index), and ToolDbClient has no upsert/update
      // verb. Exposing a key now would make a second save with the same key hit the
      // unique constraint and fail. Keyed updates land with the Phase B upsert RPC.
      memory_key: null,
      source: "user",
      pinned,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the memory." };
  }

  return {
    ok: true,
    memoryId: data.id,
    kind,
    note: "Saved to long-term memory; it will be available in future sessions. This is committed directly (no approval needed) — tell the user you'll remember it.",
  };
}

export const saveMemory: RegisteredTool = {
  name: "saveMemory",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "The fact, preference, goal, or context to remember about the user, in a concise self-contained sentence (e.g. 'Prefers terse bullet replies', 'Goal: $50k AP this quarter').",
      },
      kind: {
        type: "string",
        enum: KINDS as unknown as string[],
        description:
          "What kind of memory this is. Defaults to 'fact'. Use 'goal' for targets, 'preference' for how the user likes things, 'context' for background.",
      },
      pinned: {
        type: "boolean",
        description:
          "Set true only for a high-importance memory that should always be surfaced first.",
      },
    },
    required: ["content"],
    additionalProperties: false,
  },
  run,
};
