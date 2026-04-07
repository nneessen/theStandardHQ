// Unit tests for sequence-utils — covers the day-label formatter, gap math,
// and channel counts used by the sequence builder UI.

import { describe, expect, it } from "vitest";
import {
  formatDayLabel,
  gapFromPrevious,
  countStepsByChannel,
  CLOSE_MUSTACHE_VARIABLES,
} from "../lib/sequence-utils";
import type { GeneratedSequence } from "../types/close-ai-builder.types";

describe("formatDayLabel", () => {
  it('labels day 1 as "immediate"', () => {
    expect(formatDayLabel(1)).toBe("Day 1 (immediate)");
  });

  it("clamps day 0 and negative days to the immediate label", () => {
    expect(formatDayLabel(0)).toBe("Day 1 (immediate)");
    expect(formatDayLabel(-5)).toBe("Day 1 (immediate)");
  });

  it("formats day > 1 as plain Day N", () => {
    expect(formatDayLabel(2)).toBe("Day 2");
    expect(formatDayLabel(30)).toBe("Day 30");
  });
});

describe("gapFromPrevious", () => {
  it("returns 0 when there is no previous step (first step)", () => {
    expect(gapFromPrevious(1, null)).toBe(0);
    expect(gapFromPrevious(5, null)).toBe(0);
  });

  it("returns the day difference between consecutive steps", () => {
    expect(gapFromPrevious(3, 1)).toBe(2);
    expect(gapFromPrevious(7, 3)).toBe(4);
    expect(gapFromPrevious(9, 6)).toBe(3);
  });

  it("clamps backward-in-time gaps to 0", () => {
    expect(gapFromPrevious(1, 5)).toBe(0);
  });

  it("returns 0 when days are equal (same-day follow-up)", () => {
    expect(gapFromPrevious(3, 3)).toBe(0);
  });
});

describe("countStepsByChannel", () => {
  const makeSeq = (steps: GeneratedSequence["steps"]): GeneratedSequence => ({
    name: "test",
    timezone: "America/New_York",
    steps,
  });

  it("counts zero when steps are empty", () => {
    expect(countStepsByChannel(makeSeq([]))).toEqual({
      emailCount: 0,
      smsCount: 0,
    });
  });

  it("counts email-only sequences correctly", () => {
    const seq = makeSeq([
      {
        step_type: "email",
        day: 1,
        generated_email: { name: "n", subject: "s", body: "b" },
      },
      {
        step_type: "email",
        day: 3,
        generated_email: { name: "n", subject: "s", body: "b" },
      },
    ]);
    expect(countStepsByChannel(seq)).toEqual({ emailCount: 2, smsCount: 0 });
  });

  it("counts mixed email + sms sequences", () => {
    const seq = makeSeq([
      {
        step_type: "email",
        day: 1,
        generated_email: { name: "n", subject: "s", body: "b" },
      },
      { step_type: "sms", day: 3, generated_sms: { name: "n", text: "t" } },
      { step_type: "sms", day: 5, generated_sms: { name: "n", text: "t" } },
      {
        step_type: "email",
        day: 7,
        generated_email: { name: "n", subject: "s", body: "b" },
      },
    ]);
    expect(countStepsByChannel(seq)).toEqual({ emailCount: 2, smsCount: 2 });
  });
});

describe("CLOSE_MUSTACHE_VARIABLES", () => {
  it("includes the core personalization variables", () => {
    const values = CLOSE_MUSTACHE_VARIABLES.map((v) => v.value);
    expect(values).toContain("{{ contact.first_name }}");
    expect(values).toContain("{{ lead.display_name }}");
    expect(values).toContain("{{ user.first_name }}");
  });

  it("uses properly-formatted mustache syntax (double braces with spaces)", () => {
    for (const v of CLOSE_MUSTACHE_VARIABLES) {
      expect(v.value).toMatch(/^\{\{ [a-z_.0-9]+ \}\}$/);
    }
  });
});
