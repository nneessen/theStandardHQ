// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { Toaster } from "react-hot-toast";
import { Sidebar, FreeUserHeader } from "./components/layout";
import { useAuth } from "./contexts/AuthContext";
import { ImoProvider } from "./contexts/ImoContext";
import { logger } from "./services/base/logger";
import { ApprovalGuard } from "./components/auth/ApprovalGuard";
import { CookieConsentBanner } from "./features/legal";
import { getDisplayName } from "./types/user.types";
import { useSubscription, useTemporaryAccessCheck } from "./hooks/subscription";
import { PublicJoinPage } from "./features/recruiting/pages/PublicJoinPage";
import { PublicLandingPage } from "./features/landing";
import { RecruitHeader } from "./components/layout/RecruitHeader";

// Primary domains (not custom domains)
const PRIMARY_DOMAINS = [
  "thestandardhq.com",
  "www.thestandardhq.com",
  "localhost",
  "127.0.0.1",
];

const isVercelPreview = (hostname: string) =>
  hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.sh");

function App() {
  const location = useLocation();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  // Check if we're on a custom domain
  const isOnCustomDomain =
    hostname &&
    !PRIMARY_DOMAINS.includes(hostname) &&
    !isVercelPreview(hostname);

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
    "/join-",
    "/join/",
    "/register/",
    "/test-register/",
    "/landing",
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
  const isOnPrimaryDomain =
    PRIMARY_DOMAINS.includes(hostname) || isVercelPreview(hostname);

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
        <Toaster />
        <CookieConsentBanner />
        <Outlet />
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

  // Check if we're on the recruit pipeline page (no sidebar)
  const isRecruitPipeline = location.pathname === "/recruiting/my-pipeline";

  // Render recruit-only layout without sidebar
  if (isRecruitPipeline) {
    return (
      <>
        <Toaster />
        <CookieConsentBanner />
        <ImoProvider>
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
        </ImoProvider>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <CookieConsentBanner />
      <ImoProvider>
        <div className="flex min-h-screen flex-col">
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
            <div className="flex flex-1">
              <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebar}
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
              <div className="main-content flex-1 min-w-0">
                <div className="p-6 w-full min-h-screen">
                  <ApprovalGuard>
                    <Outlet />
                  </ApprovalGuard>
                </div>
              </div>
            </div>
          )}
        </div>
      </ImoProvider>
    </>
  );
}

export default App;
