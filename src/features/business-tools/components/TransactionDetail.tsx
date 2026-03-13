// src/features/business-tools/components/TransactionDetail.tsx
// Expandable inline detail panel for a transaction row

import { useState } from "react";
import type { TransactionResponse, CategoriesResponse } from "../types";

interface TransactionDetailProps {
  txn: TransactionResponse;
  categories: CategoriesResponse | undefined;
  onCategorize: (params: {
    id: number;
    category: string;
    transaction_kind?: string;
    business_split_bps?: number;
    reason?: string;
  }) => void;
}

export function TransactionDetail({
  txn,
  categories,
  onCategorize,
}: TransactionDetailProps) {
  const [splitPct, setSplitPct] = useState(() =>
    Math.round(txn.business_split_bps / 100),
  );
  const [reason, setReason] = useState("");

  // Update local state while dragging, only fire mutation on release
  const commitSplit = (value: number) => {
    onCategorize({
      id: txn.id,
      category: txn.category,
      business_split_bps: value * 100,
    });
  };

  const handleQuickClassify = (preset: {
    category: string;
    kind: string;
    split_bps: number;
  }) => {
    onCategorize({
      id: txn.id,
      category: preset.category,
      transaction_kind: preset.kind,
      business_split_bps: preset.split_bps,
      reason: reason || undefined,
    });
  };

  return (
    <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
      {/* Description details */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10px]">
        <div>
          <span className="text-zinc-400 block">Raw Description</span>
          <span className="text-zinc-700 dark:text-zinc-300 break-words">
            {txn.description_raw}
          </span>
        </div>
        <div>
          <span className="text-zinc-400 block">Normalized</span>
          <span className="text-zinc-700 dark:text-zinc-300 break-words">
            {txn.description_normalized || "—"}
          </span>
        </div>
        <div>
          <span className="text-zinc-400 block">Transaction Kind</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {txn.transaction_kind || "—"}
          </span>
        </div>
        <div>
          <span className="text-zinc-400 block">Review Reason</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {txn.review_reason || "—"}
          </span>
        </div>
      </div>

      {/* Business split slider */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-zinc-500 shrink-0 w-20">
          Business Split
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={splitPct}
          onChange={(e) => setSplitPct(Number(e.target.value))}
          onPointerUp={() => commitSplit(splitPct)}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight")
              commitSplit(splitPct);
          }}
          className="flex-1 h-1.5 accent-blue-600"
        />
        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 tabular-nums w-10 text-right">
          {splitPct}%
        </span>
      </div>

      {/* Quick classifications */}
      {categories?.quick_classifications &&
        categories.quick_classifications.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 shrink-0">Quick:</span>
            {categories.quick_classifications.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleQuickClassify(preset)}
                className="px-2 py-0.5 text-[10px] rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

      {/* Reason input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Optional reason for categorization..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 h-6 px-2 text-[10px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400"
        />
      </div>
    </div>
  );
}
