// src/features/social-studio/components/SocialPreview.tsx
// Live, client-side preview of the social card — pixel-exact because it mounts
// the SAME components the app uses. Scaled to fit the pane; the forwarded ref
// points at the UNSCALED card so the PNG export captures it at full 1080px.

import { useRef, useState, type RefObject } from "react";
import {
  LeaderboardSocialCard,
  MonthlyReportCard,
  AgentOfWeekCard,
  FORMAT_DIMS,
  cardThemeWrapperClass,
  type SocialAgentRow,
  type MonthlyReportCardProps,
  type AgentOfWeekCardProps,
  type AowDesign,
  type AowStyle,
  type CardTheme,
} from "@/features/social-cards";
import type { SocialFormat } from "../types";

export type PreviewData =
  | {
      kind: "leaderboard";
      rows: SocialAgentRow[];
      totalAp: number;
      periodLabel: string;
      title?: string;
      theme: CardTheme;
    }
  | {
      kind: "aotw";
      periodLabel: string;
      design: AowDesign;
      theme: CardTheme;
      agent: AgentOfWeekCardProps["agent"];
      photoPosition?: string;
      style?: AowStyle;
    }
  | ({ kind: "report"; monthLabel: string; theme: CardTheme } & Pick<
      MonthlyReportCardProps,
      "totalAp" | "stats" | "topPerformer" | "top" | "growthLabel"
    >);

interface SocialPreviewProps {
  data: PreviewData;
  format: SocialFormat;
  agencyName: string;
  network?: string;
  isSample: boolean;
  isLoading: boolean;
  showPolicies: boolean;
  /** Points at the unscaled card wrapper for full-res PNG export. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** AOTW only: enable drag-to-reposition of the agent photo (face → frame). */
  repositionable?: boolean;
  /** Current photo focal point ("x% y%"). */
  photoPosition?: string;
  /** Called with the new "x% y%" as the user drags the photo. */
  onPhotoPositionChange?: (pos: string) => void;
}

function parsePos(p?: string): [number, number] {
  const m = (p || "50% 50%").match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
}
const clampPct = (n: number) => Math.max(0, Math.min(100, n));

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
          theme={data.theme}
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
          photoPosition={data.photoPosition}
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
          theme={data.theme}
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
  agencyName,
  network,
  isSample,
  isLoading,
  showPolicies,
  cardRef,
  repositionable = false,
  photoPosition,
  onPhotoPositionChange,
}: SocialPreviewProps) {
  const { w: naturalW, h: naturalH } = FORMAT_DIMS[format];
  const scale = Math.min(MAX_W / naturalW, MAX_H / naturalH);
  const dispW = Math.round(naturalW * scale);
  const dispH = Math.round(naturalH * scale);

  // Drag-to-reposition the agent photo: pointer delta (in displayed px) shifts the
  // CSS object-position focal point. Grab-and-move feel → pointer right reveals the
  // image's left (object-position x decreases). The position is kept LOCAL during the
  // drag (only this subtree re-renders, not the whole studio page) and committed to
  // the config ONCE on release. Pointer-captured so it tracks cleanly.
  const drag = useRef<{
    sx: number;
    sy: number;
    bx: number;
    by: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<string | null>(null);

  // Compute the final focal point from the release event + the captured base, commit
  // it once, and clear the local override (batched, so no flicker). Shared by
  // pointerup AND pointercancel so an OS-cancelled drag never leaves state stuck.
  function endDrag(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    setDragPos(null);
    if (!d || !onPhotoPositionChange) return;
    const nx = clampPct(d.bx - ((e.clientX - d.sx) / dispW) * 100);
    const ny = clampPct(d.by - ((e.clientY - d.sy) / dispH) * 100);
    onPhotoPositionChange(`${Math.round(nx)}% ${Math.round(ny)}%`);
  }

  // The cards are self-contained (own palette); the wrapper mode is belt-and-suspenders
  // for any legacy theme-v2 consumer. Every PreviewData kind now carries `theme`.
  const themeClass = cardThemeWrapperClass(data.theme);
  // Show the in-progress drag focal point live without touching the studio config.
  const liveData =
    dragPos !== null && data.kind === "aotw"
      ? { ...data, photoPosition: dragPos }
      : data;

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
              data={liveData}
              format={format}
              agencyName={agencyName}
              network={network}
              showPolicies={showPolicies}
            />
          </div>
        </div>

        {repositionable && onPhotoPositionChange && (
          <div
            onPointerDown={(e) => {
              const [bx, by] = parsePos(dragPos ?? photoPosition);
              drag.current = { sx: e.clientX, sy: e.clientY, bx, by };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const nx = clampPct(d.bx - ((e.clientX - d.sx) / dispW) * 100);
              const ny = clampPct(d.by - ((e.clientY - d.sy) / dispH) * 100);
              setDragPos(`${Math.round(nx)}% ${Math.round(ny)}%`);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute inset-0 z-30"
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
            title="Drag to reposition the photo"
          >
            {!dragging && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-foreground/75 px-2.5 py-1 text-[10px] font-semibold text-background shadow">
                ⠿ Drag to reposition photo
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 text-xs text-muted-foreground">
            Loading live data…
          </div>
        )}
      </div>
    </div>
  );
}
