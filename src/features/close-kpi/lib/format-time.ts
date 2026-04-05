/**
 * Format a timestamp as a human-readable "time ago" string.
 * Handles null input, future timestamps (clock skew), and customizable null fallback.
 */
export function formatTimeAgo(
  ts: string | null,
  opts?: { nullFallback?: string },
): string {
  if (!ts) return opts?.nullFallback ?? "";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 0) return "Just now"; // future timestamp (clock skew)
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
