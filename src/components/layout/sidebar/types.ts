// src/components/layout/sidebar/types.ts
// UI-layer types for declarative sidebar navigation configuration.

import type { ElementType } from "react";
import type { FeatureKey } from "@/hooks/subscription";
import type { PermissionCode } from "@/types/permissions.types";

export interface SidebarNavigationItem {
  icon: ElementType;
  label: string;
  href: string;
  permission?: PermissionCode;
  public?: boolean;
  subscriptionFeature?: FeatureKey;
  subscriptionFeatures?: FeatureKey[];
  superAdminOnly?: boolean;
  allowedEmails?: string[];
  allowedAgencyId?: string;
  requiresLicensingWorkspace?: boolean;
  requiresUnderwritingEnabled?: boolean;
  requiresUnderwritingManage?: boolean;
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
