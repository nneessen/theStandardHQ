import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Router ──────────────────────────────────────────────────────────────────
// App calls useLocation() and Outlet; mock the whole router module so we don't
// need a real RouterProvider in these smoke tests.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => vi.fn(),
  Outlet: () => null,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// ── Auth / Supabase ──────────────────────────────────────────────────────────
vi.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./contexts/ImoContext", () => ({
  ImoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useImo: () => ({ isSuperAdmin: false }),
}));

vi.mock("./hooks/subscription", () => ({
  useSubscription: () => ({ subscription: null, isActive: false }),
  useTemporaryAccessCheck: () => ({
    shouldGrantTemporaryAccess: () => false,
  }),
}));

// ── Layout / UI ──────────────────────────────────────────────────────────────
vi.mock("./components/layout", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FreeUserHeader: () => null,
}));

vi.mock("./components/layout/RecruitHeader", () => ({
  RecruitHeader: () => null,
}));

vi.mock("./components/auth/ApprovalGuard", () => ({
  ApprovalGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./components/auth/SunsetGate", () => ({
  SunsetGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/ui/portal-container", () => ({
  PortalContainerProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ── Legal / misc ─────────────────────────────────────────────────────────────
vi.mock("./features/legal", () => ({
  CookieConsentBanner: () => null,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => null,
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./services/base/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("./types/user.types", () => ({
  getDisplayName: (u: unknown) => String(u),
}));

// ── Recruiting public join (rendered on custom domains only) ──────────────────
vi.mock("./features/recruiting/pages/PublicJoinPage", () => ({
  PublicJoinPage: () => <div data-testid="public-join-page">Join Page</div>,
}));

// ── Public landing page (rendered at "/" on localhost / primary domain) ───────
// The tests below verify that App routes the root path to this page.
vi.mock("./features/landing", () => ({
  PublicLandingPage: () => (
    <div data-testid="public-landing-page">
      <header>THE STANDARD HQ</header>
      <main>
        <section aria-label="platform sections">Platform content</section>
      </main>
    </div>
  ),
}));

import App from "./App";

describe("App smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the standard hq header", () => {
    render(<App />);
    const headerElement = screen.getByText(/the standard hq/i);
    expect(headerElement).toBeInTheDocument();
  });

  it("renders the public landing page at root", () => {
    render(<App />);
    expect(screen.getByTestId("public-landing-page")).toBeInTheDocument();
  });

  it("renders the landing page main content area", () => {
    render(<App />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
  });
});
