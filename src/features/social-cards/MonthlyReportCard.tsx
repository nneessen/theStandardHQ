// src/features/leaderboard/social/MonthlyReportCard.tsx
// Monthly AGENCY RECAP — a richer "report" graphic (deliberately not a plain
// leaderboard). Hero total AP + growth, key stats, Agent of the Month spotlight,
// and a compact top-5. Built from the real board primitives so it matches the app
// and is theme-reactive (render inside `.theme-v2[.dark]`).

import { Board, Cap, Num, T } from "@/components/board";
import { usd, initials, FORMAT_DIMS, type SocialFormat } from "./socialFormat";

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
  /** Small stats shown in the band (policies, agents, avg, etc.). */
  stats: ReportStat[];
  topPerformer: { name: string; ap: number; policies: number };
  /** Compact top-5 (rank, name, ap). */
  top: { rank: number; name: string; ap: number }[];
  /** e.g. "+18% vs MAY". Rendered as a green badge when present. */
  growthLabel?: string;
  /** 4:5 portrait (default) / 1:1 square / 9:16 story-reel. See FORMAT_DIMS. */
  format?: SocialFormat;
}

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
}: MonthlyReportCardProps) {
  // `isStory` still governs the type SCALE (9:16 gets larger type); portrait & square
  // share the compact scale and differ only in HEIGHT.
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 72 : 56;

  const sz = {
    eyebrow: isStory ? 17 : 14,
    title: isStory ? 80 : 56,
    sub: isStory ? 19 : 15,
    hero: isStory ? 108 : 78,
    stat: isStory ? 40 : 30,
    statCap: isStory ? 14 : 11,
    name: isStory ? 34 : 26,
    aotmAp: isStory ? 46 : 34,
    rowName: isStory ? 26 : 20,
    rowAp: isStory ? 30 : 23,
  };

  return (
    <div
      style={{
        width: W,
        height: H,
        background: T.bg,
        backgroundImage:
          "radial-gradient(120% 70% at 50% -10%, rgba(244,180,58,0.10), transparent 60%)",
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: T.data,
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

      {/* Title */}
      <div style={{ marginTop: isStory ? 26 : 14 }}>
        <div
          style={{
            font: `800 ${sz.title}px ${T.disp}`,
            color: T.ink,
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
          }}
        >
          MONTHLY REPORT
        </div>
        <div
          style={{
            marginTop: isStory ? 12 : 8,
            font: `700 ${sz.sub}px ${T.mono}`,
            letterSpacing: "0.16em",
            color: T.amber,
            textTransform: "uppercase",
          }}
        >
          AGENCY RECAP&nbsp;&nbsp;·&nbsp;&nbsp;{monthLabel}
        </div>
      </div>

      {/* Hero total AP */}
      <Board
        pad={isStory ? 34 : 26}
        style={{
          marginTop: isStory ? 34 : 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Cap style={{ fontSize: sz.eyebrow, color: T.mut }}>
            TOTAL ANNUAL PREMIUM
          </Cap>
          <div style={{ marginTop: isStory ? 10 : 6 }}>
            <Num
              text={usd(totalAp)}
              color={T.ink}
              lit
              style={{ fontSize: sz.hero }}
            />
          </div>
        </div>
        {growthLabel ? (
          <div
            style={{
              alignSelf: "flex-end",
              padding: isStory ? "10px 18px" : "7px 13px",
              borderRadius: 999,
              background: "rgba(95,208,138,0.14)",
              border: `1px solid ${T.green}`,
              font: `700 ${isStory ? 22 : 17}px ${T.data}`,
              color: T.green,
              whiteSpace: "nowrap",
            }}
          >
            ▲ {growthLabel}
          </div>
        ) : null}
      </Board>

      {/* Stats band */}
      <div
        style={{
          marginTop: isStory ? 22 : 14,
          display: "grid",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: isStory ? 22 : 14,
        }}
      >
        {stats.map((s) => (
          <Board key={s.label} pad={isStory ? 24 : 18}>
            <Cap style={{ fontSize: sz.statCap, color: T.mut }}>{s.label}</Cap>
            <div style={{ marginTop: isStory ? 8 : 5 }}>
              <Num text={s.value} color={T.ink} style={{ fontSize: sz.stat }} />
            </div>
          </Board>
        ))}
      </div>

      {/* Agent of the Month */}
      <Board
        pad={isStory ? 30 : 22}
        style={{
          marginTop: isStory ? 22 : 14,
          display: "flex",
          alignItems: "center",
          gap: isStory ? 24 : 18,
          background:
            "linear-gradient(100deg, rgba(244,180,58,0.12), rgba(244,180,58,0.02))",
          border: `1px solid ${T.amber}`,
        }}
      >
        <div
          style={{
            width: isStory ? 96 : 72,
            height: isStory ? 96 : 72,
            flex: "none",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `800 ${isStory ? 34 : 26}px ${T.disp}`,
            background: "linear-gradient(135deg, #f6c64a, #d9921f)",
            color: "#3a2a06",
          }}
        >
          {initials(topPerformer.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Cap style={{ fontSize: sz.eyebrow, color: T.amber }}>
            AGENT OF THE MONTH
          </Cap>
          <div
            style={{
              marginTop: 4,
              font: `800 ${sz.name}px ${T.data}`,
              color: T.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {topPerformer.name}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <Num
            text={usd(topPerformer.ap)}
            color={T.amber}
            style={{ fontSize: sz.aotmAp }}
          />
          <div
            style={{
              font: `400 ${sz.statCap}px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.1em",
              marginTop: 2,
            }}
          >
            {topPerformer.policies} POLICIES
          </div>
        </div>
      </Board>

      {/* Top 5 — the rows distribute across the remaining height (space-between) so
          the taller portrait / story canvases fill evenly instead of leaving a void. */}
      <div
        style={{
          marginTop: isStory ? 22 : 14,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Cap
          style={{
            fontSize: sz.statCap,
            color: T.mut,
            marginBottom: isStory ? 10 : 6,
          }}
        >
          TOP PRODUCERS
        </Cap>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {top.map((r) => (
            <div
              key={r.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isStory ? 18 : 12,
                padding: `${isStory ? 9 : 6}px 4px`,
                borderBottom: `1px solid ${T.line}`,
              }}
            >
              <div
                style={{
                  width: isStory ? 34 : 26,
                  font: `800 ${sz.rowName}px ${T.disp}`,
                  color: r.rank <= 3 ? T.amber : T.mut,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.rank}
              </div>
              <div
                style={{
                  flex: 1,
                  font: `700 ${sz.rowName}px ${T.data}`,
                  color: r.rank <= 3 ? T.ink : T.mut,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </div>
              <Num
                text={usd(r.ap)}
                color={r.rank <= 3 ? T.amber : T.mut}
                style={{ fontSize: sz.rowAp }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
