// src/features/call-reviews/hooks/callReviewKeys.ts
// TanStack Query key factory for the Call Reviews training feature.

export const callReviewKeys = {
  all: ["call-reviews"] as const,
  library: (imoId: string) =>
    [...callReviewKeys.all, "library", imoId] as const,
  libraryPaged: (imoId: string, filters: unknown) =>
    [...callReviewKeys.all, "library", imoId, filters] as const,
  imoAgents: (imoId: string) =>
    [...callReviewKeys.all, "imo-agents", imoId] as const,
  downlineAgents: (userId: string) =>
    [...callReviewKeys.all, "downline-agents", userId] as const,
  recording: (id: string) => [...callReviewKeys.all, "recording", id] as const,
  // Set of recording ids the current user has liked (their own hearts).
  myLikes: (imoId: string, userId: string) =>
    [...callReviewKeys.all, "my-likes", imoId, userId] as const,
  signedUrl: (path: string) =>
    [...callReviewKeys.all, "signed-url", path] as const,
  markers: (recordingId: string) =>
    [...callReviewKeys.all, "markers", recordingId] as const,
  detections: (recordingId: string) =>
    [...callReviewKeys.all, "detections", recordingId] as const,
  scripts: (imoId: string) =>
    [...callReviewKeys.all, "scripts", imoId] as const,
  // AI-generated master scripts (kpi_call_scripts) — distinct from `scripts`
  // (the word-track library above).
  generatedScripts: (imoId: string) =>
    [...callReviewKeys.all, "generated-scripts", imoId] as const,
  generatedScript: (callTypeId: string) =>
    [...callReviewKeys.all, "generated-script", callTypeId] as const,
};

// Stop polling a row that has sat in a non-terminal state without any status
// change for this long — a stuck pipeline (e.g. a silently-failed analysis
// dispatch) must not drive an unbounded 5s refetch loop.
const SETTLE_MAX_AGE_MS = 15 * 60 * 1000;

/** A recording is "settling" while transcription or analysis is in flight —
 *  but only until it has been idle in that state past SETTLE_MAX_AGE_MS. */
export function isSettling(
  row:
    | {
        transcription_status: string;
        analysis_status: string;
        updated_at?: string | null;
        created_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!row) return false;
  const inFlight = (s: string) => s === "pending" || s === "processing";
  if (!inFlight(row.transcription_status) && !inFlight(row.analysis_status)) {
    return false;
  }
  const ts = row.updated_at ?? row.created_at;
  if (ts) {
    const age = Date.now() - new Date(ts).getTime();
    if (Number.isFinite(age) && age > SETTLE_MAX_AGE_MS) return false;
  }
  return true;
}
