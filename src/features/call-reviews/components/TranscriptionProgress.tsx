// src/features/call-reviews/components/TranscriptionProgress.tsx
// Real-feedback status banner for a recording's transcribe → analyze pipeline.
// Deepgram is a single synchronous call with no true %, so the active state uses
// an INDETERMINATE bar + a live elapsed timer + stage pips (not a fake %). It also
// surfaces the stuck/terminal states with an actionable button:
//   • pending (fresh)     → "Starting transcription…" (no button — it's about to run)
//   • pending (stale)     → "Start transcription" (dispatch never fired, e.g. a gate reject)
//   • transcription failed → "Retry"
//   • analysis failed      → "Re-analyze" (transcript is fine, the AI pass errored)

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallRecordingRow } from "@/features/kpi";

const INDETERMINATE_KEYFRAMES = `
@keyframes cr-indeterminate {
  0%   { transform: translateX(-110%); }
  100% { transform: translateX(320%); }
}`;

// A freshly-uploaded row sits in 'pending' for a moment before the async
// transcribe edge function flips it to 'processing'. Only treat 'pending' as
// genuinely stuck (dispatch failed — e.g. a gate rejection) after this long, so a
// normal upload doesn't flash a misleading "Start transcription" button.
const PENDING_STALE_MS = 45_000;

function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

interface Props {
  recording: Pick<
    CallRecordingRow,
    | "transcription_status"
    | "analysis_status"
    | "updated_at"
    | "created_at"
    | "transcription_error"
  >;
  onRetry: () => void;
  retrying: boolean;
  onReanalyze: () => void;
  reanalyzing: boolean;
}

export function TranscriptionProgress({
  recording,
  onRetry,
  retrying,
  onReanalyze,
  reanalyzing,
}: Props) {
  const t = recording.transcription_status;
  const a = recording.analysis_status;
  const startedAt = recording.updated_at ?? recording.created_at ?? null;

  const transcribing = t === "processing";
  const pending = t === "pending";
  const failed = t === "failed";
  const analyzing =
    t === "completed" && (a === "pending" || a === "processing");
  const analysisFailed = t === "completed" && a === "failed";

  // Live ticker — runs while anything is in flight (incl. fresh 'pending', so the
  // view can flip to "stuck" once it crosses PENDING_STALE_MS).
  const ticking = transcribing || analyzing || pending;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  if (!transcribing && !pending && !failed && !analyzing && !analysisFailed)
    return null;

  const ageMs = startedAt != null ? now - new Date(startedAt).getTime() : 0;
  const pendingStuck = pending && ageMs >= PENDING_STALE_MS;
  const startingUp = pending && !pendingStuck;

  // ── Transcription failed ──────────────────────────────────────────────────
  if (failed) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-rose-700">
              Transcription failed
            </p>
            {recording.transcription_error && (
              <p className="text-[10px] text-rose-600/80 truncate">
                {recording.transcription_error}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] shrink-0"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`}
          />
          Retry
        </Button>
      </div>
    );
  }

  // ── Pending but stuck (dispatch never fired — e.g. a gate rejection) ───────
  if (pendingStuck) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700">
            Transcription hasn’t started yet.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] shrink-0"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`}
          />
          Start transcription
        </Button>
      </div>
    );
  }

  // ── Analysis failed (transcript is ready; the AI pass errored) ─────────────
  if (analysisFailed) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-[11px] text-rose-700">
            Analysis failed — the transcript is ready, but objections /
            word-tracks didn’t run.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] shrink-0"
          onClick={onReanalyze}
          disabled={reanalyzing}
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${reanalyzing ? "animate-spin" : ""}`}
          />
          Re-analyze
        </Button>
      </div>
    );
  }

  // ── Active (transcribing / analyzing / starting): bar + stage + elapsed ────
  const stage = transcribing
    ? "Transcribing audio"
    : analyzing
      ? "Analyzing transcript"
      : "Starting transcription";
  const elapsed =
    startedAt != null && !startingUp
      ? elapsedLabel(now - new Date(startedAt).getTime())
      : null;

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 px-3 py-2.5 space-y-2">
      <style>{INDETERMINATE_KEYFRAMES}</style>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
          <span className="text-[11px] font-medium text-v2-ink">{stage}…</span>
        </div>
        {elapsed && (
          <span className="text-[10px] tabular-nums text-v2-ink-muted">
            {elapsed}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-v2-ring/50">
        <div
          className="h-full w-1/3 rounded-full bg-amber-500"
          style={{ animation: "cr-indeterminate 1.25s ease-in-out infinite" }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-v2-ink-subtle">
        <StagePip
          label="Transcribe"
          active={transcribing || startingUp}
          done={analyzing}
        />
        <StagePip label="Analyze" active={analyzing} done={false} />
        <span className="ml-auto">Updates automatically when ready</span>
      </div>
    </div>
  );
}

function StagePip({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {done ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-amber-500 animate-pulse" : "bg-v2-ink-subtle/40"}`}
        />
      )}
      <span className={active || done ? "text-v2-ink-muted" : ""}>{label}</span>
    </span>
  );
}
