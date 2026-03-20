import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseImo = vi.fn();
const mockUseUserActiveAddons = vi.fn();
const mockUseChatBotAgent = vi.fn();
const mockUseChatBotVoiceSetupState = vi.fn();
const mockUseChatBotVoiceEntitlement = vi.fn();
const mockUseChatBotVoiceUsage = vi.fn();
const mockUseCreateVoiceAgent = vi.fn();
const mockUseConnectClose = vi.fn();
const mockUseDisconnectClose = vi.fn();
const mockUseChatBotRetellRuntime = vi.fn();
const mockUseChatBotRetellLlm = vi.fn();
const mockUseChatBotRetellVoices = vi.fn();
let MockChatBotApiErrorClass: new (
  message: string,
  isNotProvisioned?: boolean,
  isServiceError?: boolean,
  isTransportError?: boolean,
) => Error;

vi.mock("@/contexts/ImoContext", () => ({
  useImo: () => mockUseImo(),
}));

vi.mock("@/hooks/subscription", () => ({
  useUserActiveAddons: () => mockUseUserActiveAddons(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/features/chat-bot", () => {
  class MockChatBotApiError extends Error {
    constructor(
      message: string,
      public readonly isNotProvisioned = false,
      public readonly isServiceError = false,
      public readonly isTransportError = false,
    ) {
      super(message);
    }
  }

  MockChatBotApiErrorClass = MockChatBotApiError;

  return {
    ChatBotApiError: MockChatBotApiError,
    useChatBotAgent: (...args: unknown[]) => mockUseChatBotAgent(...args),
    useChatBotVoiceSetupState: (...args: unknown[]) =>
      mockUseChatBotVoiceSetupState(...args),
    useChatBotVoiceEntitlement: (...args: unknown[]) =>
      mockUseChatBotVoiceEntitlement(...args),
    useChatBotVoiceUsage: (...args: unknown[]) =>
      mockUseChatBotVoiceUsage(...args),
    useCreateVoiceAgent: (...args: unknown[]) =>
      mockUseCreateVoiceAgent(...args),
    useConnectClose: (...args: unknown[]) => mockUseConnectClose(...args),
    useDisconnectClose: (...args: unknown[]) => mockUseDisconnectClose(...args),
    useChatBotRetellRuntime: (...args: unknown[]) =>
      mockUseChatBotRetellRuntime(...args),
    useChatBotRetellLlm: (...args: unknown[]) =>
      mockUseChatBotRetellLlm(...args),
    useChatBotRetellVoices: (...args: unknown[]) =>
      mockUseChatBotRetellVoices(...args),
  };
});

vi.mock("@/features/chat-bot/components/ConnectionCard", () => ({
  ConnectionCard: ({
    title,
    connected,
  }: {
    title: string;
    connected: boolean;
  }) => (
    <div data-testid="connection-card">
      {title}:{connected ? "connected" : "not-connected"}
    </div>
  ),
}));

vi.mock("./components/VoiceAgentLanding", () => ({
  VoiceAgentLanding: ({
    nextStepTitle,
    localDevWarning,
  }: {
    nextStepTitle: string;
    localDevWarning?: string | null;
  }) => (
    <div data-testid="voice-landing">
      Next:{nextStepTitle}
      {localDevWarning ? `|warning:${localDevWarning}` : ""}
    </div>
  ),
}));

vi.mock("./components/VoiceAgentConnectionCard", () => ({
  VoiceAgentConnectionCard: () => <div data-testid="voice-launch-card" />,
}));

vi.mock("./components/VoiceAgentRetellStudioCard", () => ({
  VoiceAgentRetellStudioCard: ({ view }: { view?: string }) => (
    <div data-testid="voice-studio-card">view:{view}</div>
  ),
}));

vi.mock("./components/VoiceAgentRuntimeCard", () => ({
  VoiceAgentRuntimeCard: () => <div data-testid="voice-runtime-card" />,
}));

vi.mock("./components/VoiceAgentStatusCard", () => ({
  VoiceAgentStatusCard: () => <div data-testid="voice-status-card" />,
}));

vi.mock("./components/VoiceAgentUsageCard", () => ({
  VoiceAgentUsageCard: () => <div data-testid="voice-usage-card" />,
}));

import { VoiceAgentPage } from "./VoiceAgentPage";

function buildAgent({
  closeConnected = false,
  retellConnected = false,
}: {
  closeConnected?: boolean;
  retellConnected?: boolean;
} = {}) {
  return {
    connections: {
      close: closeConnected
        ? {
            connected: true,
            orgName: "Close Test Org",
          }
        : {
            connected: false,
          },
      retell: retellConnected
        ? {
            connected: true,
            retellAgentId: "agent_123",
          }
        : {
            connected: false,
          },
    },
    voiceEnabled: false,
    voiceFollowUpEnabled: false,
    afterHoursInboundEnabled: false,
    voiceHumanHandoffEnabled: false,
    voiceVoicemailEnabled: false,
    voiceTransferNumber: "",
  };
}

function buildSetupState({
  entitlementActive = false,
  closeConnected = false,
  retellConnected = false,
  agentExists = false,
  provisioningStatus = "not_created",
  published = false,
  nextActionKey = "activate_voice",
}: {
  entitlementActive?: boolean;
  closeConnected?: boolean;
  retellConnected?: boolean;
  agentExists?: boolean;
  provisioningStatus?: string;
  published?: boolean;
  nextActionKey?: string;
} = {}) {
  return {
    agent: {
      exists: agentExists,
      provisioningStatus,
      published,
    },
    readiness: {
      entitlementActive,
    },
    connections: {
      close: closeConnected
        ? {
            connected: true,
            orgName: "Close Test Org",
          }
        : {
            connected: false,
          },
      retell: retellConnected
        ? {
            connected: true,
            retellAgentId: "agent_123",
          }
        : {
            connected: false,
          },
    },
    nextAction: {
      key: nextActionKey,
      label: "Next action",
      description: "Next action description",
    },
  };
}

describe("VoiceAgentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseImo.mockReturnValue({ isSuperAdmin: false });
    mockUseUserActiveAddons.mockReturnValue({
      activeAddons: [],
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });
    mockUseChatBotVoiceEntitlement.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });
    mockUseChatBotVoiceUsage.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });
    mockUseCreateVoiceAgent.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      data: undefined,
    });
    mockUseConnectClose.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseDisconnectClose.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseChatBotRetellRuntime.mockReturnValue({
      data: {
        agent: {
          is_published: false,
          voice_id: "",
        },
      },
      error: null,
      isLoading: false,
    });
    mockUseChatBotRetellLlm.mockReturnValue({
      data: {
        begin_message: "",
        general_prompt: "",
      },
      error: null,
      isLoading: false,
    });
    mockUseChatBotRetellVoices.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    });
  });

  it("does not expose create before voice access is active", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: buildSetupState({
        entitlementActive: false,
        closeConnected: false,
        agentExists: false,
        nextActionKey: "activate_voice",
      }),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<VoiceAgentPage />);

    const setupTab = screen.getByRole("button", { name: /setup/i });
    expect(setupTab).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /create agent/i }));

    expect(screen.getByText("Step 1. Connect Close CRM")).toBeInTheDocument();
    expect(
      screen.getByText("Voice access is not active yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to setup/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /voice access required/i }),
    ).toBeDisabled();
    expect(screen.getByTestId("connection-card")).toHaveTextContent(
      "Close CRM:not-connected",
    );
    expect(mockUseChatBotAgent).toHaveBeenCalledWith(false);
    expect(mockUseChatBotVoiceSetupState).toHaveBeenCalledWith();
    expect(mockUseChatBotVoiceEntitlement).toHaveBeenCalledWith(false);
    expect(mockUseChatBotVoiceUsage).toHaveBeenCalledWith(false);
  });

  it("keeps setup available while voice agent provisioning is pending", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: buildAgent({ closeConnected: true, retellConnected: false }),
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: buildSetupState({
        entitlementActive: true,
        closeConnected: true,
        agentExists: true,
        provisioningStatus: "creating",
        nextActionKey: "wait_for_provisioning",
      }),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<VoiceAgentPage />);

    const setupTab = screen.getByRole("button", { name: /setup/i });
    expect(setupTab).toBeEnabled();

    fireEvent.click(setupTab);

    expect(
      screen.getByText(/your voice agent is being created now/i),
    ).toBeInTheDocument();
  });

  it("keeps the shared agent query disabled on overview and enables it on setup", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: buildAgent({ closeConnected: true, retellConnected: true }),
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: buildSetupState({
        entitlementActive: true,
        closeConnected: true,
        retellConnected: true,
        agentExists: true,
        provisioningStatus: "ready",
        nextActionKey: "publish_agent",
      }),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<VoiceAgentPage />);

    expect(mockUseChatBotAgent).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /setup/i }));

    expect(mockUseChatBotAgent).toHaveBeenLastCalledWith(true);
  });

  it("exposes the Advanced setup step after a voice agent exists", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: buildAgent({ closeConnected: true, retellConnected: true }),
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: buildSetupState({
        entitlementActive: true,
        closeConnected: true,
        retellConnected: true,
        agentExists: true,
        provisioningStatus: "ready",
        nextActionKey: "publish_agent",
      }),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<VoiceAgentPage />);

    fireEvent.click(screen.getByRole("button", { name: /setup/i }));
    fireEvent.click(screen.getByRole("button", { name: /4\. advanced/i }));

    expect(screen.getByTestId("voice-studio-card")).toHaveTextContent(
      "view:advanced",
    );
  });

  it("shows a specific local env warning when the edge function lacks upstream config", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: null,
      error: new MockChatBotApiErrorClass(
        "Chat bot service is not configured in this local edge environment.",
        false,
        true,
      ),
      isLoading: false,
    });

    render(<VoiceAgentPage />);

    expect(screen.getByTestId("voice-landing")).toHaveTextContent(
      "warning:Local voice setup is blocked because the local edge function is missing its upstream chat bot API env. Start the Supabase functions server with the project .env so voice reads can load.",
    );
  });

  it("redirects create to setup when publish is the next backend action", () => {
    mockUseChatBotAgent.mockReturnValue({
      data: buildAgent({ closeConnected: true, retellConnected: true }),
      error: null,
      isLoading: false,
    });
    mockUseChatBotVoiceSetupState.mockReturnValue({
      data: buildSetupState({
        entitlementActive: true,
        closeConnected: true,
        retellConnected: true,
        agentExists: true,
        provisioningStatus: "ready",
        nextActionKey: "publish_agent",
      }),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<VoiceAgentPage />);

    fireEvent.click(screen.getByRole("button", { name: /create agent/i }));

    expect(screen.getByTestId("voice-studio-card")).toHaveTextContent(
      "view:launch",
    );
  });
});
