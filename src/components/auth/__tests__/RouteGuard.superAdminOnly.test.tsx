import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteGuard } from "../RouteGuard";
import { useAuthorizationStatus } from "@/hooks/admin";
import { usePermissionCheck } from "@/hooks/permissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAnyFeatureAccess,
  useFeatureAccess,
  useSubscription,
  useImoAllFeaturesAccess,
} from "@/hooks/subscription";

vi.mock("@/hooks/admin", () => ({
  useAuthorizationStatus: vi.fn(),
}));

vi.mock("@/hooks/permissions", () => ({
  usePermissionCheck: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/subscription", () => ({
  useFeatureAccess: vi.fn(),
  useAnyFeatureAccess: vi.fn(),
  useSubscription: vi.fn(),
  useImoAllFeaturesAccess: vi.fn(),
  // RouteGuard calls useAiAccess() unconditionally (added by billing #18); it must
  // return a valid shape so the `{ hasAiAccess, isLoading }` destructure can't crash.
  useAiAccess: vi.fn(() => ({ hasAiAccess: false, isLoading: false })),
}));

describe("RouteGuard superAdminOnly", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuthorizationStatus).mockReturnValue({
      isApproved: true,
      isPending: false,
      isDenied: false,
      isSuperAdmin: false,
      profile: { email: "user@example.com", agency_id: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuthorizationStatus>);

    vi.mocked(usePermissionCheck).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      canAny: vi.fn().mockReturnValue(true),
      canAll: vi.fn().mockReturnValue(true),
      is: vi.fn().mockReturnValue(false),
      isLoading: false,
    } as unknown as ReturnType<typeof usePermissionCheck>);

    vi.mocked(useAuth).mockReturnValue({
      supabaseUser: { email: "user@example.com" },
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(useFeatureAccess).mockReturnValue({
      hasAccess: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useFeatureAccess>);

    vi.mocked(useAnyFeatureAccess).mockReturnValue({
      hasAccess: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useAnyFeatureAccess>);

    vi.mocked(useSubscription).mockReturnValue({
      hasManageableSubscription: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useSubscription>);

    vi.mocked(useImoAllFeaturesAccess).mockReturnValue({
      grantsAllFeatures: false,
      isLoading: false,
      error: null,
    });
  });

  it("blocks non-super-admin users for superAdminOnly routes", () => {
    render(
      <RouteGuard superAdminOnly fallback={<div data-testid="blocked" />}>
        <div data-testid="content" />
      </RouteGuard>,
    );

    expect(screen.getByTestId("blocked")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("allows super-admin users for superAdminOnly routes", () => {
    vi.mocked(useAuthorizationStatus).mockReturnValue({
      isApproved: true,
      isPending: false,
      isDenied: false,
      isSuperAdmin: true,
      profile: { email: "admin@example.com", agency_id: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuthorizationStatus>);

    render(
      <RouteGuard superAdminOnly fallback={<div data-testid="blocked" />}>
        <div data-testid="content" />
      </RouteGuard>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByTestId("blocked")).not.toBeInTheDocument();
  });
});
