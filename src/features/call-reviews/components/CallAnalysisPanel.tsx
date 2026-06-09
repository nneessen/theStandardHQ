// src/features/call-reviews/components/CallAnalysisPanel.tsx
// AI analysis surface for a reviewed call: summary, objection/smoke-screen
// breakdown, scripted word-tracks the agent used (with timing), and AI key
// moments. All seekable into the player. Reads the recording's analysis columns
// (IMO-wide) + word-track detections (IMO-wide).

import {
  Loader2,
  MessageSquareWarning,
  Quote,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CallRecordingRow } from "@/features/kpi";
import { formatClock, parseKeyMoments, parseObjectionEvents } from "../types";
import type { RecordingDetection } from "../hooks/useCallScripts";

interface CallAnalysisPanelProps {
  recording: CallRecordingRow;
  detections: RecordingDetection[];
  detectionsLoading: boolean;
  onSeek: (seconds: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function CallAnalysisPanel({
  recording,
  detections,
  detectionsLoading,
  onSeek,
  onAnalyze,
  isAnalyzing,
}: CallAnalysisPanelProps) {
  const status = recording.analysis_status;
  const objections = parseObjectionEvents(recording.objection_events);
  const keyMoments = parseKeyMoments(recording.ai_key_moments);

  // Not yet analyzed (and transcript exists) → offer to run the AI pass.
  if (status !== "completed") {
    const transcriptReady = recording.transcription_status === "completed";
    const running = status === "processing" || isAnalyzing;
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <Sparkles className="h-6 w-6 text-v2-ink-subtle" />
        <p className="text-xs text-v2-ink-muted max-w-sm">
          {running
            ? "Analyzing the call — objections, word-tracks, and demographics are being extracted…"
            : transcriptReady
              ? "Run AI analysis to extract objections, word-tracks used, demographics, and a summary."
              : "Analysis runs after the call is transcribed."}
        </p>
        {transcriptReady && (
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={onAnalyze}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {status === "failed" ? "Retry analysis" : "Run analysis"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {recording.ai_summary && (
        <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 p-3">
          <p className="text-xs text-v2-ink leading-relaxed">
            {recording.ai_summary}
          </p>
        </div>
      )}

      {/* Objection counters */}
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Objections"
          value={recording.objection_count ?? 0}
          tone="amber"
        />
        <Stat
          label="Smoke screens"
          value={recording.smoke_screen_count ?? 0}
          tone="rose"
        />
      </div>

      {/* Objections list */}
      {objections.length > 0 && (
        <Section
          icon={<MessageSquareWarning className="h-3.5 w-3.5" />}
          title="Objections"
        >
          <div className="space-y-1.5">
            {objections.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  o.start_seconds != null && onSeek(o.start_seconds)
                }
                className="w-full text-left rounded-md border border-v2-ring/70 bg-v2-card px-2.5 py-1.5 hover:bg-v2-canvas/70"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  {o.start_seconds != null && (
                    <span className="text-[10px] font-mono tabular-nums text-v2-ink-subtle">
                      {formatClock(o.start_seconds)}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 capitalize"
                  >
                    {o.type.replace(/_/g, " ")}
                  </Badge>
                  {o.is_smoke_screen && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 text-rose-600 border-rose-300"
                    >
                      smoke screen
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 ${o.handled ? "text-emerald-600 border-emerald-300" : "text-v2-ink-subtle"}`}
                  >
                    {o.handled ? "handled" : "unaddressed"}
                  </Badge>
                </div>
                {o.quote && (
                  <p className="text-[11px] text-v2-ink mt-1 flex gap-1">
                    <Quote className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-v2-ink-subtle" />
                    <span className="italic">{o.quote}</span>
                  </p>
                )}
                {o.resolution && (
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    → {o.resolution}
                  </p>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Word tracks used */}
      <Section icon={<Tag className="h-3.5 w-3.5" />} title="Word tracks used">
        {detectionsLoading ? (
          <div className="py-3 flex justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          </div>
        ) : detections.length === 0 ? (
          <p className="text-[11px] text-v2-ink-muted py-1">
            No scripted word tracks detected on this call.
          </p>
        ) : (
          <div className="space-y-1">
            {detections.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  d.time_start_seconds != null && onSeek(d.time_start_seconds)
                }
                className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1 hover:bg-v2-canvas/70"
              >
                <span className="text-[10px] font-mono tabular-nums text-v2-ink-subtle w-10 flex-shrink-0">
                  {d.time_start_seconds != null
                    ? formatClock(d.time_start_seconds)
                    : "—"}
                </span>
                <span className="text-xs text-v2-ink flex-1 truncate">
                  {d.word_track?.label ?? "Word track"}
                </span>
                {d.timing_bucket && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 capitalize"
                  >
                    {d.timing_bucket}
                  </Badge>
                )}
                {d.on_expected_timing === false && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 text-amber-600 border-amber-300"
                  >
                    off-timing
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <Section
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Key moments"
        >
          <div className="space-y-1">
            {keyMoments.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => m.time_seconds != null && onSeek(m.time_seconds)}
                className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1 hover:bg-v2-canvas/70"
              >
                <span className="text-[10px] font-mono tabular-nums text-v2-ink-subtle w-10 flex-shrink-0">
                  {m.time_seconds != null ? formatClock(m.time_seconds) : "—"}
                </span>
                <span className="text-xs text-v2-ink flex-1 truncate">
                  {m.label}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 capitalize"
                >
                  {m.kind}
                </Badge>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-v2-ink-muted">
        {icon}
        <h4 className="text-[11px] font-semibold uppercase tracking-wide">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "rose";
}) {
  const color = tone === "amber" ? "text-amber-600" : "text-rose-600";
  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card px-3 py-2">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-v2-ink-subtle">
        {label}
      </div>
    </div>
  );
}
