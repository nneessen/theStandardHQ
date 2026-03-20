import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/services/base/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";
import {
  useConnectClose,
  useCreateVoiceAgent,
  useDisconnectCalendly,
} from "../hooks/useChatBot";

describe("useCreateVoiceAgent", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: "test-access-token",
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("calls the edge function with create_voice_agent and invalidates voice queries", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        success: true,
        agent: {
          exists: true,
          provisioningStatus: "ready",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useCreateVoiceAgent(), { wrapper });

    await result.current.mutateAsync({ templateKey: "default_sales" });

    expect(supabase.functions.invoke).toHaveBeenCalledWith("chat-bot-api", {
      headers: { Authorization: "Bearer test-access-token" },
      body: { action: "create_voice_agent", templateKey: "default_sales" },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Your voice agent has been created.",
    );
    expect(invalidateSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chat-bot", "voice-setup-state", "v1"],
    });
  });

  it("shows a clear message when the create route is missing", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error:
              "Voice agent creation is not available in this environment yet.",
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    const { result } = renderHook(() => useCreateVoiceAgent(), { wrapper });

    await expect(result.current.mutateAsync({})).rejects.toBeInstanceOf(Error);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Voice agent creation is not available in this environment yet.",
      );
    });
  });

  it("surfaces upstream create failures without masking them as missing routes", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Agent not found on external platform",
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    const { result } = renderHook(() => useCreateVoiceAgent(), { wrapper });

    await expect(result.current.mutateAsync({})).rejects.toBeInstanceOf(Error);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Agent not found on external platform",
      );
    });
  });

  it("invalidates setup-state and lead-status caches after Close connects", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useConnectClose(), { wrapper });

    await result.current.mutateAsync("close-api-key");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chat-bot", "voice-setup-state", "v1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chat-bot", "close-lead-statuses"],
    });
  });

  it("invalidates setup-state after Calendly disconnects", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useDisconnectCalendly(), { wrapper });

    await result.current.mutateAsync();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chat-bot", "voice-setup-state", "v1"],
    });
  });
});
