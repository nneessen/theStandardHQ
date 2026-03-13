// src/features/business-tools/components/ReviewQueue.tsx
// Mini table showing last 10 transactions needing review with inline actions

import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useApproveTransaction,
  useExcludeTransaction,
} from "../hooks/useBusinessTools";
import type { TransactionResponse, BusinessToolsTab } from "../types";

function formatCents(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface ReviewQueueProps {
  transactions: TransactionResponse[];
  onSwitchTab: (tab: BusinessToolsTab) => void;
}

export function ReviewQueue({ transactions, onSwitchTab }: ReviewQueueProps) {
  const approve = useApproveTransaction();
  const exclude = useExcludeTransaction();

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-center">
        <p className="text-xs text-zinc-500">
          All caught up! No transactions need review.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
          Needs Review
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 text-[10px] text-teal-600 dark:text-teal-400"
          onClick={() => onSwitchTab("transactions")}
        >
          View All
          <ArrowRight className="h-3 w-3 ml-0.5" />
        </Button>
      </div>

      <table className="w-full text-[11px]">
        <tbody>
          {transactions.map((txn, idx) => (
            <tr
              key={txn.id}
              className={cn(
                "border-b border-zinc-50 dark:border-zinc-800/50 last:border-0",
                idx % 2 === 1 && "bg-zinc-50/50 dark:bg-zinc-900/30",
              )}
            >
              <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap">
                {txn.transaction_date}
              </td>
              <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate">
                {txn.description_normalized || txn.description_raw}
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right tabular-nums whitespace-nowrap",
                  txn.direction === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-800 dark:text-zinc-200",
                )}
              >
                {txn.direction === "income" ? "+" : "-"}
                {formatCents(txn.amount_cents)}
              </td>
              <td className="px-2 py-1.5 text-zinc-500 max-w-[100px] truncate">
                {txn.category}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => approve.mutate({ id: txn.id })}
                    className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600"
                    title="Approve"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => exclude.mutate({ id: txn.id })}
                    className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                    title="Exclude"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
