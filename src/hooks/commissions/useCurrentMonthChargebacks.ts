// src/hooks/commissions/useCurrentMonthChargebacks.ts

import { useQuery } from "@tanstack/react-query";
import { commissionStatusService } from "../../services/commissions/CommissionStatusService";

/**
 * Hook to get the current calendar month's chargebacks for the signed-in user.
 *
 * This is the figure the dashboard "flags" alert should show — only policies
 * that charged back THIS month — as opposed to {@link useChargebackSummary},
 * which is an all-time portfolio aggregate (and therefore looked identical
 * every month).
 */
export const useCurrentMonthChargebacks = () => {
  return useQuery({
    queryKey: ["chargebacks", "current-month"],
    queryFn: () => commissionStatusService.getCurrentMonthChargebacks(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
