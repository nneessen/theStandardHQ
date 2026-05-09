// src/hooks/kpi/useMetricsWithDateRange.ts

// React 19.1 optimizes automatically - useMemo removed
import {
  TimePeriod,
  DateRange,
  getDateRange,
  isInDateRange,
  getTimeRemaining,
} from "../../utils/dateRange";
import { formatDateForDB } from "../../lib/date";
import { usePolicies } from "../policies";
import { useCommissions } from "../commissions/useCommissions";
import { useExpenses } from "../expenses/useExpenses";
import { useCarriers } from "../carriers/useCarriers";
import { ProductType } from "../../types";

interface UseMetricsWithDateRangeOptions {
  timePeriod: TimePeriod;
  periodOffset?: number; // Offset from current period (0 = current, -1 = previous, etc.)
  enabled?: boolean;
  targetAvgPremium?: number; // User's target average premium from settings
  /**
   * When provided, overrides the derived range from (timePeriod, periodOffset).
   * Used by callers that need to anchor MTD/YTD to a specific window
   * (e.g. dashboard hero cards driven by a period picker).
   */
  customRange?: DateRange;
}

interface PeriodCommissionMetrics {
  earned: number; // Total entitled (earned + paid statuses)
  paid: number; // Money actually received (paid status only)
  pending: number;
  count: number;
  byCarrier: Record<string, number>;
  byProduct: Record<ProductType, number>;
  byState: Record<string, number>;
  averageRate: number;
  averageAmount: number;
}

interface PeriodExpenseMetrics {
  total: number;
  byCategory: Record<string, number>;
  recurring: number;
  oneTime: number;
  taxDeductible: number;
  count: number;
  averageAmount: number;
}

interface PeriodPolicyMetrics {
  newCount: number;
  premiumWritten: number;
  averagePremium: number;
  cancelled: number;
  lapsed: number;
  commissionableValue: number;
}

interface PeriodClientMetrics {
  newCount: number;
  averageAge: number;
  byState: Record<string, number>;
  totalValue: number;
}

interface CurrentStateMetrics {
  activePolicies: number;
  pendingPolicies: number;
  totalClients: number;
  pendingPipeline: number;
  retentionRate: number;
  totalPolicies: number;
}

interface PeriodAnalytics {
  surplusDeficit: number;
  breakevenNeeded: number;
  policiesNeeded: number;
  netIncome: number;
  profitMargin: number;
  paceMetrics: {
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
    policiesPerDayNeeded: number;
  };
}

export interface DateFilteredMetrics {
  periodCommissions: PeriodCommissionMetrics;
  periodExpenses: PeriodExpenseMetrics;
  periodPolicies: PeriodPolicyMetrics;
  periodClients: PeriodClientMetrics;
  currentState: CurrentStateMetrics;
  periodAnalytics: PeriodAnalytics;
  dateRange: DateRange;
  isLoading: boolean;
}

export function useMetricsWithDateRange(
  options: UseMetricsWithDateRangeOptions,
): DateFilteredMetrics {
  const {
    timePeriod,
    periodOffset = 0,
    targetAvgPremium = 1500,
    customRange,
  } = options;

  // Get base data
  const { data: policies = [], isLoading: policiesLoading } = usePolicies();
  const { data: commissions = [], isLoading: commissionsLoading } =
    useCommissions();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: _carriers = [], isLoading: carriersLoading } = useCarriers();

  const isLoading =
    policiesLoading || commissionsLoading || expensesLoading || carriersLoading;

  // Calculate date range with offset (or use caller-supplied override)
  // React 19.1 optimizes automatically
  const dateRange = customRange ?? getDateRange(timePeriod, periodOffset);
  // Create a string-based version for internal filtering (using local timezone to avoid UTC shift)
  const dateRangeForFiltering = {
    start: formatDateForDB(dateRange.startDate),
    end: formatDateForDB(dateRange.endDate),
  };

  // TEMP DIAGNOSTIC — remove after dashboard date-filter bug is pinpointed.

  console.log("[useMetricsWithDateRange]", {
    timePeriod,
    periodOffset,
    dateRangeForFiltering,
    policiesCount: policies.length,
    commissionsCount: commissions.length,
    expensesCount: expenses.length,
  });

  // Filter commissions by date range. Paid rows bucket by paymentDate
  // (when the carrier wired the money); pending/unpaid rows bucket by
  // createdAt (which is when the row was inserted, typically right after
  // policy issuance). Date ranges are honored exactly — if there's no
  // data in the period, the column shows 0.
  const filteredCommissions = commissions.filter((commission) => {
    const dateToCheck =
      commission.status === "paid" && commission.paymentDate
        ? commission.paymentDate
        : commission.createdAt;
    return isInDateRange(dateToCheck, dateRangeForFiltering);
  });

  // Filter expenses by date range
  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = expense.date || expense.created_at;
    return isInDateRange(expenseDate, dateRangeForFiltering);
  });

  // Filter policies by date range (for new policies).
  // Sales bucketing uses submit_date — that's when the policy was sold and
  // is the convention used elsewhere (PolicyRepository default, hierarchy
  // service, analytics dashboard). effective_date is when coverage starts
  // and frequently sits weeks/months in the future (client-chosen start),
  // so filtering on it under-counts the current month.
  const policyBucketDate = (p: {
    submitDate?: string;
    effectiveDate?: string;
    createdAt?: string;
  }) => p.submitDate || p.effectiveDate || p.createdAt;
  const filteredPolicies = policies.filter((policy) => {
    const policyDate = policyBucketDate(policy) ?? null;
    return isInDateRange(policyDate, dateRangeForFiltering);
  });

  // TEMP DIAGNOSTIC — remove after dashboard date-filter bug is pinpointed.

  console.log("[useMetricsWithDateRange] filtered counts", {
    timePeriod,
    filteredPoliciesCount: filteredPolicies.length,
    filteredCommissionsCount: filteredCommissions.length,
    filteredExpensesCount: filteredExpenses.length,
    samplePolicyDate: policies[0]
      ? policyBucketDate(policies[0])
      : "(no policies)",
  });

  const periodCommissions = (() => {
    const earned = filteredCommissions.reduce(
      (sum, c) => sum + (c.earnedAmount || 0),
      0,
    );

    const paid = filteredCommissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const pending = filteredCommissions
      .filter((c) => c.status === "pending" || c.status === "unpaid")
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    // Group by carrier - look up carrier from the related policy
    const byCarrier: Record<string, number> = {};
    filteredCommissions.forEach((c) => {
      if (c.policyId) {
        const policy = policies.find((p) => p.id === c.policyId);
        const carrierId = policy?.carrierId;
        if (carrierId) {
          byCarrier[carrierId] = (byCarrier[carrierId] || 0) + (c.amount || 0);
        }
      }
    });

    // Group by product - look up product from the related policy
    const byProduct: Record<ProductType, number> = {} as Record<
      ProductType,
      number
    >;
    filteredCommissions.forEach((c) => {
      if (c.policyId) {
        const policy = policies.find((p) => p.id === c.policyId);
        const product = policy?.product;
        if (product) {
          byProduct[product] = (byProduct[product] || 0) + (c.amount || 0);
        }
      }
    });

    // Group by state - look up state from the related policy's client
    const byState: Record<string, number> = {};
    filteredCommissions.forEach((c) => {
      if (c.policyId) {
        const policy = policies.find((p) => p.id === c.policyId);
        const state = policy?.client?.state || "Unknown";
        byState[state] = (byState[state] || 0) + (c.amount || 0);
      }
    });

    const count = filteredCommissions.length;
    // Rate is no longer on Commission type; default to 0
    const averageRate = 0;

    // Average based on total commission value, not just earned + pending
    const totalCommissionValue = filteredCommissions.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );
    const averageAmount = count > 0 ? totalCommissionValue / count : 0;

    return {
      earned,
      paid,
      pending,
      count,
      byCarrier,
      byProduct,
      byState,
      averageRate,
      averageAmount,
    };
  })();

  // Calculate period expense metrics
  const periodExpenses = (() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const byCategory: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const category = e.category || "Uncategorized";
      byCategory[category] = (byCategory[category] || 0) + e.amount;
    });

    const recurring = filteredExpenses
      .filter((e) => e.is_recurring)
      .reduce((sum, e) => sum + e.amount, 0);

    const oneTime = total - recurring;

    const taxDeductible = filteredExpenses
      .filter((e) => e.is_tax_deductible)
      .reduce((sum, e) => sum + e.amount, 0);

    const count = filteredExpenses.length;
    const averageAmount = count > 0 ? total / count : 0;

    return {
      total,
      byCategory,
      recurring,
      oneTime,
      taxDeductible,
      count,
      averageAmount,
    };
  })();

  // Calculate period policy metrics
  const periodPolicies = (() => {
    const newCount = filteredPolicies.length;

    const premiumWritten = filteredPolicies.reduce(
      (sum, p) => sum + (p.annualPremium || 0),
      0,
    );

    const averagePremium = newCount > 0 ? premiumWritten / newCount : 0;

    const cancelled = filteredPolicies.filter(
      (p) => p.lifecycleStatus === "cancelled",
    ).length;
    const lapsed = filteredPolicies.filter(
      (p) => p.lifecycleStatus === "lapsed",
    ).length;

    // Calculate total commissionable value
    const commissionableValue = filteredPolicies.reduce((sum, p) => {
      const premium = p.annualPremium || 0;
      const rate = p.commissionPercentage || 0;
      return sum + premium * rate;
    }, 0);

    return {
      newCount,
      premiumWritten,
      averagePremium,
      cancelled,
      lapsed,
      commissionableValue,
    };
  })();

  // Calculate period client metrics
  const periodClients = (() => {
    // Get unique clients from filtered policies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic client data shape
    const clientsInPeriod = new Map<string, any>();

    filteredPolicies.forEach((p) => {
      const clientKey = p.client?.name;
      if (clientKey && !clientsInPeriod.has(clientKey)) {
        clientsInPeriod.set(clientKey, p.client);
      }
    });

    const newCount = clientsInPeriod.size;

    // Calculate average age
    let totalAge = 0;
    let ageCount = 0;
    clientsInPeriod.forEach((client) => {
      if (client?.age) {
        totalAge += client.age;
        ageCount++;
      }
    });
    const averageAge = ageCount > 0 ? totalAge / ageCount : 0;

    // Group by state
    const byState: Record<string, number> = {};
    clientsInPeriod.forEach((client) => {
      const state = client?.state || "Unknown";
      byState[state] = (byState[state] || 0) + 1;
    });

    // Calculate total value (actual total, no scaling)
    const totalValue = filteredPolicies.reduce(
      (sum, p) => sum + (p.annualPremium || 0),
      0,
    );

    return {
      newCount,
      averageAge,
      byState,
      totalValue,
    };
  })();

  // Calculate current state metrics (point-in-time, not filtered by date)
  const currentState = (() => {
    const activePolicies = policies.filter(
      (p) => p.lifecycleStatus === "active",
    ).length;
    const pendingPolicies = policies.filter(
      (p) => p.status === "pending",
    ).length;
    const totalPolicies = policies.length;

    // Get unique clients from all policies
    const allClients = new Set(policies.map((p) => p.client?.name));
    const totalClients = allClients.size;

    // ✅ FIXED: Pending pipeline - only commissions from active/pending policies
    // Filter to only include commissions from policies that are still valid
    const pendingPipeline = commissions
      .filter((c) => {
        // Only include if commission is pending
        if (c.status !== "pending") return false;

        // Find the related policy
        const policy = policies.find((p) => p.id === c.policyId);

        // Only include if policy exists and is active (lifecycleStatus) or pending (status)
        return (
          policy &&
          (policy.lifecycleStatus === "active" || policy.status === "pending")
        );
      })
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    // Calculate retention rate
    const retentionRate =
      totalPolicies > 0 ? (activePolicies / totalPolicies) * 100 : 0;

    return {
      activePolicies,
      pendingPolicies,
      totalClients,
      pendingPipeline,
      retentionRate,
      totalPolicies,
    };
  })();

  // Calculate period analytics
  const periodAnalytics = (() => {
    // Accrual-basis: count what you've EARNED this period (paid + pending)
    // against expenses incurred. Cash-basis (paid only) systematically
    // understates net income because carriers typically wire commission
    // 30–60 days after policy issue, while rent/leads/etc. are booked
    // immediately. Using paid alone made well-performing months look like
    // losses and inflated breakevenNeeded / policiesNeeded.
    const earnedThisPeriod =
      (periodCommissions.paid ?? 0) + (periodCommissions.pending ?? 0);
    const surplusDeficit = earnedThisPeriod - periodExpenses.total;
    const netIncome = surplusDeficit;
    const breakevenNeeded = surplusDeficit < 0 ? Math.abs(surplusDeficit) : 0;

    // Profit margin uses the same accrual denominator so the percentage
    // matches the net-income narrative.
    const profitMargin =
      earnedThisPeriod > 0 ? (netIncome / earnedThisPeriod) * 100 : 0;

    const allCommissionTotal = commissions.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );
    const allCommissionCount = commissions.length;
    const avgCommissionPerPolicy =
      allCommissionCount > 0
        ? allCommissionTotal / allCommissionCount // Use actual historical average
        : targetAvgPremium * 0.75; // Fallback to target × 75% if no commission history

    const policiesNeeded =
      avgCommissionPerPolicy > 0
        ? Math.ceil(breakevenNeeded / avgCommissionPerPolicy)
        : 0;

    const timeRemaining = getTimeRemaining(timePeriod);
    const daysRemaining = Math.max(
      1,
      timeRemaining.days + timeRemaining.hours / 24,
    );

    let dailyTarget = 0;
    let weeklyTarget = 0;
    let monthlyTarget = 0;
    let policiesPerDayNeeded = 0;

    if (policiesNeeded > 0) {
      switch (timePeriod) {
        case "daily":
          // For daily, we need to close this many policies today
          dailyTarget = policiesNeeded;
          policiesPerDayNeeded = policiesNeeded;
          break;

        case "weekly":
          // For weekly, distribute over remaining days
          policiesPerDayNeeded = policiesNeeded / daysRemaining;
          dailyTarget = Math.ceil(policiesPerDayNeeded);
          weeklyTarget = policiesNeeded;
          break;

        case "monthly":
          // For monthly, distribute over remaining days
          policiesPerDayNeeded = policiesNeeded / daysRemaining;
          dailyTarget = Math.ceil(policiesPerDayNeeded);
          weeklyTarget = Math.ceil(policiesPerDayNeeded * 7);
          monthlyTarget = policiesNeeded;
          break;

        case "yearly":
          {
            // For yearly, calculate monthly and weekly targets
            const monthsRemaining = 12 - new Date().getMonth();
            policiesPerDayNeeded = policiesNeeded / daysRemaining;
            dailyTarget = Math.ceil(policiesPerDayNeeded);
            weeklyTarget = Math.ceil(policiesPerDayNeeded * 7);
            monthlyTarget = Math.ceil(policiesNeeded / monthsRemaining);
          }
          break;
      }
    }

    return {
      surplusDeficit,
      breakevenNeeded,
      policiesNeeded,
      netIncome,
      profitMargin,
      paceMetrics: {
        dailyTarget,
        weeklyTarget,
        monthlyTarget,
        policiesPerDayNeeded,
      },
    };
  })();

  return {
    periodCommissions,
    periodExpenses,
    periodPolicies,
    periodClients,
    currentState,
    periodAnalytics,
    dateRange,
    isLoading,
  };
}
