// buildSystemPrompt: the voice-mode directive is the PRIMARY fix for spoken-reply gibberish,
// so lock that it is appended only on voice turns and sits last (strongest instruction).
import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildSystemPrompt,
  VOICE_OUTPUT_DIRECTIVE,
  getAgent,
} from "../agents.ts";

const agent = getAgent("executive-briefing");

Deno.test("voice turn appends the voice directive LAST", () => {
  const prompt = buildSystemPrompt(agent, "Jarvis", undefined, undefined, true);
  assertStringIncludes(prompt, VOICE_OUTPUT_DIRECTIVE);
  // It must be the final block so it overrides earlier formatting guidance.
  assert(
    prompt.trimEnd().endsWith(VOICE_OUTPUT_DIRECTIVE.trimEnd()),
    "voice directive should be the last block of the system prompt",
  );
});

Deno.test("typed turn does NOT include the voice directive", () => {
  const prompt = buildSystemPrompt(
    agent,
    "Jarvis",
    undefined,
    undefined,
    false,
  );
  assert(
    !prompt.includes(VOICE_OUTPUT_DIRECTIVE),
    "typed turns must not get the spoken-output directive",
  );
  // Default (omitted flag) also stays typed.
  const dflt = buildSystemPrompt(agent, "Jarvis");
  assert(!dflt.includes(VOICE_OUTPUT_DIRECTIVE));
});
