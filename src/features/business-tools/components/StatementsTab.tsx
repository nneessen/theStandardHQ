// src/features/business-tools/components/StatementsTab.tsx
// Paginated statement list with server-side trust_state + account_type filters and trust actions

import { useState } from "react";
import { Loader2, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStatements, useTrustStatement } from "../hooks/useBusinessTools";
import type { StatementQuery, StatementResponse } from "../types";

const PAGE_SIZE = 50;

const TRUST_BADGE: Record<
  StatementResponse["trust_state"],
  { label: string; className: string }
> = {
  trusted: {
    label: "Trusted",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  needs_review: {
    label: "Review",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
};

const ACCOUNT_TYPES = [
  { value: "all", label: "All Account Types" },
  { value: "bank", label: "Bank" },
  { value: "credit_card", label: "Credit Card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
];

export function StatementsTab() {
  const [query, setQuery] = useState<StatementQuery>({
    limit: PAGE_SIZE,
    offset: 0,
  });

  const { data, isLoading, error, isPlaceholderData } = useStatements(query);
  const trustStatement = useTrustStatement();

  const statements = data?.items ?? [];
  const total = data?.total ?? 0;

  const page = Math.floor((query.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const setPage = (p: number) => {
    setQuery((prev) => ({ ...prev, offset: p * PAGE_SIZE }));
  };

  const setFilter = (key: "trust_state" | "account_type", value: string) => {
    setQuery((prev) => ({
      ...prev,
      offset: 0,
      [key]: value === "all" ? undefined : value,
    }));
  };

  if (isLoading && !isPlaceholderData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Failed to load statements
        </p>
        <p className="text-[10px] text-zinc-500">
          {error instanceof Error
            ? error.message
            : "The business tools service may be unavailable. Try again later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter + pagination info */}
      <div className="flex items-center gap-2">
        <select
          value={query.trust_state ?? "all"}
          onChange={(e) => setFilter("trust_state", e.target.value)}
          className="h-7 px-2 text-[11px] border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
        >
          <option value="all">All States</option>
          <option value="needs_review">Needs Review</option>
          <option value="trusted">Trusted</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={query.account_type ?? "all"}
          onChange={(e) => setFilter("account_type", e.target.value)}
          className="h-7 px-2 text-[11px] border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
        >
          {ACCOUNT_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <span className="text-[10px] text-zinc-400 ml-auto tabular-nums">
          {total.toLocaleString()} total
          {isPlaceholderData && (
            <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
          )}
        </span>
      </div>

      {/* Table */}
      {statements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xs text-zinc-500">
            {query.trust_state || query.account_type
              ? "No statements match the current filters."
              : "No statements yet. Upload files on the Upload tab."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-2 py-1.5 font-medium text-zinc-500">
                  File
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-500">
                  Institution
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-500">
                  Account
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-500">
                  Type
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-zinc-500">
                  End Date
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-zinc-500">
                  Status
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {statements.map((stmt: StatementResponse, idx: number) => (
                <tr
                  key={stmt.id}
                  className={cn(
                    "border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/30",
                    idx % 2 === 1 && "bg-zinc-50/50 dark:bg-zinc-900/10",
                  )}
                >
                  <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate">
                    {stmt.source_file}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300">
                    {stmt.institution_name}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300">
                    {stmt.account_name}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400 capitalize">
                    {stmt.account_type}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {stmt.statement_end_date || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Badge
                      className={cn(
                        "text-[9px] h-4 px-1.5",
                        TRUST_BADGE[stmt.trust_state].className,
                      )}
                    >
                      {TRUST_BADGE[stmt.trust_state].label}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {stmt.trust_state !== "trusted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 text-[10px] px-2"
                        disabled={trustStatement.isPending}
                        onClick={() => trustStatement.mutate({ id: stmt.id })}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Trust
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-500 tabular-nums">
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
