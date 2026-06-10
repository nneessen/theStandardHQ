// /home/nneessen/projects/commissionTracker/src/hooks/admin/__tests__/useUsersView.role-based-filter.test.ts
// Tests to ensure role-based filtering works correctly
// Active agents (with 'agent' role) should ONLY appear in Users & Access tab
// Recruits (without 'agent' role) should ONLY appear in Recruiting Pipeline tab

import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/services/users";
import type { RoleName } from "../../../types/permissions.types";

describe("useUsersView role-based filtering logic", () => {
  // Helper to create a valid UserProfile with all required fields
  const createMockUserProfile = (
    overrides: Partial<UserProfile>,
  ): UserProfile => ({
    // Required fields with defaults
    id: "default-id",
    email: "default@test.com",
    approval_status: "pending",
    is_admin: false,

    // Required non-nullable fields with defaults
    subscription_tier: "free",

    // All nullable fields set to null by default
    terms_accepted_at: null,
    terms_version: null,
    agent_status: null,
    approved_at: null,
    approved_by: null,
    archive_reason: null,
    archived_at: null,
    archived_by: null,
    city: null,
    contract_level: null,
    created_at: null,
    current_onboarding_phase: null,
    custom_permissions: null,
    date_of_birth: null,
    denial_reason: null,
    denied_at: null,
    facebook_handle: null,
    first_name: null,
    hierarchy_depth: null,
    hierarchy_path: null,
    instagram_url: null,
    instagram_username: null,
    is_super_admin: null,
    last_name: null,
    license_expiration: null,
    license_number: null,
    licensing_info: null,
    npn: null,
    onboarding_completed_at: null,
    onboarding_started_at: null,
    onboarding_status: null,
    personal_website: null,
    phone: null,
    password_set_at: null,
    pipeline_template_id: null,
    profile_photo_url: null,
    recruiter_id: null,
    recruiter_slug: null,
    custom_recruiting_url: null,
    referral_source: null,
    resident_state: null,
    roles: null,
    state: null,
    street_address: null,
    updated_at: null,
    upline_id: null,
    zip: null,
    agency_id: null,
    imo_id: "00000000-0000-0000-0000-000000000001",
    uw_wizard_enabled: false,
    // slack_member_overrides column was dropped from the DB; the generated type
    // still lists it until database.types.ts is regenerated from prod, so this
    // mock value stays to satisfy the (stale) type. Remove on next types regen.
    slack_member_overrides: null,

    // Apply overrides
    ...overrides,
  });

  // Test data matching actual database structure
  const mockUsers: UserProfile[] = [
    createMockUserProfile({
      id: "1",
      email: "recruit1@test.com",
      first_name: "Recruit",
      last_name: "One",
      roles: null, // NO ROLE - RECRUIT
      onboarding_status: "lead",
      approval_status: "approved",
      is_admin: false,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    }),
    createMockUserProfile({
      id: "2",
      email: "recruit2@test.com",
      first_name: "Recruit",
      last_name: "Two",
      roles: null, // NO ROLE - RECRUIT
      onboarding_status: "active",
      approval_status: "approved",
      is_admin: false,
      created_at: "2025-01-02",
      updated_at: "2025-01-02",
    }),
    createMockUserProfile({
      id: "3",
      email: "agent1@test.com",
      first_name: "Active",
      last_name: "Agent",
      roles: ["agent"] as RoleName[], // HAS AGENT ROLE - ACTIVE AGENT
      onboarding_status: "completed",
      approval_status: "approved",
      is_admin: false,
      created_at: "2025-01-03",
      updated_at: "2025-01-03",
    }),
    createMockUserProfile({
      id: "4",
      email: "admin@test.com",
      first_name: "Admin",
      last_name: "User",
      roles: ["agent", "admin"] as RoleName[], // HAS AGENT ROLE - ACTIVE AGENT
      onboarding_status: "completed",
      approval_status: "approved",
      is_admin: true,
      created_at: "2025-01-04",
      updated_at: "2025-01-04",
    }),
    createMockUserProfile({
      id: "5",
      email: "problem-user@test.com",
      first_name: "Problem",
      last_name: "User",
      roles: ["agent"] as RoleName[], // HAS AGENT ROLE BUT...
      onboarding_status: "lead", // ...STILL MARKED AS RECRUIT IN PIPELINE
      approval_status: "approved",
      is_admin: false,
      created_at: "2025-01-05",
      updated_at: "2025-01-05",
    }),
  ];

  describe("Users & Access tab (Active Agents)", () => {
    it('should INCLUDE users with roles containing "agent" OR is_admin=true', () => {
      // Filter logic from useUsersView.ts line 62-64
      const filteredUsers = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );

      expect(filteredUsers.length).toBe(3); // agent1, admin, problem-user
      expect(
        filteredUsers.every(
          (u) => u.roles?.includes("agent") || u.is_admin === true,
        ),
      ).toBe(true);
    });

    it("should EXCLUDE users with roles = undefined AND is_admin = false", () => {
      const filteredUsers = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );

      const recruitsFound = filteredUsers.filter(
        (u) => u.roles === null && !u.is_admin,
      );
      expect(recruitsFound.length).toBe(0);
    });

    it('should EXCLUDE users without "agent" role AND is_admin = false', () => {
      const filteredUsers = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );

      const nonAgents = filteredUsers.filter(
        (u) => !u.roles?.includes("agent") && !u.is_admin,
      );
      expect(nonAgents.length).toBe(0);
    });

    it('should include users with "agent" role regardless of onboarding_status', () => {
      const filteredUsers = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );

      // Problem user has agent role but onboarding_status='lead'
      const problemUser = filteredUsers.find(
        (u) => u.email === "problem-user@test.com",
      );
      expect(problemUser).toBeDefined();
      expect(problemUser?.roles).toContain("agent");
    });
  });

  describe("Recruiting Pipeline tab (Recruits)", () => {
    it("should INCLUDE users with roles = undefined AND is_admin = false", () => {
      // Filter logic from AdminControlCenter.tsx line 85-87
      const recruitsInPipeline = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      const undefinedRoleUsers = recruitsInPipeline.filter(
        (u) => u.roles === null,
      );
      expect(undefinedRoleUsers.length).toBe(2); // recruit1, recruit2
    });

    it('should EXCLUDE users with "agent" role', () => {
      const recruitsInPipeline = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      const agentUsers = recruitsInPipeline.filter((u) =>
        u.roles?.includes("agent"),
      );
      expect(agentUsers.length).toBe(0);
    });

    it("should EXCLUDE users with is_admin = true", () => {
      const recruitsInPipeline = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      const adminUsers = recruitsInPipeline.filter((u) => u.is_admin === true);
      expect(adminUsers.length).toBe(0);
    });

    it("should filter correctly: 2 recruits (undefined roles, not admin)", () => {
      const recruitsInPipeline = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      expect(recruitsInPipeline.length).toBe(2); // Only users with no agent role and not admin
      expect(
        recruitsInPipeline.every(
          (u) => u.roles === null && u.is_admin !== true,
        ),
      ).toBe(true);
    });

    it("should exclude problem user with agent role despite onboarding_status", () => {
      const recruitsInPipeline = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      // Problem user should NOT appear in recruiting pipeline because they have agent role
      const problemUser = recruitsInPipeline.find(
        (u) => u.email === "problem-user@test.com",
      );
      expect(problemUser).toBeUndefined();
    });
  });

  describe("Role-based separation (no overlap)", () => {
    it("should ensure no user appears in both tabs", () => {
      const activeAgents = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );
      const recruits = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      // Check no overlap
      const overlap = activeAgents.filter((agent) =>
        recruits.some((recruit) => recruit.id === agent.id),
      );

      expect(overlap.length).toBe(0);
    });

    it("should account for all users (no users lost)", () => {
      const activeAgents = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );
      const recruits = mockUsers.filter(
        (u) => !u.roles?.includes("agent") && u.is_admin !== true,
      );

      const totalCategorized = activeAgents.length + recruits.length;
      expect(totalCategorized).toBe(mockUsers.length);
    });
  });

  describe("Edge cases", () => {
    it("should handle users with multiple roles including agent", () => {
      const filteredUsers = mockUsers.filter(
        (u) => u.roles?.includes("agent") || u.is_admin === true,
      );

      const adminUser = filteredUsers.find((u) => u.email === "admin@test.com");
      expect(adminUser).toBeDefined();
      expect(adminUser?.roles).toContain("agent");
      expect(adminUser?.roles).toContain("admin");
    });

    it("should handle empty roles array as recruit (if not admin)", () => {
      const userWithEmptyRoles: UserProfile = createMockUserProfile({
        id: "6",
        email: "empty-roles@test.com",
        roles: [] as RoleName[],
        onboarding_status: "lead",
        approval_status: "pending",
        is_admin: false,
        created_at: "2025-01-06",
        updated_at: "2025-01-06",
      });

      const isAgent =
        userWithEmptyRoles.roles?.includes("agent") ||
        userWithEmptyRoles.is_admin === true;
      expect(isAgent).toBe(false);

      // Should appear in recruiting pipeline
      const shouldBeInPipeline =
        !userWithEmptyRoles.roles?.includes("agent") &&
        userWithEmptyRoles.is_admin !== true;
      expect(shouldBeInPipeline).toBe(true);
    });

    it("should include admin users even without agent role", () => {
      const adminWithoutAgentRole: UserProfile = createMockUserProfile({
        id: "7",
        email: "admin-only@test.com",
        roles: null, // No roles but is admin
        onboarding_status: null,
        approval_status: "approved",
        is_admin: true,
        created_at: "2025-01-07",
        updated_at: "2025-01-07",
      });

      // Should appear in Users & Access tab because is_admin=true
      const shouldBeInUsers =
        adminWithoutAgentRole.roles?.includes("agent") ||
        adminWithoutAgentRole.is_admin === true;
      expect(shouldBeInUsers).toBe(true);

      // Should NOT appear in recruiting pipeline
      const shouldBeInPipeline =
        !adminWithoutAgentRole.roles?.includes("agent") &&
        adminWithoutAgentRole.is_admin !== true;
      expect(shouldBeInPipeline).toBe(false);
    });
  });
});
