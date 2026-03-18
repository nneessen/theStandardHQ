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
  useAuth: vi.fn(),
}));

// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useIsOnExemptTeam } from "../hooks/useChatBot";

describe("useIsOnExemptTeam", () => {
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

  it("returns team access when the edge function allows it", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
    } as ReturnType<typeof useAuth>);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { hasTeamAccess: true },
      error: null,
    });

    const { result } = renderHook(() => useIsOnExemptTeam(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(true);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("chat-bot-api", {
      headers: { Authorization: "Bearer test-access-token" },
      body: { action: "get_team_access" },
    });
  });

  it("returns false when the edge function denies team access", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-2" },
    } as ReturnType<typeof useAuth>);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { hasTeamAccess: false },
      error: null,
    });

    const { result } = renderHook(() => useIsOnExemptTeam(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });

  it("stays idle when there is no authenticated user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useIsOnExemptTeam(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
