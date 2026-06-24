// src/types/policy.types.ts
// Policy type definitions - DATABASE-FIRST pattern with app-level transformations

import type { Database } from "./database.types";
import type { ProductType } from "./product.types";
import type { Product } from "./product.types";

// =============================================================================
// DATABASE-DERIVED TYPES (Source of Truth)
// =============================================================================

/** Raw database row type for policies table */
export type PolicyRow = Database["public"]["Tables"]["policies"]["Row"];

/** Insert type for creating new policies */
export type PolicyInsert = Database["public"]["Tables"]["policies"]["Insert"];

/** Update type for modifying policies */
export type PolicyUpdate = Database["public"]["Tables"]["policies"]["Update"];

/** Payment frequency enum from database */
export type PaymentFrequencyDB =
  Database["public"]["Enums"]["payment_frequency"];

/** Lead source type enum from database */
export type LeadSourceType = Database["public"]["Enums"]["lead_source_type"];

// =============================================================================
// APP-LEVEL TYPES (CamelCase for React components)
// =============================================================================

/** Policy status - application/underwriting outcome */
export type PolicyStatus = "pending" | "approved" | "denied" | "withdrawn";

/** Policy lifecycle status - state after approval */
export type PolicyLifecycleStatus =
  | "active"
  | "lapsed"
  | "cancelled"
  | "expired";
// Values MUST match the Postgres `payment_frequency` enum exactly (the Select
// emits these and they are stored verbatim). `semi_annual` is the DB form — a
// hyphenated "semi-annual" never matches the enum and silently mis-annualizes.
export type PaymentFrequency =
  | "annual"
  | "semi_annual"
  | "quarterly"
  | "monthly";

// Base client interface with common properties
export interface PolicyClientBase {
  /** clients.id — stable identity for grouping (distinct clients can share a name). */
  id?: string;
  name: string;
  state: string;
  age: number;
  dateOfBirth?: string; // ISO date string (YYYY-MM-DD)
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zipCode?: string;
}

// Legacy client interface (same as base for backward compatibility)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PolicyClient extends PolicyClientBase {}

// Extended client interface for new service architecture
export interface PolicyClientExtended extends PolicyClientBase {
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  zipCode?: string;
}

/**
 * Policy - App-level interface with camelCase fields
 *
 * This is transformed from PolicyRow for use in React components.
 * Use PolicyRow for direct database operations.
 */
export interface Policy {
  id: string;
  policyNumber: string | null;
  status: PolicyStatus;
  lifecycleStatus?: PolicyLifecycleStatus | null; // Only set when status = 'approved'

  // Client Information - flexible to support both formats
  client: PolicyClient | PolicyClientExtended;

  // Policy Details
  carrierId: string;
  productId?: string; // Links to products table
  userId?: string; // Links to auth.users
  product: ProductType; // Product type enum
  productDetails?: Product; // Full product object when joined
  submitDate?: string; // Date string in YYYY-MM-DD format
  effectiveDate: string; // Date string in YYYY-MM-DD format
  termLength?: number; // in years
  expirationDate?: string; // Date string in YYYY-MM-DD format

  // Financial Details
  annualPremium: number;
  monthlyPremium?: number;
  paymentFrequency: PaymentFrequency;
  commissionPercentage: number; // Commission rate as decimal (e.g., 0.95 for 95%)

  // Metadata
  createdAt: string;
  updatedAt: string;
  created_at?: Date; // Optional for BaseEntity compatibility
  updated_at?: Date; // Optional for BaseEntity compatibility
  createdBy?: string;
  notes?: string;

  // Lead source tracking
  leadPurchaseId?: string | null;
  leadSourceType?: LeadSourceType | null;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface NewPolicyForm {
  policyNumber: string;
  status: PolicyStatus;
  lifecycleStatus?: PolicyLifecycleStatus | null; // Only set when status = 'approved'

  // Client fields
  clientName: string;
  clientState: string;
  clientDOB: string; // ISO date string (YYYY-MM-DD)
  clientEmail?: string;
  clientPhone?: string;
  clientStreet?: string;
  clientCity?: string;
  clientZipCode?: string;

  // Policy fields
  carrierId: string;
  productId?: string;
  product: ProductType;
  submitDate: string;
  effectiveDate: string;
  expirationDate?: string;
  termLength?: number;

  // Financial fields
  premium: number;
  annualPremium?: number;
  paymentFrequency: PaymentFrequency;
  commissionPercentage: number;
  /**
   * Optional flat-dollar advance the agent enters by hand, overriding the
   * percentage-derived advance. Manual-commission entry only (no comp guide).
   * Not a policies column — used solely to seed the commission record.
   */
  manualAdvanceAmount?: number | null;

  notes?: string;
}

export interface PolicyFilters {
  status?: PolicyStatus;
  lifecycleStatus?: PolicyLifecycleStatus;
  carrierId?: string;
  product?: ProductType;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
  startDate?: Date;
  endDate?: Date;
  /** Date range lower bound (YYYY-MM-DD). Applied to whichever column dateField points at. */
  dateFrom?: string;
  /** Date range upper bound (YYYY-MM-DD). Applied to whichever column dateField points at. */
  dateTo?: string;
  /** Which date column the range filter should target. Defaults to submit_date. */
  dateField?: "submit_date" | "effective_date";
  minPremium?: number;
  maxPremium?: number;
}

/**
 * Columns the policy list can be sorted by. These are the DB column names (plus
 * the virtual "client" sort) the table headers toggle and the service maps to an
 * `order by`. Keeping this a finite union means a typo'd sort field is a compile
 * error instead of a silently ignored `order by`.
 */
export type PolicySortField =
  | "created_at"
  | "policy_number"
  | "client"
  | "status"
  | "annual_premium"
  | "submit_date"
  | "effective_date";

export interface PolicySortConfig {
  field: PolicySortField;
  direction: "asc" | "desc";
}

/**
 * Aggregated metrics for the Policies page band. Computed server-side by the
 * `get_policy_dashboard_metrics` RPC (one row) instead of loading every policy
 * and commission into the browser.
 */
export interface PolicyDashboardMetrics {
  totalPolicies: number;
  activePolicies: number;
  pendingPolicies: number;
  lapsedPolicies: number;
  cancelledPolicies: number;
  totalPremium: number;
  avgPremium: number;
  ytdPolicies: number;
  ytdPremium: number;
  earnedCommission: number;
  pendingCommission: number;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface PolicySummary {
  totalPolicies: number;
  activePolicies: number;
  pendingPolicies: number;
  lapsedPolicies: number;
  totalAnnualPremium: number;
  totalExpectedCommission: number;
  averagePolicyValue: number;
  policiesByStatus: Record<PolicyStatus, number>;
  policiesByProduct: Record<ProductType, number>;
}

// =============================================================================
// SERVICE LAYER TYPES
// =============================================================================

/**
 * Data for creating a new policy
 * Uses camelCase for app layer, transforms to snake_case for DB
 */
export interface CreatePolicyData {
  policyNumber?: string | null;
  clientId: string;
  carrierId: string;
  productId?: string;
  userId: string;
  product: ProductType;
  submitDate: Date;
  effectiveDate: Date;
  termLength?: number;
  expirationDate?: Date;
  annualPremium: number;
  monthlyPremium: number;
  paymentFrequency: PaymentFrequency;
  commissionPercentage: number;
  /**
   * Transient: agent-entered flat advance amount. Consumed by
   * PolicyService.create() to seed the commission record; never written to the
   * policies row (PolicyRepository.transformToDB whitelists columns).
   */
  manualAdvanceAmount?: number | null;
  notes?: string;
  status?: PolicyStatus;
  lifecycleStatus?: PolicyLifecycleStatus | null;
  // Lead source tracking
  leadPurchaseId?: string | null;
  leadSourceType?: LeadSourceType | null;
  // Multi-tenant fields (defense-in-depth - also set by DB trigger)
  imoId?: string | null;
  agencyId?: string | null;
}

export type UpdatePolicyData = Partial<CreatePolicyData>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform database row to app-level Policy
 */
export function policyRowToPolicy(
  row: PolicyRow,
  client: PolicyClient | PolicyClientExtended,
): Policy {
  return {
    id: row.id,
    policyNumber: row.policy_number,
    status: row.status as PolicyStatus,
    lifecycleStatus: row.lifecycle_status as PolicyLifecycleStatus | null,
    client,
    carrierId: row.carrier_id,
    productId: row.product_id || undefined,
    userId: row.user_id || undefined,
    product: row.product,
    effectiveDate: row.effective_date,
    termLength: row.term_length || undefined,
    expirationDate: row.expiration_date || undefined,
    annualPremium: row.annual_premium || 0,
    monthlyPremium: row.monthly_premium,
    paymentFrequency: (row.payment_frequency as PaymentFrequency) || "monthly",
    commissionPercentage: row.commission_percentage || 0,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    notes: row.notes || undefined,
    leadPurchaseId: row.lead_purchase_id,
    leadSourceType: row.lead_source_type,
  };
}
