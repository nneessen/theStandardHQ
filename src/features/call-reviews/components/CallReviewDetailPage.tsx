// src/features/call-reviews/components/CallReviewDetailPage.tsx
// The review screen: header stats + audio player + (Transcript | Analysis |
// Script) tabs on the left, a sticky Markers panel on the right. Any IMO agent
// can open any call (IMO-wide RLS); the page is the training surface.

import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ArrowLeftRight,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCallDuration, CALL_OUTCOME_OPTIONS } from "@/features/kpi";
import {
  useCallRecording,
  useCallRecordingSignedUrl,
  useAnalyzeCall,
  useRetryTranscription,
  useUpdateRoleMap,
} from "../hooks/useCallLibrary";
import { useCallMarkers } from "../hooks/useCallMarkers";
import {
  useCallScripts,
  useRecordingDetections,
} from "../hooks/useCallScripts";
import {
  deriveHoldSeconds,
  formatClock,
  parseRoleMap,
  parseSegments,
  type SpeakerRole,
} from "../types";
import { CallAudioPlayer, type CallPlayerHandle } from "./CallAudioPlayer";
import { TranscriptPanel } from "./TranscriptPanel";
import { CallMarkersPanel } from "./CallMarkersPanel";
import { CallAnalysisPanel } from "./CallAnalysisPanel";
import { CallScriptPanel } from "./CallScriptPanel";

const OUTCOME_LABEL = new Map<string, string>(
  CALL_OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
);

function flipRoles(
  map: Record<string, SpeakerRole>,
): Record<string, SpeakerRole> {
  const out: Record<string, SpeakerRole> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v === "agent" ? "client" : v === "client" ? "agent" : "unknown";
  }
  return out;
}

interface CallReviewDetailPageProps {
  recordingId: string;
}

export function CallReviewDetailPage({
  recordingId,
}: CallReviewDetailPageProps) {
  const { data: recording, isLoading, error } = useCallRecording(recordingId);
  const {
    data: signedUrl,
    isLoading: urlLoading,
    error: urlError,
  } = useCallRecordingSignedUrl(recording?.storage_path);
  const { data: markerData, isLoading: markersLoading } =
    useCallMarkers(recordingId);
  const { data: detections, isLoading: detectionsLoading } =
    useRecordingDetections(recordingId);
  const { data: scripts, isLoading: scriptsLoading } = useCallScripts();

  const analyzeMutation = useAnalyzeCall();
  const retryMutation = useRetryTranscription();
  const updateRoleMap = useUpdateRoleMap(recordingId);

  const playerRef = useRef<CallPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const markers = markerData?.markers ?? [];
  const segments = useMemo(
    () => parseSegments(recording?.transcript_segments),
    [recording?.transcript_segments],
  );
  // Display map honors the local flip for instant reading; the stored map is the
  // source of truth for analysis until the correction is persisted.
  const roleMap = useMemo(() => {
    const base = parseRoleMap(recording?.speaker_role_map);
    return flipped ? flipRoles(base) : base;
  }, [recording?.speaker_role_map, flipped]);

  const seekTo = (seconds: number) => {
    playerRef.current?.seek(seconds);
    playerRef.current?.play();
  };

  // Persist the corrected (flipped) speaker→role map, then re-run analysis if it
  // had already completed — because word-track detection AND objection extraction
  // both key off this map, a wrong mapping silently inverts the analysis.
  const saveCorrectedRoles = () => {
    if (!recording) return;
    const clean: Record<string, "agent" | "client"> = {};
    for (const [k, v] of Object.entries(roleMap)) {
      if (v === "agent" || v === "client") clean[k] = v;
    }
    updateRoleMap.mutate(clean, {
      onSuccess: () => {
        setFlipped(false); // stored map now equals the displayed map
        if (recording.analysis_status === "completed") {
          analyzeMutation.mutate(recordingId);
          toast.success("Speaker labels saved — re-analyzing the call");
        } else {
          toast.success("Speaker labels saved");
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }
  if (error || !recording) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-v2-ink-muted">
          This call review isn't available.
        </p>
        <Link
          to="/call-reviews"
          className="text-xs text-primary underline mt-2 inline-block"
        >
          Back to library
        </Link>
      </div>
    );
  }

  const holdSeconds = deriveHoldSeconds(markers);
  const agentTalk = recording.talk_time_seconds;
  const clientTalk = recording.client_talk_seconds;
  const talkTotal = (agentTalk ?? 0) + (clientTalk ?? 0);
  const agentPct =
    talkTotal > 0 && agentTalk != null
      ? Math.round((agentTalk / talkTotal) * 100)
      : null;
  const transcribing =
    recording.transcription_status === "pending" ||
    recording.transcription_status === "processing";
  const transcribeFailed = recording.transcription_status === "failed";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/call-reviews"
            className="inline-flex items-center gap-1 text-[11px] text-v2-ink-muted hover:text-v2-ink mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Call Reviews
          </Link>
          <h1 className="text-lg font-semibold text-v2-ink truncate">
            {recording.caller_name ||
              recording.original_filename ||
              "Call recording"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-v2-ink-muted">
            {recording.outcome && (
              <Badge
                variant="outline"
                className={`text-[10px] ${recording.outcome === "sold" ? "text-emerald-600 border-emerald-300" : ""}`}
              >
                {OUTCOME_LABEL.get(recording.outcome) ?? recording.outcome}
              </Badge>
            )}
            {recording.call_at && (
              <span>{new Date(recording.call_at).toLocaleDateString()}</span>
            )}
            {recording.caller_state && <span>· {recording.caller_state}</span>}
          </div>
        </div>
        {transcribeFailed && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => retryMutation.mutate(recordingId)}
            disabled={retryMutation.isPending}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Retry transcription
          </Button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatTile
          label="Length"
          value={formatCallDuration(recording.duration_seconds) ?? "—"}
        />
        <StatTile
          label="Agent talk"
          value={agentPct != null ? `${agentPct}%` : "—"}
          hint={agentTalk != null ? formatClock(agentTalk) : undefined}
        />
        <StatTile
          label="Client talk"
          value={agentPct != null ? `${100 - agentPct}%` : "—"}
          hint={clientTalk != null ? formatClock(clientTalk) : undefined}
        />
        <StatTile
          label="Hold time"
          value={holdSeconds != null ? formatClock(holdSeconds) : "—"}
        />
        <StatTile
          label="Objections"
          value={
            recording.objection_count != null
              ? String(recording.objection_count)
              : "—"
          }
        />
        <StatTile
          label="Premium"
          value={
            recording.premium_amount != null
              ? `$${Number(recording.premium_amount).toLocaleString()}`
              : "—"
          }
        />
      </div>

      {/* Player */}
      <CallAudioPlayer
        ref={playerRef}
        signedUrl={signedUrl ?? null}
        isLoading={urlLoading}
        error={!!urlError}
        markers={markers}
        onTimeUpdate={setCurrentTime}
      />

      {transcribing && (
        <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          <span className="text-[11px] text-v2-ink-muted">
            Transcribing this call — the transcript and analysis appear
            automatically when ready.
          </span>
        </div>
      )}

      {/* Body: tabs (left) + markers (right) */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
          <Tabs defaultValue="transcript">
            <div className="flex items-center justify-between px-3 pt-2 border-b border-v2-ring">
              <TabsList variant="underline">
                <TabsTrigger variant="underline" value="transcript">
                  Transcript
                </TabsTrigger>
                <TabsTrigger variant="underline" value="analysis">
                  Analysis
                </TabsTrigger>
                <TabsTrigger variant="underline" value="script">
                  Script
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="transcript" className="p-3">
              {segments.length > 0 && (
                <div className="flex justify-end items-center gap-1 mb-1">
                  {flipped && (
                    <Button
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={saveCorrectedRoles}
                      disabled={
                        updateRoleMap.isPending || analyzeMutation.isPending
                      }
                      title="Save these speaker labels and re-run analysis with them"
                    >
                      {updateRoleMap.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save &amp; re-analyze
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-v2-ink-muted"
                    onClick={() => setFlipped((f) => !f)}
                    title="Swap which speaker is the agent (for reading); Save to persist + re-analyze"
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" /> Flip speakers
                  </Button>
                </div>
              )}
              <TranscriptPanel
                segments={segments}
                roleMap={roleMap}
                currentTime={currentTime}
                onSeek={seekTo}
              />
            </TabsContent>

            <TabsContent value="analysis" className="p-3">
              <CallAnalysisPanel
                recording={recording}
                detections={detections ?? []}
                detectionsLoading={detectionsLoading}
                onSeek={seekTo}
                onAnalyze={() => analyzeMutation.mutate(recordingId)}
                isAnalyzing={analyzeMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="script" className="p-3">
              <CallScriptPanel
                scripts={scripts ?? []}
                isLoading={scriptsLoading}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:sticky lg:top-4">
          <CallMarkersPanel
            recordingId={recordingId}
            markers={markers}
            creatorNames={markerData?.creatorNames ?? {}}
            isLoading={markersLoading}
            currentTime={currentTime}
            onSeek={seekTo}
            getCurrentTime={() => playerRef.current?.getCurrentTime() ?? 0}
            pause={() => playerRef.current?.pause()}
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-v2-ink-subtle">
        {label}
      </div>
      <div className="text-sm font-semibold text-v2-ink tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-v2-ink-subtle font-mono">{hint}</div>
      )}
    </div>
  );
}
