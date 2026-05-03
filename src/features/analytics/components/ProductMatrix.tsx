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
        <div className="p-3 text-center text-[10px] text-v2-ink-muted">
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
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Product Mix
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            {productData.length} products in book
          </div>
        </div>
        {productData[0] && (
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight text-v2-ink leading-none">
              {productData[0].percentage.toFixed(0)}%
            </div>
            <div className="text-[10px] text-v2-ink-subtle mt-1 truncate max-w-[140px]">
              {formatProductName(productData[0].product)} leads
            </div>
          </div>
        )}
      </div>
      {productData.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-v2-ring">
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                Product
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Mix %
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Revenue
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productData.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-b border-v2-ring/60 hover:bg-v2-canvas"
              >
                <TableCell className="p-1.5 font-medium text-v2-ink">
                  {formatProductName(row.product)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                  {row.count}
                </TableCell>
                <TableCell className="p-1.5 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.percentage >= 40
                        ? "text-success"
                        : row.percentage >= 20
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {row.percentage.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono font-semibold text-v2-ink">
                  {formatCurrency(row.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-v2-ink-subtle">
          No product data available
        </div>
      )}
    </div>
  );
}
