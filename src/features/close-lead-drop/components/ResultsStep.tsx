// Step 6: Drop complete — show results and link to recipient's Smart View.

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadDropJobResults } from "../hooks/useLeadDrop";
import type { DropJob } from "../types/lead-drop.types";

interface ResultsStepProps {
  job: DropJob;
  onNewDrop: () => void;
}

const CLOSE_SMART_VIEW_BASE = "https://app.close.com/search/";

export function ResultsStep({ job, onNewDrop }: ResultsStepProps) {
  const [showFailed, setShowFailed] = useState(false);
  const { data: resultsData } = useLeadDropJobResults(
    job.failed_leads > 0 && showFailed ? job.id : null,
  );

  const isSuccess = job.status === "completed";
  const smartViewUrl = job.recipient_smart_view_id
    ? `${CLOSE_SMART_VIEW_BASE}${job.recipient_smart_view_id}/`
    : null;

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="text-center space-y-1">
        <div
          className={[
            "h-10 w-10 rounded-full flex items-center justify-center mx-auto text-xl",
            isSuccess ? "bg-green-500/20" : "bg-destructive/20",
          ].join(" ")}
        >
          {isSuccess ? "✓" : "✕"}
        </div>
        <h2 className="text-sm font-semibold">
          {isSuccess ? "Drop Complete" : "Drop Failed"}
        </h2>
        {job.error_message && (
          <p className="text-xs text-destructive">{job.error_message}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total" value={job.total_leads} />
        <StatCard
          label="Created"
          value={job.created_leads}
          color="text-green-500"
        />
        <StatCard
          label="Failed"
          value={job.failed_leads}
          color={job.failed_leads > 0 ? "text-destructive" : undefined}
        />
      </div>

      {/* Details */}
      <div className="border rounded-md divide-y divide-border text-xs">
        <InfoRow
          label="Recipient"
          value={
            [job.recipient?.first_name, job.recipient?.last_name]
              .filter(Boolean)
              .join(" ") ||
            job.recipient?.email ||
            "—"
          }
        />
        <InfoRow label="Lead Source" value={job.lead_source_label} />
        {job.sequence_name && (
          <InfoRow label="Sequence" value={job.sequence_name} />
        )}
        {job.recipient_smart_view_name && (
          <InfoRow
            label="Smart View Created"
            value={job.recipient_smart_view_name}
          />
        )}
      </div>

      {/* Smart View link */}
      {smartViewUrl && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs h-8"
          onClick={() => window.open(smartViewUrl, "_blank")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View leads in recipient's Smart View
        </Button>
      )}

      {/* Failed leads expandable */}
      {job.failed_leads > 0 && (
        <div className="border rounded-md overflow-hidden">
          <button
            onClick={() => setShowFailed((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors"
          >
            <span>
              {job.failed_leads} lead{job.failed_leads !== 1 ? "s" : ""} failed
            </span>
            {showFailed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showFailed && resultsData && (
            <div className="divide-y divide-border max-h-40 overflow-y-auto">
              {resultsData.results
                .filter((r) => r.status === "failed")
                .map((r) => (
                  <div key={r.id} className="px-3 py-2 text-xs">
                    <p className="font-medium">
                      {r.source_lead_name || r.source_lead_id}
                    </p>
                    {r.error_message && (
                      <p className="text-muted-foreground">{r.error_message}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center pt-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={onNewDrop}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New Drop
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border rounded-md p-2.5 text-center">
      <p
        className={["text-lg font-semibold tabular-nums", color ?? ""].join(
          " ",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
