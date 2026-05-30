import { describe, expect, it } from "vitest";
import { takeSentence } from "../sentences";

// Helper: fully segment a buffer the way the voice pipeline does — repeatedly
// take sentences, then flush the trimmed remainder at the end.
function segment(buf: string): string[] {
  const out: string[] = [];
  let rest = buf;
  for (;;) {
    const s = takeSentence(rest);
    if (!s) break;
    out.push(s.text);
    rest = s.rest;
  }
  const tail = rest.trim();
  if (tail) out.push(tail);
  return out;
}

describe("takeSentence", () => {
  it("splits on . ! ? followed by whitespace", () => {
    expect(segment("You have 5 hot leads. Call them now! Ready?")).toEqual([
      "You have 5 hot leads.",
      "Call them now!",
      "Ready?",
    ]);
  });

  it("does not split decimals or currency", () => {
    expect(segment("Your AP is $1.5M this month. Nice.")).toEqual([
      "Your AP is $1.5M this month.",
      "Nice.",
    ]);
  });

  it("does not split common abbreviations", () => {
    expect(segment("Call Dr. Smith and Mr. Jones today.")).toEqual([
      "Call Dr. Smith and Mr. Jones today.",
    ]);
  });

  it("does not split a mid-token dot when no whitespace follows (3.5)", () => {
    expect(segment("The rate is 3.5 percent overall")).toEqual([
      "The rate is 3.5 percent overall",
    ]);
  });

  it("KNOWN LIMITATION: a single-letter abbreviation like U.S. splits early", () => {
    // The abbreviation guard only covers multi-letter words, so "U.S. " is treated
    // as a boundary. This is an acceptable extra pause for the voice pipeline, not
    // a correctness bug — documented here so the behavior is intentional.
    expect(segment("They moved to the U.S. last year.")).toEqual([
      "They moved to the U.S.",
      "last year.",
    ]);
  });

  it("treats a newline as a hard boundary", () => {
    expect(segment("First line\nSecond line")).toEqual([
      "First line",
      "Second line",
    ]);
  });

  it("returns null until a boundary is confirmable (waits for more input)", () => {
    // A period at the very end could be a decimal/abbreviation — wait.
    expect(takeSentence("You have 5 leads.")).toBeNull();
    // Once whitespace arrives, the boundary is confirmed.
    const s = takeSentence("You have 5 leads. ");
    expect(s?.text).toBe("You have 5 leads.");
  });

  it("keeps trailing closers with the sentence boundary", () => {
    expect(segment('He said "Done!" Next up.')).toEqual([
      'He said "Done!"',
      "Next up.",
    ]);
  });

  it("flushes the remainder as the final sentence even without punctuation", () => {
    expect(segment("just a fragment")).toEqual(["just a fragment"]);
  });
});
