// src/features/kpi/index.ts
// Public barrel for the inbound-call KPI feature.
//
// The standalone /kpi page was merged into /analytics (5-tab redesign). The
// inbound-call workspace now lives as tabs on the Analytics dashboard, so the
// pieces those tabs render are exported here (cross-feature imports must go
// through this barrel — deep imports are linted).
export { ManualKpiEntryPanel } from "./components/ManualKpiEntryPanel";
export { KpiGuideSheet } from "./components/KpiGuideSheet";
export { PerformanceBand } from "./components/dashboard/PerformanceBand";
export { TrendPanel } from "./components/dashboard/TrendPanel";
export { RecordingsProvenance } from "./components/dashboard/RecordingsProvenance";
export { WordTrackForm } from "./components/WordTrackForm";
export { WordTrackLibrary } from "./components/WordTrackLibrary";

// ─── Reused by the all-agents Call Reviews training feature ──────────────────
// (cross-feature imports must go through this barrel — deep imports are linted).
export { useUploadRecording, useRecordingsList } from "./hooks/useRecordings";
export type { RecordingUploadMeta } from "./hooks/useRecordings";
export { kpiKeys, useKpiIdentity } from "./hooks/kpiKeys";
export {
  recordingStorageService,
  CALL_RECORDINGS_BUCKET,
  REDACTED_RECORDINGS_BUCKET,
} from "./services/recordingStorageService";
export {
  deriveRecordingStatus,
  recordingStatusLabel,
} from "./lib/recording-status";
export { formatCallDuration } from "./lib/format-call-duration";
export * from "./types/kpi.types";

// ─── Call Types (settings CRUD + upload dropdown) ────────────────────────────
export { useCallTypes, useActiveCallTypes } from "./hooks/useCallTypes";
export type {
  CallTypeCreateForm,
  CallTypeUpdateForm,
} from "./hooks/useCallTypes";

// ─── Daily KPI metrics (manual "Log day" totals; reused by /analytics) ───────
export {
  useDailyMetrics,
  useAgentKpiSummary,
  summarizeDailyMetrics,
} from "./hooks/useDailyMetrics";

// ─── Call analytics aggregations (reused by the /analytics board) ────────────
export {
  useKpiCallAnalytics,
  useWordTrackEffectiveness,
} from "./hooks/useCallAnalytics";
export type {
  CallAnalytics,
  CallTotals,
  StateStat,
  HourStat,
  DayStat,
  AgeBandStat,
  GenderStat,
  OutcomeStat,
  LengthBucketStat,
  AgentStat,
  WordTrackEffectiveness,
  WordTrackEffectivenessRow,
} from "./lib/call-analytics";
