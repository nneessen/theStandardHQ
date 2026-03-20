import type { ChatBotCloseLeadStatus } from "../hooks/useChatBot";

export const DEFAULT_CLOSE_LEAD_STATUS_LABELS = [
  "New",
  "Contacted",
  "Contacted/Texting",
  "Contacted/Call Back",
  "Contacted/Quoted",
  "CONTACTED/MISSED APPOINTMENT",
  "Contacted/No Answer",
  "Contacted/Left VM",
  "Contacted/Straight to VM",
  "Contacted/Doesn't Ring",
  "Contacted/Blocked",
  "Contacted/Not In Service",
  "Contacted/Hung Up",
] as const;

export const DEFAULT_CLOSE_LEAD_SOURCE_LABELS = [
  "Sitka Life",
  "GOAT Realtime Mortgage",
  "GOAT Realtime Veterans",
] as const;

export function resolveCloseLeadStatusLabels(
  statuses: ChatBotCloseLeadStatus[] | null | undefined,
): string[] {
  const labels = Array.isArray(statuses)
    ? statuses
        .map((status) => status.label?.trim())
        .filter((label): label is string => Boolean(label))
    : [];

  if (labels.length === 0) {
    return [...DEFAULT_CLOSE_LEAD_STATUS_LABELS];
  }

  return [...new Set(labels)].sort((left, right) => left.localeCompare(right));
}

export function resolveCloseLeadSourceLabels(
  selectedSources: string[] | null | undefined,
): string[] {
  const labels = Array.isArray(selectedSources)
    ? selectedSources
        .map((source) => source.trim())
        .filter((source): source is string => Boolean(source))
    : [];

  return [...new Set([...DEFAULT_CLOSE_LEAD_SOURCE_LABELS, ...labels])];
}
