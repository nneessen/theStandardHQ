// src/features/admin/utils/permissionHelpers.ts

import type { PermissionWithSource } from "@/types/permissions.types";
import { User, Users, Globe, UserCircle } from "lucide-react";

/**
 * Permission Helper Utilities
 * Functions for managing permission display, grouping, and deduplication
 */

/**
 * Get color classes for permission scope (accessible with icons)
 * Uses the shared TINT palette (soft fill + readable text, both themes).
 */
export function getScopeColor(scope: string): string {
  const colors: Record<string, string> = {
    own: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    downline:
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
    all: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    self: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  };
  return (
    colors[scope] ||
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30"
  );
}

/**
 * Get icon component for permission scope (for accessibility)
 * Icons provide visual cues beyond color alone
 */
export function getScopeIcon(scope: string) {
  const icons = {
    own: User,
    downline: Users,
    all: Globe,
    self: UserCircle,
  };
  return icons[scope as keyof typeof icons] || User;
}

/**
 * Get aria-label for screen readers
 * Provides accessible descriptions for assistive technology
 */
export function getScopeAriaLabel(scope: string, code: string): string {
  return `${code} - ${scope} scope permission`;
}

/**
 * Deduplicated permission with multiple sources
 * Handles case where permission is both direct AND inherited
 */
export interface DeduplicatedPermission extends PermissionWithSource {
  sources: Array<"direct" | "inherited">;
  inheritedFromRoles: string[];
}

/**
 * Group permissions by category (resource)
 * Organizes permissions for cleaner UI display
 */
export function groupPermissionsByCategory(
  permissions: DeduplicatedPermission[],
): Record<string, DeduplicatedPermission[]> {
  return permissions.reduce(
    (acc, perm) => {
      const category = perm.resource;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(perm);
      return acc;
    },
    {} as Record<string, DeduplicatedPermission[]>,
  );
}

/**
 * Deduplicate permissions and mark sources
 * Prevents showing the same permission twice
 * Tracks whether permission is direct, inherited, or both
 */
export function deduplicatePermissions(
  permissions: PermissionWithSource[],
): DeduplicatedPermission[] {
  const permMap = new Map<string, DeduplicatedPermission>();

  for (const perm of permissions) {
    const existing = permMap.get(perm.id);

    if (existing) {
      // Permission already exists - add source
      if (!existing.sources.includes(perm.permissionType)) {
        existing.sources.push(perm.permissionType);
      }
      if (
        perm.inheritedFromRoleName &&
        !existing.inheritedFromRoles.includes(perm.inheritedFromRoleName)
      ) {
        existing.inheritedFromRoles.push(perm.inheritedFromRoleName);
      }
    } else {
      // First time seeing this permission
      permMap.set(perm.id, {
        ...perm,
        sources: [perm.permissionType],
        inheritedFromRoles: perm.inheritedFromRoleName
          ? [perm.inheritedFromRoleName]
          : [],
      });
    }
  }

  return Array.from(permMap.values());
}
