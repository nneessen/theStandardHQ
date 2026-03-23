import { describe, expect, it } from "vitest";
import {
  assertNoVoiceActionParams,
  isVoiceAgentProvisioned,
  isVoiceAgentProvisioningPending,
  parseAddRetellVoiceParams,
  parseConnectCloseParams,
  parseCreateVoiceAgentParams,
  parseRetellAgentUpdateParams,
  parseRetellConnectionParams,
  parseRetellLlmUpdateParams,
  parseRetellSearchParams,
  parseVoiceCloneScripts,
} from "./voice-agent-contract";

describe("voice-agent-contract", () => {
  it("validates create voice agent params strictly", () => {
    expect(
      parseCreateVoiceAgentParams({ templateKey: "default_sales" }),
    ).toEqual({
      templateKey: "default_sales",
    });

    expect(() =>
      parseCreateVoiceAgentParams({
        templateKey: "default_sales",
        unexpected: true,
      }),
    ).toThrow(/unsupported fields/i);
  });

  it("validates manual voice connection params", () => {
    expect(
      parseRetellConnectionParams({
        apiKey: "rtk_123",
        retellAgentId: "agent_123",
        fromNumberSource: "close",
        closePhoneNumber: "+15551234567",
      }),
    ).toEqual({
      apiKey: "rtk_123",
      retellAgentId: "agent_123",
      fromNumberSource: "close",
      closePhoneNumber: "+15551234567",
    });

    expect(() =>
      parseRetellConnectionParams({
        apiKey: "rtk_123",
        retellAgentId: "agent_123",
        fromNumberSource: "close",
      }),
    ).toThrow(/close caller id is required/i);
  });

  it("rejects unsupported voice patch keys", () => {
    expect(
      parseRetellAgentUpdateParams({
        patch: {
          voice_id: "voice_123",
          language: "en-US",
        },
      }),
    ).toEqual({
      patch: {
        voice_id: "voice_123",
        language: "en-US",
      },
    });

    expect(() =>
      parseRetellAgentUpdateParams({
        patch: {
          api_key: "secret",
        },
      }),
    ).toThrow(/unsupported fields/i);

    expect(() =>
      parseRetellLlmUpdateParams({
        patch: {
          general_prompt: "hello",
          system_message: "nope",
        },
      }),
    ).toThrow(/unsupported fields/i);
  });

  it("validates voice search and import params", () => {
    expect(
      parseRetellSearchParams({
        searchQuery: "allison",
        voiceProvider: "elevenlabs",
      }),
    ).toEqual({
      searchQuery: "allison",
      voiceProvider: "elevenlabs",
    });

    expect(
      parseAddRetellVoiceParams({
        providerVoiceId: "voice_provider_123",
        voiceName: "Allison",
      }),
    ).toEqual({
      providerVoiceId: "voice_provider_123",
      voiceName: "Allison",
      voiceProvider: "elevenlabs",
    });
  });

  it("recognizes provisioning and ready statuses", () => {
    expect(isVoiceAgentProvisioningPending("pending")).toBe(true);
    expect(isVoiceAgentProvisioningPending("creating")).toBe(true);
    expect(isVoiceAgentProvisioned("ready")).toBe(true);
    expect(isVoiceAgentProvisioned("linked")).toBe(true);
    expect(isVoiceAgentProvisioningPending("ready")).toBe(false);
  });

  it("validates connect close params with strict allowlist", () => {
    expect(parseConnectCloseParams({ apiKey: "api_abc123" })).toEqual({
      apiKey: "api_abc123",
    });

    expect(() => parseConnectCloseParams({})).toThrow(/required/i);
    expect(() => parseConnectCloseParams({ apiKey: "  " })).toThrow(
      /required/i,
    );
    expect(() =>
      parseConnectCloseParams({ apiKey: "api_123", billingExempt: true }),
    ).toThrow(/unsupported fields/i);
    expect(() =>
      parseConnectCloseParams({ apiKey: "api_123", isActive: true }),
    ).toThrow(/unsupported fields/i);
  });

  it("requires empty params for no-body voice actions", () => {
    expect(() =>
      assertNoVoiceActionParams({}, "Publish request"),
    ).not.toThrow();
    expect(() =>
      assertNoVoiceActionParams({ nope: true }, "Publish request"),
    ).toThrow(/unsupported fields/i);
  });

  describe("parseVoiceCloneScripts", () => {
    function makeScript(index: number, overrides?: Record<string, unknown>) {
      return {
        segmentIndex: index,
        category: "Test",
        title: `Script ${index + 1}`,
        scriptText: `Content for script ${index + 1}`,
        minDurationSeconds: 120,
        targetDurationSeconds: 300,
        optional: false,
        ...overrides,
      };
    }

    function makeScripts(count: number) {
      return Array.from({ length: count }, (_, i) => makeScript(i));
    }

    it("accepts a valid array of 15-25 scripts", () => {
      const result = parseVoiceCloneScripts(makeScripts(20));
      expect(result).toHaveLength(20);
      expect(result[0].segmentIndex).toBe(0);
      expect(result[19].segmentIndex).toBe(19);
    });

    it("accepts exactly 15 scripts (minimum)", () => {
      expect(() => parseVoiceCloneScripts(makeScripts(15))).not.toThrow();
    });

    it("accepts exactly 25 scripts (maximum)", () => {
      expect(() => parseVoiceCloneScripts(makeScripts(25))).not.toThrow();
    });

    it("rejects fewer than 15 scripts", () => {
      expect(() => parseVoiceCloneScripts(makeScripts(14))).toThrow(
        /15-25 entries/,
      );
    });

    it("rejects more than 25 scripts", () => {
      expect(() => parseVoiceCloneScripts(makeScripts(26))).toThrow(
        /15-25 entries/,
      );
    });

    it("rejects non-array input", () => {
      expect(() => parseVoiceCloneScripts("not an array")).toThrow(
        /must be an array/,
      );
      expect(() => parseVoiceCloneScripts(null)).toThrow(/must be an array/);
    });

    it("requires sequential 0-indexed segmentIndex", () => {
      const scripts = makeScripts(15);
      scripts[3] = makeScript(3, { segmentIndex: 99 });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /segmentIndex must be 3/,
      );
    });

    it("requires category, title, and scriptText", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, { category: "" });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /category is required/,
      );

      scripts[0] = makeScript(0, { title: "" });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /title is required/,
      );

      scripts[0] = makeScript(0, { scriptText: "" });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /scriptText is required/,
      );
    });

    it("rejects scriptText over 10000 characters", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, { scriptText: "x".repeat(10001) });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /10000 character limit/,
      );
    });

    it("requires minDurationSeconds >= 30", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, { minDurationSeconds: 10 });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /minDurationSeconds must be >= 30/,
      );
    });

    it("requires targetDurationSeconds >= minDurationSeconds", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, {
        minDurationSeconds: 120,
        targetDurationSeconds: 60,
      });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /targetDurationSeconds must be >= minDurationSeconds/,
      );
    });

    it("requires optional to be boolean", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, { optional: "yes" });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /optional must be a boolean/,
      );
    });

    it("rejects unknown fields", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, { billingExempt: true });
      expect(() => parseVoiceCloneScripts(scripts)).toThrow(
        /unsupported fields.*billingExempt/,
      );
    });

    it("trims string fields in output", () => {
      const scripts = makeScripts(15);
      scripts[0] = makeScript(0, {
        category: "  Test  ",
        title: "  Title  ",
        scriptText: "  Content  ",
      });
      const result = parseVoiceCloneScripts(scripts);
      expect(result[0].category).toBe("Test");
      expect(result[0].title).toBe("Title");
      expect(result[0].scriptText).toBe("Content");
    });
  });
});
