import { useEffect, useCallback } from "react";
import { Loader2, Mic, Square, RotateCcw, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  VoiceCloneScript,
  VoiceCloneSessionSegment,
} from "@/features/chat-bot";
import {
  useUploadVoiceCloneSegment,
  useDeleteVoiceCloneSegment,
} from "@/features/chat-bot";
import {
  useAudioRecorder,
  type AudioRecorderState,
} from "../../hooks/useAudioRecorder";

interface SegmentRecorderProps {
  script: VoiceCloneScript;
  existingSegment: VoiceCloneSessionSegment | null;
  cloneId: string;
  onSegmentUploaded: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function SegmentRecorder({
  script,
  existingSegment,
  cloneId,
  onSegmentUploaded,
}: SegmentRecorderProps) {
  const recorder = useAudioRecorder();
  const uploadMutation = useUploadVoiceCloneSegment();
  const deleteMutation = useDeleteVoiceCloneSegment();

  // Reset recorder when switching scripts
  useEffect(() => {
    if (recorder.state === "done" || recorder.state === "recording") {
      recorder.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.segmentIndex]);

  const handleUpload = useCallback(() => {
    if (!recorder.recordedBlob) return;
    uploadMutation.mutate(
      {
        cloneId,
        segmentIndex: script.segmentIndex,
        audioBlob: recorder.recordedBlob,
        durationSeconds: recorder.elapsed,
        fileName: `segment-${String(script.segmentIndex).padStart(2, "0")}.${recorder.mimeType.includes("webm") ? "webm" : recorder.mimeType.includes("ogg") ? "ogg" : "mp4"}`,
      },
      {
        onSuccess: () => {
          recorder.reset();
          onSegmentUploaded();
        },
      },
    );
  }, [
    recorder.recordedBlob,
    recorder.elapsed,
    recorder.mimeType,
    cloneId,
    script.segmentIndex,
    uploadMutation,
    onSegmentUploaded,
    recorder,
  ]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(
      { cloneId, segmentIndex: script.segmentIndex },
      { onSuccess: onSegmentUploaded },
    );
  }, [cloneId, script.segmentIndex, deleteMutation, onSegmentUploaded]);

  return (
    <div className="flex flex-1 flex-col p-4 overflow-y-auto">
      {/* Script header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-medium text-v2-ink-subtle dark:text-v2-ink-muted tabular-nums">
            #{script.segmentIndex + 1}
          </span>
          <h3 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink">
            {script.title}
          </h3>
          {script.optional && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 text-v2-ink-subtle"
            >
              Optional
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
          Target: {formatDuration(script.targetDurationSeconds)} | Min:{" "}
          {formatDuration(script.minDurationSeconds)}
        </span>
      </div>

      {/* Script text */}
      <div className="mb-5 rounded-lg border border-v2-ring bg-v2-canvas p-4 dark:border-v2-ring dark:bg-v2-card/50">
        <p className="text-[12px] leading-relaxed text-v2-ink dark:text-v2-ink-muted whitespace-pre-wrap">
          {script.scriptText}
        </p>
      </div>

      {/* Existing segment info */}
      {existingSegment && recorder.state !== "done" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Recorded ({formatDuration(existingSegment.durationSeconds)})
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-v2-ink-muted hover:text-red-600"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {/* Recording controls */}
      <div className="mt-auto">
        <RecordingControls
          state={recorder.state}
          elapsed={recorder.elapsed}
          recordedUrl={recorder.recordedUrl}
          isUploading={uploadMutation.isPending}
          uploadError={
            uploadMutation.isError ? uploadMutation.error.message : null
          }
          recorderError={recorder.error}
          isSupported={recorder.isSupported}
          hasExisting={!!existingSegment}
          onRequestMic={recorder.requestMicrophone}
          onStart={recorder.startRecording}
          onStop={recorder.stopRecording}
          onReset={recorder.reset}
          onUpload={handleUpload}
        />
      </div>
    </div>
  );
}

interface RecordingControlsProps {
  state: AudioRecorderState;
  elapsed: number;
  recordedUrl: string | null;
  isUploading: boolean;
  uploadError: string | null;
  recorderError: string | null;
  isSupported: boolean;
  hasExisting: boolean;
  onRequestMic: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onUpload: () => void;
}

function RecordingControls({
  state,
  elapsed,
  recordedUrl,
  isUploading,
  uploadError,
  recorderError,
  isSupported,
  hasExisting,
  onRequestMic,
  onStart,
  onStop,
  onReset,
  onUpload,
}: RecordingControlsProps) {
  if (!isSupported) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
        <p className="text-[11px] text-red-600 dark:text-red-400">
          Your browser does not support audio recording. Please use Chrome,
          Firefox, or Edge.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-[11px] text-red-600 dark:text-red-400">
            {recorderError}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onRequestMic}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (state === "idle" || state === "requesting") {
    return (
      <Button
        size="sm"
        className="h-8 text-[11px] px-4"
        onClick={onRequestMic}
        disabled={state === "requesting"}
      >
        {state === "requesting" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Requesting access...
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 mr-1.5" />
            Enable Microphone
          </>
        )}
      </Button>
    );
  }

  if (state === "ready") {
    return (
      <Button
        size="sm"
        className="h-8 text-[11px] px-4 bg-red-600 hover:bg-red-700 text-white"
        onClick={onStart}
      >
        <Mic className="h-3.5 w-3.5 mr-1.5" />
        {hasExisting ? "Re-record" : "Start Recording"}
      </Button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[13px] font-mono font-medium tabular-nums text-v2-ink dark:text-v2-ink">
            {formatTime(elapsed)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-3"
          onClick={onStop}
        >
          <Square className="h-3 w-3 mr-1.5 fill-current" />
          Stop
        </Button>
      </div>
    );
  }

  // state === "done"
  return (
    <div className="space-y-3">
      {recordedUrl && (
        <audio
          src={recordedUrl}
          controls
          className="h-8 w-full [&::-webkit-media-controls-panel]:bg-v2-card-tinted dark:[&::-webkit-media-controls-panel]:bg-zinc-800"
        />
      )}
      <div className="flex items-center gap-2">
        <span className="text-[11px] tabular-nums text-v2-ink-muted dark:text-v2-ink-subtle">
          {formatTime(elapsed)} recorded
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-v2-ink-muted"
            onClick={onReset}
            disabled={isUploading}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Redo
          </Button>
          <Button
            size="sm"
            className={cn(
              "h-7 text-[11px] px-3",
              hasExisting && "bg-amber-600 hover:bg-amber-700",
            )}
            onClick={onUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1.5" />
                {hasExisting ? "Replace" : "Upload"}
              </>
            )}
          </Button>
        </div>
      </div>
      {uploadError && (
        <p className="text-[10px] text-red-600 dark:text-red-400">
          {uploadError}
        </p>
      )}
    </div>
  );
}
