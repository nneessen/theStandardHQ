// src/features/policies/utils/policyFormTransformer.ts
// Utilities for transforming policy form data to service data

import type {
  NewPolicyForm,
  CreatePolicyData,
  PaymentFrequency,
} from "@/types/policy.types";
import { parseLocalDate } from "@/lib/date";

/**
 * Calculate monthly premium from annual premium based on payment frequency
 */
export function calculateMonthlyPremium(
  annualPremium: number,
  paymentFrequency: PaymentFrequency,
): number {
  switch (paymentFrequency) {
    case "annual":
      return annualPremium / 12;
    case "semi-annual":
      return annualPremium / 6;
    case "quarterly":
      return annualPremium / 3;
    case "monthly":
    default:
      return annualPremium / 12;
  }
}

/**
 * Validate commission percentage is within database constraints
 * Database: DECIMAL(5,4) = max 9.9999 (999.99%)
 *
 * @param percent - Commission percentage (e.g., 95 for 95%)
 * @throws Error if percentage is out of valid range
 */
export function validateCommissionPercentage(percent: number): void {
  if (percent < 0 || percent > 999.99) {
    throw new Error("Commission percentage must be between 0 and 999.99");
  }
}

/**
 * Transform form data to service-compatible CreatePolicyData
 *
 * @param form - Form data from PolicyForm component
 * @param clientId - Client UUID (after client creation/lookup)
 * @param userId - User UUID from auth context
 * @returns CreatePolicyData ready for policyService.create()
 */
export function transformFormToCreateData(
  form: NewPolicyForm,
  clientId: string,
  userId: string,
): CreatePolicyData {
  // Validate required fields
  if (!form.submitDate) {
    throw new Error("Submit date is required");
  }
  if (!form.effectiveDate) {
    throw new Error("Effective date is required");
  }

  // Validate commission percentage
  const commissionPercent = form.commissionPercentage || 0;
  validateCommissionPercentage(commissionPercent);

  // Calculate monthly premium
  const monthlyPremium = calculateMonthlyPremium(
    form.annualPremium || 0,
    form.paymentFrequency,
  );

  return {
    policyNumber: form.policyNumber,
    status: form.status,
    clientId,
    userId,
    carrierId: form.carrierId,
    productId: form.productId || undefined,
    product: form.product,
    submitDate: parseLocalDate(form.submitDate),
    effectiveDate: parseLocalDate(form.effectiveDate),
    termLength: form.termLength,
    expirationDate: form.expirationDate
      ? parseLocalDate(form.expirationDate)
      : undefined,
    annualPremium: form.annualPremium || 0,
    monthlyPremium,
    paymentFrequency: form.paymentFrequency,
    commissionPercentage: commissionPercent / 100, // Convert to decimal (95% → 0.95)
    // Flat-dollar advance override (manual commission entry). Kept as-is (NOT a
    // percentage); null when the agent left it blank so the % drives the advance.
    manualAdvanceAmount:
      form.manualAdvanceAmount && form.manualAdvanceAmount > 0
        ? form.manualAdvanceAmount
        : null,
    notes: form.notes || undefined,
  };
}

/**
 * Transform partial form updates to service-compatible format
 *
 * @param updates - Partial form data
 * @param clientId - Client UUID (if client info was updated)
 * @returns Partial CreatePolicyData for policyService.update()
 */
export function transformFormToUpdateData(
  updates: Partial<NewPolicyForm>,
  clientId?: string,
): Partial<CreatePolicyData> {
  const result: Partial<CreatePolicyData> = {};

  if (updates.policyNumber !== undefined)
    result.policyNumber = updates.policyNumber;
  if (updates.status !== undefined) result.status = updates.status;
  if (clientId) result.clientId = clientId;
  if (updates.carrierId !== undefined) result.carrierId = updates.carrierId;
  if (updates.productId !== undefined) result.productId = updates.productId;
  if (updates.product !== undefined) result.product = updates.product;
  if (updates.termLength !== undefined) result.termLength = updates.termLength;
  if (updates.notes !== undefined) result.notes = updates.notes;

  // Handle dates
  if (updates.submitDate !== undefined) {
    result.submitDate = parseLocalDate(updates.submitDate);
  }
  if (updates.effectiveDate !== undefined) {
    result.effectiveDate = parseLocalDate(updates.effectiveDate);
  }
  if (updates.expirationDate !== undefined) {
    result.expirationDate = updates.expirationDate
      ? parseLocalDate(updates.expirationDate)
      : undefined;
  }

  // Handle financial fields with recalculation
  if (
    updates.annualPremium !== undefined ||
    updates.paymentFrequency !== undefined
  ) {
    const annualPremium = updates.annualPremium ?? 0;
    const paymentFrequency = updates.paymentFrequency ?? "monthly";

    result.annualPremium = annualPremium;
    result.monthlyPremium = calculateMonthlyPremium(
      annualPremium,
      paymentFrequency,
    );
    result.paymentFrequency = paymentFrequency;
  }

  if (updates.commissionPercentage !== undefined) {
    validateCommissionPercentage(updates.commissionPercentage);
    result.commissionPercentage = updates.commissionPercentage / 100;
  }

  return result;
}
