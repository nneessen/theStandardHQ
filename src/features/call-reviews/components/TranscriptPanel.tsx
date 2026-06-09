// src/features/call-reviews/components/TranscriptPanel.tsx
// Diarized transcript synced to playback: each utterance is labelled AGENT or
// CLIENT (from the speaker→role map), the active line highlights + scrolls into
// view as audio plays, and clicking a line seeks the player there.

import { useEffect, useMemo, useRef } from "react";
import { FileAudio } from "lucide-react";
import {
  formatClock,
  roleOfSpeaker,
  type DiarizedSegment,
  type SpeakerRole,
} from "../types";

interface TranscriptPanelProps {
  segments: DiarizedSegment[];
  roleMap: Record<string, SpeakerRole>;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

const ROLE_LABEL: Record<SpeakerRole, string> = {
  agent: "Agent",
  client: "Client",
  unknown: "Speaker",
};

export function TranscriptPanel({
  segments,
  roleMap,
  currentTime,
  onSeek,
}: TranscriptPanelProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < segments.length; i++) {
      const start = segments[i].start;
      if (start != null && start <= currentTime + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [segments, currentTime]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileAudio className="h-6 w-6 text-v2-ink-subtle mb-2" />
        <p className="text-xs text-v2-ink-muted">
          The transcript appears here once the call is transcribed.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
      {segments.map((seg, i) => {
        const role = roleOfSpeaker(seg.speaker, roleMap);
        const isActive = i === activeIndex;
        const isAgent = role === "agent";
        return (
          <button
            key={seg.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => seg.start != null && onSeek(seg.start)}
            className={`w-full text-left rounded-md px-2.5 py-1.5 transition-colors ${
              isActive
                ? "bg-primary/10 ring-1 ring-primary/30"
                : "hover:bg-v2-canvas/70"
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-mono tabular-nums text-v2-ink-subtle w-10 flex-shrink-0">
                {seg.start != null ? formatClock(seg.start) : "—"}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider w-12 flex-shrink-0 ${
                  isAgent
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-v2-ink-muted"
                }`}
              >
                {ROLE_LABEL[role]}
              </span>
              <span
                className={`text-xs leading-relaxed ${
                  isAgent
                    ? "text-v2-ink"
                    : "text-v2-ink-muted dark:text-v2-ink-subtle"
                }`}
              >
                {seg.text}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
