// src/features/kpi/lib/call-analytics.ts
// Pure client-side aggregation of kpi_call_recordings (+ word-track detections)
// into the shapes the comprehensive dashboard renders. Kept framework-free so it
// is unit-testable and the hooks stay thin.
//
// CONTRACT: a closing rate is a percentage 0–100 and is 0 (not null) when the
// denominator is 0, so bars/labels render a real "0%" rather than NaN. premium /
// duration sums treat null as "no contribution". `numericOrNull` defends against
// PostgREST returning a NUMERIC column as a string on some deployments.

import {
  CALLER_AGE_BAND_OPTIONS,
  CALLER_GENDER_OPTIONS,
} from "../types/kpi.types";
import type { CallRecordingRow } from "../types/kpi.types";

// ─── Input projections (narrow Picks so queries can select only what's used) ──

export type AnalyticsRecording = Pick<
  CallRecordingRow,
  | "id"
  | "agent_id"
  | "call_at"
  | "duration_seconds"
  | "caller_state"
  | "caller_age_band"
  | "caller_gender"
  | "outcome"
  | "premium_amount"
  | "policies_count"
>;

export interface DetectionRow {
  recording_id: string;
  word_track_id: string;
  position_pct: number | null;
  timing_bucket: string | null;
}

export interface TrackMeta {
  id: string;
  label: string;
  category: string;
}

// ─── Output shapes ───────────────────────────────────────────────────────────

export interface CallTotals {
  calls: number;
  sold: number;
  /** sold ÷ calls × 100; 0 when calls = 0. */
  closingRate: number;
  premiumTotal: number;
  /** Mean call length over rows with a duration; null when none. */
  avgDurationSec: number | null;
  /** premiumTotal ÷ sold; null when sold = 0. */
  avgPremium: number | null;
}

export interface StateStat {
  state: string;
  calls: number;
  sold: number;
  closingRate: number;
  premium: number;
}

export interface HourStat {
  hour: number; // 0–23 (viewer-local)
  label: string; // "3 PM"
  calls: number;
  sold: number;
  closingRate: number;
}

export interface DayStat {
  dow: number; // 0=Sun … 6=Sat
  label: string; // "Mon"
  calls: number;
  sold: number;
  closingRate: number;
}

export interface AgeBandStat {
  band: string;
  label: string;
  calls: number;
  sold: number;
  closingRate: number;
}

export interface GenderStat {
  gender: string;
  label: string;
  count: number;
}

export interface LengthBucketStat {
  label: string;
  count: number;
  sold: number;
  closingRate: number;
}

export interface AgentStat {
  agentId: string;
  name: string;
  calls: number;
  sold: number;
  policies: number;
  closingRate: number;
  premium: number;
}

export interface CallAnalytics {
  totals: CallTotals;
  byState: StateStat[];
  byHour: HourStat[];
  byDay: DayStat[];
  byAgeBand: AgeBandStat[];
  byGender: GenderStat[];
  byLengthBucket: LengthBucketStat[];
  byAgent: AgentStat[];
}

export interface WordTrackEffectivenessRow {
  id: string;
  label: string;
  category: string;
  /** Distinct in-range recordings the phrase was detected in. */
  timesUsed: number;
  /** Of those recordings, how many sold. */
  soldWhenUsed: number;
  /** soldWhenUsed ÷ timesUsed × 100. */
  closingRateWhenUsed: number;
  /** closingRateWhenUsed − baseline (percentage points). */
  delta: number;
  avgPositionPct: number | null;
  typicalTiming: string | null;
}

export interface WordTrackEffectiveness {
  rows: WordTrackEffectivenessRow[];
  /** Overall closing rate across the in-range recordings (the comparison line). */
  baseline: number;
  totalDetections: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const AGE_LABEL = new Map(
  CALLER_AGE_BAND_OPTIONS.map((o) => [o.value, o.label] as const),
);
const AGE_ORDER = CALLER_AGE_BAND_OPTIONS.map((o) => o.value);

const GENDER_LABEL = new Map(
  CALLER_GENDER_OPTIONS.map((o) => [o.value, o.label] as const),
);
const GENDER_ORDER = CALLER_GENDER_OPTIONS.map((o) => o.value);

/** Length buckets, in display order. Upper bound is exclusive (seconds). */
export const LENGTH_BUCKETS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "0–2m", max: 120 },
  { label: "2–5m", max: 300 },
  { label: "5–10m", max: 600 },
  { label: "10m+", max: Infinity },
];

export function rate(sold: number, calls: number): number {
  return calls > 0 ? (sold / calls) * 100 : 0;
}

/** Coerce a possibly-stringly NUMERIC to a finite number, else null. */
function numericOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
}

function lengthBucketLabel(sec: number): string {
  for (const b of LENGTH_BUCKETS) {
    if (sec < b.max) return b.label;
  }
  return LENGTH_BUCKETS[LENGTH_BUCKETS.length - 1].label;
}

function isSold(outcome: string | null): boolean {
  return outcome === "sold";
}

// ─── Recording aggregation ───────────────────────────────────────────────────

interface Bucket {
  calls: number;
  sold: number;
  premium: number;
}

const emptyBucket = (): Bucket => ({ calls: 0, sold: 0, premium: 0 });

export function aggregateCallAnalytics(
  rows: AnalyticsRecording[],
  agentNames: Map<string, string>,
): CallAnalytics {
  const stateMap = new Map<string, Bucket>();
  const hourMap = new Map<number, Bucket>();
  const dayMap = new Map<number, Bucket>();
  const ageMap = new Map<string, Bucket>();
  const genderMap = new Map<string, number>();
  const lengthMap = new Map<string, Bucket>();
  const agentMap = new Map<string, Bucket & { policies: number }>();

  let calls = 0;
  let sold = 0;
  let premiumTotal = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const r of rows) {
    const won = isSold(r.outcome);
    const premium = numericOrNull(r.premium_amount) ?? 0;
    const policies = numericOrNull(r.policies_count) ?? 0;
    const duration = numericOrNull(r.duration_seconds);

    calls += 1;
    if (won) sold += 1;
    premiumTotal += premium;
    if (duration != null) {
      durationSum += duration;
      durationCount += 1;
    }

    // by state
    if (r.caller_state) {
      const b = stateMap.get(r.caller_state) ?? emptyBucket();
      b.calls += 1;
      if (won) b.sold += 1;
      b.premium += premium;
      stateMap.set(r.caller_state, b);
    }

    // by hour / day (viewer-local time)
    if (r.call_at) {
      const d = new Date(r.call_at);
      if (!Number.isNaN(d.getTime())) {
        const h = d.getHours();
        const hb = hourMap.get(h) ?? emptyBucket();
        hb.calls += 1;
        if (won) hb.sold += 1;
        hourMap.set(h, hb);

        const dow = d.getDay();
        const db = dayMap.get(dow) ?? emptyBucket();
        db.calls += 1;
        if (won) db.sold += 1;
        dayMap.set(dow, db);
      }
    }

    // by age band
    if (r.caller_age_band) {
      const b = ageMap.get(r.caller_age_band) ?? emptyBucket();
      b.calls += 1;
      if (won) b.sold += 1;
      ageMap.set(r.caller_age_band, b);
    }

    // by gender
    if (r.caller_gender) {
      genderMap.set(r.caller_gender, (genderMap.get(r.caller_gender) ?? 0) + 1);
    }

    // by length bucket
    if (duration != null) {
      const label = lengthBucketLabel(duration);
      const b = lengthMap.get(label) ?? emptyBucket();
      b.calls += 1;
      if (won) b.sold += 1;
      lengthMap.set(label, b);
    }

    // by agent
    const ab = agentMap.get(r.agent_id) ?? { ...emptyBucket(), policies: 0 };
    ab.calls += 1;
    if (won) ab.sold += 1;
    ab.premium += premium;
    ab.policies += policies;
    agentMap.set(r.agent_id, ab);
  }

  const byState: StateStat[] = [...stateMap.entries()]
    .map(([state, b]) => ({
      state,
      calls: b.calls,
      sold: b.sold,
      closingRate: rate(b.sold, b.calls),
      premium: b.premium,
    }))
    .sort((a, b) => b.closingRate - a.closingRate || b.calls - a.calls);

  const byHour: HourStat[] = [...hourMap.entries()]
    .map(([hour, b]) => ({
      hour,
      label: hourLabel(hour),
      calls: b.calls,
      sold: b.sold,
      closingRate: rate(b.sold, b.calls),
    }))
    .sort((a, b) => a.hour - b.hour);

  const byDay: DayStat[] = DOW_LABELS.map((label, dow) => {
    const b = dayMap.get(dow) ?? emptyBucket();
    return {
      dow,
      label,
      calls: b.calls,
      sold: b.sold,
      closingRate: rate(b.sold, b.calls),
    };
  });

  const byAgeBand: AgeBandStat[] = AGE_ORDER.filter((band) =>
    ageMap.has(band),
  ).map((band) => {
    const b = ageMap.get(band)!;
    return {
      band,
      label: AGE_LABEL.get(band) ?? band,
      calls: b.calls,
      sold: b.sold,
      closingRate: rate(b.sold, b.calls),
    };
  });

  const byGender: GenderStat[] = GENDER_ORDER.filter((g) =>
    genderMap.has(g),
  ).map((g) => ({
    gender: g,
    label: GENDER_LABEL.get(g) ?? g,
    count: genderMap.get(g)!,
  }));

  const byLengthBucket: LengthBucketStat[] = LENGTH_BUCKETS.map((bucket) => {
    const b = lengthMap.get(bucket.label) ?? emptyBucket();
    return {
      label: bucket.label,
      count: b.calls,
      sold: b.sold,
      closingRate: rate(b.sold, b.calls),
    };
  });

  const byAgent: AgentStat[] = [...agentMap.entries()]
    .map(([agentId, b]) => ({
      agentId,
      name: agentNames.get(agentId) ?? `Agent ${agentId.slice(0, 4)}`,
      calls: b.calls,
      sold: b.sold,
      policies: b.policies,
      closingRate: rate(b.sold, b.calls),
      premium: b.premium,
    }))
    .sort((a, b) => b.closingRate - a.closingRate || b.calls - a.calls);

  return {
    totals: {
      calls,
      sold,
      closingRate: rate(sold, calls),
      premiumTotal,
      avgDurationSec: durationCount > 0 ? durationSum / durationCount : null,
      avgPremium: sold > 0 ? premiumTotal / sold : null,
    },
    byState,
    byHour,
    byDay,
    byAgeBand,
    byGender,
    byLengthBucket,
    byAgent,
  };
}

// ─── Word-track effectiveness ────────────────────────────────────────────────

export function aggregateWordTrackEffectiveness(
  recordings: Array<{ id: string; outcome: string | null }>,
  detections: DetectionRow[],
  tracks: TrackMeta[],
): WordTrackEffectiveness {
  const soldByRecording = new Map<string, boolean>();
  for (const r of recordings) soldByRecording.set(r.id, isSold(r.outcome));

  const totalCalls = recordings.length;
  const totalSold = recordings.reduce(
    (n, r) => n + (isSold(r.outcome) ? 1 : 0),
    0,
  );
  const baseline = rate(totalSold, totalCalls);

  const trackMeta = new Map(tracks.map((t) => [t.id, t] as const));

  // Per track: the set of distinct in-range recordings it hit, plus timing stats.
  interface Acc {
    recs: Set<string>;
    posSum: number;
    posCount: number;
    timing: Map<string, number>;
  }
  const acc = new Map<string, Acc>();

  for (const d of detections) {
    if (!soldByRecording.has(d.recording_id)) continue; // out of range / not visible
    const a =
      acc.get(d.word_track_id) ??
      ({ recs: new Set(), posSum: 0, posCount: 0, timing: new Map() } as Acc);
    a.recs.add(d.recording_id);
    if (d.position_pct != null && Number.isFinite(d.position_pct)) {
      a.posSum += d.position_pct;
      a.posCount += 1;
    }
    if (d.timing_bucket) {
      a.timing.set(d.timing_bucket, (a.timing.get(d.timing_bucket) ?? 0) + 1);
    }
    acc.set(d.word_track_id, a);
  }

  const rows: WordTrackEffectivenessRow[] = [...acc.entries()].map(
    ([id, a]) => {
      const timesUsed = a.recs.size;
      let soldWhenUsed = 0;
      for (const recId of a.recs) {
        if (soldByRecording.get(recId)) soldWhenUsed += 1;
      }
      const closingRateWhenUsed = rate(soldWhenUsed, timesUsed);
      const meta = trackMeta.get(id);
      // Most-common timing bucket (mode).
      let typicalTiming: string | null = null;
      let best = -1;
      for (const [bucket, n] of a.timing) {
        if (n > best) {
          best = n;
          typicalTiming = bucket;
        }
      }
      return {
        id,
        label: meta?.label ?? "Unknown phrase",
        category: meta?.category ?? "general",
        timesUsed,
        soldWhenUsed,
        closingRateWhenUsed,
        delta: closingRateWhenUsed - baseline,
        avgPositionPct: a.posCount > 0 ? a.posSum / a.posCount : null,
        typicalTiming,
      };
    },
  );

  rows.sort((x, y) => y.delta - x.delta || y.timesUsed - x.timesUsed);

  return { rows, baseline, totalDetections: detections.length };
}
