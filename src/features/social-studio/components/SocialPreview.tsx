// src/features/social-studio/components/SocialPreview.tsx
// Live, client-side preview of the social card — pixel-exact because it mounts
// the SAME components the app uses. Scaled to fit the pane; the forwarded ref
// points at the UNSCALED card so the PNG export captures it at full 1080px.

import type { RefObject } from "react";
import {
  LeaderboardSocialCard,
  MonthlyReportCard,
  AgentOfWeekCard,
  FORMAT_DIMS,
  type SocialAgentRow,
  type MonthlyReportCardProps,
  type AgentOfWeekCardProps,
  type AowDesign,
  type AowStyle,
} from "@/features/social-cards";
import type { SocialFormat, SocialTheme } from "../types";

export type PreviewData =
  | {
      kind: "leaderboard";
      rows: SocialAgentRow[];
      totalAp: number;
      periodLabel: string;
      title?: string;
    }
  | {
      kind: "aotw";
      periodLabel: string;
      design: AowDesign;
      agent: AgentOfWeekCardProps["agent"];
      style?: AowStyle;
    }
  | ({ kind: "report"; monthLabel: string } & Pick<
      MonthlyReportCardProps,
      "totalAp" | "stats" | "topPerformer" | "top" | "growthLabel"
    >);

interface SocialPreviewProps {
  data: PreviewData;
  format: SocialFormat;
  theme: SocialTheme;
  agencyName: string;
  network?: string;
  isSample: boolean;
  isLoading: boolean;
  showPolicies: boolean;
  /** Points at the unscaled card wrapper for full-res PNG export. */
  cardRef: RefObject<HTMLDivElement | null>;
}

/**
 * The single kind→component mapping for a PreviewData. Shared by the live preview
 * and the library thumbnails so a new card variant only has to be wired once (a
 * missing branch is a compile error via the exhaustive `never`, not a silent
 * fall-through to the leaderboard card).
 */
export function SocialCardSwitch({
  data,
  format,
  agencyName,
  network,
  showPolicies = true,
}: {
  data: PreviewData;
  format: SocialFormat;
  agencyName: string;
  network?: string;
  showPolicies?: boolean;
}) {
  switch (data.kind) {
    case "leaderboard":
      return (
        <LeaderboardSocialCard
          agencyName={agencyName}
          network={network}
          periodLabel={data.periodLabel}
          rows={data.rows}
          totalAp={data.totalAp}
          format={format}
          title={data.title}
          showPolicies={showPolicies}
        />
      );
    case "aotw":
      return (
        <AgentOfWeekCard
          agencyName={agencyName}
          network={network}
          periodLabel={data.periodLabel}
          agent={data.agent}
          format={format}
          design={data.design}
          style={data.style}
        />
      );
    case "report":
      return (
        <MonthlyReportCard
          agencyName={agencyName}
          network={network}
          monthLabel={data.monthLabel}
          totalAp={data.totalAp}
          stats={data.stats}
          topPerformer={data.topPerformer}
          top={data.top}
          growthLabel={data.growthLabel}
          format={format}
        />
      );
    default: {
      const _exhaustive: never = data;
      return _exhaustive;
    }
  }
}

// Fit the card within BOTH a max width and a max height so a 9:16 Story never
// overflows the viewport. Scale is whichever bound is tighter.
const MAX_W = 540;
const MAX_H = 560;

export function SocialPreview({
  data,
  format,
  theme,
  agencyName,
  network,
  isSample,
  isLoading,
  showPolicies,
  cardRef,
}: SocialPreviewProps) {
  const { w: naturalW, h: naturalH } = FORMAT_DIMS[format];
  const scale = Math.min(MAX_W / naturalW, MAX_H / naturalH);
  const dispW = Math.round(naturalW * scale);
  const dispH = Math.round(naturalH * scale);
  const themeClass = theme === "dark" ? "theme-v2 dark" : "theme-v2";

  return (
    <div
      data-testid="social-preview"
      className="relative rounded-xl border border-border bg-card/40 p-4 flex flex-col items-center"
      style={{ minHeight: 220 }}
    >
      {isSample && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-warning px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warning-foreground shadow">
          Sample preview · no live data yet
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-lg"
        style={{ width: dispW, height: dispH }}
        aria-busy={isLoading}
      >
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Unscaled card — captured by the PNG export at full resolution. Width
              comes from FORMAT_DIMS (single source of truth), never a literal. */}
          <div ref={cardRef} className={themeClass} style={{ width: naturalW }}>
            <SocialCardSwitch
              data={data}
              format={format}
              agencyName={agencyName}
              network={network}
              showPolicies={showPolicies}
            />
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 text-xs text-muted-foreground">
            Loading live data…
          </div>
        )}
      </div>
    </div>
  );
}
