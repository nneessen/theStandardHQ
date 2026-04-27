// src/features/admin/components/lead-vendors/LeadPoliciesTable.tsx

import { useState, useMemo, Fragment } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatNumber,
} from "@/lib/format";
import { SortableHead, type SortDir } from "./SortableHead";
import type {
  LeadRecentPolicy,
  LeadPackRow,
} from "@/types/lead-purchase.types";

// ---------------------------------------------------------------------------
// Enriched row with pack-level derived signals
// ---------------------------------------------------------------------------
interface EnrichedPolicy {
  policy: LeadRecentPolicy;
  packPurchaseDate: string | null;
  daysToSale: number | null;
  packPolicies: number;
  packRoi: number;
}

type PolicySortField =
  | "submitDate"
  | "packPurchaseDate"
  | "daysToSale"
  | "product"
  | "annualPremium"
  | "agentName"
  | "vendorName"
  | "clientState"
  | "packName"
  | "leadFreshness"
  | "packPolicies"
  | "packRoi";

const PAGE_SIZES = [10, 25, 50, 100] as const;

interface LeadPoliciesTableProps {
  policies: LeadRecentPolicy[];
  packs: LeadPackRow[];
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getSortValue(
  row: EnrichedPolicy,
  field: PolicySortField,
): string | number {
  switch (field) {
    case "submitDate":
      return row.policy.submitDate || "";
    case "packPurchaseDate":
      return row.packPurchaseDate || "";
    case "daysToSale":
      return row.daysToSale ?? 9999;
    case "product":
      return row.policy.product;
    case "annualPremium":
      return row.policy.annualPremium;
    case "agentName":
      return row.policy.agentName;
    case "vendorName":
      return row.policy.vendorName;
    case "clientState":
      return row.policy.clientState || "";
    case "packName":
      return row.policy.packName || "";
    case "leadFreshness":
      return row.policy.leadFreshness;
    case "packPolicies":
      return row.packPolicies;
    case "packRoi":
      return row.packRoi;
    default:
      return "";
  }
}

function daysToSaleColor(days: number | null): string {
  if (days === null) return "text-v2-ink-subtle";
  if (days <= 7) return "text-emerald-600 dark:text-emerald-400";
  if (days <= 30) return "text-blue-600 dark:text-blue-400";
  if (days <= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function roiColor(roi: number): string {
  if (roi > 0) return "text-emerald-600 dark:text-emerald-400";
  if (roi < 0) return "text-red-600 dark:text-red-400";
  return "text-v2-ink-muted";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LeadPoliciesTable({
  policies,
  packs,
  isLoading,
}: LeadPoliciesTableProps) {
  const [sortField, setSortField] = useState<PolicySortField>("submitDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);

  const handleSort = (field: PolicySortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // Build pack lookup
  const packMap = useMemo(() => {
    const map = new Map<string, LeadPackRow>();
    for (const p of packs) {
      map.set(p.packId, p);
    }
    return map;
  }, [packs]);

  // Build enriched rows with pack-level derived signals
  const enriched = useMemo((): EnrichedPolicy[] => {
    // Sort by packId then submitDate to assign sequential numbers
    const sortedPolicies = [...policies].sort((a, b) => {
      if (a.packId !== b.packId) return a.packId.localeCompare(b.packId);
      return (a.submitDate || "").localeCompare(b.submitDate || "");
    });

    // Assign sequential policy numbers per pack
    const policySequence = new Map<string, number>();
    const policyNumberMap = new Map<string, number>();
    for (const p of sortedPolicies) {
      const seq = (policySequence.get(p.packId) || 0) + 1;
      policySequence.set(p.packId, seq);
      policyNumberMap.set(p.policyId, seq);
    }

    return policies.map((policy): EnrichedPolicy => {
      const pack = packMap.get(policy.packId);
      const packPurchaseDate = pack?.purchaseDate ?? null;
      let daysToSale: number | null = null;
      if (packPurchaseDate && policy.submitDate) {
        daysToSale = daysBetween(packPurchaseDate, policy.submitDate);
        if (daysToSale < 0) daysToSale = null;
      }

      return {
        policy,
        packPurchaseDate,
        daysToSale,
        packPolicies: policyNumberMap.get(policy.policyId) || 0,
        packRoi: pack?.roiPercentage ?? 0,
      };
    });
  }, [policies, packMap]);

  // Sort
  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [enriched, sortField, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when data changes
  useMemo(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  if (isLoading && policies.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-v2-ring">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-v2-ink-muted">
            Sold Policies
          </span>
          <Badge variant="outline" className="text-[9px]">
            {sorted.length} policies
          </Badge>
        </div>
      </div>

      {/* Table */}
      <Table className="min-w-[990px]">
        <TableHeader>
          <TableRow className="bg-v2-canvas">
            <SortableHead
              field="submitDate"
              label="Submitted"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[72px]"
            />
            <SortableHead
              field="packPurchaseDate"
              label="Purchased"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[72px]"
            />
            <SortableHead
              field="daysToSale"
              label="Days"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[44px] text-right"
            />
            <SortableHead
              field="product"
              label="Product"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
            />
            <SortableHead
              field="annualPremium"
              label="Premium"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[64px] text-right"
            />
            <SortableHead
              field="agentName"
              label="Agent"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
            />
            <SortableHead
              field="vendorName"
              label="Vendor"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
            />
            <SortableHead
              field="clientState"
              label="St"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[36px] text-center"
            />
            <SortableHead
              field="packName"
              label="Pack"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
            />
            <SortableHead
              field="leadFreshness"
              label="F/A"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[36px] text-center"
            />
            <SortableHead
              field="packPolicies"
              label="Pol#"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[40px] text-right"
            />
            <SortableHead
              field="packRoi"
              label="Pack ROI"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[60px] text-right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={12}
                className="text-center text-[10px] text-v2-ink-muted py-6"
              >
                No sold policies linked to lead packages
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((row) => (
              <Fragment key={row.policy.policyId}>
                <TableRow>
                  {/* Policy submit date */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted whitespace-nowrap">
                    {row.policy.submitDate
                      ? formatDate(row.policy.submitDate, {
                          month: "numeric",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "\u2014"}
                  </TableCell>
                  {/* Pack purchase date */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted whitespace-nowrap">
                    {row.packPurchaseDate
                      ? formatDate(row.packPurchaseDate, {
                          month: "numeric",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "\u2014"}
                  </TableCell>
                  {/* Days to sale */}
                  <TableCell
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 text-right tabular-nums font-medium",
                      daysToSaleColor(row.daysToSale),
                    )}
                  >
                    {row.daysToSale !== null ? row.daysToSale : "\u2014"}
                  </TableCell>
                  {/* Product */}
                  <TableCell
                    className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[120px]"
                    title={row.policy.product}
                  >
                    {row.policy.product}
                  </TableCell>
                  {/* Premium */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                    {formatCompactCurrency(row.policy.annualPremium)}
                  </TableCell>
                  {/* Agent */}
                  <TableCell
                    className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[110px]"
                    title={row.policy.agentName}
                  >
                    {row.policy.agentName}
                  </TableCell>
                  {/* Vendor (clickable to expand pack details) */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 truncate max-w-[100px]">
                    <button
                      onClick={() =>
                        setExpandedPackId((prev) =>
                          prev === row.policy.packId ? null : row.policy.packId,
                        )
                      }
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate"
                      title={`Click to expand pack: ${row.policy.vendorName}`}
                    >
                      {row.policy.vendorName}
                    </button>
                  </TableCell>
                  {/* State */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted text-center">
                    {row.policy.clientState || "\u2014"}
                  </TableCell>
                  {/* Pack */}
                  <TableCell
                    className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[100px]"
                    title={row.policy.packName || undefined}
                  >
                    {row.policy.packName || "\u2014"}
                  </TableCell>
                  {/* F/A */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-center">
                    <span
                      className={cn(
                        "font-semibold",
                        row.policy.leadFreshness === "fresh"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {row.policy.leadFreshness === "fresh" ? "F" : "A"}
                    </span>
                  </TableCell>
                  {/* Sequential policy number within pack */}
                  <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums font-medium">
                    {row.packPolicies}
                  </TableCell>
                  {/* Pack ROI */}
                  <TableCell
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 text-right tabular-nums font-medium",
                      roiColor(row.packRoi),
                    )}
                  >
                    {formatPercent(row.packRoi)}
                  </TableCell>
                </TableRow>
                {expandedPackId === row.policy.packId && (
                  <PackExpandedDetail
                    packId={row.policy.packId}
                    packMap={packMap}
                    allEnriched={enriched}
                  />
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="px-2 py-1 border-t border-v2-ring flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted">
            {(page - 1) * pageSize + 1}&ndash;
            {Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>

          <div className="flex items-center gap-2">
            {/* Page size selector */}
            <div className="flex items-center gap-0.5 border border-v2-ring rounded overflow-hidden">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] transition-colors",
                    pageSize === size
                      ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
                      : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-1 py-0.5 text-[10px] text-v2-ink-muted hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (p === 1 || p === totalPages) return true;
                  return Math.abs(p - page) <= 1;
                })
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (
                    idx > 0 &&
                    arr[idx - 1] !== undefined &&
                    p - (arr[idx - 1] as number) > 1
                  ) {
                    acc.push("ellipsis");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-0.5 text-[10px] text-v2-ink-subtle"
                    >
                      &hellip;
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                        page === item
                          ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
                          : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-1 py-0.5 text-[10px] text-v2-ink-muted hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pack Expanded Detail Row
// ---------------------------------------------------------------------------
function PackExpandedDetail({
  packId,
  packMap,
  allEnriched,
}: {
  packId: string;
  packMap: Map<string, LeadPackRow>;
  allEnriched: EnrichedPolicy[];
}) {
  const pack = packMap.get(packId);
  const packPolicies = allEnriched.filter((e) => e.policy.packId === packId);

  return (
    <TableRow className="bg-v2-canvas/50 dark:bg-v2-ring/20">
      <TableCell colSpan={12} className="p-0">
        <div className="grid grid-cols-[220px_1fr] gap-3 p-3 border-t border-v2-ring/60">
          {/* Left: Pack summary metrics */}
          <div>
            <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
              Pack Summary
            </div>
            <div className="space-y-0.5">
              <MetricLine label="Vendor" value={pack?.vendorName || "\u2014"} />
              <MetricLine
                label="Pack Name"
                value={pack?.purchaseName || "\u2014"}
              />
              <MetricLine label="Agent" value={pack?.agentName || "\u2014"} />
              <MetricLine
                label="Purchase Date"
                value={
                  pack?.purchaseDate
                    ? formatDate(pack.purchaseDate, {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })
                    : "\u2014"
                }
              />
              <MetricLine
                label="Freshness"
                value={pack?.leadFreshness || "\u2014"}
              />
              <div className="border-t border-v2-ring my-1" />
              <MetricLine
                label="Leads"
                value={formatNumber(pack?.leadCount ?? 0)}
              />
              <MetricLine
                label="Total Cost"
                value={formatCurrency(pack?.totalCost ?? 0)}
              />
              <MetricLine
                label="CPL"
                value={formatCurrency(pack?.costPerLead ?? 0)}
              />
              <MetricLine
                label="Policies Sold"
                value={formatNumber(packPolicies.length)}
              />
              <MetricLine
                label="Conversion"
                value={formatPercent(pack?.conversionRate ?? 0)}
              />
              <MetricLine
                label="Commission"
                value={formatCompactCurrency(pack?.commissionEarned ?? 0)}
              />
              <MetricLine
                label="Total Premium"
                value={formatCompactCurrency(pack?.totalPremium ?? 0)}
              />
              <MetricLine
                label="ROI"
                value={formatPercent(pack?.roiPercentage ?? 0)}
                highlight={(pack?.roiPercentage ?? 0) > 0}
              />
            </div>
          </div>

          {/* Right: All policies in this pack */}
          <div>
            <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
              Pack Policies
              <span className="ml-1 text-v2-ink-muted">
                ({packPolicies.length})
              </span>
            </div>
            {packPolicies.length === 0 ? (
              <div className="text-[10px] text-v2-ink-subtle py-2">
                No policies in this pack
              </div>
            ) : (
              <div className="overflow-auto max-h-[240px]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-v2-ink-muted border-b border-v2-ring">
                      <th className="text-left font-semibold py-1 pr-2">
                        Submit Date
                      </th>
                      <th className="text-left font-semibold py-1 px-1.5">
                        Client
                      </th>
                      <th className="text-center font-semibold py-1 px-1.5">
                        St
                      </th>
                      <th className="text-left font-semibold py-1 px-1.5">
                        Product
                      </th>
                      <th className="text-right font-semibold py-1 px-1.5">
                        Premium
                      </th>
                      <th className="text-left font-semibold py-1 px-1.5">
                        Agent
                      </th>
                      <th className="text-left font-semibold py-1 px-1.5">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {packPolicies.map((ep) => (
                      <tr
                        key={ep.policy.policyId}
                        className="border-b border-v2-ring/60 last:border-0"
                      >
                        <td className="py-1 pr-2 text-v2-ink-muted whitespace-nowrap">
                          {ep.policy.submitDate
                            ? formatDate(ep.policy.submitDate, {
                                month: "numeric",
                                day: "numeric",
                                year: "2-digit",
                              })
                            : "\u2014"}
                        </td>
                        <td className="py-1 px-1.5 text-v2-ink-muted font-medium max-w-[120px] truncate">
                          {ep.policy.clientName}
                        </td>
                        <td className="py-1 px-1.5 text-v2-ink-muted text-center">
                          {ep.policy.clientState || "\u2014"}
                        </td>
                        <td className="py-1 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle max-w-[120px] truncate">
                          {ep.policy.product}
                        </td>
                        <td className="py-1 px-1.5 text-right tabular-nums text-v2-ink-muted dark:text-v2-ink-subtle">
                          {formatCompactCurrency(ep.policy.annualPremium)}
                        </td>
                        <td className="py-1 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle max-w-[100px] truncate">
                          {ep.policy.agentName}
                        </td>
                        <td className="py-1 px-1.5">
                          <StatusBadge status={ep.policy.status} />
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

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------
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

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    submitted:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    approved:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    active:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    lapsed:
      "bg-v2-ring text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle",
  };
  const colors =
    colorMap[status.toLowerCase()] ||
    "bg-v2-ring text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle";

  return (
    <span
      className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", colors)}
    >
      {status}
    </span>
  );
}
