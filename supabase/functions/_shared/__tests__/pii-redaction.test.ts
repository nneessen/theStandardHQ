// Run: deno test supabase/functions/_shared/__tests__/pii-redaction.test.ts
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildRedaction,
  mergeAndPadSpans,
  redactPlainText,
  regexPiiSubstrings,
  REDACTION_TOKEN,
  type RedactSegment,
  type RedactWord,
} from "../pii-redaction.ts";

// ── regexPiiSubstrings ──────────────────────────────────────────────────────
Deno.test("regex detects a formatted SSN", () => {
  const hits = regexPiiSubstrings("my social is 123-45-6789 thanks");
  assertEquals(hits.length, 1);
  assertEquals(hits[0].type, "ssn");
  assertEquals(hits[0].value, "123-45-6789");
});

Deno.test("regex detects a 16-digit card with spaces", () => {
  const hits = regexPiiSubstrings("the card is 4111 1111 1111 1111 ok");
  assert(hits.some((h) => h.type === "card"));
});

Deno.test("regex detects a long bare account/routing run", () => {
  const hits = regexPiiSubstrings("account number 123456789 routing 021000021");
  assert(hits.filter((h) => h.type === "number").length >= 1);
});

Deno.test("regex does NOT flag prices, ages, years, ZIPs", () => {
  assertEquals(regexPiiSubstrings("it's only $50,000 a year").length, 0);
  assertEquals(regexPiiSubstrings("I'm 45 and retired").length, 0);
  assertEquals(regexPiiSubstrings("back in 2026 we met").length, 0);
  assertEquals(regexPiiSubstrings("zip code is 90210").length, 0);
  assertEquals(regexPiiSubstrings("a $1,200 monthly premium").length, 0);
});

// ── mergeAndPadSpans ────────────────────────────────────────────────────────
Deno.test(
  "merge + pad: overlapping spans collapse, bounds clamp to [0, max]",
  () => {
    const merged = mergeAndPadSpans(
      [
        { start: 1.0, end: 1.5, type: "number" },
        { start: 1.6, end: 2.0, type: "number" }, // within pad+gap of the first
        { start: 10.0, end: 10.2, type: "ssn" },
      ],
      0.4,
      10.4,
    );
    assertEquals(merged.length, 2);
    assertEquals(merged[0].start, 0.6); // 1.0 - 0.4
    assert(merged[0].end >= 2.0); // absorbed the second span
    assertEquals(merged[1].end, 10.4); // clamped to max
  },
);

Deno.test("merge + pad: start never goes below zero", () => {
  const merged = mergeAndPadSpans([{ start: 0.1, end: 0.3, type: "ssn" }], 0.4);
  assertEquals(merged[0].start, 0);
});

// ── buildRedaction: end-to-end on Deepgram-shaped fixtures ──────────────────
function w(word: string, start: number, end: number, speaker = 1): RedactWord {
  return { word, punctuated_word: word, start, end, speaker };
}

Deno.test(
  "buildRedaction redacts an SSN in segment text and spans the digit word",
  () => {
    const segments: RedactSegment[] = [
      {
        id: 0,
        start: 0,
        end: 2,
        speaker: 1,
        text: "my social is 123-45-6789 okay",
      },
    ];
    const words: RedactWord[] = [
      w("my", 0, 0.2),
      w("social", 0.2, 0.5),
      w("is", 0.5, 0.6),
      w("123-45-6789", 0.6, 1.4),
      w("okay", 1.4, 1.6),
    ];
    const res = buildRedaction({ segments, words, durationSeconds: 2 });
    assert(res.segments[0].text!.includes(REDACTION_TOKEN));
    assert(!res.segments[0].text!.includes("123-45-6789"));
    assertEquals(res.redactedCount, 1);
    assertEquals(res.spans.length, 1);
    // digit word 0.6–1.4 padded by 0.4 → 0.2–1.8
    assertEquals(res.spans[0].start, 0.2);
    assertEquals(res.spans[0].end, 1.8);
  },
);

Deno.test(
  "buildRedaction uses Claude items for spelled-out PII and over-redacts the segment audio",
  () => {
    const segments: RedactSegment[] = [
      {
        id: 5,
        start: 4,
        end: 7,
        speaker: 1,
        text: "it's four five six seven eight nine",
      },
    ];
    // no digit words → regex finds nothing; Claude flags the spelled-out account.
    const words: RedactWord[] = [
      w("it's", 4, 4.3),
      w("four", 4.3, 4.6),
      w("five", 4.6, 4.9),
      w("six", 4.9, 5.2),
    ];
    const res = buildRedaction({
      segments,
      words,
      claudeItems: [
        {
          segment_id: 5,
          text: "four five six seven eight nine",
          type: "account",
        },
      ],
      durationSeconds: 8,
    });
    assert(res.segments[0].text!.includes(REDACTION_TOKEN));
    assert(!res.segments[0].text!.includes("four five six"));
    // whole-utterance span fallback (no digit words to pin)
    assertEquals(res.spans.length, 1);
    assertEquals(res.spans[0].start, 3.6); // 4 - 0.4
  },
);

Deno.test(
  "buildRedaction over-redacts the whole segment when a flagged item isn't locatable",
  () => {
    const segments: RedactSegment[] = [
      {
        id: 2,
        start: 1,
        end: 3,
        speaker: 1,
        text: "sure let me give you that",
      },
    ];
    const res = buildRedaction({
      segments,
      words: [],
      claudeItems: [{ segment_id: 2, text: "987-65-4321", type: "ssn" }],
    });
    assertEquals(res.segments[0].text, REDACTION_TOKEN);
    assertEquals(res.redactedCount, 1);
    assertEquals(res.spans.length, 1); // whole-segment span
    assertEquals(res.spans[0].start, 0.6); // 1 - 0.4
  },
);

Deno.test(
  "buildRedaction leaves clean segments untouched and rebuilds flat text",
  () => {
    const segments: RedactSegment[] = [
      { id: 0, start: 0, end: 1, speaker: 0, text: "thanks for calling" },
      {
        id: 1,
        start: 1,
        end: 3,
        speaker: 1,
        text: "my card is 4111111111111111",
      },
    ];
    const words: RedactWord[] = [w("4111111111111111", 1.2, 2.5)];
    const res = buildRedaction({ segments, words, durationSeconds: 3 });
    assertEquals(res.segments[0].text, "thanks for calling"); // untouched
    assert(res.segments[1].text!.includes(REDACTION_TOKEN));
    // flat transcript is re-joined from redacted segments — never leaks the card
    assert(!res.transcriptText.includes("4111111111111111"));
    assert(res.transcriptText.startsWith("thanks for calling"));
    assert(res.transcriptText.includes(REDACTION_TOKEN));
  },
);

Deno.test(
  "redactPlainText redacts an SSN in a flat string (no-segments fallback)",
  () => {
    const r = redactPlainText("caller said 123-45-6789 on the recording");
    assert(r.redacted);
    assert(!r.text.includes("123-45-6789"));
    assert(r.text.includes(REDACTION_TOKEN));
    // clean text is untouched
    assertEquals(redactPlainText("no sensitive data here").redacted, false);
  },
);

Deno.test("buildRedaction with no PII produces no spans and no changes", () => {
  const segments: RedactSegment[] = [
    {
      id: 0,
      start: 0,
      end: 2,
      speaker: 1,
      text: "I want a fifty thousand dollar policy",
    },
  ];
  const res = buildRedaction({ segments, words: [], durationSeconds: 2 });
  assertEquals(res.redactedCount, 0);
  assertEquals(res.spans.length, 0);
  assertEquals(res.segments[0].text, "I want a fifty thousand dollar policy");
});
