// src/services/users/userService.ts
// User profile management service using database-first types
// Refactored to use UserRepository for data access

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import { UserRepository, UserFilters } from "./UserRepository";
import type {
  UserProfile,
  UserProfileRow,
  ApprovalStats,
  AgentStatus,
  ApprovalStatus,
  CreateUserProfileData,
} from "../../types/user.types";
import {
  VALID_CONTRACT_LEVELS,
  isValidContractLevel,
} from "../../lib/constants";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
export { VALID_CONTRACT_LEVELS };

type RoleName = string;

// =============================================================================
// USER SERVICE CLASS
// =============================================================================

class UserService {
  private repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  // -------------------------------------------------------------------------
  // READ OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Get the current authenticated user's profile
   */
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.error(
          "Failed to get authenticated user",
          authError,
          "UserService",
        );
        return null;
      }

      return this.repository.findById(user.id);
    } catch (error) {
      logger.error(
        "Error in getCurrentUserProfile",
        error as Error,
        "UserService",
      );
      return null;
    }
  }

  /**
   * Get a user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Try direct access first (respects RLS)
      const profile = await this.repository.findById(userId);
      if (profile) {
        return profile;
      }

      // Fallback to admin RPC for viewing other users (if caller has admin permissions)
      return this.repository.adminGetUserProfile(userId);
    } catch (error) {
      logger.error("Error in getUserProfile", error as Error, "UserService");
      return null;
    }
  }

  /**
   * Get a user profile by email
   */
  async getByEmail(email: string): Promise<UserProfile | null> {
    try {
      return this.repository.findByEmail(email);
    } catch (error) {
      throw new Error(
        `Failed to fetch user by email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all users with optional filtering
   */
  async getAll(filter?: UserFilters): Promise<UserProfile[]> {
    try {
      const users = await this.repository.findWithFilters(filter, {
        orderBy: "created_at",
        orderDirection: "desc",
      });

      if (users.length > 0) {
        return users;
      }

      // Fallback to admin RPC if direct query returned empty (may be RLS restriction)
      return this.repository.adminGetAllUsers();
    } catch (error) {
      logger.error("Failed to fetch users", error as Error, "UserService");
      return [];
    }
  }

  /**
   * Get all users (alias for getAll with no filter)
   */
  async getAllUsers(): Promise<UserProfile[]> {
    return this.getAll();
  }

  /**
   * Get all agents (users with 'agent' or 'active_agent' role)
   */
  async getAllAgents(): Promise<UserProfile[]> {
    try {
      return this.repository.findAllAgents();
    } catch (error) {
      throw new Error(
        `Failed to fetch agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all active agents (approved and licensed)
   */
  async getActiveAgents(): Promise<UserProfile[]> {
    return this.getAll({
      roles: ["active_agent"],
      approvalStatus: "approved",
      agentStatus: "licensed",
    });
  }

  /**
   * Get all recruits
   */
  async getRecruits(): Promise<UserProfile[]> {
    return this.getAll({ roles: ["recruit"] });
  }

  /**
   * Get all admins
   */
  async getAdmins(): Promise<UserProfile[]> {
    return this.getAll({ roles: ["admin"] });
  }

  /**
   * Get users by contract level
   */
  async getByContractLevel(contractLevel: number): Promise<UserProfile[]> {
    try {
      return this.repository.findWithFilters(
        { contractLevel },
        { orderBy: "first_name", orderDirection: "asc" },
      );
    } catch (error) {
      throw new Error(
        `Failed to fetch users by contract level: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get pending users (awaiting approval)
   */
  async getPendingUsers(): Promise<UserProfile[]> {
    try {
      return this.repository.adminGetPendingUsers();
    } catch (error) {
      logger.error("Error in getPendingUsers", error as Error, "UserService");
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // CREATE OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Create a new user with auth account and profile
   * Note: This uses an Edge Function to create the auth user,
   * then updates the profile created by the database trigger.
   */
  async create(
    userData: CreateUserProfileData & {
      name?: string;
      roles?: RoleName[];
      approval_status?: ApprovalStatus;
      onboarding_status?: string | null;
      sendInvite?: boolean;
      upline_id?: string | null;
      agent_status?: AgentStatus;
      contractCompLevel?: number;
    },
  ): Promise<{
    success: boolean;
    user?: UserProfile;
    userId?: string;
    error?: string;
    inviteSent?: boolean;
  }> {
    try {
      const email = userData.email.toLowerCase().trim();

      // Check if user already exists using repository
      const existingUser = await this.repository.emailExists(email);
      if (existingUser) {
        return {
          success: false,
          error: `A user with email ${email} already exists`,
        };
      }

      // Determine roles and status based on business rules
      const { assignedRoles, agentStatus, approvalStatus } =
        this.determineUserRolesAndStatus(userData);

      // Create auth user via Edge Function
      if (userData.sendInvite === false) {
        return {
          success: false,
          error:
            "Cannot create user without sending invite (auth user required)",
        };
      }

      const { data: result, error: invokeError } =
        await supabase.functions.invoke("create-auth-user", {
          body: {
            email,
            fullName:
              userData.name ||
              `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
            roles: assignedRoles,
            isAdmin: assignedRoles.includes("admin"),
            skipPipeline: false,
            phone: userData.phone || null,
          },
        });

      if (invokeError) {
        console.error(
          "[userService.create] Edge function failed:",
          invokeError,
        );
        return {
          success: false,
          error: `Auth user creation failed: ${invokeError.message || "Unknown error"}`,
        };
      }

      if (!result) {
        return {
          success: false,
          error: "Auth user creation returned no data",
        };
      }

      const authUserId = result.user?.id;
      const inviteSent = result.emailSent === true;

      if (!authUserId) {
        if (result.alreadyExists) {
          return {
            success: false,
            error: `A user with email ${email} already exists`,
          };
        }
        return {
          success: false,
          error: "Auth user was created but no ID was returned",
        };
      }

      // Parse name into first/last
      let firstName = userData.first_name || "";
      let lastName = userData.last_name || "";
      if (userData.name && !firstName) {
        const parts = userData.name.split(" ");
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }

      // Staff roles (trainer, contracting_manager) should NEVER have onboarding_status
      // This enforces business rule: staff don't go through the recruiting pipeline
      const isStaffRole = STAFF_ONLY_ROLES.some((role) =>
        assignedRoles.includes(role),
      );
      const finalOnboardingStatus = isStaffRole
        ? null
        : userData.onboarding_status || null;

      // Update the profile created by trigger using repository
      const profileData: Partial<UserProfileRow> = {
        first_name: firstName,
        last_name: lastName,
        phone: userData.phone || null,
        // Consolidate: use upline_id as canonical, keep recruiter_id in sync
        upline_id: userData.upline_id || userData.recruiter_id || null,
        recruiter_id: userData.upline_id || userData.recruiter_id || null,
        roles: assignedRoles,
        agent_status: agentStatus,
        approval_status: approvalStatus,
        onboarding_status: finalOnboardingStatus,
        contract_level:
          userData.contractCompLevel || userData.contract_level || null,
        license_number: userData.license_number || null,
        is_admin: assignedRoles.includes("admin"),
        referral_source: userData.referral_source || null,
        street_address: userData.street_address || null,
        city: userData.city || null,
        state: userData.state || null,
        zip: userData.zip || null,
        resident_state: userData.resident_state || null,
        date_of_birth: userData.date_of_birth || null,
        npn: userData.npn || null,
        imo_id: userData.imo_id || null,
        agency_id: userData.agency_id || null,
      };

      try {
        const updatedProfile = await this.repository.update(
          authUserId,
          profileData,
        );

        logger.info(
          `User created: ${email} (ID: ${authUserId})`,
          "UserService",
        );
        return {
          success: true,
          userId: authUserId,
          user: updatedProfile as UserProfile,
          inviteSent,
        };
      } catch (updateError) {
        logger.error(
          "Failed to update user profile after auth creation",
          updateError as Error,
          "UserService",
        );
        return {
          success: true,
          userId: authUserId,
          inviteSent,
          error: `Auth user created but profile update failed: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
        };
      }
    } catch (error) {
      logger.error("Error in create", error as Error, "UserService");
      return { success: false, error: "Failed to create user" };
    }
  }

  /**
   * Determine user roles and status based on business rules
   */
  private determineUserRolesAndStatus(userData: {
    roles?: RoleName[];
    agent_status?: AgentStatus;
    approval_status?: ApprovalStatus;
    contractCompLevel?: number;
    contract_level?: number | null;
  }): {
    assignedRoles: RoleName[];
    agentStatus: AgentStatus;
    approvalStatus: ApprovalStatus;
  } {
    let assignedRoles = userData.roles || [];
    let agentStatus: AgentStatus = userData.agent_status || "not_applicable";
    let approvalStatus: ApprovalStatus = userData.approval_status || "approved";

    if (assignedRoles.length === 0) {
      const contractLevel =
        userData.contractCompLevel || userData.contract_level;
      if (contractLevel && contractLevel >= 50) {
        assignedRoles = ["active_agent"];
        agentStatus = "licensed";
      } else if (contractLevel && contractLevel < 50) {
        assignedRoles = ["agent"];
        agentStatus = "licensed";
      } else {
        assignedRoles = ["recruit"];
        agentStatus = "unlicensed";
        approvalStatus = "pending";
      }
    } else {
      if (
        assignedRoles.includes("active_agent") ||
        assignedRoles.includes("agent")
      ) {
        agentStatus = "licensed";
      } else if (assignedRoles.includes("recruit")) {
        agentStatus = "unlicensed";
        approvalStatus = "pending";
      } else if (assignedRoles.includes("admin")) {
        agentStatus = "licensed";
      }
    }

    return { assignedRoles, agentStatus, approvalStatus };
  }

  // -------------------------------------------------------------------------
  // UPDATE OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Update a user profile
   */
  async update(
    id: string,
    updates: Partial<UserProfileRow> & {
      roles?: RoleName[];
      name?: string;
    },
  ): Promise<UserProfile> {
    const dbData: Partial<UserProfileRow> = { ...updates };

    // Handle name -> first_name/last_name
    if (updates.name !== undefined) {
      const parts = updates.name.split(" ");
      dbData.first_name = parts[0] || "";
      dbData.last_name = parts.slice(1).join(" ") || "";
      delete (dbData as Record<string, unknown>).name;
    }

    // Auto-set agent_status based on roles
    if (updates.roles) {
      dbData.agent_status = this.determineAgentStatusFromRoles(updates.roles);

      // Staff roles should NEVER have onboarding_status
      // If updating to staff role, nullify onboarding_status
      const isStaffRole = STAFF_ONLY_ROLES.some((role) =>
        updates.roles!.includes(role),
      );
      if (isStaffRole) {
        dbData.onboarding_status = null;
      }
    }

    // Keep recruiter_id in sync with upline_id during migration
    // This ensures recruits always have both fields set consistently
    if (updates.upline_id !== undefined) {
      dbData.recruiter_id = updates.upline_id;
    }

    try {
      return await this.repository.update(id, dbData);
    } catch (error) {
      // Don't mask the error with a fallback fetch - propagate the actual failure
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Determine agent status based on roles
   */
  private determineAgentStatusFromRoles(roles: RoleName[]): AgentStatus {
    if (roles.includes("active_agent") || roles.includes("agent")) {
      return "licensed";
    } else if (roles.includes("recruit")) {
      return "unlicensed";
    } else if (roles.includes("admin")) {
      return "licensed";
    }
    return "not_applicable";
  }

  /**
   * Update current user's profile
   */
  async updateCurrentUserProfile(
    updates: Partial<Omit<UserProfileRow, "roles">> & { roles?: string[] },
  ): Promise<UserProfile | null> {
    const currentUser = await this.getCurrentUserProfile();
    if (!currentUser) {
      throw new Error("No authenticated user");
    }
    return this.update(currentUser.id, updates);
  }

  /**
   * Update contract level
   */
  async updateContractLevel(
    userId: string,
    contractLevel: number | null,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (contractLevel !== null && !isValidContractLevel(contractLevel)) {
        return {
          success: false,
          error: `Invalid contract level. Must be one of: ${VALID_CONTRACT_LEVELS.join(", ")}`,
        };
      }

      await this.repository.update(userId, { contract_level: contractLevel });

      // Auto-upgrade agent role if contract level is high enough
      if (contractLevel && contractLevel >= 50) {
        const profile = await this.getUserProfile(userId);
        if (
          profile &&
          profile.roles?.includes("agent") &&
          !profile.roles?.includes("active_agent")
        ) {
          const newRoles = profile.roles.map((r) =>
            r === "agent" ? "active_agent" : r,
          );
          await this.update(userId, { roles: newRoles });
        }
      }

      logger.info(
        `User ${userId} contract level set to ${contractLevel}`,
        "UserService",
      );
      return { success: true };
    } catch (error) {
      logger.error(
        "Error in updateContractLevel",
        error as Error,
        "UserService",
      );
      return { success: false, error: "Failed to update contract level" };
    }
  }

  /**
   * Get user's contract level
   */
  async getUserContractLevel(userId: string): Promise<number> {
    const profile = await this.getUserProfile(userId);
    return profile?.contract_level || 100;
  }

  // -------------------------------------------------------------------------
  // APPROVAL OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Approve a user
   */
  async approve(
    userId: string,
    role: RoleName = "active_agent",
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: "Not authenticated" };
      }

      await this.repository.adminApproveUser(userId, user.id);

      // Update role if specified
      if (role && role !== "agent") {
        await this.update(userId, { roles: [role] });
      }

      return { success: true };
    } catch (error) {
      logger.error("Error in approve", error as Error, "UserService");
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to approve user",
      };
    }
  }

  /**
   * Deny a user
   */
  async deny(
    userId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: "Not authenticated" };
      }

      await this.repository.adminDenyUser(
        userId,
        user.id,
        reason || "No reason provided",
      );

      logger.info(`User ${userId} denied by ${user.id}`, "UserService");
      return { success: true };
    } catch (error) {
      logger.error("Error in deny", error as Error, "UserService");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to deny user",
      };
    }
  }

  /**
   * Set user to pending status
   */
  async setPending(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.repository.adminSetPendingUser(userId);
      return { success: true };
    } catch (error) {
      logger.error("Error in setPending", error as Error, "UserService");
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set user to pending",
      };
    }
  }

  /**
   * Graduate a recruit to agent using RPC (bypasses RLS)
   * The RPC handles update, activity logging, and notifications
   */
  async graduateRecruit({
    recruit,
    contractLevel,
    notes,
  }: {
    recruit: Pick<UserProfile, "id" | "first_name" | "last_name" | "upline_id">;
    contractLevel: number;
    notes?: string;
    graduatedBy?: string | null;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[userService.graduateRecruit] Starting RPC call:", {
        recruitId: recruit.id,
        contractLevel,
        notes,
      });

      const { data, error } = await supabase.rpc("graduate_recruit_to_agent", {
        p_recruit_id: recruit.id,
        p_contract_level: contractLevel,
        p_notes: notes || null,
      });

      console.log("[userService.graduateRecruit] RPC response:", {
        data,
        error,
      });

      if (error) {
        logger.error("Error in graduateRecruit RPC", error, "UserService");
        return { success: false, error: error.message };
      }

      // RPC returns JSON with success/error fields
      const result = data as {
        success: boolean;
        error?: string;
        message?: string;
      };

      console.log("[userService.graduateRecruit] Parsed result:", result);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to graduate recruit",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("[userService.graduateRecruit] Exception:", error);
      logger.error("Error in graduateRecruit", error as Error, "UserService");
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to graduate recruit",
      };
    }
  }

  /**
   * Set admin role for a user
   */
  async setAdminRole(
    userId: string,
    isAdmin: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.repository.adminSetAdminRole(userId, isAdmin);

      // Update roles array
      const profile = await this.getUserProfile(userId);
      if (profile) {
        const currentRoles = profile.roles || [];
        const newRoles = isAdmin
          ? [...currentRoles, "admin"].filter((v, i, a) => a.indexOf(v) === i)
          : currentRoles.filter((r) => r !== "admin");

        await this.update(userId, { roles: newRoles });
      }

      logger.info(`User ${userId} admin role set to ${isAdmin}`, "UserService");
      return { success: true };
    } catch (error) {
      logger.error("Error in setAdminRole", error as Error, "UserService");
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to set admin role",
      };
    }
  }

  // -------------------------------------------------------------------------
  // DELETE OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Hard delete a user and all related data
   */
  async delete(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.repository.adminDeleteUser(userId);

      if (!result.success) {
        logger.error("Delete user denied", result.error, "UserService");
        return result;
      }

      logger.info(`User ${userId} deleted`, "UserService");
      return { success: true };
    } catch (error) {
      logger.error("Error in delete", error as Error, "UserService");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete user",
      };
    }
  }

  // -------------------------------------------------------------------------
  // STATUS CHECK OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Check if current user is admin
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const profile = await this.getCurrentUserProfile();
      return (
        profile?.is_admin === true || profile?.roles?.includes("admin") || false
      );
    } catch (error) {
      logger.error(
        "Error in isCurrentUserAdmin",
        error as Error,
        "UserService",
      );
      return false;
    }
  }

  /**
   * Check if current user is approved
   */
  async isCurrentUserApproved(): Promise<boolean> {
    try {
      const profile = await this.getCurrentUserProfile();
      return (
        profile?.approval_status === "approved" ||
        profile?.is_admin === true ||
        false
      );
    } catch (error) {
      logger.error(
        "Error in isCurrentUserApproved",
        error as Error,
        "UserService",
      );
      return false;
    }
  }

  /**
   * Get current user's approval status
   */
  async getCurrentUserStatus(): Promise<ApprovalStatus | null> {
    try {
      const profile = await this.getCurrentUserProfile();
      return (profile?.approval_status as ApprovalStatus) || null;
    } catch (error) {
      logger.error(
        "Error in getCurrentUserStatus",
        error as Error,
        "UserService",
      );
      return null;
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    try {
      return this.repository.getApprovalStats();
    } catch (error) {
      logger.error("Error in getApprovalStats", error as Error, "UserService");
      return { total: 0, pending: 0, approved: 0, denied: 0 };
    }
  }

  // -------------------------------------------------------------------------
  // AUTH OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Map Supabase auth user to UserProfile (for initial login)
   * Used by AuthContext before full profile is loaded
   */
  mapAuthUserToProfile(supabaseUser: {
    id: string;
    email?: string;
    created_at: string;
    updated_at?: string;
    user_metadata?: Record<string, unknown>;
  }): Partial<UserProfile> {
    const metadata = supabaseUser.user_metadata || {};

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      first_name: (metadata.first_name as string) || null,
      last_name: (metadata.last_name as string) || null,
      phone: (metadata.phone as string) || null,
      contract_level: (metadata.contract_level as number) || null,
      roles: (metadata.roles as string[]) || null,
      is_admin: (metadata.is_admin as boolean) || false,
      created_at: supabaseUser.created_at,
      updated_at: supabaseUser.updated_at || null,
    };
  }

  /**
   * @deprecated Use mapAuthUserToProfile instead
   * Legacy method for backward compatibility with AuthContext
   * Returns the deprecated User type format
   */
  mapAuthUserToUser(supabaseUser: {
    id: string;
    email?: string;
    created_at: string;
    updated_at?: string;
    user_metadata?: Record<string, unknown>;
  }): {
    id: string;
    email: string;
    name?: string;
    phone?: string;
    contractCompLevel?: number;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    rawuser_meta_data?: Record<string, unknown>;
  } {
    const metadata = supabaseUser.user_metadata || {};

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name:
        (metadata.full_name as string) ||
        supabaseUser.email?.split("@")[0] ||
        "User",
      phone: metadata.phone as string | undefined,
      contractCompLevel: (metadata.contract_comp_level as number) || 100,
      isActive: metadata.is_active !== false,
      createdAt: new Date(supabaseUser.created_at),
      updatedAt: supabaseUser.updated_at
        ? new Date(supabaseUser.updated_at)
        : undefined,
      rawuser_meta_data: metadata,
    };
  }

  // -------------------------------------------------------------------------
  // BACKWARD COMPATIBILITY ALIASES
  // -------------------------------------------------------------------------

  /** @deprecated Use getUserProfile instead */
  async getById(userId: string): Promise<UserProfile | null> {
    return this.getUserProfile(userId);
  }

  /** @deprecated Use getUserProfile instead - alias for backward compatibility */
  async getAgentById(userId: string): Promise<UserProfile | null> {
    return this.getUserProfile(userId);
  }

  /** @deprecated Use create instead */
  async createUser(
    userData: Parameters<typeof this.create>[0],
  ): Promise<ReturnType<typeof this.create>> {
    return this.create(userData);
  }

  /** @deprecated Use update instead */
  async updateUser(
    id: string,
    updates: Parameters<typeof this.update>[1],
  ): Promise<{
    success: boolean;
    data?: {
      id: string;
      email: string;
      name?: string;
      phone?: string;
      contractCompLevel?: number;
      isActive?: boolean;
    };
    error?: string;
  }> {
    try {
      const result = await this.update(id, updates);
      // Convert to legacy User format
      return {
        success: true,
        data: {
          id: result.id,
          email: result.email,
          name:
            [result.first_name, result.last_name].filter(Boolean).join(" ") ||
            undefined,
          phone: result.phone || undefined,
          contractCompLevel: result.contract_level || undefined,
          isActive: result.approval_status === "approved",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update user",
      };
    }
  }

  /** @deprecated Use delete instead */
  async deleteUser(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.delete(userId);
  }

  /** @deprecated Use approve instead */
  async approveUser(
    userId: string,
    role?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.approve(userId, role);
  }

  /** @deprecated Use deny instead */
  async denyUser(
    userId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.deny(userId, reason);
  }

  /** @deprecated Use setPending instead */
  async setPendingUser(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.setPending(userId);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const userService = new UserService();

// Backward compatibility alias
export const userApprovalService = userService;

// Re-export types
export type { UserProfile, ApprovalStats };
