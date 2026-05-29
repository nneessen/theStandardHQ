// Offline unit tests for toSpokenText — the markdown→speech normalizer. Runs with
//   deno test supabase/functions/assistant-voice-tts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { toSpokenText } from "../spoken-text.ts";

Deno.test("strips bold/italic/heading markers", () => {
  assertEquals(toSpokenText("**Hello** _there_ ## Title"), "Hello there Title");
});

Deno.test("keeps link label, drops url", () => {
  assertEquals(
    toSpokenText("See [the policy](https://x.com/p) now"),
    "See the policy now",
  );
});

Deno.test("unwraps inline and fenced code", () => {
  assertEquals(toSpokenText("Run `npm test` please"), "Run npm test please");
  assertEquals(toSpokenText("a ```block here``` b"), "a b");
});

Deno.test("expands abbreviated money", () => {
  assertEquals(
    toSpokenText("Premium is $1.5M total"),
    "Premium is 1.5 million dollars total",
  );
  assertEquals(toSpokenText("$2B in force"), "2 billion dollars in force");
  assertEquals(toSpokenText("$300K saved"), "300 thousand dollars saved");
});

Deno.test("expands plain money and strips commas", () => {
  assertEquals(
    toSpokenText("They owe $1,200 now"),
    "They owe 1200 dollars now",
  );
  assertEquals(toSpokenText("$45.50 fee"), "45.50 dollars fee");
});

Deno.test("speaks percent", () => {
  assertEquals(toSpokenText("Up 12% this week"), "Up 12 percent this week");
});

Deno.test("converts bullet lists into clause breaks", () => {
  assertEquals(
    toSpokenText("- first\n- second\n- third"),
    ", first , second , third",
  );
});

Deno.test("collapses whitespace and trims", () => {
  assertEquals(
    toSpokenText("  too    many   spaces \n\n here "),
    "too many spaces here",
  );
});
