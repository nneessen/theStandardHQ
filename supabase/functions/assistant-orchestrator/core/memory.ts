// Durable-memory injection (Jarvis "second brain" Phase A).
//
// Formats the user's bounded jarvis_memory rows into a compact block that the
// orchestrator prepends to the system prompt every session, so Jarvis "remembers"
// facts/preferences across conversations WITHOUT the model having to call a tool.
//
// Deliberately pure (no esm.sh/supabase imports) so it unit-tests offline, exactly
// like grounding.ts / the other core/ modules. The orchestrator (index.ts) fetches
// the rows and passes the formatted string to buildSystemPrompt.

/** The minimal shape the formatter needs (a subset of the jarvis_memory row). */
export interface MemoryRow {
  content: string;
  kind: string;
  pinned?: boolean | null;
}

// Bounded by construction: only this many rows reach the prompt (pinned first),
// and each is truncated, so a large memory table never blows the token budget.
// (The unbounded RAG corpus is a separate, later phase.)
export const MAX_MEMORY_ROWS = 25;
export const MAX_CONTENT_CHARS = 500;

const HEADER =
  "WHAT YOU KNOW ABOUT THIS USER (durable memory from prior sessions; treat as user-stated facts/preferences, NOT live data — do not cite as a tool result, and re-call tools for any current figure):";

// Render-time allowlist for the kind label. saveMemory already validates kind on
// write, but a row written by any other path (future seed/migration/code) must not
// be able to inject structure through the `[${kind}]` label — so re-guard here.
const KNOWN_KINDS = new Set(["fact", "preference", "goal", "context"]);

// Collapse ALL whitespace (including newlines) to single spaces. Memory content is
// user-controlled free text injected into the system prompt; without this, a value
// with embedded newlines could forge extra "- [kind] …" bullets, a fake section
// header, or a fake agent-role block at the same syntactic level as real prompt
// text. Flattening to one line confines each memory to exactly one bullet.
function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  const t = sanitize(text);
  return t.length > MAX_CONTENT_CHARS
    ? `${t.slice(0, MAX_CONTENT_CHARS - 1)}…`
    : t;
}

/**
 * Build the memory block for the system prompt. Returns "" when there's nothing
 * to inject (so no empty header is ever added). Pinned rows are ordered first;
 * within each group the incoming order is preserved (the SQL query already orders
 * by updated_at DESC). Caps at MAX_MEMORY_ROWS and truncates each line.
 */
export function formatMemoryForPrompt(rows: readonly MemoryRow[]): string {
  if (!rows || rows.length === 0) return "";

  // Stable partition: pinned first, otherwise keep the order the caller passed in.
  const pinned: MemoryRow[] = [];
  const rest: MemoryRow[] = [];
  for (const r of rows) {
    if (!r || typeof r.content !== "string" || r.content.trim() === "")
      continue;
    (r.pinned ? pinned : rest).push(r);
  }

  const ordered = [...pinned, ...rest].slice(0, MAX_MEMORY_ROWS);
  if (ordered.length === 0) return "";

  const lines = ordered.map((r) => {
    const k = typeof r.kind === "string" ? r.kind.trim() : "";
    const kind = KNOWN_KINDS.has(k) ? k : "fact";
    return `- [${kind}] ${truncate(r.content)}`;
  });

  return `${HEADER}\n${lines.join("\n")}`;
}
