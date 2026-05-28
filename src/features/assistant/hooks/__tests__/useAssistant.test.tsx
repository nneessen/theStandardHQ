import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/services/base/supabase", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/services/base/supabase";
import { useSendAssistantMessage } from "../useAssistant";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useSendAssistantMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes the orchestrator and returns its grounded response", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        conversationId: "c1",
        agentKey: "executive-briefing",
        message: "Here is your briefing.",
        toolActivity: [],
        actionRequests: [],
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

    const { result } = renderHook(() => useSendAssistantMessage(), {
      wrapper: makeWrapper(),
    });
    const res = await result.current.mutateAsync({ message: "Brief me" });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "assistant-orchestrator",
      {
        body: { message: "Brief me", conversationId: undefined },
      },
    );
    expect(res.message).toBe("Here is your briefing.");
  });

  it("rejects when the edge function returns an error", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error("boom"),
    } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

    const { result } = renderHook(() => useSendAssistantMessage(), {
      wrapper: makeWrapper(),
    });
    await expect(
      result.current.mutateAsync({ message: "x" }),
    ).rejects.toThrow();
  });
});
