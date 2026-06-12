// src/features/call-reviews/components/CallReviewDetailPage.tsx
// The review screen: header stats + audio player + (Transcript | Analysis |
// Script) tabs on the left, a sticky Markers panel on the right. Any IMO agent
// can open any call (IMO-wide RLS); the page is the training surface.

import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatCallDuration,
  CALL_OUTCOME_OPTIONS,
  useKpiIdentity,
} from "@/features/kpi";
import {
  useCallRecording,
  useCallRecordingSignedUrl,
  useImoAgents,
  useAnalyzeCall,
  useRedetectSpeakers,
  useRetryTranscription,
  useUpdateRoleMap,
} from "../hooks/useCallLibrary";
import { EditAgentDialog, externalAgentName } from "./EditAgentDialog";
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
} from "../types";
import { CallAudioPlayer, type CallPlayerHandle } from "./CallAudioPlayer";
import { TranscriptPanel } from "./TranscriptPanel";
import { CallMarkersPanel } from "./CallMarkersPanel";
import { CallAnalysisPanel } from "./CallAnalysisPanel";
import { CallScriptPanel } from "./CallScriptPanel";
import { TranscriptionProgress } from "./TranscriptionProgress";
import { SpeakerRoleEditor } from "./SpeakerRoleEditor";

const OUTCOME_LABEL = new Map<string, string>(
  CALL_OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
);

interface CallReviewDetailPageProps {
  recordingId: string;
}

export function CallReviewDetailPage({
  recordingId,
}: CallReviewDetailPageProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.is_super_admin === true;
  const { imoId, userId } = useKpiIdentity();
  const { data: recording, isLoading, error } = useCallRecording(recordingId);
  const { data: agentsData } = useImoAgents(imoId ?? undefined);
  const [showReassign, setShowReassign] = useState(false);
  // Skip the signed-URL fetch once the audio has been purged by the retention
  // policy — the object is gone, so a fetch would just 404.
  const audioExpired = !!recording?.audio_deleted_at;
  const {
    data: signedUrl,
    isLoading: urlLoading,
    error: urlError,
  } = useCallRecordingSignedUrl(
    audioExpired ? undefined : recording?.storage_path,
  );
  const { data: markerData, isLoading: markersLoading } =
    useCallMarkers(recordingId);
  const { data: detections, isLoading: detectionsLoading } =
    useRecordingDetections(recordingId);
  const { data: scripts, isLoading: scriptsLoading } = useCallScripts();

  const analyzeMutation = useAnalyzeCall();
  const redetectSpeakers = useRedetectSpeakers();
  const retryMutation = useRetryTranscription();
  const updateRoleMap = useUpdateRoleMap(recordingId);

  const playerRef = useRef<CallPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSpeakerEditor, setShowSpeakerEditor] = useState(false);

  const markers = markerData?.markers ?? [];
  const segments = useMemo(
    () => parseSegments(recording?.transcript_segments),
    [recording?.transcript_segments],
  );
  const roleMap = useMemo(
    () => parseRoleMap(recording?.speaker_role_map),
    [recording?.speaker_role_map],
  );

  const seekTo = (seconds: number) => {
    playerRef.current?.seek(seconds);
    playerRef.current?.play();
  };

  // Persist a corrected speaker→role map, then re-run analysis if it had already
  // completed — word-track detection AND objection extraction both key off this
  // map, so a wrong mapping silently inverts the analysis.
  const handleSaveRoles = (clean: Record<string, "agent" | "client">) => {
    if (!recording) return;
    updateRoleMap.mutate(clean, {
      onSuccess: () => {
        setShowSpeakerEditor(false);
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
            {recording.call_type?.name ||
              recording.caller_name ||
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
            <span>
              Agent:{" "}
              <span className="text-v2-ink font-medium">
                {externalAgentName(recording) ??
                  agentsData?.names[recording.agent_id] ??
                  "—"}
              </span>
            </span>
            {recording.call_at && (
              <span>· {new Date(recording.call_at).toLocaleDateString()}</span>
            )}
            {recording.caller_state && <span>· {recording.caller_state}</span>}
          </div>
        </div>
        {isSuperAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] shrink-0"
            onClick={() => setShowReassign(true)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Reassign agent
          </Button>
        )}
      </div>

      {showReassign && (
        <EditAgentDialog
          row={recording}
          agents={agentsData?.list ?? []}
          agentNames={agentsData?.names ?? {}}
          currentUserId={userId}
          onClose={() => setShowReassign(false)}
        />
      )}

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
        audioExpired={audioExpired}
        markers={markers}
        onTimeUpdate={setCurrentTime}
      />

      <TranscriptionProgress
        recording={recording}
        onRetry={() => retryMutation.mutate(recordingId)}
        retrying={retryMutation.isPending}
        onReanalyze={() => redetectSpeakers.mutate(recordingId)}
        reanalyzing={redetectSpeakers.isPending}
      />

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
                <div className="mb-2">
                  <div className="flex justify-end mb-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-v2-ink-muted"
                      onClick={() => setShowSpeakerEditor((s) => !s)}
                      title="Fix which speaker is the agent / client / automated"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {showSpeakerEditor ? "Done" : "Fix speakers"}
                    </Button>
                  </div>
                  {showSpeakerEditor && (
                    <SpeakerRoleEditor
                      segments={segments}
                      roleMap={roleMap}
                      onSave={handleSaveRoles}
                      saving={
                        updateRoleMap.isPending || analyzeMutation.isPending
                      }
                      onRedetect={() => redetectSpeakers.mutate(recordingId)}
                      redetecting={redetectSpeakers.isPending}
                    />
                  )}
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
