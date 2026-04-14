// History tab: table of past Lead Drop jobs with per-lead result drill-down.

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import {
  useLeadDropHistory,
  useLeadDropJobResults,
} from "../hooks/useLeadDrop";
import type { DropJob } from "../types/lead-drop.types";
import { cn } from "@/lib/utils";

const CLOSE_SMART_VIEW_BASE = "https://app.close.com/search/";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/15 text-blue-500",
  completed: "bg-green-500/15 text-green-600 dark:text-green-400",
  failed: "bg-destructive/15 text-destructive",
};

export function HistoryTab() {
  const { data, isLoading } = useLeadDropHistory();
  const jobs = data?.jobs ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading history…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        No Lead Drops yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {jobs.map((job) => (
        <HistoryRow key={job.id} job={job} />
      ))}
    </div>
  );
}

function HistoryRow({ job }: { job: DropJob }) {
  const [open, setOpen] = useState(false);
  const { data: resultsData, isLoading: loadingResults } =
    useLeadDropJobResults(open ? job.id : null);

  const recipientName =
    [job.recipient?.first_name, job.recipient?.last_name]
      .filter(Boolean)
      .join(" ") ||
    job.recipient?.email ||
    "Unknown";

  const createdAt = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const smartViewUrl = job.recipient_smart_view_id
    ? `${CLOSE_SMART_VIEW_BASE}${job.recipient_smart_view_id}/`
    : null;

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Row header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">
          {createdAt}
        </span>
        <span className="text-xs font-medium flex-1 truncate">
          {recipientName}
        </span>
        <span className="text-xs text-muted-foreground truncate hidden sm:block mr-3 max-w-[120px]">
          {job.smart_view_name}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground mr-3">
          {job.created_leads}/{job.total_leads}
        </span>
        <span
          className={cn(
            "text-[10px] rounded-full px-2 py-0.5 font-medium capitalize",
            STATUS_BADGE[job.status] ?? "bg-muted",
          )}
        >
          {job.status}
        </span>
        {smartViewUrl && (
          <a
            href={smartViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Open Smart View in Close"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <Detail label="Lead Source" value={job.lead_source_label} />
            <Detail label="Sequence" value={job.sequence_name ?? "None"} />
            {job.recipient_smart_view_name && (
              <Detail
                label="Smart View"
                value={job.recipient_smart_view_name}
              />
            )}
            {job.error_message && (
              <Detail label="Error" value={job.error_message} error />
            )}
          </div>

          {loadingResults && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading results…
            </div>
          )}

          {resultsData && resultsData.results.length > 0 && (
            <div className="border rounded-md overflow-hidden mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">
                      Lead
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resultsData.results.slice(0, 50).map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5 font-medium">
                        {r.source_lead_name || r.source_lead_id}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            "text-[10px] rounded-full px-1.5 py-0.5 font-medium",
                            r.status === "created"
                              ? "bg-green-500/15 text-green-600"
                              : "bg-destructive/15 text-destructive",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell truncate max-w-[160px]">
                        {r.error_message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultsData.results.length > 50 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/30">
                  Showing first 50 of {resultsData.results.length} results
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  error = false,
}: {
  label: string;
  value: string;
  error?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("font-medium truncate", error && "text-destructive")}>
        {value}
      </span>
    </div>
  );
}
