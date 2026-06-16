// src/components/layout/sidebar/types.ts
// UI-layer types for declarative sidebar navigation configuration.

import type { ElementType } from "react";
import type { FeatureKey } from "@/hooks/subscription";
import type { PermissionCode } from "@/types/permissions.types";

export interface SidebarNavigationItem {
  icon: ElementType;
  label: string;
  href: string;
  /** Visually elevate this item as a primary/anchor destination in the rail. */
  primary?: boolean;
  permission?: PermissionCode;
  public?: boolean;
  subscriptionFeature?: FeatureKey;
  subscriptionFeatures?: FeatureKey[];
  superAdminOnly?: boolean;
  allowedEmails?: string[];
  /** Only show if the user's email contains this substring, case-insensitive (super-admins bypass). */
  requireEmailIncludes?: string;
  allowedAgencyId?: string;
  requiresLicensingWorkspace?: boolean;
  requiresUnderwritingEnabled?: boolean;
  requiresUnderwritingManage?: boolean;
  /** Only show for users with an active paid subscription (super-admins bypass). */
  requiresPaidSubscription?: boolean;
  /** Only show for users with AI access — team-free (super-admin/free_all_features)
   *  or the ai_assistant add-on. Used for AI surfaces like AI Sales Scripts. */
  requiresAiAccess?: boolean;
}

export interface SidebarNavigationGroup {
  id: string;
  label: string;
  items: SidebarNavigationItem[];
  defaultCollapsed?: boolean;
  separatorAfter?: boolean;
}

export type SidebarNavigationVariant = "regular" | "staff" | "recruit";

export interface ResolvedSidebarNavigationItem extends SidebarNavigationItem {
  state: "visible" | "locked";
}

export interface ResolvedSidebarNavigationGroup {
  id: string;
  label: string;
  items: ResolvedSidebarNavigationItem[];
  defaultCollapsed?: boolean;
  separatorAfter?: boolean;
}
