// src/features/chat-bot/lib/monitoring-thresholds.ts
// Threshold configuration for the bot health monitoring dashboard.
// Tune these values to adjust warn/critical levels for queue depth,
// failed jobs, and database latency.

export interface Threshold {
  warn: number;
  critical: number;
}

export type ThresholdLevel = "ok" | "warn" | "critical";

/**
 * Per-queue pending-job thresholds. Queue names come from
 * standard-chat-bot's `queueBreakdown` payload.
 *
 * Unknown queue names fall back to UNKNOWN_QUEUE_THRESHOLD so any new
 * queue added upstream is never silently unmonitored.
 */
export const QUEUE_PENDING_THRESHOLDS: Record<string, Threshold> = {
  "ai-reply": { warn: 20, critical: 50 },
  "send-intro-sms": { warn: 30, critical: 100 },
  "sendblue-inbound": { warn: 10, critical: 30 },
  // check-conversation-followup legitimately holds far-future scheduled
  // jobs — higher ceilings reflect that this queue is deep by design.
  "check-conversation-followup": { warn: 500, critical: 2000 },
};

/**
 * Fallback for any queue name not explicitly listed above. Intentionally
 * tight so brand-new queues still trip alarms if they back up.
 */
export const UNKNOWN_QUEUE_THRESHOLD: Threshold = { warn: 50, critical: 200 };

/** Total failed jobs in the last 24h across all queues. */
export const TOTAL_FAILED_24H_THRESHOLD: Threshold = { warn: 10, critical: 50 };

/** Database round-trip latency reported by /api/external/monitoring/system. */
export const DB_LATENCY_MS_THRESHOLD: Threshold = { warn: 200, critical: 500 };

export function evaluateThreshold(
  value: number,
  threshold: Threshold,
): ThresholdLevel {
  if (value >= threshold.critical) return "critical";
  if (value >= threshold.warn) return "warn";
  return "ok";
}

export function getQueueThreshold(queueName: string): Threshold {
  return QUEUE_PENDING_THRESHOLDS[queueName] ?? UNKNOWN_QUEUE_THRESHOLD;
}

/**
 * Roll up any number of threshold levels into the worst one.
 * Used to compute an overall page status when multiple metrics are in play.
 */
export function worstLevel(levels: ThresholdLevel[]): ThresholdLevel {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warn")) return "warn";
  return "ok";
}
