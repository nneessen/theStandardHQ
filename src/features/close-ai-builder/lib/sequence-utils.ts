// Small helpers for the sequence builder UI.
//
// Note: the UI works in user-friendly "Day N" numbers from sequence start
// (Day 1 = immediate, Day 3 = 2 days later, etc.). At save time the backend
// converts these into Close's native format, which is seconds SINCE THE
// PREVIOUS STEP, not absolute from start. Don't try to convert day numbers
// to seconds in the frontend — that computation only makes sense once we
// know the full ordered step list.

import type { GeneratedSequence } from "../types/close-ai-builder.types";

/** User-visible label for a step delay. Day 1 → "Day 1 (immediate)". */
export function formatDayLabel(day: number): string {
  if (day <= 1) return "Day 1 (immediate)";
  return `Day ${day}`;
}

/**
 * For the step editor: return the gap in days between a step and the
 * previous one. Used to show "+2 days" next to each step so users can
 * see the cadence at a glance.
 */
export function gapFromPrevious(
  day: number,
  previousDay: number | null,
): number {
  if (previousDay == null) return 0;
  return Math.max(0, day - previousDay);
}

/** Count touches by channel for the save-confirmation banner. */
export function countStepsByChannel(seq: GeneratedSequence): {
  emailCount: number;
  smsCount: number;
} {
  let emailCount = 0;
  let smsCount = 0;
  for (const s of seq.steps) {
    if (s.step_type === "email") emailCount++;
    if (s.step_type === "sms") smsCount++;
  }
  return { emailCount, smsCount };
}

/** List of Close mustache variables for quick-insert buttons in the UI. */
export const CLOSE_MUSTACHE_VARIABLES = [
  { label: "First name", value: "{{ contact.first_name }}" },
  { label: "Last name", value: "{{ contact.last_name }}" },
  { label: "Lead name", value: "{{ lead.display_name }}" },
  { label: "Lead URL", value: "{{ lead.url }}" },
  { label: "Contact email", value: "{{ contact.email }}" },
  { label: "Your first name", value: "{{ user.first_name }}" },
  { label: "Your email", value: "{{ user.email }}" },
] as const;
