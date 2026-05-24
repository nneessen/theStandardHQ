// src/hooks/permissions/usePermissions.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PermissionCode,
  RoleName,
  Permission,
  PermissionWithSource,
} from "@/types/permissions.types";
import {
  getUserPermissionsContext,
  getUserPermissions,
  getUserRoles,
  hasPermission,
  hasRole,
  isAdminUser,
  getAllRoles,
  getAllRolesWithPermissions,
  getAllPermissions,
  getRolePermissionsWithInheritance,
  setUserRoles,
  assignPermissionToRole,
  removePermissionFromRole,
  createRole,
  updateRole,
  deleteRole,
  createPermission,
  updatePermission,
  deletePermission,
  type CreateRoleInput,
  type UpdateRoleInput,
  type CreatePermissionInput,
  type UpdatePermissionInput,
} from "@/services/permissions/permissionService";

// Re-export types for convenience
export type {
  CreateRoleInput,
  UpdateRoleInput,
  CreatePermissionInput,
  UpdatePermissionInput,
};

// ============================================
// QUERY KEYS
// ============================================

export const permissionKeys = {
  all: ["permissions"] as const,
  userPermissions: (userId: string) => ["permissions", "user", userId] as const,
  userRoles: (userId: string) => ["permissions", "roles", userId] as const,
  userContext: (userId: string) => ["permissions", "context", userId] as const,
  allRoles: ["permissions", "all-roles"] as const,
  allRolesWithPermissions: [
    "permissions",
    "all-roles",
    "with-permissions",
  ] as const,
  allPermissions: ["permissions", "all-permissions"] as const,
  hasPermission: (userId: string, code: PermissionCode) =>
    ["permissions", "has", userId, code] as const,
  hasRole: (userId: string, role: RoleName) =>
    ["permissions", "has-role", userId, role] as const,
  isAdmin: (userId: string) => ["permissions", "is-admin", userId] as const,
  role: (id: string) => ["roles", id] as const,
  rolePermissions: (id: string) => ["roles", id, "permissions"] as const,
  rolePermissionsInherited: (id: string) =>
    ["roles", id, "permissions", "inherited"] as const,
};

// ============================================
// USER PERMISSION HOOKS
// ============================================

/**
 * Get current user's full permissions context (roles + permissions)
 */
export function useUserPermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.userContext(user?.id || ""),
    queryFn: () => getUserPermissionsContext(user!.id!),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Get current user's permission codes only
 */
export function useUserPermissionCodes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.userPermissions(user?.id || ""),
    queryFn: () => getUserPermissions(user!.id!),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get current user's roles
 */
export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.userRoles(user?.id || ""),
    queryFn: () => getUserRoles(user!.id!),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Check if current user has a specific permission
 */
export function useHasPermission(permissionCode: PermissionCode) {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.hasPermission(user?.id || "", permissionCode),
    queryFn: () => hasPermission(user!.id!, permissionCode),
    enabled: !!user?.id && !!permissionCode,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Check if current user has a specific role
 */
export function useHasRole(roleName: RoleName) {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.hasRole(user?.id || "", roleName),
    queryFn: () => hasRole(user!.id!, roleName),
    enabled: !!user?.id && !!roleName,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Check if current user is an admin
 */
export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: permissionKeys.isAdmin(user?.id || ""),
    queryFn: () => isAdminUser(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to check multiple permissions and roles
 * Returns helper functions for permission checks
 * CRITICAL: Uses React Query's isPending/isFetching for accurate loading state
 */
export function usePermissionCheck() {
  const { user, loading: authLoading } = useAuth();
  const {
    data: permissionsContext,
    isPending,
    isFetching,
  } = useUserPermissions();

  // Super-admin is a column on the profile, not a role in the roles table, so the
  // role-based permission set never includes super-admin grants. Bypass code-level
  // permission checks for super-admins (mirrors how subscription feature gates already
  // bypass for admins). Tenant boundaries are still enforced server-side by RLS
  // (get_effective_imo_id / row_in_acting_scope), so this only widens client-side
  // visibility, never cross-tenant data access.
  const isSuperAdmin = user?.is_super_admin === true;

  // Loading if: auth loading, query pending, query fetching, or user exists but no data yet
  const isLoading =
    authLoading ||
    isPending ||
    isFetching ||
    (!!user?.id && !permissionsContext);

  const can = (permissionCode: PermissionCode): boolean => {
    if (isSuperAdmin) return true;
    if (!permissionsContext) return false;
    return permissionsContext.permissions.includes(permissionCode);
  };

  const canAny = (permissionCodes: PermissionCode[]): boolean => {
    if (isSuperAdmin) return true;
    if (!permissionsContext) return false;
    return permissionCodes.some((code) =>
      permissionsContext.permissions.includes(code),
    );
  };

  const canAll = (permissionCodes: PermissionCode[]): boolean => {
    if (isSuperAdmin) return true;
    if (!permissionsContext) return false;
    return permissionCodes.every((code) =>
      permissionsContext.permissions.includes(code),
    );
  };

  const is = (roleName: RoleName): boolean => {
    if (!permissionsContext) return false;
    return permissionsContext.roles.includes(roleName);
  };

  const isAnyRole = (roleNames: RoleName[]): boolean => {
    if (!permissionsContext) return false;
    return roleNames.some((role) => permissionsContext.roles.includes(role));
  };

  const isAdmin = (): boolean => {
    if (!permissionsContext) return false;
    return permissionsContext.roles.includes("admin");
  };

  return {
    can,
    canAny,
    canAll,
    is,
    isAnyRole,
    isAdmin,
    permissions: permissionsContext?.permissions || [],
    roles: permissionsContext?.roles || [],
    isLoading,
  };
}

// ============================================
// ADMIN HOOKS (ROLE & PERMISSION MANAGEMENT)
// ============================================

/**
 * Get all system roles (admin only)
 */
export function useAllRoles() {
  return useQuery({
    queryKey: permissionKeys.allRoles,
    queryFn: getAllRoles,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

/**
 * Get all system roles with permissions populated (admin only)
 */
export function useAllRolesWithPermissions() {
  return useQuery({
    queryKey: permissionKeys.allRolesWithPermissions,
    queryFn: getAllRolesWithPermissions,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

/**
 * Get all system permissions (admin only)
 */
export function useAllPermissions() {
  return useQuery({
    queryKey: permissionKeys.allPermissions,
    queryFn: getAllPermissions,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Get permissions for a specific role with inheritance
 * Uses efficient database recursive CTE for single-query fetching
 */
export function useRolePermissionsWithInheritance(roleId: string | undefined) {
  return useQuery({
    queryKey: roleId
      ? permissionKeys.rolePermissionsInherited(roleId)
      : ["empty"],
    queryFn: () => getRolePermissionsWithInheritance(roleId!),
    enabled: !!roleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Mutation to update user roles (admin only)
 */
export function useUpdateUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: RoleName[] }) =>
      setUserRoles(userId, roles),
    onSuccess: (_, variables) => {
      // Invalidate user permissions cache
      queryClient.invalidateQueries({
        queryKey: permissionKeys.userContext(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.userRoles(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.userPermissions(variables.userId),
      });
    },
  });
}

/**
 * Mutation: Assign permission to role with optimistic updates
 * Provides instant UI feedback and automatic rollback on error
 */
export function useAssignPermissionToRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      permissionId,
    }: {
      roleId: string;
      permissionId: string;
    }) => assignPermissionToRole(roleId, permissionId),

    // Optimistic update - instant feedback
    onMutate: async ({ roleId, permissionId }) => {
      // Cancel outgoing queries for this role
      await queryClient.cancelQueries({
        queryKey: permissionKeys.rolePermissionsInherited(roleId),
      });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<PermissionWithSource[]>(
        permissionKeys.rolePermissionsInherited(roleId),
      );

      // Optimistically add permission to cache
      if (previousData) {
        const allPermissions = queryClient.getQueryData<Permission[]>(
          permissionKeys.allPermissions,
        );
        const newPermission = allPermissions?.find(
          (p) => p.id === permissionId,
        );

        if (newPermission) {
          queryClient.setQueryData<PermissionWithSource[]>(
            permissionKeys.rolePermissionsInherited(roleId),
            [...previousData, { ...newPermission, permissionType: "direct" }],
          );
        }
      }

      return { previousData };
    },

    // Rollback on error
    onError: (err, { roleId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          permissionKeys.rolePermissionsInherited(roleId),
          context.previousData,
        );
      }
      console.error("Failed to assign permission:", err);
    },

    // Refetch on success to ensure consistency
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({
        queryKey: permissionKeys.rolePermissionsInherited(roleId),
      });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.rolePermissions(roleId),
      });
      // Invalidate the roles list used by AdminControlCenter
      queryClient.invalidateQueries({
        queryKey: permissionKeys.allRolesWithPermissions,
      });
    },
  });
}

/**
 * Mutation: Remove permission from role with optimistic updates
 * Provides instant UI feedback and automatic rollback on error
 */
export function useRemovePermissionFromRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      permissionId,
    }: {
      roleId: string;
      permissionId: string;
    }) => removePermissionFromRole(roleId, permissionId),

    // Optimistic update
    onMutate: async ({ roleId, permissionId }) => {
      await queryClient.cancelQueries({
        queryKey: permissionKeys.rolePermissionsInherited(roleId),
      });

      const previousData = queryClient.getQueryData<PermissionWithSource[]>(
        permissionKeys.rolePermissionsInherited(roleId),
      );

      // Optimistically remove permission from cache
      if (previousData) {
        queryClient.setQueryData<PermissionWithSource[]>(
          permissionKeys.rolePermissionsInherited(roleId),
          previousData.filter((p) => p.id !== permissionId),
        );
      }

      return { previousData };
    },

    // Rollback on error
    onError: (err, { roleId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          permissionKeys.rolePermissionsInherited(roleId),
          context.previousData,
        );
      }
      console.error("Failed to remove permission:", err);
    },

    // Refetch on success
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({
        queryKey: permissionKeys.rolePermissionsInherited(roleId),
      });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.rolePermissions(roleId),
      });
      // Invalidate the roles list used by AdminControlCenter
      queryClient.invalidateQueries({
        queryKey: permissionKeys.allRolesWithPermissions,
      });
    },
  });
}

// ============================================
// ROLE CRUD MUTATIONS
// ============================================

/**
 * Create a new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoleInput) => createRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.allRoles });
    },
  });
}

/**
 * Update an existing role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      input,
    }: {
      roleId: string;
      input: UpdateRoleInput;
    }) => updateRole(roleId, input),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.allRoles });
      queryClient.invalidateQueries({ queryKey: permissionKeys.role(roleId) });
      // Invalidate all user permissions as role changes affect users
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

/**
 * Delete a role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.allRoles });
      // Invalidate all user permissions as deleting a role affects users
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

// ============================================
// PERMISSION CRUD MUTATIONS
// ============================================

/**
 * Create a new permission
 */
export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePermissionInput) => createPermission(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: permissionKeys.allPermissions,
      });
    },
  });
}

/**
 * Update an existing permission
 */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      permissionId,
      input,
    }: {
      permissionId: string;
      input: UpdatePermissionInput;
    }) => updatePermission(permissionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: permissionKeys.allPermissions,
      });
      // Invalidate all queries as permission changes affect everyone
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

/**
 * Delete a permission
 */
export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: string) => deletePermission(permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: permissionKeys.allPermissions,
      });
      // Invalidate all queries as permission deletions affect everyone
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}
