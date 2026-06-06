// src/features/kpi/lib/format-call-duration.ts
// Format a duration in seconds as mm:ss (or h:mm:ss for >= 1 hour).

/**
 * Format a duration in whole seconds as `mm:ss` (or `h:mm:ss` when >= 1h).
 * Returns null for null/undefined/negative/non-finite input so callers can
 * suppress the value instead of rendering a meaningless "0:00" or "NaN".
 */
export function formatCallDuration(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}
