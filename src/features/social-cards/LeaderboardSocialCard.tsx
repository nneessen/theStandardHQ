// src/features/leaderboard/social/LeaderboardSocialCard.tsx
// "The Board" leaderboard rendered as a square/vertical social graphic.
// Built from the REAL board primitives (Board / Cap / Num / T tokens) so it
// matches the in-app Leaderboard exactly. Theme-reactive: render inside a
// `.dark .theme-v2` wrapper for the dark departure-board look, or `.theme-v2`
// for light — the T tokens resolve against the same CSS vars the app uses.
//
// Data is passed in (top-N agents already sorted by AP desc, agency-scoped).
// This component is pure/presentational — no data fetching — so it can be both
// rendered to PNG headlessly and dropped into the app later.

import { Board, Cap, Num, T } from "@/components/board";
import { usd, initials, FORMAT_DIMS, type SocialFormat } from "./socialFormat";

export interface SocialAgentRow {
  rank: number;
  name: string;
  agency?: string | null;
  ap: number;
  policies: number;
}

export interface LeaderboardSocialCardProps {
  /** Agency name shown in the eyebrow (this card is scoped to ONE agency). */
  agencyName: string;
  /** Upline network shown top-right (e.g. "EPIC LIFE"). Optional. */
  network?: string;
  /** e.g. "DAILY · JUN 20, 2026" or "WEEK OF JUN 14–20" or "JUNE 2026". */
  periodLabel: string;
  /** Top-N rows, already sorted by AP descending and ranked 1..N. */
  rows: SocialAgentRow[];
  /** Sum of AP across the agency for the period (the footer hero). */
  totalAp: number;
  /** 4:5 portrait (default) / 1:1 square feed post / 9:16 story-reel. See FORMAT_DIMS. */
  format?: SocialFormat;
  /** Headline; defaults to "TOP {n} AGENTS". */
  title?: string;
  /** Show the per-agent policy-count column. Default true. */
  showPolicies?: boolean;
}

export function LeaderboardSocialCard({
  agencyName,
  network,
  periodLabel,
  rows,
  totalAp,
  format = "portrait",
  title,
  showPolicies = true,
}: LeaderboardSocialCardProps) {
  // `isStory` still governs the type SCALE (the tall 9:16 canvas gets larger type);
  // portrait & square share the compact scale and differ only in HEIGHT.
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 72 : 56;

  // Type scale shifts up for the taller story canvas.
  const sz = {
    eyebrow: isStory ? 17 : 14,
    title: isStory ? 76 : 54,
    sub: isStory ? 18 : 15,
    name: isStory ? 30 : 23,
    agency: isStory ? 15 : 12,
    ap: isStory ? 38 : 30,
    pol: isStory ? 16 : 13,
    rank: isStory ? 30 : 24,
    footAp: isStory ? 48 : 38,
  };
  const rowGap = isStory ? 6 : 2;

  const heroTitle = title ?? `TOP ${rows.length} AGENTS`;

  // Past ~10 rows a single column gets cramped; split into two columns so a
  // Top 20 fits without shrinking everything. Compact rows drop the avatar +
  // policy column to stay readable at half width.
  const twoCol = rows.length > 10;
  const half = Math.ceil(rows.length / 2);
  const colA = twoCol ? rows.slice(0, half) : rows;
  const colB = twoCol ? rows.slice(half) : [];

  const renderRow = (r: SocialAgentRow, compact: boolean) => {
    const top3 = r.rank <= 3;
    const badge = compact ? (isStory ? 42 : 34) : isStory ? 56 : 44;
    return (
      <div
        key={r.rank}
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? (isStory ? 14 : 10) : isStory ? 22 : 16,
          padding: `${(compact ? 2 : rowGap) + (isStory ? 8 : 5)}px ${isStory ? 14 : 8}px`,
          borderBottom: `1px solid ${T.line}`,
          background: top3 ? "rgba(244,180,58,0.08)" : "transparent",
          borderRadius: 8,
        }}
      >
        {/* Rank */}
        <div
          style={{
            width: badge,
            height: badge,
            flex: "none",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `800 ${compact ? (isStory ? 20 : 16) : sz.rank}px ${T.disp}`,
            fontVariantNumeric: "tabular-nums",
            background: top3
              ? "linear-gradient(135deg, #f6c64a, #d9921f)"
              : "transparent",
            color: top3 ? "#3a2a06" : T.mut,
            border: top3 ? "none" : `1px solid ${T.line2}`,
          }}
        >
          {r.rank}
        </div>

        {/* Initials — single-column only (two-column has no room) */}
        {!compact && (
          <div
            style={{
              width: badge,
              height: badge,
              flex: "none",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `700 ${isStory ? 20 : 16}px ${T.data}`,
              // Theme-reactive (var) so the avatar fill stays visible in light
              // mode — a hardcoded white@6% vanished on the light canvas.
              background: T.surface4,
              border: `1px solid ${T.line2}`,
              color: T.ink,
            }}
          >
            {initials(r.name)}
          </div>
        )}

        {/* Name + agency */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 ${compact ? (isStory ? 22 : 17) : sz.name}px ${T.data}`,
              color: top3 ? T.amber : T.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.name}
          </div>
          {!compact && r.agency ? (
            <div
              style={{
                font: `400 ${sz.agency}px ${T.mono}`,
                color: T.mut2,
                letterSpacing: "0.04em",
                marginTop: 2,
              }}
            >
              {r.agency}
            </div>
          ) : null}
        </div>

        {/* Policies — single-column only */}
        {!compact && showPolicies && (
          <div
            style={{
              textAlign: "right",
              flex: "none",
              marginRight: isStory ? 10 : 6,
            }}
          >
            <div
              style={{ font: `700 ${sz.pol + 4}px ${T.data}`, color: T.mut }}
            >
              {r.policies}
            </div>
            <div
              style={{
                font: `400 ${sz.pol - 2}px ${T.mono}`,
                color: T.mut2,
                letterSpacing: "0.12em",
              }}
            >
              POL
            </div>
          </div>
        )}

        {/* AP — the hero */}
        <div
          style={{
            width: compact ? (isStory ? 150 : 108) : isStory ? 200 : 160,
            textAlign: "right",
            flex: "none",
          }}
        >
          <Num
            text={usd(r.ap)}
            color={T.amber}
            style={{ fontSize: compact ? (isStory ? 28 : 20) : sz.ap }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: W,
        height: H,
        background: T.bg,
        // Subtle vignette so the panel reads as "lit" on the board canvas.
        backgroundImage:
          "radial-gradient(120% 80% at 50% -10%, rgba(91,155,255,0.10), transparent 60%)",
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: T.data,
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Cap
          style={{
            fontSize: sz.eyebrow,
            color: T.ink,
            letterSpacing: "0.16em",
          }}
        >
          {agencyName}
        </Cap>
        {network ? (
          <Cap
            style={{
              fontSize: sz.eyebrow,
              color: T.mut2,
              letterSpacing: "0.22em",
            }}
          >
            {network}
          </Cap>
        ) : null}
      </div>

      {/* ── Title block ────────────────────────────────────── */}
      <div style={{ marginTop: isStory ? 28 : 16 }}>
        <div
          style={{
            font: `800 ${sz.title}px ${T.disp}`,
            color: T.ink,
            lineHeight: 1.02,
            letterSpacing: "-0.01em",
          }}
        >
          {heroTitle}
        </div>
        <div
          style={{
            marginTop: isStory ? 14 : 9,
            font: `700 ${sz.sub}px ${T.mono}`,
            letterSpacing: "0.16em",
            color: T.amber,
            textTransform: "uppercase",
          }}
        >
          BY ANNUAL PREMIUM&nbsp;&nbsp;·&nbsp;&nbsp;{periodLabel}
        </div>
      </div>

      {/* ── The ranked board ───────────────────────────────── */}
      <Board
        pad={isStory ? 28 : 20}
        style={{
          marginTop: isStory ? 36 : 22,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {twoCol ? (
          <div style={{ display: "flex", gap: isStory ? 32 : 20, flex: 1 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {colA.map((r) => renderRow(r, true))}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {colB.map((r) => renderRow(r, true))}
            </div>
          </div>
        ) : (
          rows.map((r) => renderRow(r, false))
        )}
      </Board>

      {/* ── Footer total ───────────────────────────────────── */}
      <div
        style={{
          marginTop: isStory ? 34 : 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Cap style={{ fontSize: sz.eyebrow, color: T.mut }}>
            AGENCY TOTAL AP
          </Cap>
          <div style={{ marginTop: 6 }}>
            <Num
              text={usd(totalAp)}
              color={T.ink}
              style={{ fontSize: sz.footAp }}
            />
          </div>
        </div>
        <Cap
          style={{
            fontSize: sz.eyebrow,
            color: T.mut2,
            letterSpacing: "0.16em",
          }}
        >
          TOP {rows.length}&nbsp;·&nbsp;{periodLabel.split("·")[0].trim()}
        </Cap>
      </div>
    </div>
  );
}
