// src/features/training-modules/types/presentation-marker.types.ts
import type { Database } from "@/types/database.types";

export type PresentationMarkerRow =
  Database["public"]["Tables"]["presentation_markers"]["Row"];
export type PresentationMarkerInsert =
  Database["public"]["Tables"]["presentation_markers"]["Insert"];
export type PresentationMarkerUpdate =
  Database["public"]["Tables"]["presentation_markers"]["Update"];

export const MARKER_TYPES = [
  "chapter",
  "highlight",
  "key_point",
  "objection_handled",
  "mistake",
] as const;

export type MarkerType = (typeof MARKER_TYPES)[number];

export const MARKER_TYPE_LABELS: Record<MarkerType, string> = {
  chapter: "Chapter",
  highlight: "Highlight",
  key_point: "Key Point",
  objection_handled: "Objection Handled",
  mistake: "Mistake / Note",
};

// Muted accent palette — single dot color per type, never full bg fills
export const MARKER_TYPE_COLORS: Record<
  MarkerType,
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
  objection_handled: {
    dot: "bg-blue-500",
    ring: "ring-blue-200 dark:ring-blue-900",
    text: "text-blue-700 dark:text-blue-400",
  },
  mistake: {
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-900",
    text: "text-rose-700 dark:text-rose-400",
  },
};

export interface PresentationMarker extends PresentationMarkerRow {
  creator?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
