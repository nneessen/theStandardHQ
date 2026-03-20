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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user_123" },
    loading: false,
  }),
}));

// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import {
  chatBotApi,
  useCalendarHealth,
  useChatBotAgent,
  useChatBotRetellRuntime,
} from "../hooks/useChatBot";

describe("useChatBotAgent", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
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

  it("returns null only for the explicit no-workspace case", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({ error: "No active chat bot found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    const { result } = renderHook(() => useChatBotAgent(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
    expect(result.current.error).toBeNull();
  });

  it("does not classify a missing deployment route as a not-provisioned workspace", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "Function not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      },
    });

    await expect(chatBotApi("get_agent")).rejects.toMatchObject({
      message: "Function not found",
      isNotProvisioned: false,
    });
  });

  it("classifies transport failures as service errors without treating them as provisioning", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
      },
    });

    await expect(chatBotApi("get_agent")).rejects.toMatchObject({
      message: "Failed to send a request to the Edge Function",
      isNotProvisioned: false,
      isServiceError: true,
      isTransportError: true,
    });
  });

  it("classifies configured service-down responses as service errors", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error:
              "Chat bot service is not configured in this local edge environment.",
            serviceDown: true,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    await expect(chatBotApi("get_agent")).rejects.toMatchObject({
      message:
        "Chat bot service is not configured in this local edge environment.",
      isNotProvisioned: false,
      isServiceError: true,
    });
  });

  it("treats missing Retell runtime as an empty optional resource", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({ error: "Retell runtime not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    const { result } = renderHook(() => useChatBotRetellRuntime(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
    expect(result.current.error).toBeNull();
  });

  it("treats missing calendar health support as an empty optional resource", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "Function not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      },
    });

    const { result } = renderHook(() => useCalendarHealth(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
    expect(result.current.error).toBeNull();
  });

  it("treats connection-status service failures as service errors", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Bot service temporarily unavailable",
            serviceDown: true,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      },
    });

    await expect(chatBotApi("get_close_status")).rejects.toMatchObject({
      message: "Bot service temporarily unavailable",
      isNotProvisioned: false,
      isServiceError: true,
    });
  });
});
