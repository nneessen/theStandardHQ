import { describe, expect, it } from "vitest";

import {
  buildStructuredRetellAgentForm,
  diffStructuredRetellAgentForm,
  extractGreetingsFromDynamicVariables,
  mergeGreetingsIntoDynamicVariables,
  validateStructuredRetellAgentForm,
  validateStructuredRetellLlmForm,
} from "./retell-studio";

describe("retell studio helpers", () => {
  it("builds structured agent form state from editable Retell agent fields", () => {
    const form = buildStructuredRetellAgentForm({
      voice_id: "voice_123",
      voice_speed: 1.1,
      webhook_events: ["call_started", "call_ended"],
      allow_user_dtmf: true,
      boosted_keywords: ["insurance", "medicare"],
    });

    expect(form.voiceId).toBe("voice_123");
    expect(form.voiceSpeed).toBe("1.1");
    expect(form.webhookEvents).toBe("call_started\ncall_ended");
    expect(form.allowUserDtmf).toBe(true);
    expect(form.boostedKeywords).toBe("insurance\nmedicare");
  });

  it("diffs structured agent forms and preserves field clears as null", () => {
    const baseline = buildStructuredRetellAgentForm({
      voice_id: "voice_123",
      webhook_url: "https://example.com/webhook",
      allow_user_dtmf: false,
    });

    const current = {
      ...baseline,
      voiceId: "voice_456",
      webhookUrl: "",
      allowUserDtmf: true,
    };

    expect(diffStructuredRetellAgentForm(current, baseline)).toEqual({
      voice_id: "voice_456",
      webhook_url: null,
      allow_user_dtmf: true,
    });
  });

  it("validates structured agent fields before save", () => {
    const errors = validateStructuredRetellAgentForm({
      ...buildStructuredRetellAgentForm(null),
      voiceSpeed: "5",
      webhookUrl: "ftp://example.com/webhook",
    });

    expect(errors).toContain("Voice speed must be 4 or less.");
    expect(errors).toContain(
      "Webhook URL must be a valid http:// or https:// URL.",
    );
  });

  it("validates JSON-backed LLM fields before save", () => {
    const errors = validateStructuredRetellLlmForm({
      generalPrompt: "Prompt",
      beginMessage: "",
      model: "gpt-4o-mini",
      modelTemperature: "0.7",
      beginAfterUserSilenceMs: "500",
      knowledgeBaseIds: "kb_123",
      toolCallStrictMode: false,
      defaultDynamicVariables: "[]",
      generalTools: "{",
      mcps: "[]",
    });

    expect(errors).toContain(
      "Default dynamic variables must be a JSON object.",
    );
    expect(errors).toContain("Functions must be valid JSON.");
  });
});

describe("extractGreetingsFromDynamicVariables", () => {
  it("returns empty object for empty string", () => {
    expect(extractGreetingsFromDynamicVariables("")).toEqual({});
  });

  it("returns empty object for malformed JSON", () => {
    expect(extractGreetingsFromDynamicVariables("{bad}")).toEqual({});
  });

  it("returns empty object for JSON array", () => {
    expect(extractGreetingsFromDynamicVariables("[]")).toEqual({});
  });

  it("extracts greeting_ prefixed keys and strips prefix", () => {
    const input = JSON.stringify({
      greeting_general_inbound: "Hi there",
      greeting_missed_appointment: "Hey {{lead_name}}",
      workflow_type: "general_inbound",
    });
    expect(extractGreetingsFromDynamicVariables(input)).toEqual({
      general_inbound: "Hi there",
      missed_appointment: "Hey {{lead_name}}",
    });
  });

  it("ignores non-string greeting values", () => {
    const input = JSON.stringify({
      greeting_general_inbound: "Hi",
      greeting_bad: 42,
      greeting_also_bad: null,
    });
    expect(extractGreetingsFromDynamicVariables(input)).toEqual({
      general_inbound: "Hi",
    });
  });
});

describe("mergeGreetingsIntoDynamicVariables", () => {
  it("creates JSON from empty base", () => {
    const result = mergeGreetingsIntoDynamicVariables("", {
      general_inbound: "Hello",
    });
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ greeting_general_inbound: "Hello" });
  });

  it("preserves non-greeting keys", () => {
    const base = JSON.stringify({ workflow_type: "test", foo: "bar" });
    const result = mergeGreetingsIntoDynamicVariables(base, {
      general_inbound: "Hi",
    });
    const parsed = JSON.parse(result);
    expect(parsed.workflow_type).toBe("test");
    expect(parsed.foo).toBe("bar");
    expect(parsed.greeting_general_inbound).toBe("Hi");
  });

  it("replaces old greeting keys with new ones", () => {
    const base = JSON.stringify({
      greeting_general_inbound: "Old greeting",
      greeting_stale_key: "Should be removed",
    });
    const result = mergeGreetingsIntoDynamicVariables(base, {
      general_inbound: "New greeting",
    });
    const parsed = JSON.parse(result);
    expect(parsed.greeting_general_inbound).toBe("New greeting");
    expect(parsed.greeting_stale_key).toBeUndefined();
  });

  it("excludes empty greeting values", () => {
    const result = mergeGreetingsIntoDynamicVariables("", {
      general_inbound: "Hi",
      missed_appointment: "",
      reschedule: "   ",
    });
    const parsed = JSON.parse(result);
    expect(parsed.greeting_general_inbound).toBe("Hi");
    expect(parsed.greeting_missed_appointment).toBeUndefined();
    expect(parsed.greeting_reschedule).toBeUndefined();
  });

  it("handles malformed base JSON gracefully", () => {
    const result = mergeGreetingsIntoDynamicVariables("{broken", {
      general_inbound: "Hi",
    });
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ greeting_general_inbound: "Hi" });
  });

  it("round-trips with extractGreetingsFromDynamicVariables", () => {
    const greetings = {
      general_inbound: "Hi, thanks for calling",
      missed_appointment: "Hey {{lead_name}}, this is {{agent_name}}",
    };
    const merged = mergeGreetingsIntoDynamicVariables("", greetings);
    const extracted = extractGreetingsFromDynamicVariables(merged);
    expect(extracted).toEqual(greetings);
  });
});
