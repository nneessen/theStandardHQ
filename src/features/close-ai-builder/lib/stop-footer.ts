// Deterministic enforcement of the SMS "Reply STOP" opt-out footer.
//
// The AI prompt is a soft hint — it asks the model to include or omit a STOP
// footer based on the includeStop option, but the model's compliance varies.
// This module guarantees the user's toggle intent in the final saved text by
// post-processing AI output (and user edits) before save.
//
// "Footer" is defined narrowly as a STOP-pattern that runs to the end of the
// body. Mid-text mentions of "Reply STOP" are intentionally NOT considered
// footers — those are body content the user wrote on purpose.

// Match a trailing STOP footer. Allows an optional leading separator
// (em-dash, hyphen, comma, colon, semicolon) but deliberately NOT a period —
// a sentence-ending period before the footer belongs to the prior sentence
// and should be kept. The keyword alternation covers the common AI variants
// observed in production: Reply STOP, Text STOP, Send STOP, Msg STOP, plus
// the "STOP to …" pattern.
const STOP_FOOTER_REGEX =
  /\s*[—\-:;,]?\s*(?:\b(?:reply|text|send|msg)\s+['""]?stop['""]?\b|\bstop\s+to\s+(?:opt\s*[\s-]?out|unsubscribe|cancel|end|quit))[^.\n]*\.?\s*$/i;

const CANONICAL_FOOTER = "Reply STOP to opt out";

/**
 * True iff the text ends with a recognizable STOP opt-out footer. Mid-text
 * "Reply STOP" mentions are not counted (by design — they're not footers and
 * shouldn't be stripped or block a footer from being appended).
 */
export function hasStopFooter(text: string): boolean {
  return STOP_FOOTER_REGEX.test(text.trim());
}

/**
 * Reconcile the SMS body against the includeStop toggle. Idempotent for
 * trailing footers.
 *
 * - include=true: append the canonical footer if no trailing opt-out is
 *   detected.
 * - include=false: strip a trailing opt-out footer if present. Mid-text
 *   "Reply STOP" mentions are preserved.
 *
 * Preserves user formatting otherwise. When appending, uses a blank-line
 * separator for multiline bodies and a single space for one-liners.
 */
export function enforceStopFooter(text: string, include: boolean): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (include) {
    if (hasStopFooter(trimmed)) return trimmed;
    const sep = trimmed.includes("\n") ? "\n\n" : " ";
    return `${trimmed}${sep}${CANONICAL_FOOTER}`;
  }

  // include === false → strip the trailing footer if present.
  if (!hasStopFooter(trimmed)) return trimmed;
  return trimmed.replace(STOP_FOOTER_REGEX, "").trimEnd();
}
