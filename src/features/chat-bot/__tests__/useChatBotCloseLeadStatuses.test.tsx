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
import { useChatBotCloseLeadStatuses } from "../hooks/useChatBot";

describe("useChatBotCloseLeadStatuses", () => {
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

  it("returns live Close lead statuses from the connected workspace", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        statuses: [
          { id: "stat_new", label: "New" },
          { id: "stat_reschedule", label: "Contacted/Reschedule" },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useChatBotCloseLeadStatuses(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { id: "stat_new", label: "New" },
        { id: "stat_reschedule", label: "Contacted/Reschedule" },
      ]);
    });
  });

  it("does not execute while disabled", () => {
    renderHook(() => useChatBotCloseLeadStatuses(false), {
      wrapper,
    });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
