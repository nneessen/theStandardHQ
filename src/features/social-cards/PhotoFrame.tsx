// src/features/social-cards/PhotoFrame.tsx
// THE single photo renderer shared by every social card that shows a headshot
// (Agent of the Week, New-Agent / Welcome, and any future recruiting photo card).
// One renderer → move + zoom behave identically everywhere and the PNG export stays
// byte-faithful, because the whole transform is pure, deterministic CSS:
//
//   • pan  → `object-position: X% Y%` chooses which part of the (cover-fit) source
//            fills the frame, so the owner drags the face into view.
//   • zoom → `transform: scale(s)` enlarges the image, anchored at `transform-origin`
//            set to the SAME `X% Y%`. The focal pixel is both where the source sits
//            and the fixed point of the scale, so it stays put while the image zooms
//            around it; the surrounding overflow is clipped by the frame's
//            `overflow:hidden`. `scale === 1` emits NO transform, so an un-zoomed card
//            is provably identical to the pre-PhotoFrame output.
//
// No DOM measuring, no randomness → the live preview, the off-screen export host, and
// the posted image are pixel-identical (true WYSIWYG).

import type { CSSProperties, ReactNode } from "react";

export interface PhotoFrameProps {
  url?: string | null;
  /** Frame size + corner radius (the clip box). */
  w: number | string;
  h: number | string;
  radius: number | string;
  /** CSS `object-position` focal point ("x% y%"). Drag-to-reposition. Default centered. */
  position?: string;
  /** Zoom multiplier (1 = cover-fit, up to ~3). Focuses on `position`. Default 1. */
  scale?: number;
  /** Wrapper background shown around/behind the photo + placeholder (the design's
   *  gradient). */
  background?: string;
  /** Rendered when there is no `url` (e.g. the agent's initials). */
  placeholder?: ReactNode;
  /** Image filter; default a gentle contrast/saturation lift (matches the legacy cards). */
  filter?: string;
  /** Extra wrapper styles (ring / shadow / absolute positioning per design). */
  style?: CSSProperties;
}

export function PhotoFrame({
  url,
  w,
  h,
  radius,
  position = "50% 50%",
  scale = 1,
  background,
  placeholder,
  filter = "contrast(1.04) saturate(1.05)",
  style,
}: PhotoFrameProps) {
  return (
    <div
      style={{
        width: w,
        height: h,
        flex: "none",
        borderRadius: radius,
        overflow: "hidden",
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: position,
            // Only emit a transform when zoomed, so un-zoomed cards render exactly as
            // before (no sub-pixel reflow from an identity transform).
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: position,
            display: "block",
            filter,
          }}
        />
      ) : (
        (placeholder ?? null)
      )}
    </div>
  );
}
