// src/features/kpi/hooks/index.ts
export { kpiKeys, useKpiIdentity } from "./kpiKeys";
export {
  useDailyMetrics,
  useUpsertDailyMetrics,
  useAgentKpiSummary,
  summarizeDailyMetrics,
  type DailyMetricUpsertInput,
} from "./useDailyMetrics";
export { useTeamDailyMetrics } from "./useTeamDailyMetrics";
export {
  useWordTracks,
  useUpsertWordTrack,
  useDeleteWordTrack,
  type WordTrackCreateInput,
} from "./useWordTracks";
export {
  useRecordingsList,
  useUploadRecording,
  type RecordingUploadMeta,
} from "./useRecordings";
export {
  useKpiCallAnalytics,
  useWordTrackEffectiveness,
} from "./useCallAnalytics";
