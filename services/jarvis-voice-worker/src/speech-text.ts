// Deterministic speech-text safety-net for the realtime voice worker.
//
// The orchestrator's voice-mode system prompt (assistant-orchestrator, isVoiceSurface)
// is the PRIMARY mechanism that makes replies markdown-free and spells numbers as words.
// THIS module is the belt-and-suspenders net: it guarantees no raw markdown or symbol
// ("**", "###", "$", "%", a bullet, a stray 4-digit integer) ever reaches ElevenLabs even
// when the model slips. It is the single authoritative deterministic transform — we do NOT
// also enable ElevenLabs `applyTextNormalization` (that would be a third, redundant number
// engine). `toSpokenText` is ported from the legacy browser path's
// assistant-voice-tts/spoken-text.ts, which is being retired.
//
// IMPORTANT: `toSpokenText` must only ever see WHOLE words/sentences — applying it to a
// half-streamed token ("$1,2…") would mangle the number. `normalizeSpeechStream` buffers the
// orchestrator's token-fragment deltas and only flushes COMPLETE sentences through it. The
// SDK's own sentence tokenizer still chunks the cleaned text for TTS downstream; this pass
// only sanitizes the text, it is not a TTS aggregator.

/** Convert markdown-ish assistant text into something natural to hear. */
export function toSpokenText(input: string): string {
  let s = input;
  // Fenced/inline code → drop the backticks, keep the words.
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  // Markdown links [label](url) → just the label.
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bold/italic/heading/list/quote markers.
  s = s.replace(/[*_#>]+/g, " ");
  s = s.replace(/^\s*[-•]\s+/gm, ", ");
  // Money with magnitude: "$1.5M" → "1.5 million dollars".
  s = s.replace(/\$\s?([\d,.]+)\s?([MmBbKk])\b/g, (_m, num, unit: string) => {
    const word =
      unit.toLowerCase() === "m"
        ? "million"
        : unit.toLowerCase() === "b"
          ? "billion"
          : "thousand";
    return `${num.replace(/,/g, "")} ${word} dollars`;
  });
  // Plain money: "$3,594" → "3,594 dollars". KEEP the commas — a bare "3594" gets
  // read digit-by-digit ("three five nine four"); "3,594" is read as a cardinal.
  s = s.replace(
    /\$\s?([\d,]+(?:\.\d+)?)/g,
    (_m, num: string) => `${num} dollars`,
  );
  // Percent sign → word.
  s = s.replace(/(\d)\s?%/g, "$1 percent");
  // Group any remaining bare 4+ digit integers with thousands separators so they
  // read as cardinals, not digit strings. Skip decimals, already-grouped numbers,
  // digits embedded in an identifier (e.g. "model3594" — LETTERS are in the lookarounds
  // too, so it's left alone), and year-like 4-digit values (1900–2099) so dates stay natural.
  s = s.replace(/(?<![\dA-Za-z,.])\d{4,}(?![\dA-Za-z,.])/g, (m) => {
    if (m.length === 4) {
      const n = Number(m);
      if (n >= 1900 && n <= 2099) return m; // leave years alone
    }
    return Number(m).toLocaleString("en-US");
  });
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Index just past the LAST sentence terminator that is safe to cut on: a `.`/`!`/`?`
 * immediately followed by whitespace, or a newline. The trailing-whitespace requirement is
 * what protects numbers — the `.` inside "$1,234.56" is followed by a digit, so it is never a
 * boundary. Returns 0 when the buffer holds no complete sentence yet.
 */
function lastSafeBoundary(s: string, from = 0): number {
  let cut = 0;
  const re = /[.!?](?=\s)|\n/g;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) cut = m.index + 1;
  return cut;
}

/**
 * Buffer the orchestrator's text deltas and yield speech-clean text, flushing one complete
 * sentence at a time so `toSpokenText` only ever runs on whole sentences. Any remainder (a
 * final sentence with no trailing space, or a no-punctuation reply) is flushed at the end.
 * Cancellation/teardown is handled by the upstream generator + the consuming ReadableStream;
 * this is a pure transform.
 */
export async function* normalizeSpeechStream(
  src: AsyncGenerator<string>,
): AsyncGenerator<string> {
  let buf = "";
  // Chars of `buf` already scanned without finding a boundary. A fresh boundary can only
  // appear in the newly-appended text (or at the prior edge, e.g. a "." now followed by new
  // whitespace), so we resume the scan one char back instead of re-scanning the whole buffer
  // every delta — keeps the per-turn work O(n), not O(n²).
  let scanned = 0;
  try {
    for await (const chunk of src) {
      buf += chunk;
      const cut = lastSafeBoundary(buf, Math.max(0, scanned - 1));
      if (cut > 0) {
        const ready = toSpokenText(buf.slice(0, cut));
        if (ready) yield `${ready} `;
        buf = buf.slice(cut);
        scanned = 0;
      } else {
        scanned = buf.length;
      }
    }
  } catch (e) {
    // Upstream errored MID-stream (e.g. the orchestrator's `error` SSE frame). Flush whatever
    // we'd buffered so the partial answer is still spoken, THEN re-throw so buildReplyStream's
    // error handling runs. Because we just yielded the partial, its `deltas` count is > 0, so it
    // keeps the partial and does NOT append the "I hit a problem" apology — preserving the
    // pre-buffering behavior. On barge-in the consumer calls .return() (not a throw), so this
    // catch never runs and we never enqueue into a torn-down stream.
    const partial = toSpokenText(buf);
    if (partial) yield partial;
    throw e;
  }
  const tail = toSpokenText(buf);
  if (tail) yield tail;
}
