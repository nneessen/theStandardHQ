// Shared Board (.theme-v2) styling helpers for the Workflows redesign.
// Keeps token usage consistent across the picker, wizard, list, and steps.

/** Accent CSS var at a given alpha %, e.g. tint("--violet", 14). */
export const tint = (accentVar: string, pct: number) =>
  `color-mix(in srgb, var(${accentVar}) ${pct}%, transparent)`;

/** Per-trigger-type accent (matches the handoff: manual=blue, schedule=amber, event=violet, webhook=cyan). */
export const TRIGGER_ACCENT: Record<string, string> = {
  manual: "--blue",
  schedule: "--amber",
  event: "--violet",
  webhook: "--cyan",
};

/** Per-action-type accent for the actions builder + review. */
export const ACTION_ACCENT: Record<string, string> = {
  send_email: "--blue",
  send_sms: "--green",
  create_notification: "--amber",
  wait: "--mut",
  webhook: "--cyan",
  update_field: "--violet",
};
