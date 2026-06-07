// src/features/underwriting/components/QuickQuote/QuoteComparisonGrid.tsx

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
// eslint-disable-next-line no-restricted-imports
import type {
  QuickQuoteResult,
  QuickQuoteProductType,
} from "@/services/underwriting/core/quickQuoteCalculator";

// =============================================================================
// Types
// =============================================================================

interface QuoteComparisonGridProps {
  quotes: QuickQuoteResult[];
  mode: "coverage" | "budget";
  amounts: [number, number, number];
  isLoading?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(value: number | null): string {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyCompact(value: number | null): string {
  if (value === null) return "N/A";
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return formatCurrency(value);
}

function getProductGroupLabel(
  productType: QuickQuoteProductType,
  termYears: number | null,
): string {
  const labels: Record<QuickQuoteProductType, string> = {
    term_life: "Term Life",
    whole_life: "Whole Life",
    participating_whole_life: "Participating Whole Life",
    indexed_universal_life: "Indexed Universal Life",
  };
  const base = labels[productType] ?? productType;
  if (productType === "term_life" && termYears) {
    return `${base} — ${termYears} Year`;
  }
  return base;
}

function getProductTypeOrder(productType: QuickQuoteProductType): number {
  const order: Record<QuickQuoteProductType, number> = {
    term_life: 1,
    whole_life: 2,
    participating_whole_life: 3,
    indexed_universal_life: 4,
  };
  return order[productType] ?? 99;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function GridSkeleton() {
  return (
    <div className="rounded-lg border border-border dark:border-border overflow-hidden">
      <div className="bg-muted dark:bg-card px-4 py-2.5">
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-5 bg-muted" />
          <Skeleton className="h-5 bg-muted" />
          <Skeleton className="h-5 bg-muted" />
          <Skeleton className="h-5 bg-muted" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-4 py-3 border-t border-border dark:border-border"
        >
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center p-12 text-center border border-dashed border-border dark:border-border rounded-lg">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function QuoteComparisonGrid({
  quotes,
  mode,
  amounts,
  isLoading = false,
}: QuoteComparisonGridProps) {
  const groupedQuotes = useMemo(() => {
    const groups = new Map<string, QuickQuoteResult[]>();

    for (const quote of quotes) {
      const groupKey =
        quote.productType === "term_life" && quote.termYears
          ? `${quote.productType}-${quote.termYears}`
          : quote.productType;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(quote);
    }

    return [...groups.entries()].sort((a, b) => {
      const aType = a[1][0]?.productType ?? "term_life";
      const bType = b[1][0]?.productType ?? "term_life";
      const aTermYears = a[1][0]?.termYears ?? 0;
      const bTermYears = b[1][0]?.termYears ?? 0;

      const typeOrder = getProductTypeOrder(aType) - getProductTypeOrder(bType);
      if (typeOrder !== 0) return typeOrder;
      return aTermYears - bTermYears;
    });
  }, [quotes]);

  if (isLoading) return <GridSkeleton />;

  if (quotes.length === 0) {
    return (
      <EmptyState message="Select products and enter demographics to see quotes" />
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {groupedQuotes.map(([groupKey, groupQuotes]) => {
          const firstQuote = groupQuotes[0];
          if (!firstQuote) return null;

          return (
            <div
              key={groupKey}
              className="rounded-lg border border-border dark:border-border overflow-hidden shadow-sm"
            >
              {/* Column Headers */}
              <div className="bg-muted dark:bg-card">
                <div className="grid grid-cols-[1fr_repeat(3,minmax(100px,140px))] items-center">
                  <div className="px-4 py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-background">
                      {getProductGroupLabel(
                        firstQuote.productType,
                        firstQuote.termYears,
                      )}
                    </span>
                  </div>
                  {amounts.map((amount, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2.5 text-center border-l border-border"
                    >
                      <span className="text-[11px] font-semibold text-background tabular-nums">
                        {mode === "coverage"
                          ? formatCurrencyCompact(amount)
                          : `${formatCurrency(amount)}/mo`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote Rows */}
              {groupQuotes.map((quote, rowIdx) => (
                <QuoteRow
                  key={`${quote.productId}-${quote.termYears ?? "wl"}`}
                  quote={quote}
                  mode={mode}
                  isEven={rowIdx % 2 === 0}
                />
              ))}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Quote Row
// =============================================================================

function QuoteRow({
  quote,
  mode,
  isEven,
}: {
  quote: QuickQuoteResult;
  mode: "coverage" | "budget";
  isEven: boolean;
}) {
  // Find lowest-cost column for highlighting
  const lowestCostIndex = useMemo(() => {
    const validCosts = quote.columns
      .map((c, i) => ({ cost: c.costPerThousand, index: i }))
      .filter((c) => c.cost !== null);
    if (validCosts.length <= 1) return -1;
    validCosts.sort((a, b) => a.cost! - b.cost!);
    return validCosts[0].index;
  }, [quote.columns]);

  const hasAnyValid = quote.columns.some((c) =>
    mode === "coverage" ? c.premium !== null : c.coverage !== null,
  );

  if (!hasAnyValid) {
    return (
      <div
        className={cn(
          "grid grid-cols-[1fr_repeat(3,minmax(100px,140px))] items-center border-t border-border dark:border-border opacity-40",
          isEven
            ? "bg-white dark:bg-background"
            : "bg-background dark:bg-card/50",
        )}
      >
        <div className="px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {quote.carrierName}
          </span>
          <span className="text-[11px] text-muted-foreground ml-2 truncate">
            {quote.productName}
          </span>
        </div>
        <div className="col-span-3 text-center py-2.5 border-l border-border dark:border-border">
          <span className="text-[11px] text-muted-foreground">
            No rates available
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_repeat(3,minmax(100px,140px))] items-center border-t border-border dark:border-border transition-colors hover:bg-info/10/40 dark:hover:bg-info/10",
        isEven
          ? "bg-white dark:bg-background"
          : "bg-background dark:bg-card/50",
      )}
    >
      {/* Carrier / Product */}
      <div className="px-4 py-2.5 min-w-0">
        <div className="text-[13px] font-semibold text-foreground dark:text-foreground truncate">
          {quote.carrierName}
        </div>
        <div className="text-[11px] text-muted-foreground dark:text-muted-foreground truncate">
          {quote.productName}
        </div>
      </div>

      {/* 3 Amount Columns */}
      {quote.columns.map((col, idx) => {
        const isLowest = idx === lowestCostIndex;
        const value = mode === "coverage" ? col.premium : col.coverage;
        const displayValue =
          mode === "coverage"
            ? formatCurrency(col.premium)
            : formatCurrencyCompact(col.coverage);

        return (
          <div
            key={idx}
            className={cn(
              "px-3 py-2.5 text-center border-l tabular-nums",
              isLowest
                ? "bg-success/10 border-l-emerald-200 dark:border-l-emerald-800"
                : "border-l-v2-ring dark:border-l-v2-ring",
            )}
          >
            {value !== null ? (
              <div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isLowest
                      ? "text-success font-bold"
                      : "text-foreground dark:text-foreground",
                  )}
                >
                  {displayValue}
                </span>
                {mode === "coverage" && (
                  <span
                    className={cn(
                      "text-[10px] ml-0.5",
                      isLowest
                        ? "text-success/70 dark:text-success/70"
                        : "text-muted-foreground dark:text-muted-foreground",
                    )}
                  >
                    /mo
                  </span>
                )}
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    --
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rate not available for this amount</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}
