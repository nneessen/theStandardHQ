// src/constants/status.constants.ts
// Centralized status constants matching database enums

// =============================================================================
// COMMISSION STATUS (from database enum: commission_status)
// =============================================================================

export const COMMISSION_STATUS = {
  PENDING: "pending",
  UNPAID: "unpaid",
  PAID: "paid",
  REVERSED: "reversed",
  DISPUTED: "disputed",
  CLAWBACK: "clawback",
  CHARGED_BACK: "charged_back",
} as const;

export type CommissionStatusValue =
  (typeof COMMISSION_STATUS)[keyof typeof COMMISSION_STATUS];

export const COMMISSION_STATUS_CONFIG: Record<
  CommissionStatusValue,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "amber" },
  unpaid: { label: "Unpaid", color: "orange" },
  paid: { label: "Paid", color: "emerald" },
  reversed: { label: "Reversed", color: "orange" },
  disputed: { label: "Disputed", color: "yellow" },
  clawback: { label: "Clawback", color: "red" },
  charged_back: { label: "Charged Back", color: "red" },
};

// =============================================================================
// POLICY STATUS (application/underwriting outcome)
// =============================================================================

export const POLICY_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
  WITHDRAWN: "withdrawn",
} as const;

export type PolicyStatusValue =
  (typeof POLICY_STATUS)[keyof typeof POLICY_STATUS];

export const POLICY_STATUS_CONFIG: Record<
  PolicyStatusValue,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "amber" },
  approved: { label: "Approved", color: "emerald" },
  denied: { label: "Denied", color: "red" },
  withdrawn: { label: "Withdrawn", color: "zinc" },
};

// =============================================================================
// POLICY LIFECYCLE STATUS (state after approval)
// =============================================================================

export const POLICY_LIFECYCLE_STATUS = {
  ACTIVE: "active",
  LAPSED: "lapsed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type PolicyLifecycleStatusValue =
  (typeof POLICY_LIFECYCLE_STATUS)[keyof typeof POLICY_LIFECYCLE_STATUS];

export const POLICY_LIFECYCLE_STATUS_CONFIG: Record<
  PolicyLifecycleStatusValue,
  { label: string; color: string }
> = {
  active: { label: "Active", color: "emerald" },
  lapsed: { label: "Lapsed", color: "red" },
  cancelled: { label: "Cancelled", color: "zinc" },
  expired: { label: "Expired", color: "blue" },
};

// NOTE: POLICY_TO_COMMISSION_STATUS mapping has been REMOVED
// Commission status is now fully independent and manually controlled
