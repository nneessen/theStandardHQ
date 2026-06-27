// src/features/social-studio/previewModel.ts
// Pure, unit-testable core of the Social Studio preview: (1) the sample/live state
// machine, (2) the period-label builder, and (3) the PreviewData assembler. Kept
// out of the component so each rule is testable in isolation and the confirmed
// bugs (zero-producer crash, empty-card export, fabricated-sample leakage,
// label/data timezone disagreement) have regression tests with no React in the way.

import { toLastInitial, usd, copyForVariant } from "@/features/social-cards";
import {
  getMonthStartString,
  getTodayString,
  getWeekStartString,
} from "@/lib/date";
import type {
  AowDesign,
  CardTheme,
  CardPageInfo,
  SocialAgentRow,
  SocialFormat,
} from "@/features/social-cards";
import type { PreviewData } from "./components/SocialPreview";
import type { SocialStudioConfig, SocialView } from "./types";

// The shared theme maps onto the AOTW card's bespoke layout keys (its three layouts
// already match each theme's character: dark Spotlight = aurora, b/w Editorial =
// editorial, light Lift = noir). Leaderboard/report consume the theme directly.
const AOW_DESIGN_FOR_THEME: Record<CardTheme, AowDesign> = {
  spotlight: "aurora",
  editorial: "editorial",
  lift: "noir",
};
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
  // newagent: "producers" here means FEATURED agents (the page feeds featuredAgents.length
  // as the count) — one selected agent is enough to render a real welcome card.
  newagent: 1,
  // recruiting: data-free templates — never sampled (the page forces isSample=false).
  recruiting: 1,
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
// The printed label must never contradict the data it stamps, so it mirrors
// leaderboardService.calculateDateRange EXACTLY by deriving every boundary from the SAME
// canonical LOCAL-date helpers (src/lib/date). `now` is injectable for deterministic tests.
function fmtYmd(ymdStr: string, opts: Intl.DateTimeFormatOptions): string {
  // The y-m-d string is already the intended LOCAL calendar day; parse it as UTC midnight and
  // format in UTC so re-formatting can't shift it back across a local offset.
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
  // Same canonical local-date windows as calculateDateRange (daily / weekly / mtd).
  const today = getTodayString(now);
  const weekStartYmd = getWeekStartString(now);
  const monthStartYmd = getMonthStartString(now);

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

/** A featured new-agent welcome card (newagent view). The `photoUrl` is ALREADY
 *  resolved to a CORS-safe data URL (or null) by the page before it reaches here, so
 *  the PNG export embeds it — this module never fetches. `name` is pre-formatted
 *  (e.g. last-initial). */
export interface NewAgentCardInput {
  name: string;
  photoUrl: string | null;
}

export interface BuildPreviewArgs {
  config: SocialStudioConfig;
  producers: ProducerRow[];
  isSample: boolean;
  labels: PeriodLabels;
  /** Featured agents for the `newagent` view (one welcome card each). Omitted/empty
   *  for every other view. */
  newAgents?: NewAgentCardInput[];
}

// Placeholder welcome card shown when the newagent view has no featured agent yet (so
// the layout is never empty). `isSample` gates posting/downloading it, exactly like the
// fabricated leaderboard sample — a fake "Welcome, Jordan A." can never reach Instagram.
const SAMPLE_NEWAGENT: NewAgentCardInput = {
  name: "Jordan A.",
  photoUrl: null,
};

// Rows per leaderboard / roster-continuation page, per format. Pinned so a FULL
// page's last row sits fully inside the 1080×H frame — overflow:hidden hides a clip,
// so these are verified by rendering, not guessed (see scripts/social-studio-export-render).
const ROWS_PER_PAGE: Record<SocialFormat, number> = {
  portrait: 10,
  square: 7,
  // 15 clipped the last row (overflow:hidden hides it from the dims check) — 14 is the
  // verified max that keeps the bottom row fully inside the 1080×1920 frame.
  story: 14,
};

// Producers listed on the monthly RECAP page (page 1). It also carries the hero
// total, stat band, and Agent of the Month, so it holds fewer rows than a pure
// roster page; the remainder spills to roster-continuation pages.
const MONTHLY_PAGE1_ROWS: Record<SocialFormat, number> = {
  portrait: 5,
  square: 4,
  story: 8,
};

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** The selected slice of a roster: a number caps to the top-N, "all" keeps the whole
 *  agency. */
function selectN<T>(items: T[], topN: number | "all"): T[] {
  return topN === "all" ? items : items.slice(0, Math.max(1, topN));
}

/**
 * Build the carousel of PreviewData "slides" for the current config + roster. One
 * card always; more when the selected roster (Top-N / "all") spills past a single
 * page at the current format.
 *
 *   • aotw      → one hero slide, never paginated.
 *   • monthly   → slide 1 = recap (hero/stats/AOTM) + top producers; slides 2+ =
 *                 roster continuation rendered as leaderboard cards.
 *   • daily/wk  → slides = the ranked roster chunked into pages.
 *
 * Every slide carries the SAME agency total AP and a `page` stamp ("PAGE X / N") when
 * there's more than one. Ranks are absolute and contiguous across the page boundary —
 * the lead slide's title reflects the user's SELECTED Top-N (e.g. "TOP 20 AGENTS"), not
 * the per-page slice OR the (possibly smaller) rendered row count.
 */
export function buildPreviewPages({
  config,
  producers,
  isSample,
  labels,
  newAgents,
}: BuildPreviewArgs): PreviewData[] {
  // Defense-in-depth: only take the live path when sample is off AND we actually have
  // producers (every producers[0] access stays crash-proof regardless of isSample).
  const useLive = !isSample && producers.length > 0;
  const { dateLabel, monthLabel, weekRange } = labels;
  const format = config.format;
  const theme = config.cardTheme;
  const perPage = ROWS_PER_PAGE[format];
  // Editable text-label overrides per data card (namespaced by card kind).
  const leaderboardCopy = copyForVariant(config.templateCopy, "leaderboard");
  const reportCopy = copyForVariant(config.templateCopy, "monthly");
  const aotwCopy = copyForVariant(config.templateCopy, "aotw");

  const leaderboardPage = (
    rows: SocialAgentRow[],
    totalAp: number,
    periodLabel: string,
    title: string | undefined,
    page: CardPageInfo | undefined,
  ): PreviewData => ({
    kind: "leaderboard",
    rows,
    totalAp,
    periodLabel,
    title,
    theme,
    copy: leaderboardCopy,
    page,
  });

  // ── AOTW: single hero, never paginated ──
  if (config.view === "aotw") {
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
    return [
      {
        kind: "aotw",
        periodLabel: `WEEK OF ${weekRange}`,
        design: AOW_DESIGN_FOR_THEME[theme],
        theme,
        copy: aotwCopy,
        agent,
        photoPosition: config.aowPhotoPosition,
        style: {
          fontDisplay: config.aowFontDisplay,
          background: config.aowBackground,
          backgroundImageUrl: config.aowBgImageUrl,
          titleScale: config.aowTitleScale,
          agencyScale: config.aowAgencyScale,
        },
      },
    ];
  }

  // ── NEW AGENTS: one welcome card per featured agent (own sample logic) ──
  // Independent of leaderboard `producers`: the "data" is the selected agent + their
  // real photo (already resolved to a data URL by the page), so sample is decided by
  // whether any agent is featured — NOT by whether the agency has ranked producers.
  if (config.view === "newagent") {
    const featured = newAgents ?? [];
    const live = !isSample && featured.length > 0;
    const list = live ? featured : [SAMPLE_NEWAGENT];
    const total = list.length;
    const welcomeCopy = copyForVariant(
      config.templateCopy,
      config.welcomeVariant,
    );
    return list.map((a, i) => ({
      kind: "newagent",
      agent: { name: a.name, photoUrl: a.photoUrl ?? null },
      variant: config.welcomeVariant,
      copy: welcomeCopy,
      theme,
      page: total > 1 ? { index: i + 1, total } : undefined,
    }));
  }

  // ── RECRUITING: a single data-free campaign template (the picked variant) ──
  if (config.view === "recruiting") {
    return [
      {
        kind: "recruiting",
        variant: config.recruitingVariant,
        copy: copyForVariant(config.templateCopy, config.recruitingVariant),
        theme,
      },
    ];
  }

  // ── MONTHLY: recap page + roster-continuation pages ──
  if (config.view === "monthly") {
    if (!useLive) {
      return [
        {
          kind: "report",
          monthLabel,
          theme,
          copy: reportCopy,
          ...SAMPLE_MONTHLY,
        },
      ];
    }
    const totalAp = producers.reduce((s, e) => s + e.apTotal, 0);
    const totalPol = producers.reduce((s, e) => s + policyCountFor(e), 0);
    const agents = producers.length;
    const avg = agents ? Math.round(totalAp / agents) : 0;
    const tp = producers[0];
    const rows: SocialAgentRow[] = selectN(producers, config.topN).map(
      (e, i) => ({
        rank: i + 1,
        name: toLastInitial(e.agentName),
        agency: null,
        ap: e.apTotal,
        policies: policyCountFor(e),
      }),
    );
    const recapRows = rows.slice(0, MONTHLY_PAGE1_ROWS[format]);
    const cont = chunk(rows.slice(MONTHLY_PAGE1_ROWS[format]), perPage);
    const total = 1 + cont.length;
    const periodLabel = `MONTHLY · ${monthLabel}`;
    const pages: PreviewData[] = [
      {
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
        top: recapRows.map((r) => ({ rank: r.rank, name: r.name, ap: r.ap })),
        theme,
        copy: reportCopy,
        page: total > 1 ? { index: 1, total } : undefined,
      },
    ];
    cont.forEach((slice, i) =>
      pages.push(
        leaderboardPage(
          slice,
          totalAp,
          periodLabel,
          `RANKS ${slice[0].rank}–${slice[slice.length - 1].rank}`,
          { index: i + 2, total },
        ),
      ),
    );
    return pages;
  }

  // ── DAILY / WEEKLY leaderboard: ranked roster chunked into pages ──
  const periodLabel =
    config.view === "weekly" ? `WEEKLY · ${weekRange}` : `DAILY · ${dateLabel}`;
  const rows: SocialAgentRow[] = useLive
    ? selectN(producers, config.topN).map((e, i) => ({
        rank: i + 1,
        name: toLastInitial(e.agentName),
        agency: null,
        ap: e.apTotal,
        policies: policyCountFor(e),
      }))
    : selectN(
        config.view === "weekly" ? SAMPLE_WEEKLY : SAMPLE_DAILY,
        config.topN,
      );
  const totalAp = useLive
    ? producers.reduce((s, e) => s + e.apTotal, 0)
    : config.view === "weekly"
      ? SAMPLE_TOTAL_WEEKLY
      : SAMPLE_TOTAL_DAILY;

  const chunks = chunk(rows, perPage);
  const total = Math.max(1, chunks.length);
  // Lead title reflects the user's SELECTED Top-N (config.topN), NOT the rendered row
  // count — so changing 5 → 10 → 20 always changes the heading even when the agency has
  // fewer producers than N (rows.length would plateau and read as "static"). "all" has
  // no number, so it reads as the whole-agency leaderboard. An explicit headline wins.
  // An explicit, non-blank headline wins; a blank/whitespace title (e.g. from a legacy
  // saved template) must NOT defeat the fallback and render an empty heading.
  const customTitle = config.title?.trim() ? config.title : undefined;
  const firstTitle =
    customTitle ??
    (config.topN === "all"
      ? "AGENCY LEADERBOARD"
      : `TOP ${config.topN} AGENTS`);
  return chunks.map((slice, i) =>
    leaderboardPage(
      slice,
      totalAp,
      periodLabel,
      i === 0
        ? firstTitle
        : `RANKS ${slice[0].rank}–${slice[slice.length - 1].rank}`,
      total > 1 ? { index: i + 1, total } : undefined,
    ),
  );
}

/** Single-card preview = page 1 of the carousel. Kept for callers (and tests) that
 *  only need the lead slide. */
export function buildPreviewData(args: BuildPreviewArgs): PreviewData {
  return buildPreviewPages(args)[0];
}
