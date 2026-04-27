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
    <div className="px-4 py-3 bg-v2-canvas/80 dark:bg-v2-card-dark/50 border-b border-v2-ring space-y-3">
      {/* Description details */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10px]">
        <div>
          <span className="text-v2-ink-subtle block">Raw Description</span>
          <span className="text-v2-ink-muted break-words">
            {txn.description_raw}
          </span>
        </div>
        <div>
          <span className="text-v2-ink-subtle block">Normalized</span>
          <span className="text-v2-ink-muted break-words">
            {txn.description_normalized || "—"}
          </span>
        </div>
        <div>
          <span className="text-v2-ink-subtle block">Transaction Kind</span>
          <span className="text-v2-ink-muted">
            {txn.transaction_kind || "—"}
          </span>
        </div>
        <div>
          <span className="text-v2-ink-subtle block">Review Reason</span>
          <span className="text-v2-ink-muted">{txn.review_reason || "—"}</span>
        </div>
      </div>

      {/* Business split slider */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-v2-ink-muted shrink-0 w-20">
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
        <span className="text-[11px] font-medium text-v2-ink-muted tabular-nums w-10 text-right">
          {splitPct}%
        </span>
      </div>

      {/* Quick classifications */}
      {categories?.quick_classifications &&
        categories.quick_classifications.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-v2-ink-subtle shrink-0">
              Quick:
            </span>
            {categories.quick_classifications.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleQuickClassify(preset)}
                className="px-2 py-0.5 text-[10px] rounded-full border border-v2-ring  text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-ring dark:hover:bg-v2-ring transition-colors"
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
          className="flex-1 h-6 px-2 text-[10px] border border-v2-ring rounded bg-v2-card text-v2-ink-muted placeholder:text-v2-ink-subtle"
        />
      </div>
    </div>
  );
}
