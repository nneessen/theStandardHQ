// src/features/kpi/index.ts
// Public barrel for the inbound-call KPI feature.
export { KpiPage } from "./components/KpiPage";

// ─── Reused by the all-agents Call Reviews training feature ──────────────────
// (cross-feature imports must go through this barrel — deep imports are linted).
export { useUploadRecording, useRecordingsList } from "./hooks/useRecordings";
export type { RecordingUploadMeta } from "./hooks/useRecordings";
export { kpiKeys, useKpiIdentity } from "./hooks/kpiKeys";
export {
  recordingStorageService,
  CALL_RECORDINGS_BUCKET,
} from "./services/recordingStorageService";
export {
  deriveRecordingStatus,
  recordingStatusLabel,
} from "./lib/recording-status";
export { formatCallDuration } from "./lib/format-call-duration";
export * from "./types/kpi.types";
