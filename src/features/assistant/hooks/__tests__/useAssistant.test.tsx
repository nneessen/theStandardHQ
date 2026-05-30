import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/services/base/supabase", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock("@/services/base/supabase-config", () => ({
  supabaseAnonKey: "anon-key",
  supabaseFunctionsUrl: "https://fn.test",
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

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
}
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// Minimal Response-shaped object — only the fields streamOrchestrator reads.
function mockResponse(opts: {
  ok: boolean;
  frames?: string[];
  json?: unknown;
}): Response {
  return {
    ok: opts.ok,
    body: opts.frames ? sseBody(opts.frames) : null,
    headers: new Headers({
      "Content-Type": opts.frames ? "text/event-stream" : "application/json",
    }),
    json: async () => opts.json ?? null,
  } as unknown as Response;
}

describe("useSendAssistantMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "tok" } },
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("streams deltas/tools and returns the assembled grounded response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        frames: [
          frame("delta", { text: "Here is " }),
          frame("delta", { text: "your briefing." }),
          frame("tool", { name: "getDailyBriefingData", status: "success" }),
          frame("done", {
            conversationId: "c1",
            agentKey: "executive-briefing",
            actionRequests: [],
            toolActivity: [{ name: "getDailyBriefingData", status: "success" }],
          }),
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const tools: unknown[] = [];
    const { result } = renderHook(() => useSendAssistantMessage(), {
      wrapper: makeWrapper(),
    });
    const res = await result.current.mutateAsync({
      message: "Brief me",
      onDelta: (t) => deltas.push(t),
      onTool: (t) => tools.push(t),
    });

    expect(deltas).toEqual(["Here is ", "your briefing."]);
    expect(res.message).toBe("Here is your briefing.");
    expect(res.conversationId).toBe("c1");
    expect(res.agentKey).toBe("executive-briefing");
    expect(res.toolActivity).toHaveLength(1);
    expect(tools).toHaveLength(1);
    // SSE transport, not functions.invoke.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fn.test/assistant-orchestrator",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects when the stream emits an error event", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockResponse({
            ok: true,
            frames: [frame("error", { error: "boom" })],
          }),
        ),
    );
    const { result } = renderHook(() => useSendAssistantMessage(), {
      wrapper: makeWrapper(),
    });
    await expect(result.current.mutateAsync({ message: "x" })).rejects.toThrow(
      /boom/,
    );
  });

  it("rejects on a non-ok response (auth/gate/validation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockResponse({ ok: false, json: { error: "Unauthorized" } }),
        ),
    );
    const { result } = renderHook(() => useSendAssistantMessage(), {
      wrapper: makeWrapper(),
    });
    await expect(result.current.mutateAsync({ message: "x" })).rejects.toThrow(
      /Unauthorized/,
    );
  });
});
