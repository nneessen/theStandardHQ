// src/features/underwriting/components/QuickQuote/QuoteResultsTable.tsx

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
// eslint-disable-next-line no-restricted-imports
import type { QuoteResult } from "@/services/underwriting/workflows/quotingService";

interface QuoteResultsTableProps {
  quotes: QuoteResult[];
  mode: "budget" | "coverage";
  isLoading?: boolean;
  showIneligible?: boolean;
}

type SortKey =
  | "score"
  | "monthlyPremium"
  | "faceAmount"
  | "costPerThousand"
  | "approvalLikelihood";
type SortDirection = "asc" | "desc";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCurrencyDecimal = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatPercent = (value: number): string => {
  return `${Math.round(value * 100)}%`;
};

export default function QuoteResultsTable({
  quotes,
  mode,
  isLoading,
  showIneligible = false,
}: QuoteResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedIneligible, setExpandedIneligible] = useState(false);

  // Separate eligible and ineligible quotes
  const eligibleQuotes = quotes.filter(
    (q) =>
      q.eligibilityStatus === "eligible" ||
      q.eligibilityStatus === "rating_adjusted",
  );
  const ineligibleQuotes = quotes.filter(
    (q) => q.eligibilityStatus === "knockout",
  );

  // Sort eligible quotes
  const sortedQuotes = [...eligibleQuotes].sort((a, b) => {
    let comparison = 0;
    switch (sortKey) {
      case "score":
        comparison = a.score - b.score;
        break;
      case "monthlyPremium":
        comparison = a.monthlyPremium - b.monthlyPremium;
        break;
      case "faceAmount":
        comparison = a.faceAmount - b.faceAmount;
        break;
      case "costPerThousand":
        comparison = a.costPerThousand - b.costPerThousand;
        break;
      case "approvalLikelihood":
        comparison = a.approvalLikelihood - b.approvalLikelihood;
        break;
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      // Default to desc for score/coverage/approval, asc for price
      setSortDirection(
        key === "monthlyPremium" || key === "costPerThousand" ? "asc" : "desc",
      );
    }
  };

  const SortButton = ({
    sortKeyValue,
    children,
  }: {
    sortKeyValue: SortKey;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-1 text-[10px] font-medium hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted"
      onClick={() => handleSort(sortKeyValue)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "ml-1 h-3 w-3",
          sortKey === sortKeyValue
            ? "text-blue-600"
            : "text-v2-ink-subtle dark:text-v2-ink-muted",
        )}
      />
    </Button>
  );

  const getProductTypeBadge = (
    productType: string,
    termYears: number | null,
  ) => {
    if (productType === "term_life" && termYears) {
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[9px] h-4 px-1">
          Term {termYears}yr
        </Badge>
      );
    }
    if (productType === "whole_life" || productType === "final_expense") {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[9px] h-4 px-1">
          Whole Life
        </Badge>
      );
    }
    if (productType === "participating_whole_life") {
      return (
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[9px] h-4 px-1">
          Part. WL
        </Badge>
      );
    }
    return (
      <Badge className="bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-muted text-[9px] h-4 px-1">
        {productType.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getApprovalBadge = (likelihood: number) => {
    if (likelihood >= 0.8) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[9px] h-4 px-1">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          {formatPercent(likelihood)}
        </Badge>
      );
    }
    if (likelihood >= 0.5) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-[9px] h-4 px-1">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          {formatPercent(likelihood)}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[9px] h-4 px-1">
        <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
        {formatPercent(likelihood)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg border-v2-ring dark:border-v2-ring overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-v2-canvas dark:bg-v2-card/50">
              <TableHead className="text-[10px] font-medium">Carrier</TableHead>
              <TableHead className="text-[10px] font-medium">Product</TableHead>
              <TableHead className="text-[10px] font-medium">Type</TableHead>
              <TableHead className="text-[10px] font-medium text-right">
                Coverage
              </TableHead>
              <TableHead className="text-[10px] font-medium text-right">
                Monthly
              </TableHead>
              <TableHead className="text-[10px] font-medium text-right">
                $/1K
              </TableHead>
              <TableHead className="text-[10px] font-medium text-center">
                Approval
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <div className="h-4 bg-v2-card-tinted dark:bg-v2-card-tinted rounded animate-pulse" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (eligibleQuotes.length === 0) {
    return (
      <div className="border rounded-lg border-v2-ring dark:border-v2-ring p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-v2-ink-subtle" />
        <p className="text-sm text-v2-ink-muted dark:text-v2-ink-subtle">
          No eligible quotes found
        </p>
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-muted mt-1">
          {ineligibleQuotes.length > 0
            ? `${ineligibleQuotes.length} products were excluded due to eligibility rules`
            : "Try adjusting your search criteria"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
        <span>
          Found <span className="font-medium">{eligibleQuotes.length}</span>{" "}
          eligible quotes
          {mode === "budget" && (
            <>
              {" "}
              • Best coverage:{" "}
              <span className="font-medium text-emerald-600">
                {formatCurrency(
                  Math.max(...eligibleQuotes.map((q) => q.faceAmount)),
                )}
              </span>
            </>
          )}
          {mode === "coverage" && (
            <>
              {" "}
              • Best price:{" "}
              <span className="font-medium text-emerald-600">
                {formatCurrencyDecimal(
                  Math.min(...eligibleQuotes.map((q) => q.monthlyPremium)),
                )}
                /mo
              </span>
            </>
          )}
        </span>
        {ineligibleQuotes.length > 0 && (
          <span className="text-v2-ink-muted">
            {ineligibleQuotes.length} products excluded
          </span>
        )}
      </div>

      {/* Main Table */}
      <div className="border rounded-lg border-v2-ring dark:border-v2-ring overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-v2-canvas dark:bg-v2-card/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted">
              <TableHead className="text-[10px] font-medium w-[120px]">
                Carrier
              </TableHead>
              <TableHead className="text-[10px] font-medium w-[160px]">
                Product
              </TableHead>
              <TableHead className="text-[10px] font-medium w-[70px]">
                Type
              </TableHead>
              <TableHead className="text-[10px] font-medium text-right w-[100px]">
                <SortButton sortKeyValue="faceAmount">Coverage</SortButton>
              </TableHead>
              <TableHead className="text-[10px] font-medium text-right w-[90px]">
                <SortButton sortKeyValue="monthlyPremium">Monthly</SortButton>
              </TableHead>
              <TableHead className="text-[10px] font-medium text-right w-[70px]">
                <SortButton sortKeyValue="costPerThousand">$/1K</SortButton>
              </TableHead>
              <TableHead className="text-[10px] font-medium text-center w-[80px]">
                <SortButton sortKeyValue="approvalLikelihood">
                  Approval
                </SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedQuotes.map((quote, index) => (
              <TableRow
                key={`${quote.productId}-${quote.termYears}`}
                className={cn(
                  index === 0 && "bg-emerald-50/50 dark:bg-emerald-900/10",
                  quote.eligibilityStatus === "rating_adjusted" &&
                    "bg-yellow-50/30 dark:bg-yellow-900/10",
                )}
              >
                <TableCell className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
                  {quote.carrierName}
                </TableCell>
                <TableCell className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  <div className="flex items-center gap-1">
                    {quote.productName}
                    {quote.eligibilityStatus === "rating_adjusted" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] max-w-[200px]">
                            Rating adjusted from {quote.ratingAdjustedFrom} to{" "}
                            {quote.healthClassResult}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getProductTypeBadge(quote.productType, quote.termYears)}
                </TableCell>
                <TableCell className="text-[11px] text-right font-medium text-v2-ink dark:text-v2-ink-muted">
                  {formatCurrency(quote.faceAmount)}
                </TableCell>
                <TableCell className="text-[11px] text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyDecimal(quote.monthlyPremium)}
                </TableCell>
                <TableCell className="text-[11px] text-right text-v2-ink-muted dark:text-v2-ink-subtle">
                  ${quote.costPerThousand.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  {getApprovalBadge(quote.approvalLikelihood)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Ineligible Products (Collapsible) */}
      {showIneligible && ineligibleQuotes.length > 0 && (
        <div className="border rounded-lg border-v2-ring dark:border-v2-ring overflow-hidden">
          <button
            onClick={() => setExpandedIneligible(!expandedIneligible)}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {ineligibleQuotes.length} products excluded
            </span>
            {expandedIneligible ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedIneligible && (
            <Table>
              <TableBody>
                {ineligibleQuotes.map((quote) => (
                  <TableRow
                    key={`${quote.productId}-${quote.termYears}-ineligible`}
                    className="opacity-50 bg-red-50/30 dark:bg-red-900/10"
                  >
                    <TableCell className="text-[11px] text-v2-ink-muted w-[120px]">
                      {quote.carrierName}
                    </TableCell>
                    <TableCell className="text-[11px] text-v2-ink-muted w-[160px]">
                      {quote.productName}
                    </TableCell>
                    <TableCell
                      colSpan={5}
                      className="text-[10px] text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {quote.ineligibilityReason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
