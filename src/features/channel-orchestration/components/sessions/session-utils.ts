// src/features/channel-orchestration/components/sessions/session-utils.ts

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function outcomeBadge(outcome: string | null): {
  variant: BadgeVariant;
  label: string;
} {
  switch (outcome) {
    case "answered":
      return { variant: "default", label: "Answered" };
    case "voicemail":
      return { variant: "secondary", label: "Voicemail" };
    case "no_answer":
      return { variant: "outline", label: "No Answer" };
    case "busy":
      return { variant: "destructive", label: "Busy" };
    case "error":
      return { variant: "destructive", label: "Error" };
    default:
      return { variant: "outline", label: outcome || "Unknown" };
  }
}

export function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
