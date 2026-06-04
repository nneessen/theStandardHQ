// src/services/users/__tests__/userService.test.ts
// Unit tests for UserService and UserRepository

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase - using hoisted mock
vi.mock("../../base/supabase", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockAuth = {
    getUser: vi.fn(),
    signOut: vi.fn(),
  };

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
    },
  };
});

vi.mock("../../base/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { UserRepository } from "../UserRepository";
import { supabase } from "../../base/supabase";

describe("UserRepository", () => {
  let repository: UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        roles: ["agent"],
        approval_status: "approved",
        agent_status: "licensed",
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      } as never);

      const result = await repository.findById("user-123");

      expect(result).toEqual(mockUser);
      expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    });

    it("should return null when user not found", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "Not found" },
            }),
          }),
        }),
      } as never);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email (case-insensitive)", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      } as never);

      const result = await repository.findByEmail("TEST@EXAMPLE.COM");

      expect(result).toEqual(mockUser);
      expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    });

    it("should return null when email not found", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "Not found" },
            }),
          }),
        }),
      } as never);

      const result = await repository.findByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });

  describe("emailExists", () => {
    it("should return true when email exists", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "user-123" },
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await repository.emailExists("test@example.com");

      expect(result).toBe(true);
    });

    it("should return false when email does not exist", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      } as never);

      const result = await repository.emailExists("notfound@example.com");

      expect(result).toBe(false);
    });
  });

  describe("findAllAgents", () => {
    it("should return users with agent or active_agent role", async () => {
      const mockAgents = [
        { id: "1", email: "agent@test.com", roles: ["agent"] },
        { id: "2", email: "active@test.com", roles: ["active_agent"] },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAgents, error: null }),
          }),
        }),
      } as never);

      const result = await repository.findAllAgents();

      expect(result).toHaveLength(2);
    });
  });

  describe("Admin RPC Operations", () => {
    describe("adminGetPendingUsers", () => {
      it("should call admin_get_pending_users RPC", async () => {
        const mockPendingUsers = [
          { id: "1", email: "pending1@test.com", approval_status: "pending" },
        ];

        vi.mocked(supabase.rpc).mockResolvedValue({
          data: mockPendingUsers,
          error: null,
        } as never);

        const result = await repository.adminGetPendingUsers();

        expect(supabase.rpc).toHaveBeenCalledWith("admin_get_pending_users");
        expect(result).toEqual(mockPendingUsers);
      });
    });

    describe("adminApproveUser", () => {
      it("should call admin_approve_user RPC with correct params", async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: null,
          error: null,
        } as never);

        await repository.adminApproveUser("target-user-id", "approver-id");

        expect(supabase.rpc).toHaveBeenCalledWith("admin_approve_user", {
          target_user_id: "target-user-id",
          approver_id: "approver-id",
        });
      });
    });

    describe("adminDenyUser", () => {
      it("should call admin_deny_user RPC with reason", async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: null,
          error: null,
        } as never);

        await repository.adminDenyUser(
          "target-id",
          "approver-id",
          "Test reason",
        );

        expect(supabase.rpc).toHaveBeenCalledWith("admin_deny_user", {
          target_user_id: "target-id",
          approver_id: "approver-id",
          reason: "Test reason",
        });
      });
    });

    describe("adminDeleteUser", () => {
      it("should return success when delete succeeds", async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: null,
          error: null,
        } as never);

        const result = await repository.adminDeleteUser("user-to-delete");

        expect(result.success).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith("admin_deleteuser", {
          target_user_id: "user-to-delete",
        });
      });

      it("should return error when RPC indicates failure", async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: { success: false, error: "Cannot delete user with policies" },
          error: null,
        } as never);

        const result = await repository.adminDeleteUser("user-to-delete");

        expect(result.success).toBe(false);
        expect(result.error).toBe("Cannot delete user with policies");
      });
    });

    describe("adminSetAdminRole", () => {
      it("should call admin_set_admin_role RPC", async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: null,
          error: null,
        } as never);

        await repository.adminSetAdminRole("user-id", true);

        expect(supabase.rpc).toHaveBeenCalledWith("admin_set_admin_role", {
          target_user_id: "user-id",
          new_is_admin: true,
        });
      });
    });
  });

  describe("getApprovalStats", () => {
    it("should calculate approval statistics", async () => {
      const mockProfiles = [
        { approval_status: "pending" },
        { approval_status: "pending" },
        { approval_status: "approved" },
        { approval_status: "approved" },
        { approval_status: "approved" },
        { approval_status: "denied" },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      } as never);

      const result = await repository.getApprovalStats();

      expect(result).toEqual({
        total: 6,
        pending: 2,
        approved: 3,
        denied: 1,
      });
    });
  });

  describe("update", () => {
    it("should update user profile", async () => {
      const mockUpdatedUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "Jane",
        last_name: "Doe",
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedUser,
                error: null,
              }),
            }),
          }),
        }),
      } as never);

      const result = await repository.update("user-123", {
        first_name: "Jane",
      });

      expect(result.first_name).toBe("Jane");
    });
  });
});
