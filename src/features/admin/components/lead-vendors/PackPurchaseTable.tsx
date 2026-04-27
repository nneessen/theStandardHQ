// src/features/admin/components/lead-vendors/PackPurchaseTable.tsx

import { useState, useMemo, useCallback } from "react";
import { Loader2, X, Settings2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatPercent,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "@/lib/format";
// eslint-disable-next-line no-restricted-imports
import { useLocalStorage } from "@/hooks/base/useLocalStorage";
import { SortableHead, type SortDir } from "./SortableHead";
import type { LeadPackRow, PackHeatMetrics } from "@/types/lead-purchase.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PackSortField =
  | "purchaseDate"
  | "purchaseName"
  | "vendorName"
  | "agentName"
  | "leadFreshness"
  | "leadCount"
  | "totalCost"
  | "costPerLead"
  | "policiesSold"
  | "conversionRate"
  | "commissionEarned"
  | "totalPremium"
  | "roiPercentage";

type PerfFilter = "all" | "winners" | "losers" | "zero";
type ActivityFilter = "all" | "active" | "stale" | "dead";
type FreshnessFilter = "all" | "fresh" | "aged";

interface PackFilters {
  performance: PerfFilter;
  activity: ActivityFilter;
  quickSale: boolean;
  freshness: FreshnessFilter;
}

const DEFAULT_PACK_FILTERS: PackFilters = {
  performance: "all",
  activity: "all",
  quickSale: false,
  freshness: "all",
};

// ---------------------------------------------------------------------------
// Configurable thresholds (persisted in localStorage)
// ---------------------------------------------------------------------------
interface PackFilterThresholds {
  winnersMinRoi: number;
  losersMaxRoi: number;
  activeDaysWindow: number;
  staleDaysWindow: number;
  quickSaleMaxDays: number;
}

const DEFAULT_THRESHOLDS: PackFilterThresholds = {
  winnersMinRoi: 0,
  losersMaxRoi: 0,
  activeDaysWindow: 30,
  staleDaysWindow: 30,
  quickSaleMaxDays: 7,
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

interface PackPurchaseTableProps {
  packs: LeadPackRow[];
  packMetrics: PackHeatMetrics[];
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Threshold input helper
// ---------------------------------------------------------------------------
function ThresholdInput({
  label,
  value,
  onChange,
  suffix,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle whitespace-nowrap">
        {label}
      </label>
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed)) onChange(parsed);
          }}
          className="w-14 px-1 py-0.5 text-[10px] text-right tabular-nums border border-v2-ring rounded bg-white dark:bg-v2-ring text-v2-ink-muted focus:outline-none focus:ring-1 focus:ring-v2-accent"
        />
        {suffix && (
          <span className="text-[9px] text-v2-ink-subtle">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented toggle helper
// ---------------------------------------------------------------------------
function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-center gap-0 border border-v2-ring rounded overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              value === opt.value
                ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
                : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PackPurchaseTable({
  packs,
  packMetrics,
  isLoading,
}: PackPurchaseTableProps) {
  const [sortField, setSortField] = useState<PackSortField>("purchaseDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<PackFilters>(DEFAULT_PACK_FILTERS);
  const [thresholds, setThresholds] = useLocalStorage<PackFilterThresholds>(
    "pack-filter-thresholds",
    DEFAULT_THRESHOLDS,
  );

  const handleSort = (field: PackSortField) => {
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

  const updateFilter = useCallback(
    <K extends keyof PackFilters>(key: K, value: PackFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [],
  );

  const updateThreshold = useCallback(
    <K extends keyof PackFilterThresholds>(
      key: K,
      value: PackFilterThresholds[K],
    ) => {
      setThresholds((prev) => ({ ...prev, [key]: value }));
    },
    [setThresholds],
  );

  const hasActiveFilters =
    filters.performance !== "all" ||
    filters.activity !== "all" ||
    filters.quickSale ||
    filters.freshness !== "all";

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_PACK_FILTERS);
    setPage(1);
  }, []);

  // Build metrics lookup
  const metricsMap = useMemo(() => {
    const map = new Map<string, PackHeatMetrics>();
    for (const m of packMetrics) {
      map.set(m.packId, m);
    }
    return map;
  }, [packMetrics]);

  // Sort
  const sorted = useMemo(() => {
    return [...packs].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [packs, sortField, sortDir]);

  // Filter
  const filtered = useMemo(() => {
    if (!hasActiveFilters) return sorted;

    return sorted.filter((pack) => {
      const metrics = metricsMap.get(pack.packId);

      // Performance filter
      if (filters.performance !== "all") {
        switch (filters.performance) {
          case "winners":
            if (pack.roiPercentage <= thresholds.winnersMinRoi) return false;
            break;
          case "losers":
            if (
              pack.policiesSold === 0 ||
              pack.roiPercentage > thresholds.losersMaxRoi
            )
              return false;
            break;
          case "zero":
            if (pack.policiesSold !== 0) return false;
            break;
        }
      }

      // Activity filter (uses daysSinceLastSale for configurable window)
      if (filters.activity !== "all") {
        if (!metrics) {
          // No metrics = skip this filter (pass through)
        } else {
          switch (filters.activity) {
            case "active":
              if (
                metrics.daysSinceLastSale < 0 ||
                metrics.daysSinceLastSale > thresholds.activeDaysWindow
              )
                return false;
              break;
            case "stale":
              if (
                metrics.policiesSold === 0 ||
                metrics.daysSinceLastSale <= thresholds.staleDaysWindow
              )
                return false;
              break;
            case "dead":
              if (metrics.policiesSold !== 0) return false;
              break;
          }
        }
      }

      // Quick Sale filter
      if (filters.quickSale) {
        if (!metrics) {
          // No metrics = skip this filter
        } else {
          if (
            metrics.daysToFirstSale < 0 ||
            metrics.daysToFirstSale > thresholds.quickSaleMaxDays
          )
            return false;
        }
      }

      // Freshness filter
      if (filters.freshness !== "all") {
        if (pack.leadFreshness !== filters.freshness) return false;
      }

      return true;
    });
  }, [sorted, filters, hasActiveFilters, metricsMap, thresholds]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when data changes
  useMemo(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const roiColor = (roi: number) =>
    roi > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : roi < 0
        ? "text-red-600 dark:text-red-400"
        : "text-v2-ink-muted";

  if (isLoading && packs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      {/* Header with filters */}
      <div className="px-2 py-1.5 border-b border-v2-ring space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-v2-ink-muted">
            All Purchases
          </span>
          <Badge variant="outline" className="text-[9px]">
            {hasActiveFilters
              ? `${filtered.length}/${sorted.length} packs`
              : `${sorted.length} packs`}
          </Badge>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <SegmentedToggle<PerfFilter>
            label="Perf"
            options={[
              { value: "all", label: "All" },
              { value: "winners", label: "Winners" },
              { value: "losers", label: "Losers" },
              { value: "zero", label: "Zero" },
            ]}
            value={filters.performance}
            onChange={(v) => updateFilter("performance", v)}
          />

          <SegmentedToggle<ActivityFilter>
            label="Activity"
            options={[
              { value: "all", label: "All" },
              {
                value: "active",
                label: `Active (${thresholds.activeDaysWindow}d)`,
              },
              {
                value: "stale",
                label: `Stale (${thresholds.staleDaysWindow}d)`,
              },
              { value: "dead", label: "Dead" },
            ]}
            value={filters.activity}
            onChange={(v) => updateFilter("activity", v)}
          />

          <SegmentedToggle<FreshnessFilter>
            label="Leads"
            options={[
              { value: "all", label: "All" },
              { value: "fresh", label: "Fresh" },
              { value: "aged", label: "Aged" },
            ]}
            value={filters.freshness}
            onChange={(v) => updateFilter("freshness", v)}
          />

          {/* Quick Sale toggle */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Quick Sale
            </span>
            <button
              onClick={() => updateFilter("quickSale", !filters.quickSale)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors",
                filters.quickSale
                  ? "bg-v2-ring text-white border-v2-ring dark:bg-v2-ring dark:text-v2-ink dark:border-v2-ring"
                  : "text-v2-ink-muted border-v2-ring hover:bg-v2-ring dark:hover:bg-v2-ring",
              )}
            >
              {`\u2264${thresholds.quickSaleMaxDays}d`}
            </button>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-v2-ink-muted hover:text-v2-ink transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          {/* Settings popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-0.5 text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle transition-colors rounded hover:bg-v2-ring dark:hover:bg-v2-ring"
                title="Filter thresholds"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 space-y-2">
              <div className="text-[10px] font-semibold text-v2-ink-muted mb-1">
                Filter Thresholds
              </div>

              <ThresholdInput
                label="Winners min ROI"
                value={thresholds.winnersMinRoi}
                onChange={(v) => updateThreshold("winnersMinRoi", v)}
                suffix="%"
              />
              <ThresholdInput
                label="Losers max ROI"
                value={thresholds.losersMaxRoi}
                onChange={(v) => updateThreshold("losersMaxRoi", v)}
                suffix="%"
              />
              <ThresholdInput
                label="Active window"
                value={thresholds.activeDaysWindow}
                onChange={(v) => updateThreshold("activeDaysWindow", v)}
                suffix="d"
              />
              <ThresholdInput
                label="Stale window"
                value={thresholds.staleDaysWindow}
                onChange={(v) => updateThreshold("staleDaysWindow", v)}
                suffix="d"
              />
              <ThresholdInput
                label="Quick sale max"
                value={thresholds.quickSaleMaxDays}
                onChange={(v) => updateThreshold("quickSaleMaxDays", v)}
                suffix="d"
              />

              <button
                onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
                className="flex items-center gap-1 w-full justify-center pt-1 mt-1 border-t border-v2-ring text-[10px] text-v2-ink-muted hover:text-v2-ink transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Defaults
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table */}
      <Table className="min-w-[1050px]">
        <TableHeader>
          <TableRow className="bg-v2-canvas">
            <SortableHead
              field="purchaseDate"
              label="Date"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[68px]"
            />
            <SortableHead
              field="purchaseName"
              label="Name"
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
              field="agentName"
              label="Agent"
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
              field="leadCount"
              label="#"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[36px] text-right"
            />
            <SortableHead
              field="totalCost"
              label="Cost"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[52px] text-right"
            />
            <SortableHead
              field="costPerLead"
              label="CPL"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[44px] text-right"
            />
            <SortableHead
              field="policiesSold"
              label="Pol"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[36px] text-right"
            />
            <SortableHead
              field="conversionRate"
              label="Conv"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[44px] text-right"
            />
            <SortableHead
              field="commissionEarned"
              label="Comm"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[52px] text-right"
            />
            <SortableHead
              field="totalPremium"
              label="Prem"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[52px] text-right"
            />
            <SortableHead
              field="roiPercentage"
              label="ROI"
              handleSort={handleSort}
              sortField={sortField}
              sortDir={sortDir}
              className="w-[44px] text-right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={13}
                className="text-center text-[10px] text-v2-ink-muted py-6"
              >
                No purchases match your filters
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((pack) => (
              <TableRow key={pack.packId}>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted whitespace-nowrap">
                  {formatDate(pack.purchaseDate, {
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </TableCell>
                <TableCell
                  className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[140px]"
                  title={pack.purchaseName || undefined}
                >
                  {pack.purchaseName || "\u2014"}
                </TableCell>
                <TableCell
                  className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[110px]"
                  title={pack.vendorName}
                >
                  {pack.vendorName}
                </TableCell>
                <TableCell
                  className="text-[10px] px-1.5 py-0.5 text-v2-ink-muted truncate max-w-[110px]"
                  title={pack.agentName}
                >
                  {pack.agentName}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-center">
                  <span
                    className={cn(
                      "font-semibold",
                      pack.leadFreshness === "fresh"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {pack.leadFreshness === "fresh" ? "F" : "A"}
                  </span>
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {pack.leadCount}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {formatCompactCurrency(pack.totalCost)}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {formatCurrency(pack.costPerLead)}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {pack.policiesSold}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {formatPercent(pack.conversionRate)}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {formatCompactCurrency(pack.commissionEarned)}
                </TableCell>
                <TableCell className="text-[10px] px-1.5 py-0.5 text-right tabular-nums">
                  {formatCompactCurrency(pack.totalPremium)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 text-right tabular-nums font-medium",
                    roiColor(pack.roiPercentage),
                  )}
                >
                  {formatPercent(pack.roiPercentage)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="px-2 py-1 border-t border-v2-ring flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted">
            {(page - 1) * pageSize + 1}&ndash;
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}
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
