// src/features/business-tools/components/UploadResultSummary.tsx
// Detailed breakdown after job completes, showing file-by-file status

import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineJob, BusinessToolsTab } from "../types";

interface UploadResultSummaryProps {
  job: PipelineJob;
  onSwitchTab: (tab: BusinessToolsTab) => void;
  onReset: () => void;
}

interface FileResult {
  filename: string;
  status: "imported" | "skipped" | "unsupported" | "error";
  reason?: string;
  transactions_count?: number;
}

export function UploadResultSummary({
  job,
  onSwitchTab,
  onReset,
}: UploadResultSummaryProps) {
  // Parse result if available — the API may return structured results
  const result = job.result as {
    files?: FileResult[];
    total_transactions?: number;
    total_statements?: number;
    needs_review?: number;
  } | null;

  const files = result?.files ?? [];
  const totalTx = result?.total_transactions ?? 0;
  const totalStmts = result?.total_statements ?? 0;
  const needsReview = result?.needs_review ?? 0;
  const isComplete = job.status === "complete";
  const isFailed = job.status === "failed";

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-xs font-medium text-v2-ink dark:text-v2-ink-subtle">
          {isComplete ? "Processing Complete" : "Processing Failed"}
        </span>
      </div>

      {/* Summary stats */}
      {isComplete && (totalTx > 0 || totalStmts > 0) && (
        <div className="flex items-center gap-4 text-[11px]">
          {totalTx > 0 && (
            <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
              <strong className="text-v2-ink dark:text-v2-ink-subtle">
                {totalTx}
              </strong>{" "}
              transactions
            </span>
          )}
          {totalStmts > 0 && (
            <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
              <strong className="text-v2-ink dark:text-v2-ink-subtle">
                {totalStmts}
              </strong>{" "}
              statements
            </span>
          )}
          {needsReview > 0 && (
            <span className="text-warning">
              <strong>{needsReview}</strong> need review
            </span>
          )}
        </div>
      )}

      {/* File-by-file status */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded text-[10px]",
                f.status === "imported"
                  ? "bg-success/10 dark:bg-success/10"
                  : f.status === "error"
                    ? "bg-destructive/10 dark:bg-destructive/10"
                    : "bg-v2-canvas/30",
              )}
            >
              {f.status === "imported" ? (
                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
              ) : f.status === "error" ? (
                <XCircle className="h-3 w-3 text-destructive shrink-0" />
              ) : (
                <AlertCircle className="h-3 w-3 text-v2-ink-subtle shrink-0" />
              )}
              <span className="text-v2-ink-muted truncate">{f.filename}</span>
              {f.transactions_count != null && (
                <span className="text-v2-ink-muted ml-auto shrink-0">
                  {f.transactions_count} txns
                </span>
              )}
              {f.reason && (
                <span className="text-v2-ink-subtle ml-auto shrink-0">
                  {f.reason}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {isFailed && job.error && (
        <p className="text-[10px] text-destructive">{job.error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isComplete && needsReview > 0 && (
          <Button
            size="sm"
            className="h-7 text-[11px] bg-success hover:bg-success text-white"
            onClick={() => onSwitchTab("transactions")}
          >
            Start Reviewing
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {isComplete && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => onSwitchTab("transactions")}
          >
            View Transactions
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-v2-ink-muted"
          onClick={onReset}
        >
          Upload More
        </Button>
      </div>
    </div>
  );
}
