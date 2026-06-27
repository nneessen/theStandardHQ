// src/features/social-cards/LeaderboardSocialCard.tsx
// Agency leaderboard as a social graphic, rendered in one of the shared brand THEMES
// (Spotlight / Editorial / Lift — see themes.ts). Self-contained: it carries its own
// theme palette + fonts (NOT the app theme-v2 tokens), so the in-browser PNG export is
// pixel-faithful. Pure/presentational — a single PAGE of ranked rows passed in, already
// sorted by AP with ABSOLUTE ranks. Multi-page rosters are paginated upstream
// (buildPreviewPages) into one card per page; `page` stamps "PAGE X / N".

import {
  usd,
  FORMAT_DIMS,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";
import { copyText, type CopyField, type CopyMap } from "./templateCopy";

// ── Editable text labels (rows, AP totals, ranks, period all stay dynamic). ──
export const LEADERBOARD_COPY: CopyField[] = [
  { key: "policiesLabel", label: "Policies column", default: "POL" },
  {
    key: "byAnnualPremiumLabel",
    label: "Subheading prefix",
    default: "By Annual Premium",
  },
  {
    key: "footerTotalLabel",
    label: "Footer total label",
    default: "Agency Total AP",
  },
];

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
  /** Carousel position when the roster spans multiple cards. */
  page?: CardPageInfo;
  /** Per-field text overrides (keyed by LEADERBOARD_COPY keys); blank → the default. */
  copy?: CopyMap;
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
  page,
  copy,
}: LeaderboardSocialCardProps) {
  const t = resolveCardTheme(theme);
  const lbl = (key: string, dflt: string) => copyText(copy, key, dflt);
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 72 : 56;

  // Phone-readable sizes for a 1080-wide canvas — the prior scale (name 23) was
  // unreadable as a feed thumbnail. Names dominate; AP is the hero number.
  const sz = {
    eyebrow: isStory ? 22 : 18,
    title: isStory ? 90 : 66,
    sub: isStory ? 20 : 16,
    name: isStory ? 50 : 42,
    agency: isStory ? 22 : 18,
    pol: isStory ? 26 : 22,
    rank: isStory ? 42 : 34,
    ap: isStory ? 56 : 46,
    footAp: isStory ? 64 : 54,
  };
  const heroTitle = title ?? `TOP ${rows.length} AGENTS`;
  const paginated = !!page && page.total > 1;
  const badge = isStory ? 62 : 50;
  const apW = isStory ? 280 : 230;

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

  const renderRow = (r: SocialAgentRow) => {
    const top3 = r.rank <= 3;
    // 3-digit ranks (100+ producers) would overflow the circle — shrink the digits.
    const rankPx = r.rank >= 100 ? Math.round(sz.rank * 0.66) : sz.rank;
    return (
      <div
        key={r.rank}
        style={{
          display: "flex",
          alignItems: "center",
          gap: isStory ? 22 : 16,
          padding: `${isStory ? 15 : 11}px ${isStory ? 14 : 8}px`,
          borderBottom: `1px solid ${t.hairline}`,
          background: top3 ? t.rowTopTint : "transparent",
          borderRadius: t.sharp ? 0 : 8,
        }}
      >
        {/* Rank badge — a NUMBER, not initials */}
        <div
          style={{
            width: badge,
            height: badge,
            flex: "none",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `700 ${rankPx}px ${t.disp}`,
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
              font: `700 ${sz.name}px ${t.sans}`,
              color: top3 ? t.topInk : t.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.name}
          </div>
          {r.agency ? (
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

        {/* Policies */}
        {showPolicies && (
          <div
            style={{
              textAlign: "right",
              flex: "none",
              marginRight: isStory ? 12 : 8,
            }}
          >
            {num(String(r.policies), t.inkMuted, sz.pol + 6)}
            <div
              style={{
                font: `600 ${sz.pol - 6}px ${t.sans}`,
                color: t.inkSubtle,
                letterSpacing: "0.12em",
              }}
            >
              {lbl("policiesLabel", "POL")}
            </div>
          </div>
        )}

        {/* AP — the hero number */}
        <div style={{ width: apW, textAlign: "right", flex: "none" }}>
          {num(usd(r.ap), top3 ? t.accentStrong : t.ink, sz.ap)}
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
          {lbl("byAnnualPremiumLabel", "By Annual Premium")}
          &nbsp;&nbsp;·&nbsp;&nbsp;{periodLabel}
        </div>
      </div>

      {/* The ranked board — single column, TOP-ALIGNED so a partial final page keeps the
          same row size as a full one (no space-between stretch). */}
      <div
        style={{
          marginTop: isStory ? 30 : 20,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          background: t.panelBg,
          border: `1px solid ${t.panelBorder}`,
          borderRadius: t.panelRadius,
          boxShadow: t.panelShadow,
          padding: isStory ? 24 : 16,
          overflow: "hidden",
        }}
      >
        {rows.map((r) => renderRow(r))}
      </div>

      {/* Footer total + carousel page stamp */}
      <div
        style={{
          marginTop: isStory ? 30 : 18,
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
            {lbl("footerTotalLabel", "Agency Total AP")}
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
          {paginated
            ? `Page ${page.index} / ${page.total}`
            : periodLabel.split("·")[0].trim()}
        </span>
      </div>
    </div>
  );
}
