import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// B1 regression guard. The platform-sunset kill switch makes get_my_imo_id()
// return the sentinel for a revoked user, so their own `imos` row reads as 0
// rows (imo === null) and `imos.access_revoked_at` is NEVER visible to them.
// `useRevocationStatus` MUST therefore detect revocation via the
// `is_access_revoked` SECURITY DEFINER RPC (which bypasses the gate), not by
// reading the gated `imos` row off ImoContext. If this test ever flips to
// asserting an ImoContext read, the feature has silently regressed to inert.

const rpc = vi.fn();
let authState: { user: { id: string } | null; loading: boolean };
let imoState: { isSuperAdmin: boolean; loading: boolean };

vi.mock("@/services/base", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("@/contexts/ImoContext", () => ({
  useImo: () => imoState,
}));

import { useRevocationStatus } from "../useRevocation";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useRevocationStatus (B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-123" }, loading: false };
    imoState = { isSuperAdmin: false, loading: false };
  });

  it("derives isRevoked from the is_access_revoked RPC, keyed by the caller id", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useRevocationStatus(), { wrapper });

    await waitFor(() => expect(result.current.isRevoked).toBe(true));
    expect(rpc).toHaveBeenCalledWith("is_access_revoked", {
      p_user_id: "user-123",
    });
  });

  it("treats an RPC result of false as not revoked", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRevocationStatus(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRevoked).toBe(false);
  });

  it("never revokes a super-admin and never calls the RPC for one", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    imoState = { isSuperAdmin: true, loading: false };

    const { result } = renderHook(() => useRevocationStatus(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRevoked).toBe(false);
    expect(result.current.isSuperAdmin).toBe(true);
    // super-admin lives on the FFG IMO — the query must stay disabled so the
    // owner is never locked out even when FFG itself is the revoked IMO.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not query until a user id is present (no anon RPC call)", async () => {
    authState = { user: null, loading: false };
    rpc.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useRevocationStatus(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRevoked).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
