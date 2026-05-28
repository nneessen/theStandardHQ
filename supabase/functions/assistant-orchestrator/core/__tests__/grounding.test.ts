import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  assessGrounding,
  collectAvailability,
  containsFigures,
} from "../grounding.ts";

// Mirrors getDailyBriefingData's nested { sections: { x: {available} } } shape.
const briefing = (avail: boolean) => ({
  sections: {
    teamProduction: avail
      ? { available: true, data: { teams: [{ ap: 1 }] } }
      : { available: false, reason: "no_data" },
    policyRisk: { available: false, reason: "no_data" },
  },
});

Deno.test("collectAvailability finds nested section flags", () => {
  assertEquals(collectAvailability(briefing(true)), [true, false]);
  assertEquals(collectAvailability(briefing(false)), [false, false]);
});

Deno.test(
  "collectAvailability ignores non-section outputs (drafts/errors)",
  () => {
    assertEquals(
      collectAvailability({ ok: true, actionRequestId: "x", channel: "email" }),
      [],
    );
    assertEquals(collectAvailability({ error: "tool failed" }), []);
  },
);

Deno.test(
  "containsFigures matches stats but not years/counts/durations",
  () => {
    // Should match — figure-like.
    assertEquals(containsFigures("You're at $12,500 in AP."), true);
    assertEquals(containsFigures("Placement rate is 82%."), true);
    assertEquals(containsFigures("1,234 policies in force."), true);
    assertEquals(containsFigures("Average premium 87.50."), true);
    // Should NOT match — safe in a "no data" disclaimer.
    assertEquals(containsFigures("No data sources are connected yet."), false);
    assertEquals(containsFigures("Let's revisit in 2026."), false);
    assertEquals(containsFigures("Here are 3 steps to connect data."), false);
    assertEquals(containsFigures("Check back in 10 minutes."), false);
  },
);

Deno.test("warns: figures stated when every section was unavailable", () => {
  const s = assessGrounding(
    [briefing(false)],
    "You wrote $12,500 in AP this week.",
  );
  assertEquals(s.ranGroundingTools, true);
  assertEquals(s.anyDataAvailable, false);
  assertEquals(s.ungroundedNumericWarning, true);
});

Deno.test("no warn: data was available (figures are grounded)", () => {
  const s = assessGrounding([briefing(true)], "Your team AP is $12,500.");
  assertEquals(s.anyDataAvailable, true);
  assertEquals(s.ungroundedNumericWarning, false);
});

Deno.test("no warn: all unavailable but reply states no figures", () => {
  const s = assessGrounding(
    [briefing(false)],
    "I don't have production data connected for your account yet.",
  );
  assertEquals(s.ranGroundingTools, true);
  assertEquals(s.ungroundedNumericWarning, false);
});

Deno.test("no warn: no grounding tools ran this turn (e.g. draft-only)", () => {
  const s = assessGrounding(
    [{ ok: true, actionRequestId: "x", channel: "email" }],
    "Drafted your follow-up to the $500 deductible question.",
  );
  assertEquals(s.ranGroundingTools, false);
  assertEquals(s.ungroundedNumericWarning, false);
});
