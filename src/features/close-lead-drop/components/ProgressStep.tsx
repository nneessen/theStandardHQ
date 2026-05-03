// Step 5: Live progress bar while the drop runs in the background.

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLeadDropJobStatus } from "../hooks/useLeadDrop";

interface ProgressStepProps {
  jobId: string;
  totalLeads: number;
  onComplete: () => void;
}

export function ProgressStep({
  jobId,
  totalLeads,
  onComplete,
}: ProgressStepProps) {
  const { data } = useLeadDropJobStatus(jobId);
  const job = data?.job;

  const created = job?.created_leads ?? 0;
  const failed = job?.failed_leads ?? 0;
  const processed = created + failed;
  const total = job?.total_leads ?? totalLeads;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isComplete = job?.status === "completed" || job?.status === "failed";

  // Keep a stable ref so the effect closure doesn't go stale
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Trigger parent transition when job reaches terminal state
  useEffect(() => {
    if (!isComplete) return;
    const timer = setTimeout(() => onCompleteRef.current(), 800);
    return () => clearTimeout(timer);
  }, [isComplete]);

  return (
    <div className="space-y-5 py-4">
      <div className="text-center space-y-1">
        {!isComplete && (
          <Loader2 className="h-8 w-8 animate-spin text-success mx-auto" />
        )}
        {isComplete && job?.status === "completed" && (
          <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center mx-auto">
            <span className="text-success text-base">✓</span>
          </div>
        )}
        {isComplete && job?.status === "failed" && (
          <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
            <span className="text-destructive text-base">✕</span>
          </div>
        )}
        <p className="text-sm font-semibold">
          {isComplete
            ? job?.status === "completed"
              ? "Drop Complete"
              : "Drop Failed"
            : "Dropping Leads…"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isComplete
            ? `${created} created · ${failed} failed`
            : `Creating leads… ${processed} / ${total}`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{percent}%</span>
          <span>
            {processed} / {total}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-6 text-xs">
        <div className="text-center">
          <p className="text-lg font-semibold text-success tabular-nums">
            {created}
          </p>
          <p className="text-muted-foreground">Created</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive tabular-nums">
            {failed}
          </p>
          <p className="text-muted-foreground">Failed</p>
        </div>
      </div>

      {job?.error_message && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md p-3 text-center">
          {job.error_message}
        </div>
      )}

      {!isComplete && (
        <p className="text-center text-xs text-muted-foreground">
          Please keep this page open while the drop is running.
        </p>
      )}
    </div>
  );
}
