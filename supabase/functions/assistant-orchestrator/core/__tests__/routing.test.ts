import { assertEquals } from "jsr:@std/assert@1";
import { routeToAgent } from "../routing.ts";

Deno.test("routes a briefing request to executive-briefing", () => {
  assertEquals(
    routeToAgent("Brief me on what needs my attention today"),
    "executive-briefing",
  );
});

Deno.test("defaults to executive-briefing for any input", () => {
  assertEquals(routeToAgent("show me the team"), "executive-briefing");
});

Deno.test("falls back to first enabled agent when default not enabled", () => {
  assertEquals(routeToAgent("hi", ["policy-risk"]), "policy-risk");
});
