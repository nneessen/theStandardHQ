/**
 * AuthContext — sign-in revocation hard block
 * Verifies that a user in a revoked IMO is signed out and blocked at login,
 * while normal users (and transient RPC failures) still authenticate.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock the supabase client the AuthContext imports ─────────────────────────
// Defined via vi.hoisted so they exist when the hoisted vi.mock factory runs.
const {
  signInWithPassword,
  rpc,
  signOut,
  getSession,
  onAuthStateChange,
  profileChain,
} = vi.hoisted(() => {
  const profileChain: {
    select: () => typeof profileChain;
    eq: () => typeof profileChain;
    single: () => Promise<{ data: null; error: null }>;
  } = {
    select: () => profileChain,
    eq: () => profileChain,
    single: async () => ({ data: null, error: null }),
  };
  return {
    signInWithPassword: vi.fn(),
    rpc: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({
      data: { session: null },
      error: null,
    })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    profileChain,
  };
});

vi.mock("@/services/base", () => ({
  isLocalSupabase: false,
  supabase: {
    auth: {
      signInWithPassword,
      signOut,
      getSession,
      onAuthStateChange,
    },
    rpc,
    from: () => profileChain,
  },
}));

vi.mock("@/services/base/logger", () => ({
  logger: { auth: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/services/settings/userService", () => ({
  userService: {
    mapAuthUserToProfile: (u: { id: string; email: string }) => ({
      id: u.id,
      email: u.email,
    }),
  },
}));

import { AuthProvider, useAuth, AccountClosedError } from "../AuthContext";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

const fakeSignInResult = {
  data: {
    user: { id: "u1", email: "blocked@ffg.test" },
    session: { access_token: "tok", user: { id: "u1" } },
  },
  error: null,
};

describe("AuthContext signIn — revoked-IMO hard block", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue(fakeSignInResult);
    signOut.mockResolvedValue({ error: null });
  });

  it("throws AccountClosedError and signs out when the user's IMO is revoked", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.signIn("blocked@ffg.test", "pw"),
    ).rejects.toBeInstanceOf(AccountClosedError);

    expect(rpc).toHaveBeenCalledWith("is_access_revoked", { p_user_id: "u1" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("allows sign-in when the user is not revoked", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.signIn("ok@test.com", "pw"),
    ).resolves.toBeUndefined();

    expect(signOut).not.toHaveBeenCalled();
  });

  it("fails open (allows sign-in) when the revocation RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.signIn("ok@test.com", "pw"),
    ).resolves.toBeUndefined();

    expect(signOut).not.toHaveBeenCalled();
  });
});
