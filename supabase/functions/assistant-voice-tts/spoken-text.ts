// Pure markdown→speech normalizer, isolated from index.ts (which calls serve())
// so it stays offline-testable via `deno test`.

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
  s = s.replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (_m, num: string) => `${num} dollars`);
  // Percent sign → word.
  s = s.replace(/(\d)\s?%/g, "$1 percent");
  // Group any remaining bare 4+ digit integers with thousands separators so they
  // read as cardinals, not digit strings. Skip decimals, already-grouped numbers
  // (lookarounds), and year-like 4-digit values (1900–2099) so dates stay natural.
  s = s.replace(/(?<![\d,.])\d{4,}(?![\d,.])/g, (m) => {
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
