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
