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
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4 text-center">
        <p className="text-xs text-v2-ink-muted">
          All caught up! No transactions need review.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
        <span className="text-[11px] font-medium text-v2-ink-muted">
          Needs Review
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 text-[10px] text-success"
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
                "border-b border-v2-ring /50 last:border-0",
                idx % 2 === 1 && "bg-v2-canvas/50 dark:bg-v2-card-dark/30",
              )}
            >
              <td className="px-3 py-1.5 text-v2-ink-muted whitespace-nowrap">
                {txn.transaction_date}
              </td>
              <td className="px-2 py-1.5 text-v2-ink dark:text-v2-ink-subtle max-w-[200px] truncate">
                {txn.description_normalized || txn.description_raw}
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right tabular-nums whitespace-nowrap",
                  txn.direction === "income"
                    ? "text-success"
                    : "text-v2-ink dark:text-v2-ink-subtle",
                )}
              >
                {txn.direction === "income" ? "+" : "-"}
                {formatCents(txn.amount_cents)}
              </td>
              <td className="px-2 py-1.5 text-v2-ink-muted max-w-[100px] truncate">
                {txn.category}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => approve.mutate({ id: txn.id })}
                    className="p-0.5 rounded hover:bg-success/20 dark:hover:bg-success/30 text-success"
                    title="Approve"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => exclude.mutate({ id: txn.id })}
                    className="p-0.5 rounded hover:bg-v2-ring dark:hover:bg-v2-ring text-v2-ink-muted"
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
