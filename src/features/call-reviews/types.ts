// src/features/call-reviews/types.ts
// Type contracts + safe JSON parsers for the all-agents Call Reviews training
// feature. Reuses the kpi_* data layer; adds the call-marker types and runtime
// guards for the JSONB columns the transcription/analysis pipeline writes.

import type { Database } from "@/types/database.types";

// ─── kpi_call_markers Row/Insert/Update ─────────────────────────────────────

export type CallMarkerRow =
  Database["public"]["Tables"]["kpi_call_markers"]["Row"];
export type CallMarkerInsert =
  Database["public"]["Tables"]["kpi_call_markers"]["Insert"];
export type CallMarkerUpdate =
  Database["public"]["Tables"]["kpi_call_markers"]["Update"];

// ─── Marker types (validated in TS) ─────────────────────────────────────────

export const CALL_MARKER_TYPES = [
  "chapter",
  "highlight",
  "key_point",
  "objection",
  "hold",
  "mistake",
  "coaching",
] as const;

export type CallMarkerType = (typeof CALL_MARKER_TYPES)[number];

export const CALL_MARKER_LABELS: Record<CallMarkerType, string> = {
  chapter: "Chapter",
  highlight: "Highlight",
  key_point: "Key Point",
  objection: "Objection",
  hold: "Hold",
  mistake: "Mistake",
  coaching: "Coaching Note",
};

// Single accent dot per type (muted palette; never full bg fills).
export const CALL_MARKER_COLORS: Record<
  CallMarkerType,
  { dot: string; ring: string; text: string }
> = {
  chapter: {
    dot: "bg-zinc-400 dark:bg-zinc-500",
    ring: "ring-zinc-300 dark:ring-zinc-700",
    text: "text-v2-ink-muted dark:text-v2-ink-subtle",
  },
  highlight: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-900",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  key_point: {
    dot: "bg-amber-500",
    ring: "ring-amber-200 dark:ring-amber-900",
    text: "text-amber-700 dark:text-amber-400",
  },
  objection: {
    dot: "bg-blue-500",
    ring: "ring-blue-200 dark:ring-blue-900",
    text: "text-blue-700 dark:text-blue-400",
  },
  hold: {
    dot: "bg-violet-500",
    ring: "ring-violet-200 dark:ring-violet-900",
    text: "text-violet-700 dark:text-violet-400",
  },
  mistake: {
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-900",
    text: "text-rose-700 dark:text-rose-400",
  },
  coaching: {
    dot: "bg-cyan-500",
    ring: "ring-cyan-200 dark:ring-cyan-900",
    text: "text-cyan-700 dark:text-cyan-400",
  },
};

export function isCallMarkerType(v: unknown): v is CallMarkerType {
  return (
    typeof v === "string" &&
    (CALL_MARKER_TYPES as readonly string[]).includes(v)
  );
}

// ─── Diarized transcript segment (written by transcribe-call-recording) ──────

export interface DiarizedSegment {
  id: number;
  start: number | null;
  end: number | null;
  text: string;
  speaker: number | null;
}

export type SpeakerRole = "agent" | "client" | "unknown";

/** Safely parse the transcript_segments JSONB into typed segments. */
export function parseSegments(json: unknown): DiarizedSegment[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((raw, i): DiarizedSegment | null => {
      if (!raw || typeof raw !== "object") return null;
      const s = raw as Record<string, unknown>;
      return {
        id: typeof s.id === "number" ? s.id : i,
        start: typeof s.start === "number" ? s.start : null,
        end: typeof s.end === "number" ? s.end : null,
        text: typeof s.text === "string" ? s.text : "",
        speaker: typeof s.speaker === "number" ? s.speaker : null,
      };
    })
    .filter((s): s is DiarizedSegment => s !== null);
}

/** Parse speaker_role_map JSONB → { [speakerIndex]: role }. */
export function parseRoleMap(json: unknown): Record<string, SpeakerRole> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, SpeakerRole> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (v === "agent" || v === "client") out[k] = v;
  }
  return out;
}

export function roleOfSpeaker(
  speaker: number | null,
  roleMap: Record<string, SpeakerRole>,
): SpeakerRole {
  if (speaker == null) return "unknown";
  return roleMap[String(speaker)] ?? "unknown";
}

// ─── AI analysis JSONB shapes (written by analyze-call-transcript) ───────────

export interface ObjectionEvent {
  start_seconds: number | null;
  end_seconds: number | null;
  quote: string;
  type: string;
  is_smoke_screen: boolean;
  handled: boolean;
  resolution: string;
}

export function parseObjectionEvents(json: unknown): ObjectionEvent[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((raw): ObjectionEvent | null => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      return {
        start_seconds:
          typeof o.start_seconds === "number" ? o.start_seconds : null,
        end_seconds: typeof o.end_seconds === "number" ? o.end_seconds : null,
        quote: typeof o.quote === "string" ? o.quote : "",
        type: typeof o.type === "string" ? o.type : "other",
        is_smoke_screen: o.is_smoke_screen === true,
        handled: o.handled === true,
        resolution: typeof o.resolution === "string" ? o.resolution : "",
      };
    })
    .filter((o): o is ObjectionEvent => o !== null);
}

export interface KeyMoment {
  time_seconds: number | null;
  label: string;
  kind: string;
}

export function parseKeyMoments(json: unknown): KeyMoment[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((raw): KeyMoment | null => {
      if (!raw || typeof raw !== "object") return null;
      const m = raw as Record<string, unknown>;
      return {
        time_seconds:
          typeof m.time_seconds === "number" ? m.time_seconds : null,
        label: typeof m.label === "string" ? m.label : "",
        kind: typeof m.kind === "string" ? m.kind : "other",
      };
    })
    .filter((m): m is KeyMoment => m !== null);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** mm:ss (or h:mm:ss). Used for transcript + marker timestamps. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0)
    return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Total hold seconds derived from hold markers (start→end ranges). */
export function deriveHoldSeconds(markers: CallMarkerRow[]): number | null {
  const holds = markers.filter(
    (m) => m.marker_type === "hold" && m.end_seconds != null,
  );
  if (holds.length === 0) return null;
  return Math.round(
    holds.reduce(
      (sum, m) => sum + Math.max(0, (m.end_seconds ?? 0) - m.start_seconds),
      0,
    ),
  );
}
