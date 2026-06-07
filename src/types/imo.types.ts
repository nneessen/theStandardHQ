// src/types/imo.types.ts
// Types for Multi-IMO / Multi-Agency architecture

import type { Database, Json } from "./database.types";

// =============================================================================
// IMO ROLE CONSTANTS - MEDIUM-1 fix: Centralize role names to avoid magic strings
// =============================================================================

/**
 * IMO-related role names - use these constants instead of hardcoded strings
 */
export const IMO_ROLES = {
  IMO_OWNER: "imo_owner",
  IMO_ADMIN: "imo_admin",
} as const;

export type ImoRoleName = (typeof IMO_ROLES)[keyof typeof IMO_ROLES];

/**
 * Check if a roles array includes IMO admin privileges
 */
export function hasImoAdminRole(roles: string[] | null | undefined): boolean {
  if (!roles) return false;
  return (
    roles.includes(IMO_ROLES.IMO_OWNER) || roles.includes(IMO_ROLES.IMO_ADMIN)
  );
}

/**
 * Check if a roles array includes IMO owner role
 */
export function hasImoOwnerRole(roles: string[] | null | undefined): boolean {
  if (!roles) return false;
  return roles.includes(IMO_ROLES.IMO_OWNER);
}

// =============================================================================
// DATABASE ROW TYPES - Imported from generated database.types.ts
// =============================================================================

export type ImoRow = Database["public"]["Tables"]["imos"]["Row"];
export type ImoInsert = Database["public"]["Tables"]["imos"]["Insert"];
export type ImoUpdate = Database["public"]["Tables"]["imos"]["Update"];

// Alias for backward compatibility
export type UpdateImoData = ImoUpdate;

export type AgencyRow = Database["public"]["Tables"]["agencies"]["Row"];
export type AgencyInsert = Database["public"]["Tables"]["agencies"]["Insert"];
export type AgencyUpdate = Database["public"]["Tables"]["agencies"]["Update"];

// Alias for backward compatibility
export type UpdateAgencyData = AgencyUpdate;

// =============================================================================
// EXTENDED INTERFACES
// =============================================================================

/**
 * IMO with related data
 */
export interface Imo extends ImoRow {
  agencies?: Agency[];
  agent_count?: number;
}

/**
 * Agency with related data
 */
export interface Agency extends AgencyRow {
  imo?: Imo;
  owner?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  agent_count?: number;
}

// =============================================================================
// IMO ROLES
// =============================================================================

/**
 * Roles specific to IMO/Agency hierarchy
 */
export type ImoRole =
  | "imo_owner" // Full control over IMO
  | "imo_admin" // Manage agencies/agents within IMO
  | "agency_owner" // Manage their agency and downlines
  | "trainer" // Training access
  | "agent"; // Regular agent

/**
 * Check if user has a specific IMO role
 */
export function hasImoRole(roles: string[] | null, role: ImoRole): boolean {
  return roles?.includes(role) ?? false;
}

/**
 * Check if user is an IMO admin (owner or admin)
 */
export function isImoAdmin(roles: string[] | null): boolean {
  return hasImoRole(roles, "imo_owner") || hasImoRole(roles, "imo_admin");
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(isSuperAdmin: boolean | null): boolean {
  return isSuperAdmin === true;
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * IMO context type for React context
 */
export interface ImoContextType {
  // Current IMO and Agency
  imo: Imo | null;
  agency: Agency | null;

  // Role flags (derived from user profile)
  isImoOwner: boolean;
  isImoAdmin: boolean;
  isAgencyOwner: boolean;
  isSuperAdmin: boolean;

  // Loading/error state
  loading: boolean;
  error: Error | null;

  // Super-admin acting IMO selection.
  // When isSuperAdmin, this holds the current sidebar selection:
  //   - null              → "Own IMO" (default; scopes to the super-admin's home IMO)
  //   - a uuid            → acting as that specific IMO
  //   - ALL_IMOS_SENTINEL → explicit "All IMOs" cross-tenant view
  // Persists in sessionStorage; clears on browser close.
  actingImoId: string | null;
  setActingImoId: (imoId: string | null) => Promise<void> | void;

  // Effective IMO id for writes/filters. The single source of truth that BOTH
  // the app layer and RLS scope to: the selected/home IMO, or null only in the
  // explicit "All IMOs" mode.
  effectiveImoId: string | null;

  // True only when a super-admin has explicitly chosen the cross-tenant
  // "All IMOs" view (effectiveImoId is null and data spans every IMO).
  isViewingAllImos: boolean;

  // Actions
  refetch: () => Promise<void>;
}

// =============================================================================
// FORM TYPES
// =============================================================================

/**
 * Data for creating a new IMO
 */
export interface CreateImoData {
  name: string;
  code: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  settings?: Json;
}

/**
 * Data for creating a new Agency
 */
export interface CreateAgencyData {
  imo_id: string;
  name: string;
  code: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  logo_url?: string;
  owner_id?: string;
  settings?: Json;
}

// =============================================================================
// QUERY/FILTER TYPES
// =============================================================================

/**
 * Filters for querying IMOs
 */
export interface ImoFilters {
  is_active?: boolean;
  code?: string;
}

/**
 * Filters for querying Agencies
 */
export interface AgencyFilters {
  imo_id?: string;
  is_active?: boolean;
  code?: string;
  owner_id?: string;
}

// =============================================================================
// METRICS TYPES
// =============================================================================

/**
 * IMO-level metrics
 */
export interface ImoMetrics {
  total_agencies: number;
  total_agents: number;
  active_agents: number;
  total_policies: number;
  total_premium: number;
  total_commissions: number;
}

/**
 * Agency-level metrics
 */
export interface AgencyMetrics {
  total_agents: number;
  active_agents: number;
  total_policies: number;
  total_premium: number;
  total_commissions: number;
  total_override_commissions: number;
}

// =============================================================================
// DASHBOARD METRICS TYPES (Phase 5)
// =============================================================================

/**
 * IMO Dashboard Metrics - aggregated metrics for IMO admins
 */
export interface ImoDashboardMetrics {
  imo_id: string;
  imo_name: string;
  total_active_policies: number;
  total_annual_premium: number;
  total_commissions_ytd: number;
  total_earned_ytd: number;
  total_unearned: number;
  agent_count: number;
  agency_count: number;
  avg_production_per_agent: number;
}

/**
 * Agency Dashboard Metrics - aggregated metrics for agency owners
 */
export interface AgencyDashboardMetrics {
  agency_id: string;
  agency_name: string;
  imo_id: string;
  active_policies: number;
  total_annual_premium: number;
  total_commissions_ytd: number;
  total_earned_ytd: number;
  total_unearned: number;
  agent_count: number;
  avg_production_per_agent: number;
  top_producer_id: string | null;
  top_producer_name: string | null;
  top_producer_premium: number;
}

/**
 * IMO Production by Agency - breakdown for IMO admins
 * This is the SINGLE SOURCE OF TRUTH for agency production metrics.
 * Used by both dashboard and reports.
 */
export interface ImoProductionByAgency {
  agency_id: string;
  agency_name: string;
  agency_code: string;
  owner_name: string;
  // Policy metrics
  new_policies: number;
  policies_lapsed: number;
  retention_rate: number;
  // Financial metrics
  new_premium: number;
  commissions_earned: number;
  // Agent metrics
  agent_count: number;
  avg_premium_per_agent: number;
  // Rankings
  rank_by_premium: number;
  rank_by_policies: number;
  pct_of_imo_premium: number;
}

/**
 * Agency Production by Agent - breakdown for agency owners
 */
export interface AgencyProductionByAgent {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  contract_level: number;
  active_policies: number;
  total_annual_premium: number;
  commissions_ytd: number;
  earned_ytd: number;
  unearned_amount: number;
  pct_of_agency_production: number;
  joined_date: string;
}

// =============================================================================
// OVERRIDE COMMISSION SUMMARY TYPES (Phase 7)
// =============================================================================

/**
 * IMO Override Summary - aggregate override metrics for IMO admins
 */
export interface ImoOverrideSummary {
  imo_id: string;
  imo_name: string;
  total_override_count: number;
  total_override_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  chargeback_amount: number;
  unique_uplines: number;
  unique_downlines: number;
  avg_override_per_policy: number;
}

/**
 * Agency Override Summary - aggregate override metrics for agency owners
 */
export interface AgencyOverrideSummary {
  agency_id: string;
  agency_name: string;
  total_override_count: number;
  total_override_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  chargeback_amount: number;
  unique_uplines: number;
  unique_downlines: number;
  avg_override_per_policy: number;
  top_earner_id: string | null;
  top_earner_name: string | null;
  top_earner_amount: number;
}

/**
 * Override by Agency - breakdown for IMO admins
 */
export interface OverrideByAgency {
  agency_id: string;
  agency_name: string;
  agency_code: string;
  override_count: number;
  total_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  pct_of_imo_overrides: number;
}

/**
 * Override by Agent - breakdown for agency owners
 */
export interface OverrideByAgent {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  override_count: number;
  total_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  avg_per_override: number;
  pct_of_agency_overrides: number;
}

// =============================================================================
// RECRUITING SUMMARY TYPES (Phase 8)
// =============================================================================

/**
 * Recruiting status counts by onboarding status
 */
export interface RecruitingStatusCounts {
  [status: string]: number;
}

/**
 * IMO Recruiting Summary - aggregate recruiting metrics for IMO admins
 */
export interface ImoRecruitingSummary {
  total_recruits: number;
  by_status: RecruitingStatusCounts;
  by_agent_status: RecruitingStatusCounts;
  conversion_rate: number;
  avg_days_to_complete: number | null;
  active_in_pipeline: number;
  completed_count: number;
  dropped_count: number;
}

/**
 * Agency Recruiting Summary - aggregate recruiting metrics for agency owners
 */
export interface AgencyRecruitingSummary {
  total_recruits: number;
  by_status: RecruitingStatusCounts;
  by_agent_status: RecruitingStatusCounts;
  conversion_rate: number;
  avg_days_to_complete: number | null;
  active_in_pipeline: number;
  completed_count: number;
  dropped_count: number;
}

/**
 * Recruiting by Agency - breakdown for IMO admins
 */
export interface RecruitingByAgency {
  agency_id: string;
  agency_name: string;
  total_recruits: number;
  active_in_pipeline: number;
  completed_count: number;
  dropped_count: number;
  conversion_rate: number;
  licensed_count: number;
}

/**
 * Recruiting by Recruiter - breakdown for agency owners
 */
export interface RecruitingByRecruiter {
  recruiter_id: string;
  recruiter_name: string;
  recruiter_email: string;
  total_recruits: number;
  active_in_pipeline: number;
  completed_count: number;
  dropped_count: number;
  conversion_rate: number;
  licensed_count: number;
}

// =============================================================================
// CASCADE AGENCY ASSIGNMENT TYPES
// =============================================================================

/**
 * Result from the cascade_agency_assignment RPC function
 */
export interface CascadeAssignmentResult {
  success: boolean;
  ownerUpdated: boolean;
  downlinesUpdated: number;
  totalUpdated: number;
  ownerName?: string;
  ownerHierarchyPath?: string;
  error?: string;
  errorDetail?: string;
}

/**
 * Preview data for cascade assignment - shows how many users would be affected
 */
export interface CascadePreview {
  ownerName: string;
  downlineCount: number;
  totalCount: number;
}

/**
 * Options for creating an agency with cascade assignment
 */
export interface CreateAgencyWithCascadeOptions {
  cascadeDownlines?: boolean;
}

/**
 * Result from createAgencyWithCascade - includes agency and optional cascade result
 */
export interface CreateAgencyWithCascadeResult {
  agency: AgencyRow;
  cascadeResult?: CascadeAssignmentResult;
}
