// src/features/kpi/lib/recording-status.ts
// Collapse the two independent pipeline status columns
// (transcription_status, analysis_status) into ONE display status.

import type {
  CallRecordingRow,
  RecordingDisplayStatus,
} from "../types/kpi.types";

/**
 * Derive a single display status from a recording's transcription + analysis
 * status columns.
 *
 * Precedence:
 *   - either column "failed"          → "failed"
 *   - transcription processing        → "transcribing"
 *   - transcription pending           → "uploaded"
 *   - transcription completed:
 *       - analysis processing         → "analyzing"
 *       - analysis completed          → "analyzed"
 *       - analysis skipped            → "skipped"
 *       - otherwise (pending)         → "transcribed"
 *   - transcription skipped           → "skipped"
 */
export function deriveRecordingStatus(
  row: Pick<CallRecordingRow, "transcription_status" | "analysis_status">,
): RecordingDisplayStatus {
  const transcription = row.transcription_status;
  const analysis = row.analysis_status;

  if (transcription === "failed" || analysis === "failed") {
    return "failed";
  }

  switch (transcription) {
    case "processing":
      return "transcribing";
    case "pending":
      return "uploaded";
    case "skipped":
      return "skipped";
    case "completed":
      switch (analysis) {
        case "processing":
          return "analyzing";
        case "completed":
          return "analyzed";
        case "skipped":
          return "skipped";
        default:
          return "transcribed";
      }
    default:
      // Unknown transcription value — safest neutral state.
      return "uploaded";
  }
}

const STATUS_LABELS: Record<RecordingDisplayStatus, string> = {
  uploaded: "Uploaded",
  transcribing: "Transcribing",
  transcribed: "Transcribed",
  analyzing: "Analyzing",
  analyzed: "Analyzed",
  skipped: "Skipped",
  failed: "Failed",
};

export function recordingStatusLabel(status: RecordingDisplayStatus): string {
  return STATUS_LABELS[status];
}
