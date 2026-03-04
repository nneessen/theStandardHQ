import type { Database } from "./database.types";

// ============================================================================
// Comp Guide Types (DB-first pattern from comp_guide table)
// ============================================================================

/** Raw database row from comp_guide table */
export type CompGuideRow = Database["public"]["Tables"]["comp_guide"]["Row"];
/** Insert type for comp_guide table */
export type CompGuideInsert =
  Database["public"]["Tables"]["comp_guide"]["Insert"];
/** Update type for comp_guide table */
export type CompGuideUpdate =
  Database["public"]["Tables"]["comp_guide"]["Update"];

/**
 * Comp Guide entry - carrier product compensation rates
 * Uses database row type as source of truth
 */
export type Comp = CompGuideRow;

/** Create compensation guide data (form input) */
export interface CreateCompData {
  carrier_id: string;
  product_type: Database["public"]["Enums"]["product_type"];
  contract_level: number;
  product_id?: string;
  commission_percentage: number;
  bonus_percentage?: number;
  effective_date: string;
  expiration_date?: string;
  minimum_premium?: number;
  maximum_premium?: number;
}

/** Update compensation guide data */
export interface UpdateCompData {
  carrier_id?: string;
  product_type?: Database["public"]["Enums"]["product_type"];
  contract_level?: number;
  product_id?: string;
  commission_percentage?: number;
  bonus_percentage?: number;
  effective_date?: string;
  expiration_date?: string;
  minimum_premium?: number;
  maximum_premium?: number;
}

/** Filters for querying comp guide entries */
export interface CompFilters {
  carrier_id?: string;
  product_type?: Database["public"]["Enums"]["product_type"];
  contract_level?: number;
  product_id?: string;
  effective_from?: string;
  effective_to?: string;
}

/** Product summary statistics from comp guide */
export interface ProductSummary {
  product_type: Database["public"]["Enums"]["product_type"];
  carrier_count: number;
  avg_commission: number;
  min_contract_level: number;
  max_contract_level: number;
}

// ============================================================================
// Commission Database Types (DB-first pattern from commissions table)
// ============================================================================

/** Raw database row from commissions table */
export type CommissionRow = Database["public"]["Tables"]["commissions"]["Row"];
/** Insert type for commissions table */
export type CommissionInsert =
  Database["public"]["Tables"]["commissions"]["Insert"];
/** Update type for commissions table */
export type CommissionUpdate =
  Database["public"]["Tables"]["commissions"]["Update"];

// ============================================================================
// Commission Types
// ============================================================================

export type CommissionType =
  | "first_year"
  | "renewal"
  | "trail"
  | "bonus"
  | "override";

/**
 * Commission Status Lifecycle (matches database enum: commission_status)
 *
 * USER-CONTROLLABLE STATUSES (Normal lifecycle):
 * - pending: Policy not active yet, commission not paid
 * - paid: Policy is active, commission has been paid
 *
 * AUTOMATIC TERMINAL STATUSES (Set by database triggers only):
 * - reversed: Commission reversed (carrier decision)
 * - disputed: Commission under dispute
 * - clawback: Commission was paid but later clawed back
 * - charged_back: Chargeback applied when policy lapses/cancels
 *
 * IMPORTANT:
 * - Terminal statuses (reversed, disputed, clawback, charged_back) should NOT be set manually via UI
 * - They are set automatically by database triggers when policies lapse/cancel
 * - User should use policy action buttons (Cancel Policy, Mark as Lapsed) instead
 * - Commission status FOLLOWS policy status, not vice versa
 */
export type CommissionStatus =
  | "pending"
  | "unpaid"
  | "paid"
  | "reversed"
  | "disputed"
  | "clawback"
  | "charged_back";

/**
 * Commission — maps 1:1 to the `commissions` DB table.
 *
 * Fields that belong to the *Policy* (client, carrier, product, premium, etc.)
 * are intentionally NOT on this type. If you need commission + policy data
 * together, use the `CommissionWithPolicy` type from CommissionRepository.
 */
export interface Commission {
  id: string;
  policyId?: string;
  userId: string;

  // Commission Details
  type: CommissionType;
  status: CommissionStatus;

  // ADVANCE (upfront payment)
  amount: number;
  advanceMonths: number;

  // CAPPED ADVANCE (when carrier has advance_cap)
  originalAdvance?: number | null;
  overageAmount?: number | null;
  overageStartMonth?: number | null;

  // EARNING TRACKING (as client pays premiums)
  monthsPaid: number;
  earnedAmount: number;
  unearnedAmount: number;
  lastPaymentDate?: Date;

  // CHARGEBACK TRACKING (when policy lapses/cancels)
  chargebackAmount?: number;
  chargebackDate?: Date;
  chargebackReason?: string;

  // Dates
  paymentDate?: Date | string;
  createdAt: Date;
  updatedAt?: Date;

  // Additional
  notes?: string;
  monthNumber?: number | null;
  relatedAdvanceId?: string | null;

  // Multi-tenant
  imoId?: string | null;
}

// ============================================================================
// Chargeback Types (DB-first from chargebacks table)
// ============================================================================

/** Raw database row from chargebacks table */
export type ChargebackRow = Database["public"]["Tables"]["chargebacks"]["Row"];
/** Insert type for chargebacks table */
export type ChargebackInsert =
  Database["public"]["Tables"]["chargebacks"]["Insert"];
/** Update type for chargebacks table */
export type ChargebackUpdate =
  Database["public"]["Tables"]["chargebacks"]["Update"];

/** Chargeback status enum (matches DB enum chargeback_status) */
export type ChargebackStatus =
  | "pending"
  | "processed"
  | "disputed"
  | "resolved";

/**
 * Chargeback — maps 1:1 to the `chargebacks` DB table.
 */
export interface Chargeback {
  id: string;
  commissionId: string | null;
  chargebackAmount: number;
  chargebackDate: Date;
  reason?: string;
  status: ChargebackStatus;
  resolutionDate?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Data required to create a new chargeback record.
 * Maps to ChargebackInsert but with camelCase naming.
 */
export interface CreateChargebackData {
  commissionId: string;
  chargebackAmount: number;
  chargebackDate: Date;
  reason?: string;
  status?: ChargebackStatus;
  resolutionDate?: Date;
  resolutionNotes?: string;
}

export interface CommissionSummary {
  totalCommissions: number;
  totalPremiums: number;
  averageCommissionRate: number;
  commissionCount: number;
  topCarriers: Array<{
    carrierId: string;
    carrierName: string;
    totalCommissions: number;
    count: number;
  }>;
  productBreakdown: Array<{
    product: string;
    count: number;
    totalCommissions: number;
  }>;
  stateBreakdown: Array<{
    state: string;
    count: number;
    totalCommissions: number;
  }>;
  statusBreakdown?: Array<{
    status: CommissionStatus;
    count: number;
    totalCommissions: number;
  }>;
}

// Service layer types
export type CreateCommissionData = Omit<
  Commission,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateCommissionData = Partial<CreateCommissionData>;
