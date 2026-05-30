// Sentence segmentation for the voice TTS pipeline. Deliberately dumb: a wrong
// split is an awkward pause, never a correctness bug. We flush on a `.!?` (or a
// newline) followed by whitespace, guarding the common false positives —
// decimals ("$1.5M"), mid-token dots ("U.S."), and a small abbreviation set.

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "sr",
  "jr",
  "vs",
  "st",
  "mt",
  "etc",
  "inc",
  "ltd",
  "co",
  "no",
  "approx",
  "dept",
  "est",
]);

const SENTENCE_ENDERS = new Set([".", "!", "?"]);
const CLOSERS = /[)"'\]]/;

/**
 * Pulls the first complete sentence off the front of `buf`.
 *
 * @returns `{ text, rest }` when a sentence boundary is found, or `null` when the
 *   buffer doesn't yet contain a confirmable boundary (caller keeps buffering and
 *   flushes the remainder when the stream ends).
 */
export function takeSentence(
  buf: string,
): { text: string; rest: string } | null {
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];

    // A newline is always a hard boundary (paragraph / list item).
    if (c === "\n") {
      const text = buf.slice(0, i).trim();
      const rest = buf.slice(i + 1);
      if (text) return { text, rest };
      continue; // collapse leading newlines
    }

    if (!SENTENCE_ENDERS.has(c)) continue;

    // Consume trailing closers: `leads.)` / `"done!"`.
    let j = i + 1;
    while (j < buf.length && CLOSERS.test(buf[j])) j++;

    const next = buf[j];
    // Boundary sits at the very end — can't confirm it's not a decimal /
    // abbreviation / mid-token dot yet. Wait for more (or the final flush).
    if (next === undefined) return null;
    // Not actually a boundary (e.g. "3.5", "U.S.") — keep scanning.
    if (!/\s/.test(next)) continue;

    // Abbreviation guard: "Dr. Smith" isn't two sentences.
    if (c === ".") {
      const word = buf.slice(0, i).match(/([A-Za-z]+)$/);
      if (word && ABBREVIATIONS.has(word[1].toLowerCase())) continue;
    }

    const text = buf.slice(0, j).trim();
    const rest = buf.slice(j);
    if (!text) continue;
    return { text, rest };
  }
  return null;
}
