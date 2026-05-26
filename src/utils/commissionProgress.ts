import { parseLocalDate } from "../lib/date";
import { roundCurrency } from "../lib/currency";

const DEFAULT_ADVANCE_MONTHS = 9;

export interface CommissionProgressInput {
  amount: number;
  advanceMonths?: number | null;
  fallbackMonthsPaid?: number | null;
  effectiveDate?: string | null;
  lifecycleStatus?: string | null;
  cancellationDate?: string | null;
  asOfDate?: Date;
}

export interface CommissionProgressResult {
  monthsPaid: number;
  earnedAmount: number;
  unearnedAmount: number;
}

export function calculateCompletedPolicyMonths(
  startDate: Date,
  endDate: Date,
): number {
  if (endDate < startDate) {
    return 0;
  }

  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function calculateCommissionProgress(
  input: CommissionProgressInput,
): CommissionProgressResult {
  const normalizedAdvanceMonths =
    input.advanceMonths && input.advanceMonths > 0
      ? input.advanceMonths
      : DEFAULT_ADVANCE_MONTHS;
  const fallbackMonthsPaid = Math.max(0, input.fallbackMonthsPaid || 0);
  const monthlyEarnRate =
    normalizedAdvanceMonths > 0 ? input.amount / normalizedAdvanceMonths : 0;

  let monthsPaid = fallbackMonthsPaid;

  if (input.effectiveDate) {
    const effectiveDate = parseLocalDate(input.effectiveDate);
    const isClosedPolicy =
      input.lifecycleStatus === "cancelled" ||
      input.lifecycleStatus === "lapsed";

    if (!isClosedPolicy || input.cancellationDate) {
      const endDate =
        isClosedPolicy && input.cancellationDate
          ? parseLocalDate(input.cancellationDate)
          : input.asOfDate || new Date();
      monthsPaid = calculateCompletedPolicyMonths(effectiveDate, endDate);
    }
  }

  const cappedMonthsPaid = Math.min(monthsPaid, normalizedAdvanceMonths);
  // Round the earned output, then derive unearned from the rounded earned so the
  // two always reconcile to the stored amount (earned + unearned === amount).
  const earnedAmount = roundCurrency(monthlyEarnRate * cappedMonthsPaid);

  return {
    monthsPaid: cappedMonthsPaid,
    earnedAmount,
    unearnedAmount: roundCurrency(Math.max(0, input.amount - earnedAmount)),
  };
}
