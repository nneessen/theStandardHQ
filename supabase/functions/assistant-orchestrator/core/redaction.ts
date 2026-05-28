// Redaction + truncation for tool I/O before it is written to assistant_tool_calls.
// Pure. Keeps secrets out of logs and prevents large tool outputs (e.g. long lead
// lists) from ballooning the audit table.

const SENSITIVE_KEY_PATTERN =
  /(token|secret|api[_-]?key|password|passwd|authorization|bearer|signature|cookie|ssn|social_security|dob|date_of_birth|access_key|private_key)/i;

const MAX_STRING = 500;
const MAX_ARRAY = 25;
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[redacted:max-depth]";

  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING} chars]`
      : value;
  }

  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => redact(v, depth + 1));
    if (value.length > MAX_ARRAY)
      out.push(`[+${value.length - MAX_ARRAY} more]`);
    return out;
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k)
        ? "[redacted]"
        : redact(v, depth + 1);
    }
    return out;
  }

  return value;
}

// Structural keys whose string values are known non-PII enums/identifiers and are
// safe to keep in the audit summary. Everything else (names, emails, free text,
// premiums-as-strings) is reduced to a length marker.
const SAFE_SUMMARY_STRING_KEYS = new Set([
  "reason",
  "status",
  "channel",
  "note",
  "error",
  "generatedAt",
  "actionRequestId",
]);

const SUMMARY_MAX_STRING = 200;

/**
 * Audit-safe summary of a tool's OUTPUT for assistant_tool_calls.output_redacted.
 * Unlike redact() (which only masks sensitive *key names*), this never emits a
 * string *value* pulled from a DB row, so client/agent names, premiums, DOB, etc.
 * returned by the grounding RPCs are not warehoused in the audit log. It preserves
 * structure (object keys), booleans, numbers, and array *counts*, so the log still
 * proves what shape each tool returned and whether each section was `available`.
 */
export function summarizeToolOutput(
  value: unknown,
  key?: string,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return "[summary:max-depth]";

  if (value === null) return null;
  const t = typeof value;
  if (t === "boolean" || t === "number") return value;

  if (t === "string") {
    const s = value as string;
    if (key && SAFE_SUMMARY_STRING_KEYS.has(key)) {
      return s.length > SUMMARY_MAX_STRING
        ? `${s.slice(0, SUMMARY_MAX_STRING)}…[+${s.length - SUMMARY_MAX_STRING} chars]`
        : s;
    }
    return `[omitted:${s.length}]`;
  }

  // Arrays are where row PII lives (lead lists, commission rows, leaderboards).
  // Never recurse into element values — record only the count.
  if (Array.isArray(value)) return { count: value.length };

  if (t === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = summarizeToolOutput(v, k, depth + 1);
    }
    return out;
  }

  return undefined;
}
