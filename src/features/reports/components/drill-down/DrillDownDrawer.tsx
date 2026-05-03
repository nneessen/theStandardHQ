// src/features/reports/components/drill-down/DrillDownDrawer.tsx

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronUp, ChevronDown } from "lucide-react";
import { DrillDownRecord, DrillDownContext } from "@/types/reports.types";
import { useDrillDown } from "@/hooks";
import { cn } from "@/lib/utils";

interface DrillDownDrawerProps {
  open: boolean;
  onClose: () => void;
  context: DrillDownContext | null;
}

type SortDirection = "asc" | "desc";
type SortKey = keyof DrillDownRecord;

export function DrillDownDrawer({
  open,
  onClose,
  context,
}: DrillDownDrawerProps) {
  const { data, isLoading, error } = useDrillDown(context);
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sortedRecords = React.useMemo(() => {
    if (!data?.records) return [];
    return [...data.records].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data?.records, sortKey, sortDirection]);

  const handleExportCSV = () => {
    if (!data?.records || !data.columns) return;

    const headers = data.columns.map((c) => c.label);
    const rows = sortedRecords.map((record) =>
      data.columns.map((col) => {
        const val = record[col.key];
        if (col.format === "currency" && typeof val === "number") {
          return val.toFixed(2);
        }
        return val ?? "";
      }),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${context?.type || "drill-down"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic value type
  const formatValue = (value: any, format?: string): string => {
    if (value === undefined || value === null) return "-";
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (format === "number") {
      return new Intl.NumberFormat("en-US").format(value);
    }
    return String(value);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-base">
            {context?.title || "Details"}
          </SheetTitle>
          {context?.subtitle && (
            <SheetDescription className="text-xs">
              {context.subtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-destructive/10 rounded border border-destructive/30 dark:border-destructive">
              <p className="text-sm text-destructive">
                Error loading data: {error.message}
              </p>
            </div>
          )}

          {/* Data */}
          {!isLoading && !error && data && (
            <>
              {/* Summary */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-baseline gap-4 flex-wrap">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Records
                    </span>
                    <p className="text-lg font-bold">
                      {data.summary.totalRecords}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Total Amount
                    </span>
                    <p className="text-lg font-bold">
                      {formatValue(data.summary.totalAmount, "currency")}
                    </p>
                  </div>
                  {data.summary.avgAmount !== undefined &&
                    data.summary.avgAmount > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Avg Amount
                        </span>
                        <p className="text-lg font-bold">
                          {formatValue(data.summary.avgAmount, "currency")}
                        </p>
                      </div>
                    )}
                  {data.summary.additionalMetrics &&
                    Object.entries(data.summary.additionalMetrics).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span className="text-xs text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <p className="text-sm font-semibold">
                            {typeof value === "number"
                              ? formatValue(value, "currency")
                              : value}
                          </p>
                        </div>
                      ),
                    )}
                </div>
              </div>

              {/* Table */}
              {sortedRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {data.columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-2 py-2 text-left font-semibold text-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {sortKey === col.key &&
                                (sortDirection === "asc" ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                ))}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedRecords.map((record, idx) => (
                        <tr
                          key={record.id || idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {data.columns.map((col) => (
                            <td
                              key={col.key}
                              className={cn(
                                "px-2 py-1.5",
                                col.format === "currency" &&
                                  "text-right font-mono",
                                col.format === "number" && "text-right",
                              )}
                            >
                              {col.key === "status" ? (
                                <Badge
                                  variant={
                                    record.status?.toLowerCase() === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {record.status}
                                </Badge>
                              ) : (
                                formatValue(record[col.key], col.format)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No records found for the selected criteria.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!data || data.records.length === 0}
              className="h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Close
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
