// src/features/admin/components/lead-vendors/VendorIntelligenceTable.tsx

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPercent, formatCompactCurrency } from "@/lib/format";
import { getTrendArrow } from "@/hooks/lead-purchases";
import { SortableHead, type SortDir } from "./SortableHead";
import { PackHeatBadge } from "./PackHeatBadge";
import { VendorExpandedRow } from "./VendorExpandedRow";
import type { VendorIntelligenceRow } from "./LeadIntelligenceDashboard";

type VendorSortField =
  | "heat"
  | "vendorName"
  | "totalPacks"
  | "uniqueUsers"
  | "winRate"
  | "conversionRate"
  | "avgRoi"
  | "avgPremPerUser"
  | "trend";

const PAGE_SIZES = [10, 25, 50, 100] as const;

interface VendorIntelligenceTableProps {
  rows: VendorIntelligenceRow[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  startDate?: string;
  endDate?: string;
}

export function VendorIntelligenceTable({
  rows,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  startDate,
  endDate,
}: VendorIntelligenceTableProps) {
  const [sortField, setSortField] = useState<VendorSortField>("heat");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleSort = (field: VendorSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sort
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortField === "heat") {
        const aScore = a.heat?.score ?? 0;
        const bScore = b.heat?.score ?? 0;
        return sortDir === "asc" ? aScore - bScore : bScore - aScore;
      }
      if (sortField === "trend") {
        const trendOrder = {
          up: 4,
          "up-right": 3,
          right: 2,
          "down-right": 1,
          down: 0,
        };
        const aT = a.heat?.trend ?? "right";
        const bT = b.heat?.trend ?? "right";
        return sortDir === "asc"
          ? trendOrder[aT] - trendOrder[bT]
          : trendOrder[bT] - trendOrder[aT];
      }
      const field = sortField as keyof VendorIntelligenceRow;
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [rows, sortField, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const roiColor = (roi: number) =>
    roi > 0
      ? "text-success"
      : roi < 0
        ? "text-destructive"
        : "text-v2-ink-muted";

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-v2-ring flex items-center gap-2">
        <span className="text-[11px] font-semibold text-v2-ink-muted">
          Vendor Intelligence
        </span>
        <Badge variant="outline" className="text-[9px]">
          {sorted.length} vendors
        </Badge>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-v2-canvas">
              <SortableHead
                field="heat"
                label="Heat"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[55px] text-center"
              />
              <SortableHead
                field="vendorName"
                label="Vendor"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
              />
              <SortableHead
                field="totalPacks"
                label="Packs"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[50px] text-right"
              />
              <SortableHead
                field="uniqueUsers"
                label="Users"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[50px] text-right"
              />
              <SortableHead
                field="winRate"
                label="Win%"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[55px] text-right"
              />
              <SortableHead
                field="conversionRate"
                label="Conv%"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[55px] text-right"
              />
              <SortableHead
                field="avgRoi"
                label="ROI%"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[55px] text-right"
              />
              <SortableHead
                field="avgPremPerUser"
                label="Prem/User"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[70px] text-right"
              />
              {/* F/A ratio (not sortable) */}
              <th className="text-[10px] font-semibold p-1.5 w-[70px]">F/A</th>
              <SortableHead
                field="trend"
                label="Trend"
                handleSort={handleSort}
                sortField={sortField}
                sortDir={sortDir}
                className="w-[40px] text-center"
              />
              {/* Expand */}
              <th className="w-[30px] p-1.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center text-[11px] text-v2-ink-muted py-6"
                >
                  No vendors match your filters
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row) => {
                const isExpanded = expandedIds.has(row.vendorId);
                const totalFA = row.freshCount + row.agedCount;
                const freshPct =
                  totalFA > 0 ? (row.freshCount / totalFA) * 100 : 50;

                return (
                  <VendorTableRow
                    key={row.vendorId}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(row.vendorId)}
                    roiColor={roiColor}
                    freshPct={freshPct}
                    startDate={startDate}
                    endDate={endDate}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="px-3 py-1.5 border-t border-v2-ring flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted">
            Showing {(page - 1) * pageSize + 1}&ndash;
            {Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>

          <div className="flex items-center gap-2">
            {/* Page size selector */}
            <div className="flex items-center gap-0.5 border border-v2-ring rounded overflow-hidden">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => onPageSizeChange(size)}
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
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-1.5 py-0.5 text-[10px] text-v2-ink-muted hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
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
                      className="px-1 text-[10px] text-v2-ink-subtle"
                    >
                      &hellip;
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => onPageChange(item)}
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
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-1.5 py-0.5 text-[10px] text-v2-ink-muted hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
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
// Individual vendor row
// ---------------------------------------------------------------------------
function VendorTableRow({
  row,
  isExpanded,
  onToggle,
  roiColor,
  freshPct,
  startDate,
  endDate,
}: {
  row: VendorIntelligenceRow;
  isExpanded: boolean;
  onToggle: () => void;
  roiColor: (r: number) => string;
  freshPct: number;
  startDate?: string;
  endDate?: string;
}) {
  return (
    <>
      <TableRow
        className="hover:bg-v2-canvas transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="p-1.5 text-center">
          <PackHeatBadge heat={row.heat} />
        </TableCell>
        <TableCell className="p-1.5 text-[11px] font-medium text-v2-ink max-w-[200px] truncate">
          {row.vendorName}
        </TableCell>
        <TableCell className="p-1.5 text-right text-[11px] text-v2-ink-muted">
          {row.totalPacks}
        </TableCell>
        <TableCell className="p-1.5 text-right text-[11px] text-v2-ink-muted">
          {row.uniqueUsers}
        </TableCell>
        <TableCell className="p-1.5 text-right text-[11px] font-medium text-v2-ink-muted">
          {formatPercent(row.winRate)}
        </TableCell>
        <TableCell className="p-1.5 text-right text-[11px] text-v2-ink-muted">
          {formatPercent(row.conversionRate)}
        </TableCell>
        <TableCell
          className={cn(
            "p-1.5 text-right text-[11px] font-medium",
            roiColor(row.avgRoi),
          )}
        >
          {formatPercent(row.avgRoi)}
        </TableCell>
        <TableCell className="p-1.5 text-right text-[11px] text-v2-ink-muted">
          {formatCompactCurrency(row.avgPremPerUser)}
        </TableCell>
        {/* Fresh/Aged split bar */}
        <TableCell className="p-1.5">
          <div className="flex items-center gap-1">
            <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-v2-ring flex">
              <div
                className="bg-info h-full"
                style={{ width: `${freshPct}%` }}
              />
              <div
                className="bg-warning h-full"
                style={{ width: `${100 - freshPct}%` }}
              />
            </div>
            <span className="text-[9px] text-v2-ink-subtle flex-shrink-0 w-[24px] text-right">
              {row.freshCount}/{row.agedCount}
            </span>
          </div>
        </TableCell>
        <TableCell className="p-1.5 text-center text-[11px]">
          {row.heat ? getTrendArrow(row.heat.trend) : "\u2014"}
        </TableCell>
        <TableCell className="p-1.5 text-center">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-v2-ink-subtle" />
          ) : (
            <ChevronRight className="h-3 w-3 text-v2-ink-subtle" />
          )}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <VendorExpandedRow row={row} startDate={startDate} endDate={endDate} />
      )}
    </>
  );
}
