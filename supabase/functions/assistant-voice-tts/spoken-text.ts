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
  // Money: "$1.5M" → "1.5 million dollars", "$1,200" → "1200 dollars".
  s = s.replace(/\$\s?([\d,.]+)\s?([MmBbKk])\b/g, (_m, num, unit: string) => {
    const word =
      unit.toLowerCase() === "m"
        ? "million"
        : unit.toLowerCase() === "b"
          ? "billion"
          : "thousand";
    return `${num.replace(/,/g, "")} ${word} dollars`;
  });
  s = s.replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (_m, num: string) => {
    return `${num.replace(/,/g, "")} dollars`;
  });
  // Percent sign → word.
  s = s.replace(/(\d)\s?%/g, "$1 percent");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
