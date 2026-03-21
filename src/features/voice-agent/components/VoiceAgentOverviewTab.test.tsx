import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { VoiceAgentOverviewTab } from "./VoiceAgentOverviewTab";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const baseProps = {
  voiceAccessActive: false,
  voiceAgentPublished: false,
  setupSteps: [
    {
      id: "voice-access",
      title: "Voice access",
      description: "",
      state: "upcoming" as const,
    },
    {
      id: "close",
      title: "Close CRM",
      description: "",
      state: "upcoming" as const,
    },
    {
      id: "line",
      title: "Create Agent",
      description: "",
      state: "upcoming" as const,
    },
  ],
  completedSteps: 0,
  nextStepTitle: "Voice access",
  primaryActionLabel: "Start Free Trial",
  onPrimaryAction: vi.fn(),
  onNavigateToSetup: vi.fn(),
  onNavigateToStats: vi.fn(),
  onNavigateToPlans: vi.fn(),
  voiceEntitlement: null,
  voiceUsage: null,
  voiceSetupState: null,
  voiceSnapshot: null,
  trialIncludedMinutes: 15,
  includedMinutes: 500,
};

describe("VoiceAgentOverviewTab", () => {
  it("renders hero section with badge and tagline", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(screen.getByText("AI-Powered Voice Agent")).toBeInTheDocument();
    expect(
      screen.getByText(/Automate Follow-Ups & Inbound Calls/),
    ).toBeInTheDocument();
    expect(screen.getByText("Close CRM")).toBeInTheDocument();
    expect(screen.getByText("Retell.ai")).toBeInTheDocument();
  });

  it("renders feature highlights grid", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(screen.getByText("What's Included")).toBeInTheDocument();
    expect(screen.getByText("Missed Appointment Recovery")).toBeInTheDocument();
    expect(screen.getByText("After-Hours Inbound")).toBeInTheDocument();
    expect(screen.getByText("Human Handoff")).toBeInTheDocument();
    expect(screen.getByText("Voicemail Detection")).toBeInTheDocument();
  });

  it("renders CTA button in hero for non-subscribers", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(screen.getByText("Start Free Trial")).toBeInTheDocument();
  });

  it("hides metrics strip for non-subscribers", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(screen.queryByText("Voice Metrics · This Cycle")).toBeNull();
    expect(screen.queryByText("Your Voice Agent")).toBeNull();
  });

  it("renders voice metrics strip for active subscribers", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceEntitlement={{
          status: "active",
          usage: {
            outboundCalls: 12,
            inboundCalls: 5,
            answeredCalls: 14,
            usedMinutes: 42,
            includedMinutes: 500,
          },
        }}
      />,
    );

    expect(screen.getByText("Voice Metrics · This Cycle")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("42/500")).toBeInTheDocument();
    expect(screen.getByText("82.4%")).toBeInTheDocument();
  });

  it("shows Your Agent section for subscribers with setup complete", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceAgentPublished
        completedSteps={3}
        voiceEntitlement={{
          status: "active",
          usage: {
            outboundCalls: 8,
            inboundCalls: 3,
            answeredCalls: 9,
            usedMinutes: 30,
            includedMinutes: 500,
          },
        }}
      />,
    );

    expect(screen.getByText("Your Voice Agent")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows Draft status for unpublished agent in Your Agent section", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        completedSteps={3}
      />,
    );

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows setup progress when active but not fully set up", () => {
    const steps = [
      {
        id: "voice-access",
        title: "Voice access",
        description: "",
        state: "complete" as const,
      },
      {
        id: "close",
        title: "Close CRM",
        description: "",
        state: "complete" as const,
      },
      {
        id: "line",
        title: "Create Agent",
        description: "",
        state: "current" as const,
      },
    ];

    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        setupSteps={steps}
        completedSteps={2}
        nextStepTitle="Create Agent"
      />,
    );

    expect(screen.getByText("Setup Progress")).toBeInTheDocument();
    expect(screen.getByText("2/3 complete")).toBeInTheDocument();
    expect(screen.getByText("Create Agent")).toBeInTheDocument();
  });

  it("renders answer rate as --% when total calls is zero", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceEntitlement={{
          status: "active",
          usage: {
            outboundCalls: 0,
            inboundCalls: 0,
            answeredCalls: 0,
            usedMinutes: 0,
            includedMinutes: 500,
          },
        }}
      />,
    );

    expect(screen.getByText("--%")).toBeInTheDocument();
  });

  it("falls back to voiceSnapshot usage when other sources are null", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceSnapshot={{
          usage: {
            outboundCalls: 7,
            inboundCalls: 3,
            answeredCalls: 8,
            usedMinutes: 20,
            includedMinutes: 500,
          },
        }}
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("20/500")).toBeInTheDocument();
  });

  it("calls navigation callbacks from quick-nav buttons in Your Agent section", () => {
    const onNavigateToSetup = vi.fn();
    const onNavigateToStats = vi.fn();
    const onNavigateToPlans = vi.fn();

    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        completedSteps={3}
        onNavigateToSetup={onNavigateToSetup}
        onNavigateToStats={onNavigateToStats}
        onNavigateToPlans={onNavigateToPlans}
      />,
    );

    fireEvent.click(screen.getByText("Setup"));
    expect(onNavigateToSetup).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Stats"));
    expect(onNavigateToStats).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Plans"));
    expect(onNavigateToPlans).toHaveBeenCalledTimes(1);
  });

  it("uses href link when primaryActionHref is provided for non-subscribers", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        primaryActionHref="/billing"
        primaryActionLabel="Resolve Billing"
      />,
    );

    const link = screen.getByText("Resolve Billing").closest("a");
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("shows Complete Setup button in hero for subscribers without setup", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        completedSteps={1}
      />,
    );

    expect(screen.getByText("Complete Setup")).toBeInTheDocument();
  });

  it("shows View Stats button in hero for subscribers with complete setup", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        completedSteps={3}
      />,
    );

    expect(screen.getByText("View Stats")).toBeInTheDocument();
  });
});
