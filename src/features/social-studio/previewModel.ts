// src/features/social-studio/previewModel.ts
// Pure, unit-testable core of the Social Studio preview: (1) the sample/live state
// machine, (2) the period-label builder, and (3) the PreviewData assembler. Kept
// out of the component so each rule is testable in isolation and the confirmed
// bugs (zero-producer crash, empty-card export, fabricated-sample leakage,
// label/data timezone disagreement) have regression tests with no React in the way.

import { toLastInitial, usd } from "@/features/social-cards";
import type { PreviewData } from "./components/SocialPreview";
import type { SocialStudioConfig, SocialView } from "./types";
import {
  SAMPLE_DAILY,
  SAMPLE_WEEKLY,
  SAMPLE_MONTHLY,
  SAMPLE_TOTAL_DAILY,
  SAMPLE_TOTAL_WEEKLY,
  SAMPLE_AOTW,
} from "./sampleData";

// ── 1. Sample/live state machine ────────────────────────────────────────────
// A leaderboard with only a couple of producers looks empty, so default to the
// labeled sample while production is thin; AOTW shows a single hero, so one real
// producer is enough.
const MIN_PRODUCERS: Record<SocialView, number> = {
  daily: 5,
  weekly: 5,
  monthly: 5,
  aotw: 1,
};

export interface SampleStateInput {
  view: SocialView;
  /** producers = leaderboard entries with apTotal > 0 (real producers). */
  producersCount: number;
  isLoading: boolean;
  /** The "Preview with sample data" toggle: null = auto-decide. */
  sampleOverride: boolean | null;
}

export interface SampleState {
  /** Whether the SAMPLE layout is shown (badge on, download + caption blocked). */
  isSample: boolean;
  /** True when there is NO live data at all, so sample is forced regardless of the
   *  toggle — the toggle is disabled in this state. */
  sampleForced: boolean;
  /** The auto heuristic's verdict (used as the toggle's default position). */
  autoSample: boolean;
}

/**
 * Decide whether to show sample vs. live data.
 *
 * The single invariant that closes three bugs: **when there are zero real
 * producers, sample is FORCED for every view** (not just AOTW). That means
 * `!isSample` implies `producersCount > 0`, so any `producers[0]` access in the
 * live branch is safe (fixes the monthly zero-producer crash), and the
 * download/caption sample-guards can never let an empty real card through.
 */
export function resolveSampleState(input: SampleStateInput): SampleState {
  const min = MIN_PRODUCERS[input.view];
  const hasLive = input.producersCount > 0;
  const autoSample =
    !hasLive || (!input.isLoading && input.producersCount < min);
  const sampleForced = !hasLive;
  const isSample = sampleForced ? true : (input.sampleOverride ?? autoSample);
  return { isSample, sampleForced, autoSample };
}

// ── 2. Period labels (timezone-consistent with the data window) ──────────────
// leaderboardService.calculateDateRange derives the queried window from a mix of
// UTC (`today = now.toISOString()`) and local (week/month-start arithmetic). To
// guarantee the printed label can never contradict the data it stamps, we mirror
// that exact math here and format the resulting y-m-d strings in UTC. `now` is
// injectable so the rules are deterministically testable.
function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtYmd(ymdStr: string, opts: Intl.DateTimeFormatOptions): string {
  // Parse as UTC midnight and format in UTC so a local offset can't shift the day.
  return new Date(`${ymdStr}T00:00:00Z`)
    .toLocaleDateString("en-US", { ...opts, timeZone: "UTC" })
    .toUpperCase();
}

export interface PeriodLabels {
  dateLabel: string;
  monthLabel: string;
  weekRange: string;
}

export function buildPeriodLabels(now: Date = new Date()): PeriodLabels {
  // daily window = { today, today } (UTC today) — see calculateDateRange "daily".
  const today = ymd(now);
  // weekly window start = Monday of the local week (calculateDateRange "weekly").
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const weekStartYmd = ymd(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysSinceMonday,
    ),
  );
  // mtd window start = local month start (calculateDateRange "mtd").
  const monthStartYmd = ymd(new Date(now.getFullYear(), now.getMonth(), 1));

  const dateLabel = fmtYmd(today, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  // The month of the WINDOW (its start), not "today" — at a month boundary the UTC
  // "today" can roll into the next month while the report still covers this one.
  const monthLabel = fmtYmd(monthStartYmd, { month: "long", year: "numeric" });

  const startMonth = new Date(`${weekStartYmd}T00:00:00Z`).getUTCMonth();
  const endDateNum = new Date(`${today}T00:00:00Z`).getUTCDate();
  const endMonth = new Date(`${today}T00:00:00Z`).getUTCMonth();
  const fmtMD = (s: string) => fmtYmd(s, { month: "short", day: "numeric" });
  // Include the end month only when the week-to-date span crosses a month boundary,
  // else "JUN 30–3" reads as a backwards range on the posted graphic.
  const weekRange =
    startMonth === endMonth
      ? `${fmtMD(weekStartYmd)}–${endDateNum}`
      : `${fmtMD(weekStartYmd)}–${fmtMD(today)}`;

  return { dateLabel, monthLabel, weekRange };
}

// ── 3. PreviewData assembler ─────────────────────────────────────────────────
// The minimal shape of a producer row this module consumes (an
// AgentLeaderboardEntry, narrowed). `submittedPolicies` is optional: until the
// additive AP-count RPC lands it is undefined and we fall back to policyCount.
export interface ProducerRow {
  agentName: string;
  apTotal: number;
  policyCount: number;
  /** Count of SUBMITTED policies — matches apTotal's population. Preferred for the
   *  card's policy stat when available (see get_agency_ap_leaderboard). */
  submittedPolicies?: number;
}

/** The policy count that is CONSISTENT with apTotal: submitted count when present,
 *  else the (legacy) approved policyCount. */
function policyCountFor(p: ProducerRow): number {
  return p.submittedPolicies ?? p.policyCount;
}

export interface BuildPreviewArgs {
  config: SocialStudioConfig;
  producers: ProducerRow[];
  isSample: boolean;
  labels: PeriodLabels;
}

export function buildPreviewData({
  config,
  producers,
  isSample,
  labels,
}: BuildPreviewArgs): PreviewData {
  // Defense-in-depth: only take the live path when sample is off AND we actually
  // have producers. With resolveSampleState, !isSample already implies producers
  // exist, but guarding here makes every producers[0] access crash-proof
  // regardless of how isSample was derived.
  const useLive = !isSample && producers.length > 0;
  const { dateLabel, monthLabel, weekRange } = labels;

  if (config.view === "monthly") {
    if (useLive) {
      const totalAp = producers.reduce((s, e) => s + e.apTotal, 0);
      const totalPol = producers.reduce((s, e) => s + policyCountFor(e), 0);
      const agents = producers.length;
      const avg = agents ? Math.round(totalAp / agents) : 0;
      const tp = producers[0];
      return {
        kind: "report",
        monthLabel,
        totalAp,
        stats: [
          { label: "POLICIES", value: String(totalPol) },
          { label: "PRODUCERS", value: String(agents) },
          { label: "AVG AP / AGENT", value: usd(avg) },
        ],
        topPerformer: {
          name: toLastInitial(tp.agentName),
          ap: tp.apTotal,
          policies: policyCountFor(tp),
        },
        top: producers.slice(0, 5).map((e, i) => ({
          rank: i + 1,
          name: toLastInitial(e.agentName),
          ap: e.apTotal,
        })),
      };
    }
    return { kind: "report", monthLabel, ...SAMPLE_MONTHLY };
  }

  if (config.view === "aotw") {
    // The week's #1 producer = the top of the (weekly-scoped) leaderboard. Fall
    // back to the sample agent when previewing sample OR when there are no real
    // producers yet (the latter can't happen under resolveSampleState, but the
    // guard keeps this independent of that).
    const top = useLive ? producers[0] : undefined;
    const photoUrl = config.aowPhotoUrl;
    const agent = top
      ? {
          name: toLastInitial(top.agentName),
          ap: top.apTotal,
          policies: policyCountFor(top),
          photoUrl,
        }
      : { ...SAMPLE_AOTW, photoUrl };
    return {
      kind: "aotw",
      periodLabel: `WEEK OF ${weekRange}`,
      design: config.aowDesign,
      agent,
      style: {
        fontDisplay: config.aowFontDisplay,
        background: config.aowBackground,
        backgroundImageUrl: config.aowBgImageUrl,
        titleScale: config.aowTitleScale,
        agencyScale: config.aowAgencyScale,
      },
    };
  }

  // daily / weekly leaderboard
  const periodLabel =
    config.view === "weekly" ? `WEEKLY · ${weekRange}` : `DAILY · ${dateLabel}`;
  // Card splits >10 rows into two columns, so 20 fits — no format-based clamp.
  const cap = Math.min(config.topN, 20);

  if (useLive) {
    return {
      kind: "leaderboard",
      rows: producers.slice(0, cap).map((e, i) => ({
        rank: i + 1,
        name: toLastInitial(e.agentName),
        agency: null,
        ap: e.apTotal,
        policies: policyCountFor(e),
      })),
      totalAp: producers.reduce((s, e) => s + e.apTotal, 0),
      periodLabel,
      title: config.title,
    };
  }

  const sample = config.view === "weekly" ? SAMPLE_WEEKLY : SAMPLE_DAILY;
  const sampleTotal =
    config.view === "weekly" ? SAMPLE_TOTAL_WEEKLY : SAMPLE_TOTAL_DAILY;
  return {
    kind: "leaderboard",
    rows: sample.slice(0, cap),
    totalAp: sampleTotal,
    periodLabel,
    title: config.title,
  };
}
