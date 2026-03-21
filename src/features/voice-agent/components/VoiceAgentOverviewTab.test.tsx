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
  voiceAgentCreated: false,
  voiceAgentProvisioning: false,
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
  launchPriceLabel: "$149/mo",
  trialIncludedMinutes: 15,
  includedMinutes: 500,
};

describe("VoiceAgentOverviewTab", () => {
  it("renders trial CTA for non-subscribers", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    // Both pricing section and CTA footer render trial elements
    expect(
      screen.getAllByText("Start Free Trial").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/credit card/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/15 min hard-capped/)).toBeInTheDocument();
    expect(screen.getByText("Close CRM")).toBeInTheDocument();
    expect(screen.getByText("Retell.ai")).toBeInTheDocument();
  });

  it("renders pricing section with correct plan labels for non-subscribers", () => {
    render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$149")).toBeInTheDocument();
    expect(screen.getByText(/min\/month/)).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
  });

  it("renders voice metrics strip for active subscribers", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceAgentCreated
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

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("42/500")).toBeInTheDocument();
    expect(screen.getByText("82.4%")).toBeInTheDocument();
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

  it("shows published badge for live agents", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceAgentPublished
        voiceAgentCreated
        completedSteps={3}
      />,
    );

    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("hides metrics strip and shows pricing for non-subscribers", () => {
    const { container } = render(<VoiceAgentOverviewTab {...baseProps} />);

    expect(container.querySelector('[class*="Voice Metrics"]')).toBeNull();
    expect(screen.getByText("Plans")).toBeInTheDocument();
  });

  it("calls onPrimaryAction when trial button is clicked", () => {
    const onPrimaryAction = vi.fn();
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        onPrimaryAction={onPrimaryAction}
      />,
    );

    const buttons = screen.getAllByText("Start Free Trial");
    fireEvent.click(buttons[0]);

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("calls navigation callbacks from quick-nav buttons", () => {
    const onNavigateToSetup = vi.fn();
    const onNavigateToStats = vi.fn();
    const onNavigateToPlans = vi.fn();

    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        voiceAccessActive
        voiceAgentCreated
        onNavigateToSetup={onNavigateToSetup}
        onNavigateToStats={onNavigateToStats}
        onNavigateToPlans={onNavigateToPlans}
      />,
    );

    fireEvent.click(screen.getByText("Setup"));
    expect(onNavigateToSetup).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Stats"));
    expect(onNavigateToStats).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Plan"));
    expect(onNavigateToPlans).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("20/500")).toBeInTheDocument();
  });

  it("uses href link when primaryActionHref is provided", () => {
    render(
      <VoiceAgentOverviewTab
        {...baseProps}
        primaryActionHref="/billing"
        primaryActionLabel="Resolve Billing"
      />,
    );

    const links = screen.getAllByText("Resolve Billing");
    const link = links[0].closest("a");
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("disables action button when primaryActionDisabled is true", () => {
    render(<VoiceAgentOverviewTab {...baseProps} primaryActionDisabled />);

    const ctaButton = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Start Free Trial"));
    expect(ctaButton).toBeDisabled();
  });
});
