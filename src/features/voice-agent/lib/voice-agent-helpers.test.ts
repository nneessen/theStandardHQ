import { describe, expect, it } from "vitest";
import {
  normalizeNextActionKey,
  parseVoiceSnapshot,
} from "./voice-agent-helpers";

describe("parseVoiceSnapshot", () => {
  it("returns null for non-object values", () => {
    expect(parseVoiceSnapshot(null)).toBeNull();
    expect(parseVoiceSnapshot(undefined)).toBeNull();
    expect(parseVoiceSnapshot("string")).toBeNull();
    expect(parseVoiceSnapshot(42)).toBeNull();
    expect(parseVoiceSnapshot([])).toBeNull();
  });

  it("returns null when status is not a string", () => {
    expect(parseVoiceSnapshot({ status: 123 })).toBeNull();
    expect(parseVoiceSnapshot({ status: true })).toBeNull();
  });

  it("returns null when includedMinutes is not a number", () => {
    expect(parseVoiceSnapshot({ includedMinutes: "500" })).toBeNull();
  });

  it("returns null when usage is not an object", () => {
    expect(parseVoiceSnapshot({ usage: "bad" })).toBeNull();
    expect(parseVoiceSnapshot({ usage: 42 })).toBeNull();
  });

  it("parses a valid snapshot with no usage", () => {
    const result = parseVoiceSnapshot({
      status: "active",
      includedMinutes: 500,
    });
    expect(result).toEqual({ status: "active", includedMinutes: 500 });
  });

  it("sanitizes usage sub-fields that are not numbers", () => {
    const result = parseVoiceSnapshot({
      status: "active",
      usage: {
        outboundCalls: "not-a-number",
        inboundCalls: null,
        answeredCalls: undefined,
        usedMinutes: NaN,
        remainingMinutes: Infinity,
      },
    });

    expect(result).not.toBeNull();
    expect(result!.usage).toEqual({
      outboundCalls: 0,
      inboundCalls: 0,
      answeredCalls: 0,
      usedMinutes: 0,
      remainingMinutes: 0,
    });
  });

  it("preserves valid numeric usage fields", () => {
    const result = parseVoiceSnapshot({
      status: "trialing",
      usage: {
        outboundCalls: 12,
        inboundCalls: 5,
        answeredCalls: 14,
        usedMinutes: 42,
        remainingMinutes: 458,
      },
    });

    expect(result).not.toBeNull();
    expect(result!.usage).toEqual({
      outboundCalls: 12,
      inboundCalls: 5,
      answeredCalls: 14,
      usedMinutes: 42,
      remainingMinutes: 458,
    });
  });

  it("handles empty object as valid snapshot with no fields", () => {
    const result = parseVoiceSnapshot({});
    expect(result).toEqual({});
  });

  it("rejects usage when it is an array", () => {
    expect(parseVoiceSnapshot({ usage: [1, 2, 3] })).toBeNull();
  });
});

describe("normalizeNextActionKey", () => {
  it("returns 'unknown' for null/undefined/empty", () => {
    expect(normalizeNextActionKey(null)).toBe("unknown");
    expect(normalizeNextActionKey(undefined)).toBe("unknown");
    expect(normalizeNextActionKey("")).toBe("unknown");
    expect(normalizeNextActionKey("   ")).toBe("unknown");
  });

  it("recognizes all known action keys", () => {
    const knownKeys = [
      "activate_trial",
      "resolve_billing",
      "resolve_suspension",
      "replenish_minutes",
      "reactivate_voice",
      "activate_voice",
      "connect_close",
      "create_agent",
      "wait_for_provisioning",
      "repair_agent",
      "publish_agent",
      "connect_calendar",
      "review_guardrails",
    ];

    for (const key of knownKeys) {
      expect(normalizeNextActionKey(key)).toBe(key);
    }
  });

  it("normalizes case and whitespace", () => {
    expect(normalizeNextActionKey("  ACTIVATE_TRIAL  ")).toBe("activate_trial");
    expect(normalizeNextActionKey("Publish_Agent")).toBe("publish_agent");
  });

  it("returns 'unknown' for unrecognized backend keys", () => {
    expect(normalizeNextActionKey("upgrade_plan")).toBe("unknown");
    expect(normalizeNextActionKey("some_future_key")).toBe("unknown");
    expect(normalizeNextActionKey("activate_trial_v2")).toBe("unknown");
  });
});
