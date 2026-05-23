// src/types/user.types.ts
// Canonical user/agent type definitions - DATABASE-FIRST pattern
// All other files should import UserProfile from here
// TODO: all types/interfaces if possible should be inhereting from the database.types.ts file
// to maintain consistency throughout the app regarding interfaces/types

import type { Database, Json } from "./database.types";

// =============================================================================
// DATABASE-DERIVED TYPES (Source of Truth)
// =============================================================================

/** Raw database row type for user_profiles table */
export type UserProfileRow =
  Database["public"]["Tables"]["user_profiles"]["Row"];

/** Insert type for creating new user profiles */
export type UserProfileInsert =
  Database["public"]["Tables"]["user_profiles"]["Insert"];

/** Update type for modifying user profiles */
export type UserProfileUpdate =
  Database["public"]["Tables"]["user_profiles"]["Update"];

/** Agent status enum from database */
export type AgentStatus = Database["public"]["Enums"]["agent_status"];

/** Approval status values */
export type ApprovalStatus = "pending" | "approved" | "denied";

// NOTE: OnboardingStatus is NO LONGER a static type.
// Onboarding statuses are dynamic and come from the pipeline_phases table
// based on the recruit's assigned pipeline_template_id.
// Import TerminalStatus from recruiting.types.ts for terminal states (completed, dropped, etc.)

// =============================================================================
// USERPROFILE - Primary Interface (extends database row)
// =============================================================================

/**
 * UserProfile - The canonical user/agent interface
 *
 * This is the SINGLE SOURCE OF TRUTH for user profile types.
 * All components should import UserProfile from this file.
 *
 * Extends the database row type with optional join fields.
 */
export interface UserProfile extends UserProfileRow {
  // Optional nested upline data (populated by joins)
  upline?: Pick<
    UserProfileRow,
    "id" | "email" | "first_name" | "last_name"
  > | null;

  // Computed/legacy fields (for backward compatibility)
  // These are not in the database but used by app code
  full_name?: string; // Computed from first_name + last_name
  agent_code?: string; // Legacy field
  license_state?: string; // Alias for resident_state
  license_states?: string[]; // Multiple license states
  notes?: string; // User notes
  hire_date?: string; // When agent was hired
  ytd_commission?: number; // Year-to-date commission (calculated)
  ytd_premium?: number; // Year-to-date premium (calculated)
}

/**
 * Minimal user profile for UI components (messaging, avatars, etc.)
 */
export type UserProfileMinimal = Pick<
  UserProfileRow,
  "id" | "first_name" | "last_name" | "email" | "profile_photo_url"
>;

/**
 * User profile with hierarchy fields required (not nullable)
 * Use when hierarchy context is guaranteed
 */
export interface UserProfileWithHierarchy extends UserProfile {
  hierarchy_path: string;
  hierarchy_depth: number;
  upline_id: string | null;
}

// =============================================================================
// FORM & INPUT TYPES
// =============================================================================

/**
 * Data for creating a new user profile
 */
export interface CreateUserProfileData {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  /**
   * Direct manager in the hierarchy tree (canonical field).
   * This person supervises and manages the user.
   */
  upline_id?: string | null;
  /**
   * @deprecated Use upline_id instead. In practice, the recruiter is
   * always the same as the upline. This field is retained for backward
   * compatibility and will be kept in sync with upline_id.
   */
  recruiter_id?: string | null;
  referral_source?: string | null;
  agent_status?: AgentStatus;
  contract_level?: number | null;
  roles?: string[];
  is_admin?: boolean;
  pipeline_template_id?: string | null;
  // Address fields
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  date_of_birth?: string | null;
  resident_state?: string | null;
  // Licensing
  license_number?: string | null;
  npn?: string | null;
  licensing_info?: Json | null;
  // Organization
  imo_id?: string;
  agency_id?: string | null;
  // Recruiting
  recruiter_slug?: string | null;
}

/**
 * Data for updating an existing user profile
 */
export type UpdateUserProfileData = Partial<CreateUserProfileData> & {
  id: string;
};

// =============================================================================
// ADMIN & APPROVAL TYPES
// =============================================================================

/**
 * Statistics for user approval workflow
 * Moved from userService.ts to proper location
 */
export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
}

/**
 * User with computed display fields
 */
export interface UserProfileWithDisplay extends UserProfile {
  full_name: string; // Computed: first_name + last_name
  display_name: string; // Computed: full_name or email
}

// =============================================================================
// USER PREFERENCES
// =============================================================================

export interface UserPreferences {
  theme: "light" | "dark";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  currency: "USD" | "EUR" | "GBP" | "CAD";
  defaultCommissionRate: number;
  notifications: {
    emailReports: boolean;
    policyReminders: boolean;
    goalAchievements: boolean;
  };
}

// Chargeback types moved to commission.types.ts
// Import from there: import { Chargeback, CreateChargebackData } from './commission.types'

// =============================================================================
// UI TYPES
// =============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  isActive?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get full name from user profile
 */
export function getFullName(
  user: Pick<UserProfileRow, "first_name" | "last_name">,
): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "";
}

/**
 * Get display name (full name or email fallback)
 */
export function getDisplayName(
  user: Pick<UserProfileRow, "first_name" | "last_name" | "email">,
): string {
  const fullName = getFullName(user);
  return fullName || user.email;
}

/**
 * Get initials from user profile
 */
export function getUserInitials(
  user: Pick<UserProfileRow, "first_name" | "last_name">,
): string {
  const first = user.first_name?.[0] || "";
  const last = user.last_name?.[0] || "";
  return (first + last).toUpperCase() || "?";
}

// =============================================================================
// AGENT SETTINGS TYPES (merged from agent.types.ts)
// =============================================================================

/**
 * Agent settings for commission tracking
 */
export interface AgentSettings {
  id: string;
  userId: string;
  contractLevel: number; // 80-145
  firstName?: string;
  lastName?: string;
  agentCode?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NewAgentSettingsForm {
  contractLevel: number;
  firstName?: string;
  lastName?: string;
  agentCode?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
}

export interface UpdateAgentSettingsForm extends Partial<NewAgentSettingsForm> {
  id: string;
}

export type CreateAgentSettingsData = Omit<
  AgentSettings,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Agent profile with performance metrics
 */
export interface AgentProfile extends AgentSettings {
  totalCommissions: number;
  totalPolicies: number;
  averageCommissionRate: number;
  monthlyCommissions: number;
  yearToDateCommissions: number;
}
