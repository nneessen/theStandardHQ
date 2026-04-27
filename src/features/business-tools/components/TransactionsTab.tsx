// src/features/business-tools/components/TransactionsTab.tsx
// Paginated transaction table with server-side filtering, quick classify, search, expandable rows, and bulk actions

import React, { useState, useMemo, useCallback, Fragment } from "react";
import {
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  useTransactions,
  useStableMetadata,
  useCategorizeTransaction,
  useApproveTransaction,
  useExcludeTransaction,
  useBulkApprove,
  useBulkExclude,
  useBulkCategorize,
} from "../hooks/useBusinessTools";
import { TransactionDetail } from "./TransactionDetail";
import type {
  TransactionResponse,
  TransactionQuery,
  CategoriesResponse,
} from "../types";

const PAGE_SIZE = 50;

const TRUST_BADGE: Record<string, { label: string; className: string }> = {
  auto_trusted: {
    label: "Auto",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  trusted: {
    label: "Trusted",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  approved: {
    label: "Approved",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  needs_review: {
    label: "Review",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  excluded: {
    label: "Excluded",
    className:
      "bg-v2-ring text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
};

function formatCents(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// ─── Memoized Row Component ──────────────────────────────────

const TransactionRow = React.memo(function TransactionRow({
  txn,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  categories,
  onCategorize,
  onApprove,
  onExclude,
  idx,
}: {
  txn: TransactionResponse;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (id: number) => void;
  onToggleSelect: (id: number) => void;
  categories: CategoriesResponse | undefined;
  onCategorize: (params: {
    id: number;
    category: string;
    transaction_kind?: string;
    business_split_bps?: number;
    reason?: string;
  }) => void;
  onApprove: (params: { id: number }) => void;
  onExclude: (params: { id: number }) => void;
  idx: number;
}) {
  const badge = TRUST_BADGE[txn.trust_state] ?? TRUST_BADGE.needs_review;
  return (
    <Fragment>
      <tr
        className={cn(
          "border-b border-v2-ring/60 hover:bg-v2-canvas dark:hover:bg-v2-card-dark/30 cursor-pointer",
          idx % 2 === 1 && "bg-v2-canvas/50 dark:bg-v2-card-dark/10",
          txn.excluded_from_totals && "opacity-50",
          isExpanded && "bg-v2-canvas dark:bg-v2-card-dark/40",
        )}
        onClick={() => onToggleExpand(txn.id)}
      >
        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(txn.id)}
          />
        </td>
        <td className="px-1 py-1 text-v2-ink-subtle">
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </td>
        <td className="px-2 py-1 text-v2-ink-muted whitespace-nowrap">
          {txn.transaction_date}
        </td>
        <td className="px-2 py-1 text-v2-ink dark:text-v2-ink-subtle max-w-[240px] truncate">
          {txn.description_normalized || txn.description_raw}
        </td>
        <td
          className={cn(
            "px-2 py-1 text-right tabular-nums whitespace-nowrap",
            txn.direction === "income"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-v2-ink dark:text-v2-ink-subtle",
          )}
        >
          {txn.direction === "income" ? "+" : "-"}
          {formatCents(txn.amount_cents)}
        </td>
        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
          {categories ? (
            <select
              value={txn.category}
              onChange={(e) =>
                onCategorize({
                  id: txn.id,
                  category: e.target.value,
                })
              }
              className="h-5 px-1 text-[10px] border border-v2-ring rounded bg-transparent text-v2-ink-muted max-w-[120px]"
            >
              {categories.categories.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-v2-ink-muted">{txn.category}</span>
          )}
        </td>
        <td className="px-2 py-1 text-right tabular-nums text-v2-ink-muted dark:text-v2-ink-subtle">
          {(txn.business_split_bps / 100).toFixed(0)}%
        </td>
        <td className="px-2 py-1 text-center">
          <Badge className={cn("text-[9px] h-4 px-1.5", badge.className)}>
            {badge.label}
          </Badge>
        </td>
        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            {txn.trust_state !== "approved" && (
              <button
                onClick={() => onApprove({ id: txn.id })}
                className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600"
                title="Approve"
              >
                <Check className="h-3 w-3" />
              </button>
            )}
            {txn.trust_state !== "excluded" && (
              <button
                onClick={() => onExclude({ id: txn.id })}
                className="p-0.5 rounded hover:bg-v2-ring dark:hover:bg-v2-ring text-v2-ink-muted"
                title="Exclude"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr key={`${txn.id}-detail`}>
          <td colSpan={9} className="p-0">
            <TransactionDetail
              txn={txn}
              categories={categories}
              onCategorize={onCategorize}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
});

// ─── Main Component ──────────────────────────────────────────

export function TransactionsTab() {
  const [query, setQuery] = useState<TransactionQuery>({
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const {
    data: txData,
    isLoading: txLoading,
    error,
    isPlaceholderData,
  } = useTransactions(query);
  const { categories, isLoading: metaLoading } = useStableMetadata();
  const isLoading = txLoading || metaLoading;

  const allTransactions = useMemo(() => txData?.items ?? [], [txData?.items]);
  const total = txData?.total ?? 0;

  // Client-side description search within current page
  const transactions = useMemo(() => {
    if (!searchText.trim()) return allTransactions;
    const lower = searchText.toLowerCase();
    return allTransactions.filter(
      (t: TransactionResponse) =>
        (t.description_normalized || "").toLowerCase().includes(lower) ||
        t.description_raw.toLowerCase().includes(lower),
    );
  }, [allTransactions, searchText]);

  const categorize = useCategorizeTransaction();
  const approve = useApproveTransaction();
  const exclude = useExcludeTransaction();
  const bulkApprove = useBulkApprove();
  const bulkExclude = useBulkExclude();
  const bulkCategorize = useBulkCategorize();

  const page = Math.floor((query.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const setPage = (p: number) => {
    setSelected(new Set());
    setExpandedId(null);
    setQuery((prev) => ({ ...prev, offset: p * PAGE_SIZE }));
  };

  const setFilter = (key: "trust_state" | "category", value: string) => {
    setSelected(new Set());
    setExpandedId(null);
    setQuery((prev) => ({
      ...prev,
      offset: 0,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleCategorize = useCallback(
    (params: {
      id: number;
      category: string;
      transaction_kind?: string;
      business_split_bps?: number;
      reason?: string;
    }) => {
      categorize.mutate(params);
    },
    [categorize],
  );

  const handleApprove = useCallback(
    (params: { id: number }) => {
      approve.mutate(params);
    },
    [approve],
  );

  const handleExclude = useCallback(
    (params: { id: number }) => {
      exclude.mutate(params);
    },
    [exclude],
  );

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t: TransactionResponse) => t.id)));
    }
  };

  const selectedIds = Array.from(selected);

  if (isLoading && !isPlaceholderData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Failed to load transactions
        </p>
        <p className="text-[10px] text-v2-ink-muted">
          {error instanceof Error
            ? error.message
            : "Service unavailable. Try again later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filters + search + pagination info */}
      <div className="flex items-center gap-2">
        <select
          value={query.trust_state ?? "all"}
          onChange={(e) => setFilter("trust_state", e.target.value)}
          className="h-7 px-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted"
        >
          <option value="all">All States</option>
          <option value="needs_review">Needs Review</option>
          <option value="trusted">Trusted</option>
          <option value="approved">Approved</option>
          <option value="excluded">Excluded</option>
          <option value="rejected">Rejected</option>
        </select>

        {categories && (
          <select
            value={query.category ?? "all"}
            onChange={(e) => setFilter("category", e.target.value)}
            className="h-7 px-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted"
          >
            <option value="all">All Categories</option>
            {categories.categories.map((c: string) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-7 pl-6 pr-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted placeholder:text-v2-ink-subtle w-48"
          />
        </div>

        <span className="text-[10px] text-v2-ink-subtle ml-auto tabular-nums">
          {searchText ? `${transactions.length} matches / ` : ""}
          {total.toLocaleString()} total
          {isPlaceholderData && (
            <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
          )}
        </span>
      </div>

      {/* Quick classify bar (shown when items selected) */}
      {selected.size > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 flex-wrap">
          <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300 mr-1">
            {selected.size} selected
          </span>

          {/* Quick classification pills */}
          {categories?.quick_classifications?.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                bulkCategorize.mutate({
                  ids: selectedIds,
                  category: preset.category,
                  transaction_kind: preset.kind,
                  business_split_bps: preset.split_bps,
                });
                setSelected(new Set());
              }}
              className="px-2 py-0.5 text-[10px] rounded-full bg-white dark:bg-v2-ring border border-v2-ring  text-v2-ink-muted hover:bg-v2-canvas dark:hover:bg-v2-card-dark transition-colors"
            >
              {preset.label}
            </button>
          ))}

          <div className="h-4 w-px bg-v2-ring mx-0.5" />

          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            disabled={bulkApprove.isPending}
            onClick={() => {
              bulkApprove.mutate({ ids: selectedIds });
              setSelected(new Set());
            }}
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            disabled={bulkExclude.isPending}
            onClick={() => {
              bulkExclude.mutate({ ids: selectedIds });
              setSelected(new Set());
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Exclude
          </Button>

          {categories && (
            <div className="relative">
              <select
                className="h-6 px-2 text-[10px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted appearance-none pr-5"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    bulkCategorize.mutate({
                      ids: selectedIds,
                      category: e.target.value,
                    });
                    setSelected(new Set());
                  }
                }}
              >
                <option value="" disabled>
                  Set Category...
                </option>
                {categories.categories.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle pointer-events-none" />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xs text-v2-ink-muted">
            {query.trust_state || query.category || searchText
              ? "No transactions match the current filters."
              : "No transactions yet. Upload a statement to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-v2-ring">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-v2-canvas dark:bg-v2-card-dark border-b border-v2-ring">
                <th className="w-8 px-2 py-1.5">
                  <Checkbox
                    checked={
                      transactions.length > 0 &&
                      selected.size === transactions.length
                        ? true
                        : selected.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="w-6 px-1 py-1.5" />
                <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted">
                  Date
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted">
                  Description
                </th>
                <th className="text-right px-2 py-1.5 font-medium text-v2-ink-muted">
                  Amount
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted">
                  Category
                </th>
                <th className="text-right px-2 py-1.5 font-medium text-v2-ink-muted">
                  Biz%
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-v2-ink-muted">
                  Status
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-v2-ink-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn: TransactionResponse, idx: number) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  isExpanded={expandedId === txn.id}
                  isSelected={selected.has(txn.id)}
                  onToggleExpand={toggleExpand}
                  onToggleSelect={toggleSelect}
                  categories={categories}
                  onCategorize={handleCategorize}
                  onApprove={handleApprove}
                  onExclude={handleExclude}
                  idx={idx}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-v2-ink-muted tabular-nums">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 w-6 p-0"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 w-6 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
