// src/features/admin/components/lead-vendors/VendorExpandedRow.tsx

import { Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
} from "@/lib/format";
import { useLeadVendorUserBreakdown } from "@/hooks/lead-purchases";
import type { VendorUserBreakdown } from "@/types/lead-purchase.types";
import type { VendorIntelligenceRow } from "./LeadIntelligenceDashboard";

interface VendorExpandedRowProps {
  row: VendorIntelligenceRow;
  startDate?: string;
  endDate?: string;
}

export function VendorExpandedRow({
  row,
  startDate,
  endDate,
}: VendorExpandedRowProps) {
  const { data: breakdown, isLoading } = useLeadVendorUserBreakdown(
    row.vendorId,
    startDate,
    endDate,
  );

  const roiColor = (roi: number) =>
    roi > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : roi < 0
        ? "text-red-600 dark:text-red-400"
        : "text-v2-ink-muted";

  const profitableUsers = breakdown?.filter((a) => a.avgRoi > 0).length ?? 0;
  const totalUsers = breakdown?.length ?? 0;

  return (
    <TableRow className="bg-v2-canvas/50 dark:bg-v2-ring/20">
      <TableCell colSpan={11} className="p-0">
        <div className="grid grid-cols-[240px_1fr] gap-3 p-3 border-t border-v2-ring/60">
          {/* Left: Vendor summary metrics */}
          <div>
            <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
              Vendor Summary
            </div>
            <div className="space-y-0.5">
              <MetricLine
                label="Total Spend"
                value={formatCompactCurrency(row.totalSpent)}
              />
              <MetricLine
                label="Total Leads"
                value={formatNumber(row.totalLeads)}
              />
              <MetricLine
                label="Total Policies"
                value={formatNumber(row.totalPolicies)}
              />
              <MetricLine
                label="Total Premium"
                value={formatCompactCurrency(row.totalPremium)}
              />
              <MetricLine
                label="Total Commission"
                value={formatCompactCurrency(row.totalCommission)}
              />
              <MetricLine
                label="CPL"
                value={formatCurrency(row.avgCostPerLead)}
              />
              <MetricLine
                label="Last Purchase"
                value={
                  row.lastPurchaseDate
                    ? formatDate(row.lastPurchaseDate, {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })
                    : "\u2014"
                }
              />
              {breakdown && (
                <>
                  <div className="border-t border-v2-ring my-1" />
                  <MetricLine
                    label="Profitable Users"
                    value={`${profitableUsers}/${totalUsers}`}
                    highlight={profitableUsers > totalUsers / 2}
                  />
                  <MetricLine
                    label="Avg Policies/User"
                    value={
                      totalUsers > 0
                        ? formatNumber(
                            Math.round(
                              (breakdown.reduce(
                                (s, a) => s + a.totalPolicies,
                                0,
                              ) /
                                totalUsers) *
                                10,
                            ) / 10,
                          )
                        : "\u2014"
                    }
                  />
                  <MetricLine
                    label="Avg Prem/User"
                    value={formatCompactCurrency(row.avgPremPerUser)}
                  />
                </>
              )}
            </div>

            {/* Heat breakdown */}
            {row.heat && (
              <div className="mt-2.5">
                <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
                  Heat Breakdown
                </div>
                <div className="space-y-1">
                  <HeatBar
                    label="Conversion"
                    score={row.heat.breakdown.conversionRate}
                    max={25}
                    color="bg-red-500"
                  />
                  <HeatBar
                    label="ROI"
                    score={row.heat.breakdown.roi}
                    max={20}
                    color="bg-orange-500"
                  />
                  <HeatBar
                    label="Prem/Lead"
                    score={row.heat.breakdown.premiumPerLead}
                    max={15}
                    color="bg-amber-500"
                  />
                  <HeatBar
                    label="Recency"
                    score={row.heat.breakdown.recency}
                    max={15}
                    color="bg-blue-500"
                  />
                  <HeatBar
                    label="Velocity"
                    score={row.heat.breakdown.velocity}
                    max={15}
                    color="bg-indigo-500"
                  />
                  <HeatBar
                    label="Consistency"
                    score={row.heat.breakdown.agentConsistency}
                    max={10}
                    color="bg-violet-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Per-user agent breakdown */}
          <div>
            <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
              Agent Performance
              {breakdown && (
                <span className="ml-1 text-v2-ink-muted">
                  ({profitableUsers} profitable / {totalUsers} total)
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
              </div>
            ) : !breakdown || breakdown.length === 0 ? (
              <div className="text-[10px] text-v2-ink-subtle py-2">
                No agent data available
              </div>
            ) : (
              <div className="overflow-auto max-h-[240px]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-v2-ink-muted border-b border-v2-ring">
                      <th className="text-left font-semibold py-1 pr-2">
                        Agent
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Packs
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Leads
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Spend
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Policies
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Conv%
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Comm
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        ROI%
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        F/A
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((agent: VendorUserBreakdown) => (
                      <tr
                        key={agent.userId}
                        className="border-b border-v2-ring/60 last:border-0"
                      >
                        <td className="py-1 pr-2 text-v2-ink-muted font-medium max-w-[120px] truncate">
                          {agent.userName}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatNumber(agent.totalPurchases)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatNumber(agent.totalLeads)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatCompactCurrency(agent.totalSpent)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatNumber(agent.totalPolicies)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatPercent(agent.conversionRate)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatCompactCurrency(agent.totalCommission)}
                        </td>
                        <td
                          className={cn(
                            "py-1 px-1.5 text-right font-medium",
                            roiColor(agent.avgRoi),
                          )}
                        >
                          {formatPercent(agent.avgRoi)}
                        </td>
                        <td className="py-1 px-1.5 text-right text-v2-ink-muted">
                          {agent.freshLeads}/{agent.agedLeads}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MetricLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-v2-ink-muted">{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-v2-ink-muted",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function HeatBar({
  label,
  score,
  max,
  color,
}: {
  label: string;
  score: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-v2-ink-muted w-[60px] flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-[5px] rounded-full bg-v2-ring overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-v2-ink-muted w-[28px] text-right flex-shrink-0">
        {score}/{max}
      </span>
    </div>
  );
}
