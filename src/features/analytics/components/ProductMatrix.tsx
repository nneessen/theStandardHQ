// src/features/analytics/components/ProductMatrix.tsx

import React from "react";
import { useAnalyticsData } from "../../../hooks";
import { cn } from "@/lib/utils";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * ProductMatrix - Product performance matrix
 */
export function ProductMatrix() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Product Mix
        </div>
        <div className="p-3 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  // Helper function to format product names (whole_life -> Whole Life)
  const formatProductName = (product: string): string => {
    return product
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Aggregate product data from policies
  const productMap = new Map<string, { count: number; revenue: number }>();
  let totalRevenue = 0;

  raw.policies.forEach((policy) => {
    const product = policy.product || "Unknown";
    const revenue = policy.annualPremium || 0;

    const existing = productMap.get(product) || { count: 0, revenue: 0 };
    productMap.set(product, {
      count: existing.count + 1,
      revenue: existing.revenue + revenue,
    });

    totalRevenue += revenue;
  });

  // Convert to array and calculate percentages
  const productData = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product: product,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Product Mix
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {productData.length} products
        </span>
      </div>
      {productData.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                Product
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Mix %
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Revenue
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productData.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <TableCell className="p-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                  {formatProductName(row.product)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                  {row.count}
                </TableCell>
                <TableCell className="p-1.5 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.percentage >= 40
                        ? "text-emerald-600 dark:text-emerald-400"
                        : row.percentage >= 20
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {row.percentage.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(row.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          No product data available
        </div>
      )}
    </div>
  );
}
