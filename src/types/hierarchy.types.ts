// src/types/hierarchy.types.ts
// Type definitions for insurance agency hierarchy system

import type { CommissionStatus } from "./commission.types";
import type { UserProfile } from "./user.types";

// Re-export UserProfile for backward compatibility
// All new code should import directly from user.types.ts
export type { UserProfile } from "./user.types";

/**
 * Hierarchical tree node representing an agent and their downlines
 */
export interface HierarchyNode extends UserProfile {
  children: HierarchyNode[];
  downline_count: number; // Total count of all descendants
  direct_downline_count: number; // Immediate children only
  contractCompLevel?: number; // From auth.users metadata
  override_earnings?: number; // Total override earnings from this agent
}

/**
 * Override commission record
 * Earned by uplines from downline policy sales
 */
export interface OverrideCommission {
  id: string;

  // Relationships
  policy_id: string;
  base_agent_id: string; // Who wrote the policy
  override_agent_id: string; // Who earns the override

  // Hierarchy tracking
  hierarchy_depth: number; // 1 = immediate upline, 2 = upline's upline, etc.

  // Commission calculation details
  base_comp_level: number; // e.g., 100
  override_comp_level: number; // e.g., 120
  carrier_id: string;
  product_id: string | null;
  policy_premium: number;

  // Calculated amounts
  base_commission_amount: number; // What downline earned
  override_commission_amount: number; // Difference (upline - downline)

  // Advance tracking (same as base commissions)
  advance_months: number;
  months_paid: number;
  earned_amount: number;
  unearned_amount: number;

  // Chargeback tracking
  chargeback_amount: number;
  chargeback_date: Date | null;
  chargeback_reason: string | null;

  // Status lifecycle
  status: CommissionStatus;
  payment_date: Date | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Override commission with related agent details
 */
export interface OverrideCommissionWithAgents extends OverrideCommission {
  base_agent_email: string;
  base_agent_name?: string;
  override_agent_email: string;
  override_agent_name?: string;
  policy_number?: string;
  carrier_name?: string;
  product_name?: string;
}

/**
 * Summary of override commissions by agent
 */
export interface OverrideSummary {
  override_agent_id: string;
  total_overrides: number;
  total_override_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  charged_back_amount: number;
  total_earned: number;
  total_unearned: number;
}

/**
 * Summary of override commissions by downline
 */
export interface OverrideByDownlineSummary {
  downline_id: string;
  downline_email: string;
  downline_name?: string;
  hierarchy_depth: number;
  total_policies: number;
  total_premium: number;
  total_override_generated: number;
  pending_override: number;
  earned_override: number;
  paid_override: number;
}

/**
 * Downline performance metrics
 */
export interface DownlinePerformance {
  agent_id: string;
  agent_email: string;
  agent_name?: string;
  hierarchy_depth: number;

  // Policy metrics
  policies_written: number;
  policies_active: number;
  policies_lapsed: number;
  policies_cancelled: number;

  // Premium metrics
  total_premium: number;
  avg_premium: number;

  // Commission metrics
  total_base_commission: number;
  total_commission_earned: number;
  total_commission_paid: number;

  // Override metrics (what this downline generated for upline)
  total_overrides_generated: number;
  pending_overrides_generated: number;
  earned_overrides_generated: number;
  paid_overrides_generated: number;

  // Persistency
  persistency_rate: number; // Percentage of policies still active
}

/**
 * Filters for override commission queries
 */
export interface OverrideFilters {
  status?: CommissionStatus | CommissionStatus[];
  downline_id?: string;
  hierarchy_depth?: number;
  start_date?: Date;
  end_date?: Date;
  min_amount?: number;
  max_amount?: number;
}

/**
 * Request to change hierarchy relationship
 */
export interface HierarchyChangeRequest {
  agent_id: string;
  new_upline_id: string | null;
  reason?: string;
}

/**
 * Validation result for hierarchy changes
 */
export interface HierarchyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Hierarchy statistics
 */
export interface HierarchyStats {
  // Agent counts
  total_agents: number;
  total_downlines: number;
  direct_downlines: number;
  max_depth: number;

  // Override income
  total_override_income_mtd: number;
  total_override_income_ytd: number;

  // Team performance metrics (for selected period)
  team_ap_total: number; // Sum of ALL submissions (any status) with submit_date in period
  team_ip_total: number; // Sum of active/issued policies with effective_date in period
  team_policies_count: number; // Count of all policies in period
  avg_premium_per_agent: number; // team_ap_total / active_agents

  // Top performer
  top_performer_id: string | null;
  top_performer_name: string | null;
  top_performer_ap: number;

  // Health metrics
  recruitment_rate: number; // New agents this period / total agents
  retention_rate: number; // Approved agents / total agents
  avg_contract_level: number; // Average contract_level across team
  pending_invitations: number; // Count from invitations table

  // Pending AP Submission (policies not yet active)
  team_pending_ap_total: number; // Sum of AP for status='pending' with submit_date in period
  team_pending_policies_count: number; // Count of pending policies in period

  // Team Pace Metrics (AP-based)
  // Monthly Pace
  team_monthly_ap_target: number; // Sum of all team members' monthly AP targets
  team_fixed_monthly_ap: number; // Sum of all submissions with submit_date in current month up to today
  team_monthly_pace_percentage: number; // (actual AP MTD / expected AP at this point in month) * 100
  team_monthly_pace_status: "ahead" | "on_pace" | "behind";
  team_monthly_projected: number; // Projected month-end AP at current pace

  // Yearly Pace
  team_yearly_ap_target: number; // Sum of all team members' annual AP targets
  team_ytd_ap_total: number; // Actual team AP (all submissions) written YTD
  team_yearly_pace_percentage: number; // (actual AP YTD / expected AP at this point in year) * 100
  team_yearly_pace_status: "ahead" | "on_pace" | "behind";
  team_yearly_projected: number; // Projected year-end AP at current pace
}

/**
 * Database view type for override_commission_summary
 */
export interface OverrideCommissionSummaryView {
  override_agent_id: string;
  total_overrides: number;
  total_override_amount: number;
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  charged_back_amount: number;
  total_earned: number;
  total_unearned: number;
}

// ============================================================================
// Phase 12A: Org Chart Visualization Types
// ============================================================================

/**
 * Scope for org chart view
 */
export type OrgChartScope = "imo" | "agency" | "agent" | "auto";

/**
 * Node type in org chart
 */
export type OrgChartNodeType = "imo" | "agency" | "agent";

/**
 * Performance metrics for org chart nodes
 */
export interface OrgChartMetrics {
  agentCount?: number;
  activePolicyCount: number;
  totalAnnualPremium: number;
  totalCommissionsYtd: number;
  avgContractLevel?: number;
}

/**
 * Org chart node representing an IMO, Agency, or Agent
 */
export interface OrgChartNode {
  id: string;
  type: OrgChartNodeType;
  name: string;
  code?: string;
  logoUrl?: string | null;
  // IMO/Agency specific
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  // Agent specific
  email?: string;
  contractLevel?: number;
  agentStatus?: string;
  profilePhotoUrl?: string | null;
  hierarchyDepth?: number;
  // Metrics and children
  metrics?: OrgChartMetrics;
  children: OrgChartNode[];
}

/**
 * Request parameters for org chart data
 */
export interface OrgChartRequest {
  scope?: OrgChartScope;
  scopeId?: string;
  includeMetrics?: boolean;
  maxDepth?: number;
}

/**
 * Flattened node for list/table views
 */
export interface FlatOrgChartNode extends Omit<OrgChartNode, "children"> {
  parentId?: string;
  depth: number;
  path: string[];
  hasChildren: boolean;
  childCount: number;
}
