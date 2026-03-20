import { describe, expect, it } from "vitest";

import {
  buildStructuredRetellAgentForm,
  diffStructuredRetellAgentForm,
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
