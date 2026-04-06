// src/features/close-kpi/types/team-call-stats.types.ts
//
// Types for the daily call monitoring view in the Close KPIs Team tab.
// Mirrors the get-team-call-stats edge function response shape.

export type TeamCallRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export interface TeamCallRange {
  preset: TeamCallRangePreset;
  /** ISO 8601 timestamp (timezone-aware) — start of range, inclusive */
  from: string;
  /** ISO 8601 timestamp (timezone-aware) — end of range, inclusive */
  to: string;
  /** Human-readable label, e.g. "Today", "Last 7 days" */
  label: string;
}

export interface TeamCallStatsRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  isSelf: boolean;
  dials: number;
  connects: number;
  connectRate: number | null;
  talkTimeSeconds: number;
  voicemails: number;
  lastCallAt: string | null;
  /** Per-agent error so one bad API key doesn't break the whole table */
  error: string | null;
}

export interface TeamCallStatsResponse {
  from: string;
  to: string;
  rows: TeamCallStatsRow[];
}
