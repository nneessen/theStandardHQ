import { describe, expect, it } from "vitest";
import {
  assertNoVoiceActionParams,
  isVoiceAgentProvisioned,
  isVoiceAgentProvisioningPending,
  parseAddRetellVoiceParams,
  parseCreateVoiceAgentParams,
  parseRetellAgentUpdateParams,
  parseRetellConnectionParams,
  parseRetellLlmUpdateParams,
  parseRetellSearchParams,
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

  it("requires empty params for no-body voice actions", () => {
    expect(() =>
      assertNoVoiceActionParams({}, "Publish request"),
    ).not.toThrow();
    expect(() =>
      assertNoVoiceActionParams({ nope: true }, "Publish request"),
    ).toThrow(/unsupported fields/i);
  });
});
