// src/features/social-cards/LeaderboardSocialCard.tsx
// Agency leaderboard as a social graphic, rendered in one of the shared brand THEMES
// (Spotlight / Editorial / Lift — see themes.ts). Self-contained: it carries its own
// theme palette + fonts (NOT the app theme-v2 tokens), so the in-browser PNG export is
// pixel-faithful. Pure/presentational — top-N rows passed in, already sorted by AP.

import { usd, FORMAT_DIMS, type SocialFormat } from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";

export interface SocialAgentRow {
  rank: number;
  name: string;
  agency?: string | null;
  ap: number;
  policies: number;
}

export interface LeaderboardSocialCardProps {
  agencyName: string;
  network?: string;
  /** e.g. "DAILY · JUN 20, 2026" or "WEEK OF JUN 14–20". */
  periodLabel: string;
  rows: SocialAgentRow[];
  totalAp: number;
  format?: SocialFormat;
  title?: string;
  showPolicies?: boolean;
  /** Brand theme (Spotlight / Editorial / Lift). Default Spotlight. */
  theme?: CardTheme;
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
  theme = "spotlight",
}: LeaderboardSocialCardProps) {
  const t = resolveCardTheme(theme);
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 72 : 56;

  const sz = {
    eyebrow: isStory ? 17 : 14,
    title: isStory ? 84 : 60,
    sub: isStory ? 17 : 14,
    name: isStory ? 30 : 23,
    agency: isStory ? 15 : 12,
    pol: isStory ? 16 : 13,
    rank: isStory ? 30 : 24,
    ap: isStory ? 38 : 30,
    footAp: isStory ? 52 : 40,
  };
  const rowGap = isStory ? 6 : 2;
  const heroTitle = title ?? `TOP ${rows.length} AGENTS`;

  // Past ~10 rows a single column gets cramped → two columns (compact rows).
  const twoCol = rows.length > 10;
  const half = Math.ceil(rows.length / 2);
  const colA = twoCol ? rows.slice(0, half) : rows;
  const colB = twoCol ? rows.slice(half) : [];

  const num = (text: string, color: string, size: number, weight = 700) => (
    <span
      style={{
        font: `${weight} ${size}px ${t.disp}`,
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
      }}
    >
      {text}
    </span>
  );

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
          borderBottom: `1px solid ${t.hairline}`,
          background: top3 ? t.rowTopTint : "transparent",
          borderRadius: t.sharp ? 0 : 8,
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
            font: `700 ${compact ? (isStory ? 20 : 16) : sz.rank}px ${t.disp}`,
            fontVariantNumeric: "tabular-nums",
            background: top3 ? t.rankTopBg : t.rankBg,
            color: top3 ? t.rankTopInk : t.rankInk,
            border: top3 ? "none" : `1px solid ${t.hairline}`,
          }}
        >
          {r.rank}
        </div>

        {/* Name + agency */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 ${compact ? (isStory ? 22 : 17) : sz.name}px ${t.sans}`,
              color: top3 ? t.topInk : t.ink,
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
                font: `500 ${sz.agency}px ${t.sans}`,
                color: t.inkSubtle,
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
            {num(String(r.policies), t.inkMuted, sz.pol + 5)}
            <div
              style={{
                font: `600 ${sz.pol - 2}px ${t.sans}`,
                color: t.inkSubtle,
                letterSpacing: "0.12em",
              }}
            >
              POL
            </div>
          </div>
        )}

        {/* AP — the hero number */}
        <div
          style={{
            width: compact ? (isStory ? 150 : 108) : isStory ? 200 : 160,
            textAlign: "right",
            flex: "none",
          }}
        >
          {num(
            usd(r.ap),
            top3 ? t.accentStrong : t.ink,
            compact ? (isStory ? 28 : 20) : sz.ap,
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: W,
        height: H,
        ...themePageBackground(t),
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: t.sans,
        color: t.ink,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: `800 ${sz.eyebrow + 6}px ${t.sans}`,
            color: t.ink,
            letterSpacing: "0.04em",
          }}
        >
          {agencyName}
        </span>
        {network ? (
          <span
            style={{
              font: `600 ${sz.eyebrow}px ${t.sans}`,
              color: t.inkSubtle,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {network}
          </span>
        ) : null}
      </div>
      <div
        style={{
          height: 1,
          background: t.ruleStrong,
          marginTop: 14,
          opacity: 0.7,
        }}
      />

      {/* Title block */}
      <div style={{ marginTop: isStory ? 26 : 16 }}>
        <div
          style={{
            font: `700 ${sz.title}px ${t.disp}`,
            color: t.ink,
            lineHeight: 0.96,
            letterSpacing: "0.005em",
          }}
        >
          {heroTitle}
        </div>
        <div
          style={{
            marginTop: isStory ? 14 : 9,
            font: `700 ${sz.sub}px ${t.sans}`,
            letterSpacing: "0.16em",
            color: t.accent,
            textTransform: "uppercase",
          }}
        >
          By Annual Premium&nbsp;&nbsp;·&nbsp;&nbsp;{periodLabel}
        </div>
      </div>

      {/* The ranked board */}
      <div
        style={{
          marginTop: isStory ? 34 : 22,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: t.panelBg,
          border: `1px solid ${t.panelBorder}`,
          borderRadius: t.panelRadius,
          boxShadow: t.panelShadow,
          padding: isStory ? 28 : 20,
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
      </div>

      {/* Footer total */}
      <div
        style={{
          marginTop: isStory ? 34 : 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              font: `600 ${sz.eyebrow}px ${t.sans}`,
              color: t.inkMuted,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Agency Total AP
          </div>
          <div style={{ marginTop: 6 }}>
            {num(usd(totalAp), t.ink, sz.footAp, 700)}
          </div>
        </div>
        <span
          style={{
            font: `600 ${sz.eyebrow}px ${t.sans}`,
            color: t.inkSubtle,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Top {rows.length}&nbsp;·&nbsp;{periodLabel.split("·")[0].trim()}
        </span>
      </div>
    </div>
  );
}
