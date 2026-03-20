import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoiceAgentUsageCard } from "./VoiceAgentUsageCard";

describe("VoiceAgentUsageCard", () => {
  it("uses usage data from setup-state when dedicated stats queries are empty", () => {
    render(
      <VoiceAgentUsageCard
        isLoading={false}
        launchIncludedMinutes={500}
        voiceSetupState={{
          agent: {
            exists: true,
            provisioningStatus: "ready",
            published: false,
          },
          readiness: {
            entitlementActive: true,
          },
          connections: {
            close: {
              connected: true,
            },
            retell: {
              connected: true,
            },
          },
          nextAction: {
            key: "publish_agent",
            label: "Publish",
            description: "Publish the draft.",
          },
          entitlement: {
            agentId: "agent_123",
            status: "trialing",
            planCode: "voice_pro_v1",
            includedMinutes: 500,
            hardLimitMinutes: 500,
            cycleStartAt: "2026-03-01T00:00:00.000Z",
            cycleEndAt: "2026-03-31T00:00:00.000Z",
            cancelAt: null,
            canceledAt: null,
            features: {
              missedAppointment: false,
              reschedule: false,
              quotedFollowup: false,
              afterHoursInbound: false,
            },
            usage: {
              outboundCalls: 4,
              inboundCalls: 3,
              answeredCalls: 5,
              usedMinutes: 123,
              remainingMinutes: 377,
            },
          },
          usage: {
            cycleStartAt: "2026-03-01T00:00:00.000Z",
            cycleEndAt: "2026-03-31T00:00:00.000Z",
            includedMinutes: 500,
            hardLimitMinutes: 500,
            usedMinutes: 123,
            remainingMinutes: 377,
            outboundCalls: 4,
            inboundCalls: 3,
            answeredCalls: 5,
          },
        }}
        voiceEntitlement={null}
        voiceUsage={null}
        snapshot={null}
        showServiceWarning={false}
      />,
    );

    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText(/of 500 minutes used/i)).toBeInTheDocument();
    expect(screen.getByText("377 remaining")).toBeInTheDocument();
  });
});
