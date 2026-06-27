// src/features/call-reviews/components/ReviewQueuePage.tsx
// Admin-only queue of call recordings awaiting PII review before they can be
// shared IMO-wide (Call Reviews redaction Phase 3). Each row links to the detail
// page, where the ReviewPanel approve/reject/re-mute controls live. The route +
// this page are admin-gated; RLS already hides needs_review rows from peers.

import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useKpiIdentity } from "@/features/kpi";
import { useAuthorizationStatus } from "@/hooks/admin";
import { useReviewQueue } from "../hooks/useReviewQueue";
import { useImoAgents } from "../hooks/useCallLibrary";
import { externalAgentName } from "./EditAgentDialog";

function spanCount(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

function audioReady(r: {
  audio_redaction_status?: string;
  spans_version?: number;
  muted_spans_version?: number;
  redaction_detector?: string | null;
  redacted_storage_path?: string | null;
}): boolean {
  return (
    r.audio_redaction_status === "done" &&
    (r.muted_spans_version ?? 0) === (r.spans_version ?? 0) &&
    !!r.redaction_detector &&
    !!r.redacted_storage_path
  );
}

export function ReviewQueuePage() {
  const {
    isAdmin,
    isSuperAdmin,
    isLoading: authLoading,
  } = useAuthorizationStatus();
  const { imoId } = useKpiIdentity();
  const { data: rows, isLoading } = useReviewQueue();
  const { data: agentsData } = useImoAgents(imoId ?? undefined);
  const agentNames = agentsData?.names ?? {};

  if (!authLoading && !isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You don't have access to the review queue.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          Review Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Recordings awaiting PII review. Confirm the muted audio and redacted
          transcript, then approve to share with the team or reject to keep
          private. Approving deletes the raw original.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-xl border border-v2-ring bg-v2-card p-8 text-center text-sm text-muted-foreground">
          Nothing awaiting review. New recordings appear here after their audio
          is redacted.
        </div>
      ) : (
        <div className="rounded-xl border border-v2-ring bg-v2-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground bg-v2-muted/40">
              <tr>
                <th className="text-left font-medium px-3 py-2">Date</th>
                <th className="text-left font-medium px-3 py-2">Agent</th>
                <th className="text-left font-medium px-3 py-2">Caller</th>
                <th className="text-left font-medium px-3 py-2">Type</th>
                <th className="text-left font-medium px-3 py-2">Detection</th>
                <th className="text-left font-medium px-3 py-2">Audio</th>
                <th className="text-right font-medium px-3 py-2">Spans</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ready = audioReady(r as Parameters<typeof audioReady>[0]);
                const detector = r.redaction_detector as string | null;
                const audioStatus = (r as { audio_redaction_status?: string })
                  .audio_redaction_status;
                const when = r.call_at ?? r.created_at;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-v2-ring hover:bg-v2-muted/30"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {when ? new Date(when).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {externalAgentName(r) ?? agentNames[r.agent_id] ?? "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate">
                      {r.caller_name || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.call_type?.name || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${detector === "regex_only" ? "border-amber-500 text-amber-700" : ""}`}
                      >
                        {detector ?? "none"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[11px]">
                        {audioStatus ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {spanCount(r.redaction_spans)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/call-reviews/$recordingId"
                        params={{ recordingId: r.id }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {ready ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : null}
                        Review
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
