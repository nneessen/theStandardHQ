// src/features/kpi/components/RecordingsList.tsx
// Table of the agent's uploaded recordings with a derived status badge and an
// inline player that streams from a short-lived signed URL.

import React, { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TINT } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useRecordingsList } from "../hooks";
import { recordingStorageService } from "../services/recordingStorageService";
import {
  deriveRecordingStatus,
  recordingStatusLabel,
} from "../lib/recording-status";
import { formatCallDuration } from "../lib/format-call-duration";
import {
  CALL_OUTCOME_OPTIONS,
  type RecordingDisplayStatus,
} from "../types/kpi.types";

const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  CALL_OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
);

// Status → tint mapping (theme-aware; TINT has both light + dark: variants).
const STATUS_CLASSES: Record<RecordingDisplayStatus, string> = {
  uploaded: TINT.slate,
  transcribing: TINT.blue,
  transcribed: TINT.blue,
  analyzing: TINT.amber,
  analyzed: TINT.emerald,
  skipped: TINT.slate,
  failed: TINT.rose,
};

export const RecordingsList: React.FC = () => {
  const { data: recordings, isLoading, isError, error } = useRecordingsList();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePlay = async (id: string, storagePath: string) => {
    setLoadingId(id);
    try {
      const url = await recordingStorageService.getSignedUrl(storagePath);
      if (url) {
        setActiveId(id);
        setActiveUrl(url);
      }
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[11px] text-muted-foreground">
        Loading recordings…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-8 text-center text-[11px] text-destructive">
        {error instanceof Error ? error.message : "Failed to load recordings"}
      </div>
    );
  }
  if (!recordings || recordings.length === 0) {
    return (
      <div className="py-8 text-center text-[11px] text-muted-foreground">
        No recordings uploaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Call
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Caller
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              State
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Outcome
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Duration
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Status
            </th>
            <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Play
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-v2-ring">
          {recordings.map((r) => {
            const status = deriveRecordingStatus(r);
            const duration = formatCallDuration(r.duration_seconds);
            return (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="px-2 py-2 text-foreground">
                    {r.call_at
                      ? formatDateTime(r.call_at)
                      : formatDateTime(r.created_at)}
                  </td>
                  <td className="px-2 py-2 text-foreground">
                    {r.caller_name ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-foreground">
                    {r.caller_state ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-foreground">
                    {r.outcome ? (OUTCOME_LABELS[r.outcome] ?? r.outcome) : "—"}
                  </td>
                  <td className="px-2 py-2 text-foreground">
                    {duration ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] px-1.5 py-0.5",
                        STATUS_CLASSES[status],
                      )}
                    >
                      {recordingStatusLabel(status)}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={() => handlePlay(r.id, r.storage_path)}
                      disabled={loadingId === r.id}
                      aria-label="Play recording"
                    >
                      {loadingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
                {activeId === r.id && activeUrl ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-2">
                      <audio
                        src={activeUrl}
                        controls
                        autoPlay
                        className="h-8 w-full"
                      >
                        <track kind="captions" />
                      </audio>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
