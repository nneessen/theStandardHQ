// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { Toaster } from "react-hot-toast";
import { AppShell, FreeUserHeader } from "./components/layout";
import { useAuth } from "./contexts/AuthContext";
import { ImoProvider } from "./contexts/ImoContext";
import { logger } from "./services/base/logger";
import { ApprovalGuard } from "./components/auth/ApprovalGuard";
import { PortalContainerProvider } from "./components/ui/portal-container";
import { SunsetGate } from "./components/auth/SunsetGate";
import { CookieConsentBanner } from "./features/legal";
import { getDisplayName } from "./types/user.types";
import { useSubscription, useTemporaryAccessCheck } from "./hooks/subscription";
import { PublicJoinPage } from "./features/recruiting/pages/PublicJoinPage";
import { PublicLandingPage } from "./features/landing";
import { RecruitHeader } from "./components/layout/RecruitHeader";
import { classifyHost } from "./lib/hostname";

function App() {
  const location = useLocation();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  // Classify the host once: primary app/marketing, a zero-config branded
  // subdomain ({slug}.thestandardhq.com), or an external white-label domain.
  const host = classifyHost(hostname);

  // Branded hosts (platform subdomain or external custom domain) render the
  // public recruiting page at root. CustomDomainContext resolves the slug/theme.
  const isOnCustomDomain =
    host.kind === "platform-subdomain" || host.kind === "custom";

  // Check if public path BEFORE calling useAuth to avoid unnecessary auth checks
  const publicPaths = [
    "/login",
    "/auth/callback",
    "/auth/verify-email",
    "/auth/reset-password",
    "/auth/pending",
    "/auth/denied",
    "/terms",
    "/privacy",
    "/accessibility",
    "/join-",
    "/join/",
    "/register/",
    "/landing",
    "/internal/design-preview", // wizard live-preview iframe (renders bare, no shell)
  ];
  const isPublicPath = publicPaths.some((path) =>
    location.pathname.startsWith(path),
  );

  // Custom domain at root path should show recruiting page
  if (isOnCustomDomain && location.pathname === "/") {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <PublicJoinPage />
      </>
    );
  }

  // Primary domain landing page paths
  const isOnPrimaryDomain = host.kind === "primary";

  // Show landing page at "/" or "/landing" on primary domain (before auth check)
  if (
    isOnPrimaryDomain &&
    (location.pathname === "/" || location.pathname === "/landing")
  ) {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <PublicLandingPage />
      </>
    );
  }

  // For public paths, render immediately without auth
  if (isPublicPath) {
    return (
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <Toaster />
        <CookieConsentBanner />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </>
    );
  }

  // Only use auth for non-public paths
  return <AuthenticatedApp />;
}

// Separate component for authenticated routes
function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { subscription, isActive: _isSubscriptionActive } = useSubscription();

  // Always show sidebar - even for free tier users
  // Feature gating is handled within the sidebar via locked nav items
  const _isFreeTier = subscription?.plan?.name === "free";
  const { shouldGrantTemporaryAccess } = useTemporaryAccessCheck();
  const _hasTemporaryAccess = shouldGrantTemporaryAccess(
    "dashboard",
    user?.email,
  );
  const shouldHideSidebar = false; // Always show sidebar

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await signOut();
        navigate({ to: "/" });
      } catch (error) {
        logger.error(
          "Logout error",
          error instanceof Error ? error : String(error),
          "App",
        );
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // Track if user was ever authenticated to prevent redirect during initial load
  const wasAuthenticatedRef = useRef(false);

  // Update ref when user becomes authenticated
  useEffect(() => {
    if (user?.id) {
      wasAuthenticatedRef.current = true;
    }
  }, [user?.id]);

  // Redirect to login when no authenticated user
  useEffect(() => {
    if (loading) return;
    if (location.pathname === "/login") return;

    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Redirecting to login...</div>
      </div>
    );
  }

  // Command center owns the full viewport — no sidebar, no app chrome — so the
  // Jarvis HUD reads uniformly for every user (its own dark shell + back affordance).
  const isCommandCenter = location.pathname === "/command-center";
  if (isCommandCenter) {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <ImoProvider>
          <SunsetGate>
            <ApprovalGuard>
              <Outlet />
            </ApprovalGuard>
          </SunsetGate>
        </ImoProvider>
      </>
    );
  }

  // Custom-domain setup wizard owns the full viewport (its own dark shell +
  // step rail + back-to-settings affordance) — no sidebar.
  const isCustomDomainSetup =
    location.pathname === "/recruiting/custom-domains/setup";
  if (isCustomDomainSetup) {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <ImoProvider>
          <SunsetGate>
            <ApprovalGuard>
              <Outlet />
            </ApprovalGuard>
          </SunsetGate>
        </ImoProvider>
      </>
    );
  }

  // Check if we're on the recruit pipeline page (no sidebar)
  const isRecruitPipeline = location.pathname === "/recruiting/my-pipeline";

  // Render recruit-only layout without sidebar
  if (isRecruitPipeline) {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <ImoProvider>
          <SunsetGate>
            <div className="min-h-screen bg-[#0a0a0a]">
              <RecruitHeader
                userName={
                  user.first_name && user.last_name
                    ? getDisplayName({
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email || "",
                      })
                    : user.email?.split("@")[0] || "User"
                }
                onLogout={handleLogout}
              />
              <ApprovalGuard>
                <Outlet />
              </ApprovalGuard>
            </div>
          </SunsetGate>
        </ImoProvider>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <CookieConsentBanner />
      <ImoProvider>
        <SunsetGate>
          {/* `dark` is scoped here (not on <html>) so "The Board" dark theme +
              dark: variants apply ONLY inside the authenticated shell — public
              pages follow the global theme untouched. */}
          <div className="dark theme-v2 v2-canvas font-display text-v2-ink flex min-h-screen flex-col">
            <PortalContainerProvider>
              {shouldHideSidebar ? (
                <>
                  <FreeUserHeader
                    userName={
                      user.first_name && user.last_name
                        ? getDisplayName({
                            first_name: user.first_name,
                            last_name: user.last_name,
                            email: user.email || "",
                          })
                        : user.email?.split("@")[0] || "User"
                    }
                    userEmail={user.email || ""}
                    onLogout={handleLogout}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="p-6 w-full min-h-screen">
                      <ApprovalGuard>
                        <Outlet />
                      </ApprovalGuard>
                    </div>
                  </div>
                </>
              ) : (
                <AppShell
                  isSidebarCollapsed={isSidebarCollapsed}
                  onToggleSidebar={toggleSidebar}
                  userName={
                    user.first_name && user.last_name
                      ? getDisplayName({
                          first_name: user.first_name,
                          last_name: user.last_name,
                          email: user.email || "",
                        })
                      : user.email?.split("@")[0] || "User"
                  }
                  userEmail={user.email || ""}
                  onLogout={handleLogout}
                >
                  <ApprovalGuard>
                    <Outlet />
                  </ApprovalGuard>
                </AppShell>
              )}
            </PortalContainerProvider>
          </div>
        </SunsetGate>
      </ImoProvider>
    </>
  );
}

export default App;
