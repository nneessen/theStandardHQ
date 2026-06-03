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

// ---------------------------------------------------------------------------
// COUNT-based caps — a second, orthogonal defense to the per-call counter above.
// Enforced in the executor via the assistant_send_caps RPC (COUNT over committed
// sends), NOT the simple counter. Tunable; values are conservative defaults for the
// ASSISTANT send path specifically (one-off Jarvis-drafted sends — NOT the bulk
// campaign tools). Two axes:
//   * distinct-recipient/day (per user, per channel): bounds fan-out. Set BELOW the
//     per-call daily cap so the volume budget can include repeats but the number of
//     DISTINCT people stays bounded (e.g. sms: 25 total/day across <=15 people).
//   * IMO-wide/day (per tenant, sms+email combined): bounds aggregate org blast.
const DISTINCT_RECIPIENT_DAILY_CAPS: Record<string, number> = {
  sms: 15,
  email: 30,
};

const IMO_DAILY_SEND_CEILING = 300;

/**
 * Per-user daily DISTINCT-recipient cap for a channel, or null when the channel has
 * no distinct cap (e.g. close_note/close_task, which have no recipient).
 */
export function distinctRecipientDailyCap(channel: string): number | null {
  return DISTINCT_RECIPIENT_DAILY_CAPS[channel] ?? null;
}

/** IMO-wide daily ceiling on external (sms+email) assistant sends. */
export function imoDailySendCeiling(): number {
  return IMO_DAILY_SEND_CEILING;
}
