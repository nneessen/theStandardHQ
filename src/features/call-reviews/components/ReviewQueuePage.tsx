// src/features/call-reviews/components/ReviewQueuePage.tsx
// Admin-only queue of call recordings awaiting PII review before they can be
// shared IMO-wide (Call Reviews redaction Phase 3). Each row links to the detail
// page (ReviewPanel approve/reject/re-mute), and ready rows can be bulk-approved.
// The route + page are admin-gated; RLS already hides needs_review rows from peers.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useKpiIdentity } from "@/features/kpi";
import { useAuthorizationStatus } from "@/hooks/admin";
import { useReviewQueue, useApproveMany } from "../hooks/useReviewQueue";
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
  const approveMany = useApproveMany();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const readyIds = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => audioReady(r as Parameters<typeof audioReady>[0]))
        .map((r) => r.id),
    [rows],
  );
  const selectedReady = useMemo(
    () => readyIds.filter((id) => selected.has(id)),
    [readyIds, selected],
  );
  const allReadySelected =
    readyIds.length > 0 && selectedReady.length === readyIds.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allReadySelected ? new Set() : new Set(readyIds));

  if (!authLoading && !isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You don't have access to the review queue.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
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
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-xl border border-v2-ring bg-v2-card p-8 text-center text-sm text-muted-foreground">
          Nothing awaiting review. New recordings appear here after their audio
          is redacted.
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-v2-ring bg-v2-card px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-emerald-600"
                checked={allReadySelected}
                onChange={toggleAll}
                disabled={readyIds.length === 0}
              />
              Select all ready ({readyIds.length})
            </label>
            <span className="text-muted-foreground">
              {selectedReady.length} selected
            </span>
            <div className="ml-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={
                      selectedReady.length === 0 || approveMany.isPending
                    }
                  >
                    {approveMany.isPending && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Approve {selectedReady.length || ""} selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Approve {selectedReady.length} recording
                      {selectedReady.length === 1 ? "" : "s"} for the team?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Each becomes visible to every agent in your agency (muted
                      audio + redacted transcript), and its raw original audio
                      is permanently deleted. Spot-check a few first — make sure
                      no client PII is audible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        approveMany.mutate(selectedReady, {
                          onSuccess: () => setSelected(new Set()),
                        })
                      }
                    >
                      Approve &amp; purge raw
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-v2-ring bg-v2-card">
            <table className="w-full text-sm">
              <thead className="bg-v2-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Agent</th>
                  <th className="px-3 py-2 text-left font-medium">Caller</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Detection</th>
                  <th className="px-3 py-2 text-left font-medium">Audio</th>
                  <th className="px-3 py-2 text-right font-medium">Spans</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ready = audioReady(
                    r as Parameters<typeof audioReady>[0],
                  );
                  const detector = r.redaction_detector as string | null;
                  const audioStatus = (r as { audio_redaction_status?: string })
                    .audio_redaction_status;
                  const when = r.call_at ?? r.created_at;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-v2-ring hover:bg-v2-muted/30"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          disabled={!ready}
                          title={
                            ready
                              ? "Select for bulk approve"
                              : "Not ready — audio still being muted"
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {when ? new Date(when).toLocaleDateString() : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {externalAgentName(r) ?? agentNames[r.agent_id] ?? "—"}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2">
                        {r.caller_name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
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
        </>
      )}
    </div>
  );
}
