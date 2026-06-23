// src/features/social-studio/components/PostConfirmDialog.tsx
// "Confirm before you post" gate. Shows the graphic inside recognizable Instagram
// chrome (feed post or story) — the user's "preview what it's actually going to look
// like on Instagram, then confirm" — plus the caption, the target @account, and the
// carousel slide count, with explicit Post / Cancel.

import { Heart, MessageCircle, Send, Bookmark, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cardThemeWrapperClass,
  FORMAT_DIMS,
  type SocialFormat,
} from "@/features/social-cards";
import { SocialCardSwitch, type PreviewData } from "./SocialPreview";
import type { SocialPostType } from "../types";

interface PostConfirmDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  postType: SocialPostType;
  format: SocialFormat;
  /** The slide shown in the chrome (the currently-previewed page). */
  data: PreviewData;
  agencyName: string;
  network?: string;
  showPolicies: boolean;
  /** Connected IG @username (without the @). */
  handle?: string;
  caption: string;
  /** Total slides that will post (carousel size). */
  slideCount: number;
  posting: boolean;
  onConfirm: () => void;
}

const FRAME_W = 288;

// A faithful, scaled-down render of the actual card (same components the export uses,
// so the user sees the real graphic — just smaller). Display-only, never captured.
function ScaledCard({
  data,
  format,
  agencyName,
  network,
  showPolicies,
}: {
  data: PreviewData;
  format: SocialFormat;
  agencyName: string;
  network?: string;
  showPolicies: boolean;
}) {
  const { w, h } = FORMAT_DIMS[format];
  const scale = FRAME_W / w;
  return (
    <div
      style={{
        width: FRAME_W,
        height: Math.round(h * scale),
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div className={cardThemeWrapperClass(data.theme)} style={{ width: w }}>
          <SocialCardSwitch
            data={data}
            format={format}
            agencyName={agencyName}
            network={network}
            showPolicies={showPolicies}
          />
        </div>
      </div>
    </div>
  );
}

export function PostConfirmDialog({
  open,
  onOpenChange,
  postType,
  format,
  data,
  agencyName,
  network,
  showPolicies,
  handle,
  caption,
  slideCount,
  posting,
  onConfirm,
}: PostConfirmDialogProps) {
  const isStory = postType === "story";
  const handleLabel = handle ? `@${handle}` : "your account";
  const carousel = slideCount > 1;
  // IG carousels cap at 10; surface the truncation rather than silently dropping.
  const postedSlides = Math.min(slideCount, 10);
  const card = (
    <ScaledCard
      data={data}
      format={format}
      agencyName={agencyName}
      network={network}
      showPolicies={showPolicies}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Post to Instagram {isStory ? "Story" : carousel ? "(carousel)" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {isStory ? (
            // ── Story chrome: 9:16, progress segments + header ──
            <div
              className="overflow-hidden rounded-2xl bg-black"
              style={{ width: FRAME_W }}
            >
              <div className="flex gap-1 px-2 pt-2">
                {Array.from({ length: Math.max(1, postedSlides) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/40"
                    >
                      {i === 0 && (
                        <div className="h-full w-1/3 rounded-full bg-white" />
                      )}
                    </div>
                  ),
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400" />
                <span className="text-xs font-semibold text-white">
                  {handleLabel}
                </span>
                <span className="text-[10px] text-white/60">now</span>
              </div>
              {card}
            </div>
          ) : (
            // ── Feed chrome: header + image + actions + caption ──
            <div
              className="w-full overflow-hidden rounded-xl border border-border bg-card"
              style={{ maxWidth: FRAME_W + 24 }}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400" />
                <span className="text-xs font-semibold text-foreground">
                  {handleLabel}
                </span>
                <span className="ml-auto text-muted-foreground">···</span>
              </div>
              <div className="flex justify-center bg-black">{card}</div>
              <div className="flex items-center gap-3 px-3 py-2 text-foreground">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
                <Send className="h-5 w-5" />
                <Bookmark className="ml-auto h-5 w-5" />
              </div>
              {carousel && (
                <div className="flex justify-center gap-1 pb-1">
                  {Array.from({ length: Math.min(postedSlides, 10) }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-accent" : "bg-muted-foreground/40"}`}
                      />
                    ),
                  )}
                </div>
              )}
              {caption ? (
                <p className="max-h-16 overflow-hidden px-3 pb-3 text-xs text-foreground">
                  <span className="font-semibold">{handleLabel}</span> {caption}
                </p>
              ) : null}
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground">
            Posting to{" "}
            <span className="font-medium text-foreground">{handleLabel}</span>{" "}
            as a{" "}
            <span className="font-medium text-foreground">
              {isStory ? "Story" : carousel ? "carousel post" : "feed post"}
            </span>
            .
            {carousel && (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {postedSlides} slide{postedSlides === 1 ? "" : "s"}
                </span>
                {slideCount > 10
                  ? ` (first 10 of ${slideCount} — download all for the rest)`
                  : ""}
                .
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={posting}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={posting}>
            {posting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            {posting ? "Posting…" : "Post now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
