// src/features/call-reviews/components/ReviewPanel.tsx
// Admin-only PII review controls shown on the call detail page when a recording is
// awaiting review (Call Reviews redaction Phase 3). Lets an IMO admin confirm the
// muted audio + redacted transcript, scrub human-typed fields the pipeline can't
// reach, adjust mute spans (re-mute), then APPROVE (shares IMO-wide + purges the
// raw original) or REJECT (keep private). The DB trigger is the real guarantee;
// this panel disables actions that the server would refuse, to guide the reviewer.

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Plus,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useAuthorizationStatus } from "@/hooks/admin";
import type { CallLibraryRow } from "../hooks/useCallLibrary";
import {
  useApproveRedaction,
  useUpdateSpans,
  useRejectRecording,
  useRemuteAudio,
  useReopenRecording,
  useScrubFields,
  type RedactionSpan,
} from "../hooks/useReviewQueue";

interface ReviewPanelProps {
  recording: CallLibraryRow;
}

function parseSpans(raw: unknown): RedactionSpan[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is RedactionSpan =>
        !!s &&
        typeof (s as RedactionSpan).start === "number" &&
        typeof (s as RedactionSpan).end === "number",
    )
    .map((s) => ({ start: s.start, end: s.end, type: s.type }));
}

// Numbers that survived transcript redaction — a digit-run on screen almost
// certainly means a number still audible. Pull the reviewer's eye to them.
function residualNumberRuns(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/\d[\d\s.-]{2,}\d/g) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 4) out.add(m.trim());
    if (out.size >= 10) break;
  }
  return [...out];
}

const fmt = (n: number) => {
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function ReviewPanel({ recording }: ReviewPanelProps) {
  const { isAdmin, isSuperAdmin } = useAuthorizationStatus();
  const canReview = isAdmin || isSuperAdmin;

  const approve = useApproveRedaction();
  const reject = useRejectRecording();
  const reopen = useReopenRecording();
  const remute = useRemuteAudio();
  const updateSpans = useUpdateSpans();
  const scrub = useScrubFields();

  const status = recording.redaction_status as string;
  const audioStatus = (recording as { audio_redaction_status?: string })
    .audio_redaction_status;
  const detector = recording.redaction_detector as string | null;
  const spansVersion =
    (recording as { spans_version?: number }).spans_version ?? 0;
  const mutedVersion =
    (recording as { muted_spans_version?: number }).muted_spans_version ?? 0;
  const muteCurrent = mutedVersion === spansVersion;

  const initialSpans = useMemo(
    () => parseSpans(recording.redaction_spans),
    [recording.redaction_spans],
  );
  const [spans, setSpans] = useState<RedactionSpan[]>(initialSpans);
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const spansDirty = useMemo(
    () => JSON.stringify(spans) !== JSON.stringify(initialSpans),
    [spans, initialSpans],
  );

  const [callerName, setCallerName] = useState(recording.caller_name ?? "");
  const [notes, setNotes] = useState(recording.notes ?? "");
  const fieldsDirty =
    callerName !== (recording.caller_name ?? "") ||
    notes !== (recording.notes ?? "");

  const residuals = useMemo(
    () => residualNumberRuns(recording.transcript_text),
    [recording.transcript_text],
  );

  if (!canReview) return null;
  // Only render for review-relevant statuses; stay quiet on the shared library page.
  if (!["needs_review", "failed", "rejected"].includes(status)) {
    if (status === "approved") {
      return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Approved for the team
          {recording.raw_audio_purged_at
            ? " · raw audio purged"
            : " · raw audio pending purge"}
        </div>
      );
    }
    return null;
  }

  const canApprove =
    status === "needs_review" &&
    audioStatus === "done" &&
    muteCurrent &&
    !!detector &&
    !!recording.redacted_storage_path;

  const approveBlockedReason = !detector
    ? "PII detection has not run yet."
    : audioStatus !== "done"
      ? audioStatus === "failed"
        ? "Audio muting failed — re-mute before approving."
        : "Audio is still being muted…"
      : !muteCurrent
        ? "Spans changed since the last mute — re-mute first."
        : null;

  const addSpan = () => {
    const s = Number(addStart);
    const e = Number(addEnd);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
    setSpans((prev) =>
      [...prev, { start: s, end: e, type: "manual" }].sort(
        (a, b) => a.start - b.start,
      ),
    );
    setAddStart("");
    setAddEnd("");
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.04] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold">PII Review</h3>
          <Badge variant="outline" className="text-[11px] capitalize">
            {status.replace("_", " ")}
          </Badge>
          {audioStatus && (
            <Badge variant="outline" className="text-[11px]">
              audio: {audioStatus}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[11px] ${detector === "regex_only" ? "border-amber-500 text-amber-700" : ""}`}
          >
            {detector ?? "no detection"}
          </Badge>
        </div>
      </div>

      {/* Warnings */}
      {detector === "regex_only" && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          AI detection didn't run (regex-only) — scrutinize numbers and names
          carefully before approving.
        </p>
      )}
      {audioStatus === "failed" && (
        <p className="text-xs text-red-600 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Audio muting failed
          {(recording as { audio_redaction_error?: string })
            .audio_redaction_error
            ? `: ${(recording as { audio_redaction_error?: string }).audio_redaction_error}`
            : "."}{" "}
          Re-mute before approving.
        </p>
      )}

      {/* Residual digit-run highlight */}
      {residuals.length > 0 && (
        <div className="text-xs rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <div className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {residuals.length} number sequence
            {residuals.length === 1 ? "" : "s"} remain in the transcript
          </div>
          <p className="text-muted-foreground mt-1">
            Confirm none are client PII (SSN / card / account). If audible, add
            a mute span below.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {residuals.map((r, i) => (
              <code
                key={i}
                className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px]"
              >
                {r}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Human-typed fields the pipeline never scans */}
      <div className="space-y-2">
        <p className="text-xs font-medium">
          Scrub typed fields{" "}
          <span className="font-normal text-muted-foreground">
            — these become visible to the whole team on approval and are NOT
            auto-redacted.
          </span>
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Caller name
            </Label>
            <Input
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="(blank)"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Notes / title
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="text-sm min-h-8"
            />
          </div>
        </div>
        {fieldsDirty && (
          <Button
            size="sm"
            variant="outline"
            disabled={scrub.isPending}
            onClick={() =>
              scrub.mutate({
                recordingId: recording.id,
                caller_name: callerName.trim() || null,
                notes: notes.trim() || null,
              })
            }
          >
            {scrub.isPending && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            Save fields
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          Marker notes are also shared — scrub any client identifiers in the
          Markers panel before approving.
        </p>
      </div>

      {/* Span editor (pre-approval only; raw still exists) */}
      {status !== "rejected" && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Mute spans ({spans.length})</p>
          {spans.length > 0 ? (
            <ul className="space-y-1">
              {spans.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs font-mono bg-v2-card border border-v2-ring rounded px-2 py-1"
                >
                  <span className="flex-1">
                    {fmt(s.start)} → {fmt(s.end)}
                    {s.type ? `  (${s.type})` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() =>
                      setSpans((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label="Remove span"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No mute spans — nothing in the audio is muted.
            </p>
          )}
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Start (s)
              </Label>
              <Input
                value={addStart}
                onChange={(e) => setAddStart(e.target.value)}
                inputMode="decimal"
                className="h-8 w-20 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                End (s)
              </Label>
              <Input
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
                inputMode="decimal"
                className="h-8 w-20 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={addSpan}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!spansDirty || updateSpans.isPending}
              onClick={() =>
                updateSpans.mutate(
                  { recordingId: recording.id, spans },
                  { onSuccess: () => undefined },
                )
              }
            >
              {updateSpans.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Save spans & re-mute
            </Button>
            {!muteCurrent && !spansDirty && (
              <span className="text-[11px] text-amber-700">
                Saved spans not yet muted — re-mute pending.
              </span>
            )}
            {audioStatus === "failed" && (
              <Button
                size="sm"
                variant="outline"
                disabled={remute.isPending}
                onClick={() => remute.mutate(recording.id)}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${remute.isPending ? "animate-spin" : ""}`}
                />
                Retry muting
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
        {status === "rejected" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate(recording.id)}
          >
            {reopen.isPending && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            Re-open for review
          </Button>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={!canApprove || approve.isPending}>
                  {approve.isPending && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  Approve & share
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Approve for the whole team?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The muted recording and redacted transcript become visible
                    to every agent in your agency, and the raw original audio is
                    permanently deleted. Make sure no client PII is audible or
                    on screen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => approve.mutate(recording.id)}
                  >
                    Approve & purge raw
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={reject.isPending}>
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Keep this recording private?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    It will never be shared with the team. You can re-open it
                    for review later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => reject.mutate(recording.id)}
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!canApprove && approveBlockedReason && (
              <span className="text-[11px] text-muted-foreground">
                {approveBlockedReason}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
