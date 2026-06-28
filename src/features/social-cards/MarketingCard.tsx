// src/features/social-cards/MarketingCard.tsx
// Marketing slides for the carousel builder (#8) — a BOLD, scroll-stopping design system, not
// a minimal editorial frame. Each archetype is its own punchy composition on a vivid gradient
// stage: oversized graphic type, accent pops, sticker badges, progress dots, swipe cues.
//   hook (cover) · list (numbered) · checklist · stat (one big number) · compare (two panels)
//   · quote · tip · cta (close) · custom (over a photo). Legacy decks (quote/tip/cta/custom)
//   still render.
//
// Self-contained (own palette + fonts) so the PNG export is pixel-faithful.
//
// EXPORT QUIRK (load-bearing): modern-screenshot under-measures multi-line DISPLAY-font height
// → wrapped display text overlaps on the PNG. Rule applied throughout: multi-line copy uses the
// heavy SANS face (Inter, measures correctly at any line count); the DISPLAY face (Big Shoulders)
// is used ONLY for guaranteed single-line text — the big stat value and the list rank numerals —
// each sized to fit its width so it can never overflow.

import {
  FORMAT_DIMS,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import { resolveCardTheme, type CardTheme } from "./themes";

export type MarketingVariant =
  | "hook"
  | "list"
  | "checklist"
  | "stat"
  | "compare"
  | "quote"
  | "tip"
  | "cta"
  | "custom";

export interface SlideListItem {
  label: string;
  detail?: string;
}
export interface SlideCompareColumn {
  title: string;
  items: string[];
}
export interface SlideCompare {
  left: SlideCompareColumn;
  right: SlideCompareColumn;
}

export interface MarketingCardProps {
  variant: MarketingVariant;
  agencyName: string;
  network?: string;
  format?: SocialFormat;
  /** Brand theme (Spotlight / Editorial / Lift). Default Spotlight. */
  theme?: CardTheme;
  /** Carousel position when the deck spans multiple cards. */
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
  /** custom / hook only — optional full-bleed background image (data: URL, CORS-proof export). */
  imageDataUrl?: string;
}

const BIG = '"Big Shoulders Display","Arial Black",system-ui,sans-serif';
const SANS = '"Inter",system-ui,sans-serif';

const DEFAULT_EYEBROW: Partial<Record<MarketingVariant, string>> = {
  tip: "Pro tip",
  cta: "Now hiring",
};

/** A vivid, on-brand "stage" for the marketing slides — bolder than the data-card themes.
 *  Dark themes get a deep indigo→violet→fuchsia mesh; light themes a bright tinted canvas.
 *  `accent` is the high-energy pop used for stickers / highlights / CTAs / checks. */
function boldKit(theme: CardTheme, onPhoto: boolean) {
  const t = resolveCardTheme(theme);
  const dark = t.mode === "dark";

  // Deep, saturated mesh for the dark stage.
  const darkMesh =
    "radial-gradient(62% 48% at 12% 6%, rgba(99,102,241,0.62), transparent 60%)," +
    "radial-gradient(58% 46% at 92% 14%, rgba(217,70,239,0.50), transparent 62%)," +
    "radial-gradient(78% 60% at 50% 112%, rgba(124,58,237,0.62), transparent 60%)," +
    "radial-gradient(40% 32% at 82% 78%, rgba(56,189,248,0.30), transparent 60%)";
  // Bright canvas with bold color blooms for the light stage.
  const lightMesh =
    "radial-gradient(55% 42% at 8% 6%, rgba(99,102,241,0.20), transparent 62%)," +
    "radial-gradient(52% 40% at 94% 12%, rgba(217,70,239,0.16), transparent 64%)," +
    "radial-gradient(70% 55% at 52% 112%, rgba(124,58,237,0.18), transparent 60%)";

  const base = dark ? "#0a0a18" : "#f7f7fb";
  return {
    dark,
    base,
    bgImage: dark ? darkMesh : lightMesh,
    // Text
    ink: onPhoto ? "#ffffff" : dark ? "#ffffff" : "#100a26",
    inkMuted: onPhoto
      ? "rgba(255,255,255,0.82)"
      : dark
        ? "rgba(255,255,255,0.74)"
        : "rgba(16,10,38,0.66)",
    inkFaint: onPhoto
      ? "rgba(255,255,255,0.60)"
      : dark
        ? "rgba(255,255,255,0.48)"
        : "rgba(16,10,38,0.42)",
    // Accent pop (bright gold) + its on-color ink.
    accent: "#fde047",
    accentInk: "#1a1205",
    // Secondary brand glow.
    violet: "#a78bfa",
    // Surfaces for rows / panels.
    card: dark ? "rgba(255,255,255,0.07)" : "rgba(16,10,38,0.05)",
    cardLine: dark ? "rgba(255,255,255,0.14)" : "rgba(16,10,38,0.12)",
    disp: BIG,
    sans: SANS,
    sharp: t.sharp,
  };
}

type Kit = ReturnType<typeof boldKit>;

export function MarketingCard({
  variant,
  agencyName,
  network,
  format = "portrait",
  theme = "spotlight",
  page,
  eyebrow,
  text,
  attribution,
  headline,
  subheadline,
  body,
  items,
  bullets,
  stat,
  statLabel,
  compare,
  ctaAction,
  imageDataUrl,
}: MarketingCardProps) {
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 92 : 76;
  const innerW = W - PAD * 2;
  const onPhoto =
    (variant === "custom" || variant === "hook") && !!imageDataUrl;
  const k = boldKit(theme, onPhoto);
  const paginated = !!page && page.total > 1;
  const r = (n: number) => (k.sharp ? 0 : n); // radius helper (Editorial = sharp)

  // ── Background stage ────────────────────────────────────────────────────────
  const pageBg: React.CSSProperties = onPhoto
    ? {
        backgroundImage: `linear-gradient(178deg, rgba(7,6,20,0.42) 0%, rgba(7,6,20,0.30) 38%, rgba(7,6,20,0.90) 100%), url(${imageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: k.base, backgroundImage: k.bgImage };

  const shownEyebrow = (eyebrow ?? DEFAULT_EYEBROW[variant] ?? "").trim();

  // ── Reusable chrome ─────────────────────────────────────────────────────────
  const brandMark = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          width: isStory ? 14 : 12,
          height: isStory ? 14 : 12,
          borderRadius: 999,
          background: k.accent,
          boxShadow: `0 0 18px ${k.accent}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          font: `800 ${isStory ? 26 : 22}px ${k.sans}`,
          color: k.ink,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {agencyName}
      </span>
      {network ? (
        <span
          style={{
            font: `600 ${isStory ? 22 : 18}px ${k.sans}`,
            color: k.inkFaint,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          · {network}
        </span>
      ) : null}
    </div>
  );

  const dots = paginated ? (
    <div
      style={{ display: "flex", alignItems: "center", gap: isStory ? 10 : 8 }}
    >
      {Array.from({ length: page!.total }).map((_, i) => {
        const active = i + 1 === page!.index;
        return (
          <span
            key={i}
            style={{
              width: active ? (isStory ? 30 : 26) : isStory ? 10 : 9,
              height: isStory ? 10 : 9,
              borderRadius: 999,
              background: active ? k.accent : k.inkFaint,
            }}
          />
        );
      })}
    </div>
  ) : (
    <span />
  );

  const swipeCue = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        font: `800 ${isStory ? 24 : 20}px ${k.sans}`,
        color: k.accent,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
      }}
    >
      Swipe{" "}
      <span style={{ fontSize: isStory ? 30 : 26, lineHeight: 1 }}>→</span>
    </span>
  );

  // Decorative oversized blurred orb that bleeds off a corner.
  const orb = (
    color: string,
    size: number,
    top: number | "auto",
    left: number | "auto",
    right: number | "auto" = "auto",
    bottom: number | "auto" = "auto",
  ): React.CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    top,
    left,
    right,
    bottom,
    borderRadius: 999,
    background: color,
    filter: "blur(8px)",
    opacity: 0.5,
    pointerEvents: "none",
  });

  // ── Per-archetype body ──────────────────────────────────────────────────────
  let bodyBlock: React.ReactNode = null;

  if (variant === "hook") {
    const hl = (headline ?? "").trim();
    const size = isStory
      ? hl.length < 28
        ? 168
        : hl.length < 46
          ? 140
          : 118
      : hl.length < 24
        ? 132
        : hl.length < 40
          ? 112
          : hl.length < 56
            ? 96
            : 84;
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 34 : 26,
          width: "100%",
        }}
      >
        {shownEyebrow ? (
          <span
            style={{
              alignSelf: "flex-start",
              font: `800 ${isStory ? 26 : 22}px ${k.sans}`,
              color: k.accentInk,
              background: k.accent,
              padding: `${isStory ? 12 : 10}px ${isStory ? 22 : 18}px`,
              borderRadius: r(999),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              transform: "rotate(-2deg)",
              boxShadow: `0 14px 36px rgba(253,224,71,0.32)`,
            }}
          >
            {shownEyebrow}
          </span>
        ) : null}
        {hl ? (
          <div
            style={{
              font: `900 ${size}px ${k.sans}`,
              color: k.ink,
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
              textShadow: onPhoto ? "0 4px 30px rgba(0,0,0,0.45)" : "none",
            }}
          >
            {hl}
          </div>
        ) : null}
        <span
          style={{
            width: isStory ? 130 : 104,
            height: isStory ? 10 : 8,
            background: k.accent,
            borderRadius: r(999),
          }}
        />
        {subheadline ? (
          <div
            style={{
              font: `500 ${isStory ? 44 : 36}px ${k.sans}`,
              color: k.inkMuted,
              lineHeight: 1.3,
              maxWidth: "94%",
            }}
          >
            {subheadline}
          </div>
        ) : null}
      </div>
    );
  } else if (variant === "stat") {
    const statText = (stat ?? "").trim();
    // Big Shoulders single line — fit to width with NO floor so it can never overflow.
    // 0.66 em/char over-estimates the condensed face (wide $/M/% glyphs) so it never clips.
    const statPx = statText
      ? Math.min(
          isStory ? 420 : 320,
          Math.floor(innerW / Math.max(1, statText.length * 0.66)),
        )
      : 0;
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: isStory ? 22 : 18,
          width: "100%",
        }}
      >
        {shownEyebrow ? (
          <SectionTag k={k} isStory={isStory} r={r} text={shownEyebrow} />
        ) : null}
        {statText ? (
          <div
            style={{
              font: `800 ${statPx}px ${k.disp}`,
              color: k.accent,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              textShadow: `0 18px 60px rgba(253,224,71,0.28)`,
            }}
          >
            {statText}
          </div>
        ) : null}
        {statLabel ? (
          <div
            style={{
              font: `800 ${isStory ? 50 : 40}px ${k.sans}`,
              color: k.ink,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              maxWidth: "94%",
            }}
          >
            {statLabel}
          </div>
        ) : null}
        {body ? (
          <div
            style={{
              marginTop: isStory ? 12 : 8,
              font: `500 ${isStory ? 40 : 32}px ${k.sans}`,
              color: k.inkMuted,
              lineHeight: 1.34,
              maxWidth: "92%",
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    );
  } else if (variant === "list") {
    const rows = (items ?? []).filter((it) => it && (it.label || it.detail));
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: isStory ? 22 : 16,
        }}
      >
        {headline ? (
          <SectionHead k={k} isStory={isStory} text={headline} />
        ) : null}
        {rows.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: isStory ? 28 : 22,
              width: "100%",
            }}
          >
            <div
              style={{
                width: isStory ? 96 : 80,
                height: isStory ? 96 : 80,
                borderRadius: r(20),
                background: i === 0 ? k.accent : k.card,
                border: `2px solid ${i === 0 ? k.accent : k.cardLine}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow:
                  i === 0 ? `0 14px 34px rgba(253,224,71,0.3)` : "none",
              }}
            >
              <span
                style={{
                  font: `800 ${isStory ? 58 : 48}px ${k.disp}`,
                  color: i === 0 ? k.accentInk : k.ink,
                  lineHeight: 1,
                }}
              >
                {i + 1}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: isStory ? 6 : 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  font: `800 ${isStory ? 46 : 38}px ${k.sans}`,
                  color: k.ink,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.label}
              </div>
              {it.detail ? (
                <div
                  style={{
                    font: `500 ${isStory ? 34 : 27}px ${k.sans}`,
                    color: k.inkMuted,
                    lineHeight: 1.28,
                  }}
                >
                  {it.detail}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (variant === "checklist") {
    const lines = (bullets ?? []).filter(Boolean);
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: isStory ? 20 : 14,
        }}
      >
        {headline ? (
          <SectionHead k={k} isStory={isStory} text={headline} />
        ) : null}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: isStory ? 24 : 18,
              width: "100%",
              padding: `${isStory ? 22 : 17}px ${isStory ? 26 : 22}px`,
              background: k.card,
              border: `1px solid ${k.cardLine}`,
              borderRadius: r(18),
            }}
          >
            <span
              aria-hidden
              style={{
                width: isStory ? 52 : 44,
                height: isStory ? 52 : 44,
                borderRadius: 999,
                background: k.accent,
                color: k.accentInk,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `800 ${isStory ? 30 : 25}px ${k.sans}`,
                lineHeight: 1,
                flexShrink: 0,
                boxShadow: `0 8px 22px rgba(253,224,71,0.3)`,
              }}
            >
              &#10003;
            </span>
            <span
              style={{
                font: `600 ${isStory ? 42 : 34}px ${k.sans}`,
                color: k.ink,
                lineHeight: 1.22,
                flex: 1,
                minWidth: 0,
              }}
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (variant === "compare") {
    const col = (c: SlideCompareColumn | undefined, win: boolean) => (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 18 : 14,
          padding: isStory ? 32 : 26,
          borderRadius: r(26),
          background: win
            ? "linear-gradient(155deg, rgba(253,224,71,0.20), rgba(217,70,239,0.16))"
            : k.card,
          border: `2px solid ${win ? k.accent : k.cardLine}`,
          boxShadow: win ? `0 22px 60px rgba(253,224,71,0.18)` : "none",
        }}
      >
        <div
          style={{
            font: `800 ${isStory ? 40 : 32}px ${k.sans}`,
            color: win ? k.accent : k.inkMuted,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.08,
          }}
        >
          {c?.title}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isStory ? 16 : 12,
          }}
        >
          {(c?.items ?? []).filter(Boolean).map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: isStory ? 14 : 11,
                alignItems: "flex-start",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: isStory ? 38 : 31,
                  height: isStory ? 38 : 31,
                  borderRadius: 999,
                  flexShrink: 0,
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: win ? k.accent : "transparent",
                  border: win ? "none" : `2px solid ${k.inkFaint}`,
                  color: win ? k.accentInk : k.inkFaint,
                  font: `800 ${isStory ? 24 : 19}px ${k.sans}`,
                  lineHeight: 1,
                }}
              >
                {win ? "✓" : "✕"}
              </span>
              <span
                style={{
                  font: `500 ${isStory ? 34 : 27}px ${k.sans}`,
                  color: win ? k.ink : k.inkMuted,
                  lineHeight: 1.26,
                }}
              >
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
    bodyBlock = compare ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: isStory ? 26 : 20,
        }}
      >
        {headline ? (
          <SectionHead k={k} isStory={isStory} text={headline} />
        ) : null}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: isStory ? 36 : 30,
            width: "100%",
            alignItems: "stretch",
          }}
        >
          {col(compare.left, false)}
          {col(compare.right, true)}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: isStory ? 80 : 64,
              height: isStory ? 80 : 64,
              borderRadius: 999,
              background: k.base,
              border: `3px solid ${k.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `900 ${isStory ? 34 : 27}px ${k.sans}`,
              color: k.accent,
              letterSpacing: "0.04em",
              boxShadow: `0 10px 30px rgba(0,0,0,0.4)`,
            }}
          >
            VS
          </div>
        </div>
      </div>
    ) : null;
  } else if (variant === "quote") {
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 18 : 12,
          width: "100%",
        }}
      >
        <div
          aria-hidden
          style={{
            font: `800 ${isStory ? 280 : 220}px ${k.disp}`,
            color: k.accent,
            lineHeight: 0.6,
            height: isStory ? 150 : 118,
            opacity: 0.95,
          }}
        >
          &ldquo;
        </div>
        <div
          style={{
            font: `800 ${isStory ? 86 : 68}px ${k.sans}`,
            color: k.ink,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
          }}
        >
          {text}
        </div>
      </div>
    );
  } else {
    // tip | cta | custom
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: isStory ? 30 : 22,
          width: "100%",
        }}
      >
        {shownEyebrow ? (
          <SectionTag k={k} isStory={isStory} r={r} text={shownEyebrow} />
        ) : null}
        {headline ? (
          <div
            style={{
              font: `900 ${isStory ? 92 : 72}px ${k.sans}`,
              color: k.ink,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            {headline}
          </div>
        ) : null}
        {body ? (
          <div
            style={{
              font: `500 ${isStory ? 44 : 35}px ${k.sans}`,
              color: k.inkMuted,
              lineHeight: 1.34,
              maxWidth: "94%",
            }}
          >
            {body}
          </div>
        ) : null}
        {variant === "cta" ? (
          <div
            style={{
              marginTop: isStory ? 18 : 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              font: `800 ${isStory ? 44 : 36}px ${k.sans}`,
              color: k.accentInk,
              background: k.accent,
              padding: `${isStory ? 26 : 20}px ${isStory ? 44 : 34}px`,
              borderRadius: r(999),
              letterSpacing: "0.01em",
              boxShadow: `0 18px 48px rgba(253,224,71,0.34)`,
            }}
          >
            {(ctaAction ?? "").trim() || "DM us to apply"}
            <span style={{ fontSize: isStory ? 44 : 36, lineHeight: 1 }}>
              →
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  const heroSwipe = variant === "hook" || variant === "cta";

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        ...pageBg,
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: k.sans,
        color: k.ink,
        overflow: "hidden",
      }}
    >
      {/* Decorative orbs (skip over a photo — the scrim owns the look) */}
      {!onPhoto && (
        <>
          <div
            style={orb(
              k.accent,
              isStory ? 150 : 120,
              isStory ? -40 : -30,
              "auto",
              isStory ? -30 : -24,
            )}
          />
          <div
            style={orb(
              k.violet,
              isStory ? 320 : 260,
              "auto",
              isStory ? -90 : -70,
              "auto",
              isStory ? -70 : -56,
            )}
          />
        </>
      )}

      {/* Top chrome — brand mark */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {brandMark}
      </div>

      {/* Body */}
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {bodyBlock}
      </div>

      {/* Quote attribution — anchored above the footer so the quote can't overlap it. */}
      {variant === "quote" && attribution ? (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: isStory ? 24 : 18,
          }}
        >
          <span
            style={{
              width: isStory ? 46 : 38,
              height: 4,
              background: k.accent,
              borderRadius: 999,
            }}
          />
          <span
            style={{
              font: `700 ${isStory ? 32 : 26}px ${k.sans}`,
              color: k.inkMuted,
              letterSpacing: "0.02em",
            }}
          >
            {attribution}
          </span>
        </div>
      ) : null}

      {/* Bottom chrome — progress dots + swipe/handle */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {dots}
        {heroSwipe ? (
          swipeCue
        ) : (
          <span
            style={{
              font: `700 ${isStory ? 22 : 18}px ${k.sans}`,
              color: k.inkFaint,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {network || agencyName}
          </span>
        )}
      </div>
    </div>
  );
}

/** Big bold section heading used by list / checklist / compare. */
function SectionHead({
  k,
  isStory,
  text,
}: {
  k: Kit;
  isStory: boolean;
  text: string;
}) {
  return (
    <div
      style={{
        font: `900 ${isStory ? 72 : 58}px ${k.sans}`,
        color: k.ink,
        lineHeight: 1.02,
        letterSpacing: "-0.025em",
        marginBottom: isStory ? 14 : 10,
        width: "100%",
      }}
    >
      {text}
    </div>
  );
}

/** Small accent pill tag (eyebrow for stat / tip / cta). */
function SectionTag({
  k,
  isStory,
  r,
  text,
}: {
  k: Kit;
  isStory: boolean;
  r: (n: number) => number;
  text: string;
}) {
  return (
    <span
      style={{
        font: `800 ${isStory ? 26 : 22}px ${k.sans}`,
        color: k.accentInk,
        background: k.accent,
        padding: `${isStory ? 11 : 9}px ${isStory ? 20 : 16}px`,
        borderRadius: r(999),
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  );
}
