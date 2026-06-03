// Per-action-class daily send caps. Enforced in assistant-action-execute (the executor) as
// defense-in-depth: approved sends run OUT-OF-BAND of the orchestrator, so they bypass its
// request/token buckets entirely. Without a cap here, an automated/compromised approve->execute
// loop (or a script hitting the public endpoint) has no per-day ceiling. Human approval is the
// primary gate; this bounds the blast radius if that gate is bypassed.
//
// Pure + dependency-free so it unit-tests offline. Keyed per user per channel (24h window) via
// the existing Postgres rate limiter (check_rate_limit / _shared/rate-limit.ts).

const DAILY_CAPS: Record<string, number> = {
  sms: 25,
  email: 50,
  close_note: 60,
  close_task: 60,
};

/** The per-user daily send cap for an action channel, or null when the channel is uncapped. */
export function actionDailyCap(channel: string): number | null {
  return DAILY_CAPS[channel] ?? null;
}

/** Rate-limit bucket key for a channel's per-user daily send cap. */
export function actionRateKey(channel: string, userId: string): string {
  return `ratelimit:act:${channel}:${userId}`;
}

export const ACTION_RATE_WINDOW_SECONDS = 86400;
