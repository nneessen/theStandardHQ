// src/features/analytics/components/ClientSegmentation.tsx

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
 * ClientSegmentation - Client value segmentation and opportunities
 *
 * Segments clients by value (High/Medium/Low) and identifies renewal opportunities
 */
export function ClientSegmentation() {
  const { dateRange } = useAnalyticsDateRange();
  const { segmentation, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Client Segments
        </div>
        <div className="p-3 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!segmentation) {
    return null;
  }

  const { segments: segmentData, chargebackRisk } = segmentation;
  const totalRevenue =
    segmentData.totalPremiumByTier.high +
    segmentData.totalPremiumByTier.medium +
    segmentData.totalPremiumByTier.low;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const segmentTableData = [
    {
      tier: "HIGH",
      clients: segmentData.highValue.length,
      totalAP: segmentData.totalPremiumByTier.high,
      avgAP: segmentData.avgPremiumByTier.high,
      mixPercent:
        totalRevenue > 0
          ? (segmentData.totalPremiumByTier.high / totalRevenue) * 100
          : 0,
    },
    {
      tier: "MED",
      clients: segmentData.mediumValue.length,
      totalAP: segmentData.totalPremiumByTier.medium,
      avgAP: segmentData.avgPremiumByTier.medium,
      mixPercent:
        totalRevenue > 0
          ? (segmentData.totalPremiumByTier.medium / totalRevenue) * 100
          : 0,
    },
    {
      tier: "LOW",
      clients: segmentData.lowValue.length,
      totalAP: segmentData.totalPremiumByTier.low,
      avgAP: segmentData.avgPremiumByTier.low,
      mixPercent:
        totalRevenue > 0
          ? (segmentData.totalPremiumByTier.low / totalRevenue) * 100
          : 0,
    },
  ];

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-2">
        Client Segments
      </div>

      <Table className="text-[11px] mb-2">
        <TableHeader>
          <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
            <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
              Tier
            </TableHead>
            <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
              Clients
            </TableHead>
            <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
              Total AP
            </TableHead>
            <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
              Avg AP
            </TableHead>
            <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
              Mix %
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segmentTableData.map((row, idx) => (
            <TableRow
              key={idx}
              className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <TableCell className="p-1.5">
                <span
                  className={cn(
                    "font-medium",
                    row.tier === "HIGH"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.tier === "MED"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {row.tier}
                </span>
              </TableCell>
              <TableCell className="p-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                {row.clients}
              </TableCell>
              <TableCell className="p-1.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(row.totalAP)}
              </TableCell>
              <TableCell className="p-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                {formatCurrency(row.avgAP)}
              </TableCell>
              <TableCell className="p-1.5 text-right">
                <span
                  className={cn(
                    "font-mono",
                    row.tier === "HIGH"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.tier === "MED"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {row.mixPercent.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Top Chargeback Risk - highest premium policies in contestability */}
      {chargebackRisk && chargebackRisk.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1 mt-2">
            Top Chargeback Risk
          </div>
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                  Client
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                  At Risk
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                  Age
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chargebackRisk.map((row) => (
                <TableRow
                  key={row.policyId}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <TableCell className="p-1.5">
                    <span
                      className="font-medium text-zinc-900 dark:text-zinc-100 truncate"
                      title={row.clientName}
                    >
                      {row.clientName}
                    </span>
                  </TableCell>
                  <TableCell className="p-1.5 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(row.atRiskAmount)}
                  </TableCell>
                  <TableCell className="p-1.5 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium",
                        row.riskLevel === "high"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : row.riskLevel === "medium"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {row.monthsInContestability}mo
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
