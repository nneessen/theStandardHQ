import { assertEquals } from "jsr:@std/assert@1";
import { classifyIntent, routeToAgent } from "../routing.ts";

const ALL_WIRED = [
  "executive-briefing",
  "production-analyst",
  "policy-risk",
] as const;

Deno.test("classifyIntent maps explicit intents", () => {
  assertEquals(
    classifyIntent("Brief me on what needs my attention today"),
    "executive-briefing",
  );
  assertEquals(
    classifyIntent("what's our AP pace this month"),
    "production-analyst",
  );
  assertEquals(
    classifyIntent("which policies are at risk of chargeback?"),
    "policy-risk",
  );
  assertEquals(classifyIntent("hello there"), null);
});

Deno.test("classifyIntent: a general check-in beats domain keywords", () => {
  // Mentions production but is a general briefing request.
  assertEquals(classifyIntent("brief me on production"), "executive-briefing");
});

Deno.test("routes a briefing request to executive-briefing", () => {
  assertEquals(
    routeToAgent("Brief me on what needs my attention today", [...ALL_WIRED]),
    "executive-briefing",
  );
});

Deno.test("routes to the matched specialist when it is enabled", () => {
  assertEquals(
    routeToAgent("how is team production pacing?", [...ALL_WIRED]),
    "production-analyst",
  );
  assertEquals(
    routeToAgent("show me chargeback exposure", [...ALL_WIRED]),
    "policy-risk",
  );
});

Deno.test(
  "falls back to briefing when the matched specialist is NOT enabled",
  () => {
    assertEquals(
      routeToAgent("show me chargeback exposure", ["executive-briefing"]),
      "executive-briefing",
    );
  },
);

Deno.test("unmatched input goes to executive-briefing when enabled", () => {
  assertEquals(routeToAgent("show me the team"), "executive-briefing");
});

Deno.test("falls back to first enabled agent when default not enabled", () => {
  assertEquals(routeToAgent("hi", ["policy-risk"]), "policy-risk");
});
