import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoiceAgentStatusCard } from "./VoiceAgentStatusCard";

describe("VoiceAgentStatusCard", () => {
  it("shows access-required setup copy from setup-state", () => {
    render(
      <VoiceAgentStatusCard
        hasVoiceAddon={false}
        syncStatus={null}
        lastSyncedAt={null}
        lastSyncAttemptAt={null}
        lastSyncHttpStatus={null}
        voiceEntitlement={null}
        voiceSetupState={{
          agent: {
            exists: false,
            provisioningStatus: "not_created",
            published: false,
          },
          readiness: {
            entitlementActive: false,
          },
          connections: {
            close: {
              connected: false,
            },
            retell: {
              connected: false,
            },
          },
          nextAction: {
            key: "activate_voice",
            label: "Activate voice",
            description: "Voice is not activated yet.",
          },
        }}
        snapshot={null}
        showServiceWarning={false}
        retellConnected={false}
      />,
    );

    expect(screen.getByText("Voice access required")).toBeInTheDocument();
    expect(screen.getByText("Not yet assigned")).toBeInTheDocument();
  });

  it("shows published state when setup-state says the agent is live", () => {
    render(
      <VoiceAgentStatusCard
        hasVoiceAddon
        syncStatus="synced"
        lastSyncedAt={null}
        lastSyncAttemptAt={null}
        lastSyncHttpStatus={null}
        voiceEntitlement={null}
        voiceSetupState={{
          agent: {
            exists: true,
            provisioningStatus: "ready",
            published: true,
          },
          readiness: {
            entitlementActive: true,
          },
          connections: {
            close: {
              connected: true,
              orgName: "Close Test Org",
            },
            retell: {
              connected: true,
              retellAgentId: "agent_123",
            },
          },
          nextAction: {
            key: "review_guardrails",
            label: "Review guardrails",
            description: "Review launch settings.",
          },
          entitlement: {
            agentId: "agent_123",
            status: "active",
            planCode: "voice_pro_v1",
            includedMinutes: 500,
            hardLimitMinutes: 500,
            cycleStartAt: null,
            cycleEndAt: null,
            cancelAt: null,
            canceledAt: null,
            features: {
              missedAppointment: false,
              reschedule: false,
              quotedFollowup: false,
              afterHoursInbound: false,
            },
            usage: {
              outboundCalls: 0,
              inboundCalls: 0,
              answeredCalls: 0,
              usedMinutes: 0,
              remainingMinutes: 500,
            },
          },
        }}
        snapshot={null}
        showServiceWarning={false}
        retellConnected
      />,
    );

    expect(screen.getByText("Published and live")).toBeInTheDocument();
    expect(screen.getByText("Assigned to this workspace")).toBeInTheDocument();
  });
});
