// src/features/social-studio/components/SocialPreview.tsx
// Live, client-side preview of the social card — pixel-exact because it mounts
// the SAME components the app uses. Scaled to fit the pane; the forwarded ref
// points at the UNSCALED card so the PNG export captures it at full 1080px.

import { useEffect, useRef, useState } from "react";
import {
  LeaderboardSocialCard,
  MonthlyReportCard,
  AgentOfWeekCard,
  MarketingCard,
  NewAgentCard,
  RecruitingCard,
  FORMAT_DIMS,
  cardThemeWrapperClass,
  type SocialAgentRow,
  type MonthlyReportCardProps,
  type AgentOfWeekCardProps,
  type AowDesign,
  type AowStyle,
  type CardTheme,
  type CardPageInfo,
  type MarketingVariant,
  type SlideListItem,
  type SlideCompare,
  type RecruitingVariant,
  type WelcomeVariant,
  type CopyMap,
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
      copy?: CopyMap;
      page?: CardPageInfo;
    }
  | {
      kind: "aotw";
      periodLabel: string;
      design: AowDesign;
      theme: CardTheme;
      agent: AgentOfWeekCardProps["agent"];
      photoPosition?: string;
      photoScale?: number;
      style?: AowStyle;
      copy?: CopyMap;
    }
  | ({
      kind: "report";
      monthLabel: string;
      theme: CardTheme;
      copy?: CopyMap;
      page?: CardPageInfo;
    } & Pick<
      MonthlyReportCardProps,
      "totalAp" | "stats" | "topPerformer" | "top" | "growthLabel"
    >)
  // Marketing slide for the carousel builder (#8) — non-data copy across a library of layout
  // archetypes (hook/list/checklist/stat/compare/quote/tip/cta/custom). One member with a
  // `variant`; which content fields apply depends on it.
  | {
      kind: "marketing";
      variant: MarketingVariant;
      theme: CardTheme;
      page?: CardPageInfo;
      eyebrow?: string;
      text?: string;
      attribution?: string;
      headline?: string;
      subheadline?: string;
      body?: string;
      items?: SlideListItem[];
      bullets?: string[];
      stat?: string;
      statLabel?: string;
      compare?: SlideCompare;
      ctaAction?: string;
      imageDataUrl?: string;
    }
  // "Welcome new agent" card — one agent + their profile photo. Used by the auto-generated
  // welcome-post approval queue (photo passed as a data: URL so the export embeds it).
  | {
      kind: "newagent";
      agent: { name: string; photoUrl?: string | null };
      /** Photo focal point ("x% y%") + zoom — drag/zoom in the preview. */
      photoPosition?: string;
      photoScale?: number;
      /** Which welcome design renders (own palette). */
      variant: WelcomeVariant;
      /** Per-field copy overrides for the welcome design. */
      copy?: CopyMap;
      theme: CardTheme;
      page?: CardPageInfo;
    }
  // Recruiting campaign template (The Standard / Epic Life pitch). Data-free — the
  // `variant` picks the design; its own palette (ignores `theme`, kept for the wrapper).
  // `copy` carries per-field wording overrides.
  | {
      kind: "recruiting";
      variant: RecruitingVariant;
      copy?: CopyMap;
      theme: CardTheme;
      page?: CardPageInfo;
    };

interface SocialPreviewProps {
  data: PreviewData;
  format: SocialFormat;
  agencyName: string;
  network?: string;
  isSample: boolean;
  isLoading: boolean;
  showPolicies: boolean;
  /** Enable drag-to-reposition + zoom of the agent photo (face → frame). Applies to any
   *  card with a photo (AOTW + new-agent welcome). */
  repositionable?: boolean;
  /** Current photo focal point ("x% y%"). */
  photoPosition?: string;
  /** Current photo zoom multiplier (1 = fit). */
  photoScale?: number;
  /** Called with the new "x% y%" as the user drags the photo. */
  onPhotoPositionChange?: (pos: string) => void;
  /** Called with the new zoom multiplier as the user moves the zoom slider. */
  onPhotoScaleChange?: (scale: number) => void;
}

/** Card kinds that carry a movable/zoomable photo. */
function hasPhotoTransform(
  d: PreviewData,
): d is Extract<PreviewData, { kind: "aotw" | "newagent" }> {
  return d.kind === "aotw" || d.kind === "newagent";
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

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
          copy={data.copy}
          page={data.page}
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
          photoScale={data.photoScale}
          style={data.style}
          copy={data.copy}
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
          copy={data.copy}
          page={data.page}
        />
      );
    case "marketing":
      return (
        <MarketingCard
          variant={data.variant}
          agencyName={agencyName}
          network={network}
          format={format}
          theme={data.theme}
          page={data.page}
          eyebrow={data.eyebrow}
          text={data.text}
          attribution={data.attribution}
          headline={data.headline}
          subheadline={data.subheadline}
          body={data.body}
          items={data.items}
          bullets={data.bullets}
          stat={data.stat}
          statLabel={data.statLabel}
          compare={data.compare}
          ctaAction={data.ctaAction}
          imageDataUrl={data.imageDataUrl}
        />
      );
    case "newagent":
      return (
        <NewAgentCard
          agencyName={agencyName}
          network={network}
          agent={data.agent}
          format={format}
          photoPosition={data.photoPosition}
          photoScale={data.photoScale}
          variant={data.variant}
          copy={data.copy}
          theme={data.theme}
          page={data.page}
        />
      );
    case "recruiting":
      return (
        <RecruitingCard
          agencyName={agencyName}
          network={network}
          variant={data.variant}
          format={format}
          copy={data.copy}
          page={data.page}
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
  repositionable = false,
  photoPosition,
  photoScale = 1,
  onPhotoPositionChange,
  onPhotoScaleChange,
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

  // Wheel / trackpad-pinch to zoom over the photo. React's onWheel is passive at the
  // root (preventDefault no-ops), so attach a NON-passive native listener to the overlay
  // and read the latest scale/callback through refs (no listener re-attach per zoom tick).
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(photoScale);
  scaleRef.current = photoScale;
  const onScaleRef = useRef(onPhotoScaleChange);
  onScaleRef.current = onPhotoScaleChange;
  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !repositionable) return;
    const onWheel = (e: WheelEvent) => {
      if (!onScaleRef.current) return;
      e.preventDefault();
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, scaleRef.current - e.deltaY * 0.0022),
      );
      onScaleRef.current(Math.round(next * 100) / 100);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [repositionable]);

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
  // Applies to ANY photo-bearing card (AOTW + new-agent), not just AOTW.
  const liveData: PreviewData =
    dragPos !== null && hasPhotoTransform(data)
      ? { ...data, photoPosition: dragPos }
      : data;

  // One element description rendered in TWO places (React mounts an independent
  // instance at each position): the scaled on-screen preview, and the off-screen
  // full-size export source. Keeping it a single const guarantees they stay identical.
  const cardInner = (
    <SocialCardSwitch
      data={liveData}
      format={format}
      agencyName={agencyName}
      network={network}
      showPolicies={showPolicies}
    />
  );

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
          {/* DISPLAY ONLY — scaled to fit the pane. The PNG export must NOT read this
              node: modern-screenshot sizes its canvas from the transform-affected
              bounding rect, so capturing here yields only the top-left fraction of the
              card (the WI-1 "one eighth / too big" crop). The ref lives on the
              off-screen full-size copy below instead. */}
          <div className={themeClass} style={{ width: naturalW }}>
            {cardInner}
          </div>
        </div>

        {repositionable && onPhotoPositionChange && (
          <div
            ref={overlayRef}
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
            title="Drag to reposition the photo · scroll to zoom"
          >
            {!dragging && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-foreground/75 px-2.5 py-1 text-[10px] font-semibold text-background shadow">
                ⠿ Drag to move · scroll to zoom
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

      {repositionable && onPhotoScaleChange && (
        <div
          className="mt-3 flex items-center gap-2"
          style={{ width: dispW }}
          data-testid="photo-zoom"
        >
          <span className="text-[11px] font-medium text-muted-foreground">
            Zoom
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.02}
            value={photoScale}
            onChange={(e) => onPhotoScaleChange(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
            aria-label="Zoom photo"
          />
          <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
            {Math.round(photoScale * 100)}%
          </span>
          {photoScale !== 1 && (
            <button
              type="button"
              onClick={() => onPhotoScaleChange(1)}
              className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
              title="Reset zoom to 100%"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
