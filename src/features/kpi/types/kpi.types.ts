// src/features/kpi/types/kpi.types.ts
// Type contracts for the inbound-call KPI feature (Phase 1).
//
// Row/Insert/Update aliases derive from the generated DB types (the single
// source of truth). Enum columns are stored as plain `string` in the DB types
// (enums are validated in TypeScript, not via DB CHECK constraints), so we keep
// the DB string type at read boundaries and apply the unions below only for
// form state and Insert payloads.

import type { Database } from "@/types/database.types";

// ─── Table Row / Insert / Update aliases ───────────────────────────────────

export type CallRecordingRow =
  Database["public"]["Tables"]["kpi_call_recordings"]["Row"];
export type CallRecordingInsert =
  Database["public"]["Tables"]["kpi_call_recordings"]["Insert"];
export type CallRecordingUpdate =
  Database["public"]["Tables"]["kpi_call_recordings"]["Update"];

export type DailyCallMetricRow =
  Database["public"]["Tables"]["kpi_daily_call_metrics"]["Row"];
export type DailyCallMetricInsert =
  Database["public"]["Tables"]["kpi_daily_call_metrics"]["Insert"];
export type DailyCallMetricUpdate =
  Database["public"]["Tables"]["kpi_daily_call_metrics"]["Update"];

export type WordTrackRow =
  Database["public"]["Tables"]["kpi_word_tracks"]["Row"];
export type WordTrackInsert =
  Database["public"]["Tables"]["kpi_word_tracks"]["Insert"];
export type WordTrackUpdate =
  Database["public"]["Tables"]["kpi_word_tracks"]["Update"];

// ─── Enum unions (validated in TypeScript) ──────────────────────────────────

export type CallDirection = "inbound" | "outbound";

export type CallerAgeBand =
  | "under_30"
  | "30_39"
  | "40_49"
  | "50_59"
  | "60_69"
  | "70_plus"
  | "unknown";

export type CallerGender = "male" | "female" | "other" | "unknown";

export type CallOutcome =
  | "sold"
  | "not_sold"
  | "callback"
  | "no_sale_followup"
  | "wrong_number"
  | "not_qualified"
  | "do_not_call"
  | "other";

export type PipelineStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type WordTrackScope = "personal" | "team" | "imo";

export type WordTrackMatchType = "exact" | "fuzzy" | "regex" | "semantic";

export type WordTrackCategory =
  | "greeting"
  | "rapport"
  | "discovery"
  | "pitch"
  | "objection_handling"
  | "close"
  | "compliance"
  | "cross_sell"
  | "general";

export type WordTrackExpectedTiming =
  | "opening"
  | "early"
  | "mid"
  | "late"
  | "closing"
  | "any";

// ─── Enum option lists (label/value pairs for selects) ──────────────────────

export const CALL_DIRECTION_OPTIONS: ReadonlyArray<{
  value: CallDirection;
  label: string;
}> = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
];

export const CALLER_AGE_BAND_OPTIONS: ReadonlyArray<{
  value: CallerAgeBand;
  label: string;
}> = [
  { value: "under_30", label: "Under 30" },
  { value: "30_39", label: "30–39" },
  { value: "40_49", label: "40–49" },
  { value: "50_59", label: "50–59" },
  { value: "60_69", label: "60–69" },
  { value: "70_plus", label: "70+" },
  { value: "unknown", label: "Unknown" },
];

export const CALLER_GENDER_OPTIONS: ReadonlyArray<{
  value: CallerGender;
  label: string;
}> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const CALL_OUTCOME_OPTIONS: ReadonlyArray<{
  value: CallOutcome;
  label: string;
}> = [
  { value: "sold", label: "Sold" },
  { value: "not_sold", label: "Not Sold" },
  { value: "callback", label: "Callback" },
  { value: "no_sale_followup", label: "No Sale — Follow Up" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "not_qualified", label: "Not Qualified" },
  { value: "do_not_call", label: "Do Not Call" },
  { value: "other", label: "Other" },
];

export const WORD_TRACK_SCOPE_OPTIONS: ReadonlyArray<{
  value: WordTrackScope;
  label: string;
}> = [
  { value: "personal", label: "Personal" },
  { value: "team", label: "Team" },
  { value: "imo", label: "IMO" },
];

export const WORD_TRACK_MATCH_TYPE_OPTIONS: ReadonlyArray<{
  value: WordTrackMatchType;
  label: string;
}> = [
  { value: "exact", label: "Exact" },
  { value: "fuzzy", label: "Fuzzy" },
  { value: "regex", label: "Regex" },
  { value: "semantic", label: "Semantic" },
];

export const WORD_TRACK_CATEGORY_OPTIONS: ReadonlyArray<{
  value: WordTrackCategory;
  label: string;
}> = [
  { value: "greeting", label: "Greeting" },
  { value: "rapport", label: "Rapport" },
  { value: "discovery", label: "Discovery" },
  { value: "pitch", label: "Pitch" },
  { value: "objection_handling", label: "Objection Handling" },
  { value: "close", label: "Close" },
  { value: "compliance", label: "Compliance" },
  { value: "cross_sell", label: "Cross-Sell" },
  { value: "general", label: "General" },
];

export const WORD_TRACK_TIMING_OPTIONS: ReadonlyArray<{
  value: WordTrackExpectedTiming;
  label: string;
}> = [
  { value: "opening", label: "Opening" },
  { value: "early", label: "Early" },
  { value: "mid", label: "Mid" },
  { value: "late", label: "Late" },
  { value: "closing", label: "Closing" },
  { value: "any", label: "Any" },
];

// ─── US states (USPS 2-letter, 50 states + DC) ──────────────────────────────

export const US_STATES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// ─── Aggregated dashboard summary (derived client-side) ──────────────────────

export interface AgentKpiSummary {
  /** Number of daily-metric rows the summary aggregates. */
  rowCount: number;
  // Raw aggregates — null means "no data entered for this column" (suppress
  // the tile). A numeric 0 is a real, displayable value.
  totalInboundCalls: number | null;
  answeredCalls: number | null;
  missedCalls: number | null;
  leadsReceived: number | null;
  clientsSold: number | null;
  policiesSold: number | null;
  premiumWritten: number | null;
  leadSpend: number | null;
  marketingSpend: number | null;
  totalTalkTimeSeconds: number | null;
  // Derived KPIs — null when an input is missing or a denominator is 0/null.
  connectRate: number | null;
  closingRate: number | null;
  policiesPerClient: number | null;
  costPerAcquisition: number | null;
}

/** One-display-status mapping of the two pipeline status columns. */
export type RecordingDisplayStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "analyzed"
  | "skipped"
  | "failed";

export interface DateRange {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}
