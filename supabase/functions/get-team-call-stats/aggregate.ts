// supabase/functions/get-team-call-stats/aggregate.ts
//
// Pure functions for aggregating Close call records into per-agent stats.
// Extracted from index.ts so they're importable from both the Deno edge
// function (via relative path) AND from vitest tests (which can resolve
// the same path under Node since this file has no Deno-specific imports).
//
// This file MUST stay free of Deno globals, URL imports, and node-only
// modules. Treat it as runtime-agnostic.

export interface CloseCall {
  id: string;
  lead_id: string;
  /** "outbound" | "outgoing" | "inbound" | "incoming" — Close uses both spellings */
  direction?: string;
  /** Call duration in seconds. Only meaningful for answered calls. */
  duration?: number;
  /** "answered" | "no-answer" | "busy" | "vm-answer" | ... */
  disposition?: string;
  date_created: string;
}

export interface CallAggregate {
  dials: number;
  connects: number;
  /** Sum of duration (seconds) for answered outbound calls. */
  talkTimeSeconds: number;
  voicemails: number;
  /** ISO 8601 timestamp of the most recent OUTBOUND call. Null if no dials. */
  lastDialAt: string | null;
}

/**
 * Close API uses both "outbound"/"outgoing" depending on the endpoint version.
 * Match either spelling. Source: signal-extractor.ts in close-lead-heat-score.
 */
export function isOutbound(direction?: string): boolean {
  return direction === "outbound" || direction === "outgoing";
}

/**
 * Aggregate a list of Close call records into per-agent dial stats.
 *
 * Only OUTBOUND calls are counted — this is dial-monitoring data, not
 * total call volume. Inbound calls are ignored entirely (not counted as
 * dials, not factored into lastDialAt).
 *
 * Talk time is computed from `duration` only on calls with disposition
 * === "answered". Calls that hit voicemail or rang out have undefined
 * duration semantics and are excluded from talk time even if Close
 * happens to set a duration value.
 */
export function aggregateCalls(calls: CloseCall[]): CallAggregate {
  let dials = 0;
  let connects = 0;
  let talkTimeSeconds = 0;
  let voicemails = 0;
  let lastDialAt: string | null = null;

  for (const c of calls) {
    if (!isOutbound(c.direction)) continue;
    dials += 1;
    if (c.disposition === "answered") {
      connects += 1;
      talkTimeSeconds += c.duration ?? 0;
    } else if (c.disposition === "vm-answer") {
      voicemails += 1;
    }
    if (lastDialAt === null || c.date_created > lastDialAt) {
      lastDialAt = c.date_created;
    }
  }

  return { dials, connects, talkTimeSeconds, voicemails, lastDialAt };
}
