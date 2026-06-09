// src/features/call-reviews/hooks/callReviewKeys.ts
// TanStack Query key factory for the Call Reviews training feature.

export const callReviewKeys = {
  all: ["call-reviews"] as const,
  library: (imoId: string) =>
    [...callReviewKeys.all, "library", imoId] as const,
  recording: (id: string) => [...callReviewKeys.all, "recording", id] as const,
  signedUrl: (path: string) =>
    [...callReviewKeys.all, "signed-url", path] as const,
  markers: (recordingId: string) =>
    [...callReviewKeys.all, "markers", recordingId] as const,
  detections: (recordingId: string) =>
    [...callReviewKeys.all, "detections", recordingId] as const,
  scripts: (imoId: string) =>
    [...callReviewKeys.all, "scripts", imoId] as const,
};

/** A recording is "settling" while transcription or analysis is in flight. */
export function isSettling(
  row:
    | { transcription_status: string; analysis_status: string }
    | null
    | undefined,
): boolean {
  if (!row) return false;
  const inFlight = (s: string) => s === "pending" || s === "processing";
  return inFlight(row.transcription_status) || inFlight(row.analysis_status);
}
