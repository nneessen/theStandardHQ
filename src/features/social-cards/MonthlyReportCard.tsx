// src/features/social-cards/MonthlyReportCard.tsx
// Monthly agency RECAP as a social graphic, in one of the shared brand THEMES
// (Spotlight / Editorial / Lift — see themes.ts). Self-contained (own palette +
// fonts), so the in-browser PNG export is pixel-faithful. Hero total AP + growth,
// stat band, Agent of the Month, compact top-5.

import { usd, FORMAT_DIMS, type SocialFormat } from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";

export interface ReportStat {
  label: string;
  value: string;
}

export interface MonthlyReportCardProps {
  agencyName: string;
  network?: string;
  /** e.g. "JUNE 2026". */
  monthLabel: string;
  totalAp: number;
  stats: ReportStat[];
  topPerformer: { name: string; ap: number; policies: number };
  top: { rank: number; name: string; ap: number }[];
  /** e.g. "+18% vs MAY" → rendered as a green badge when present. */
  growthLabel?: string;
  format?: SocialFormat;
  /** Brand theme (Spotlight / Editorial / Lift). Default Spotlight. */
  theme?: CardTheme;
}

// Growth = positive trend → the brand success green (--success in index.css),
// constant across themes (a status color, not part of the theme palette).
const SUCCESS = "#10b981";
const SUCCESS_SOFT = "rgba(16,185,129,0.14)";

export function MonthlyReportCard({
  agencyName,
  network,
  monthLabel,
  totalAp,
  stats,
  topPerformer,
  top,
  growthLabel,
  format = "portrait",
  theme = "spotlight",
}: MonthlyReportCardProps) {
  const t = resolveCardTheme(theme);
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 72 : 56;

  const sz = {
    eyebrow: isStory ? 17 : 14,
    title: isStory ? 88 : 62,
    sub: isStory ? 18 : 14,
    hero: isStory ? 116 : 84,
    stat: isStory ? 40 : 30,
    statCap: isStory ? 14 : 11,
    name: isStory ? 34 : 26,
    aotmAp: isStory ? 46 : 34,
    rowName: isStory ? 26 : 20,
    rowAp: isStory ? 30 : 23,
  };

  const num = (text: string, color: string, size: number, glow = false) => (
    <span
      style={{
        font: `700 ${size}px ${t.disp}`,
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.005em",
        textShadow:
          glow && t.mode === "dark" ? "0 0 36px rgba(99,102,241,0.45)" : "none",
      }}
    >
      {text}
    </span>
  );

  const panel: React.CSSProperties = {
    background: t.panelBg,
    border: `1px solid ${t.panelBorder}`,
    borderRadius: t.panelRadius,
    boxShadow: t.panelShadow,
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

      {/* Title */}
      <div style={{ marginTop: isStory ? 24 : 14 }}>
        <div
          style={{
            font: `700 ${sz.title}px ${t.disp}`,
            color: t.ink,
            lineHeight: 0.96,
            letterSpacing: "0.005em",
          }}
        >
          MONTHLY REPORT
        </div>
        <div
          style={{
            marginTop: isStory ? 12 : 8,
            font: `700 ${sz.sub}px ${t.sans}`,
            letterSpacing: "0.16em",
            color: t.accent,
            textTransform: "uppercase",
          }}
        >
          Agency Recap&nbsp;&nbsp;·&nbsp;&nbsp;{monthLabel}
        </div>
      </div>

      {/* Hero total AP */}
      <div
        style={{
          ...panel,
          marginTop: isStory ? 30 : 20,
          padding: isStory ? 34 : 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              font: `600 ${sz.eyebrow}px ${t.sans}`,
              color: t.inkMuted,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Total Annual Premium
          </div>
          <div style={{ marginTop: isStory ? 10 : 6 }}>
            {num(usd(totalAp), t.ink, sz.hero, true)}
          </div>
        </div>
        {growthLabel ? (
          <div
            style={{
              alignSelf: "flex-end",
              padding: isStory ? "10px 18px" : "7px 13px",
              borderRadius: 999,
              background: SUCCESS_SOFT,
              border: `1px solid ${SUCCESS}`,
              font: `700 ${isStory ? 22 : 17}px ${t.sans}`,
              color: SUCCESS,
              whiteSpace: "nowrap",
            }}
          >
            ▲ {growthLabel}
          </div>
        ) : null}
      </div>

      {/* Stats band */}
      <div
        style={{
          marginTop: isStory ? 20 : 14,
          display: "grid",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: isStory ? 20 : 14,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ ...panel, padding: isStory ? 24 : 18 }}>
            <div
              style={{
                font: `600 ${sz.statCap}px ${t.sans}`,
                color: t.inkMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
            <div style={{ marginTop: isStory ? 8 : 5 }}>
              {num(s.value, t.ink, sz.stat)}
            </div>
          </div>
        ))}
      </div>

      {/* Agent of the Month — accent-tinted highlight band */}
      <div
        style={{
          marginTop: isStory ? 20 : 14,
          padding: isStory ? 30 : 22,
          display: "flex",
          alignItems: "center",
          gap: isStory ? 24 : 18,
          background: t.accentSoft,
          border: `1px solid ${t.accent}`,
          borderRadius: t.panelRadius,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 ${sz.eyebrow}px ${t.sans}`,
              color: t.accent,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Agent of the Month
          </div>
          <div
            style={{
              marginTop: 4,
              font: `800 ${sz.name}px ${t.sans}`,
              color: t.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {topPerformer.name}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          {num(usd(topPerformer.ap), t.accentStrong, sz.aotmAp)}
          <div
            style={{
              font: `500 ${sz.statCap}px ${t.sans}`,
              color: t.inkSubtle,
              letterSpacing: "0.1em",
              marginTop: 2,
            }}
          >
            {topPerformer.policies} POLICIES
          </div>
        </div>
      </div>

      {/* Top 5 — distributes across remaining height */}
      <div
        style={{
          marginTop: isStory ? 20 : 14,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            font: `600 ${sz.statCap}px ${t.sans}`,
            color: t.inkMuted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: isStory ? 10 : 6,
          }}
        >
          Top Producers
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {top.map((r) => {
            const top3 = r.rank <= 3;
            return (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isStory ? 18 : 12,
                  padding: `${isStory ? 9 : 6}px 4px`,
                  borderBottom: `1px solid ${t.hairline}`,
                }}
              >
                <div
                  style={{
                    width: isStory ? 34 : 26,
                    font: `700 ${sz.rowName}px ${t.disp}`,
                    color: top3 ? t.accentStrong : t.inkMuted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.rank}
                </div>
                <div
                  style={{
                    flex: 1,
                    font: `700 ${sz.rowName}px ${t.sans}`,
                    color: top3 ? t.ink : t.inkMuted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name}
                </div>
                {num(usd(r.ap), top3 ? t.accentStrong : t.inkMuted, sz.rowAp)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
