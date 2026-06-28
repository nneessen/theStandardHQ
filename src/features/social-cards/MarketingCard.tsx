// src/features/social-cards/MarketingCard.tsx
// Marketing slides for the carousel builder (#8). A LIBRARY of distinct layout archetypes —
// not one centered-text template — so an AI-composed deck reads like a designed carousel:
//   hook (scroll-stopping cover) · list (numbered) · checklist (bullets) · stat (one big
//   real number) · compare (two columns) · quote · tip (insight) · cta (closing) · custom
//   (copy over the user's photo). Legacy decks persist quote/tip/cta/custom — still rendered.
//
// Self-contained like the data cards (own theme palette + fonts → pixel-faithful PNG export),
// and shares their frame — themed page background, agency/network masthead + rule, footer
// page-stamp — so a mixed carousel (data + marketing) reads as ONE cohesive deck.
//
// Variety comes from LAYOUT + hierarchy + bold type on the SAME on-brand theme tokens
// (themes.ts indigo) — never per-slide accent colors (feedback_no_rainbow_cards).
//
// EXPORT QUIRK (load-bearing): modern-screenshot under-measures multi-line DISPLAY-font
// height, so wrapped display text overlaps what's below it on the PNG. Rule of thumb used
// throughout: multi-line copy uses the heavy SANS face (measures correctly at any line
// count); the DISPLAY face is used only for text guaranteed to be ONE line — big stat
// values and list rank numbers — sized with fitFontPx so it can't overflow the width.

import {
  FORMAT_DIMS,
  fitFontPx,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";

export type MarketingVariant =
  // ── richer layout archetypes ──
  | "hook"
  | "list"
  | "checklist"
  | "stat"
  | "compare"
  // ── legacy keys (still composed + persisted; redesigned here) ──
  | "quote"
  | "tip"
  | "cta"
  | "custom";

/** One numbered-list row. */
export interface SlideListItem {
  label: string;
  detail?: string;
}

/** One side of a two-column compare slide. */
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
  // ── Content (which fields apply depends on variant) ──
  /** Small uppercase kicker above the headline (hook / list / checklist / compare / stat). */
  eyebrow?: string;
  /** quote */
  text?: string;
  attribution?: string;
  /** hook / list / checklist / tip / cta / custom */
  headline?: string;
  /** hook supporting line */
  subheadline?: string;
  /** tip / cta / custom / stat */
  body?: string;
  /** list (numbered rows) */
  items?: SlideListItem[];
  /** checklist (bulleted lines) */
  bullets?: string[];
  /** stat — one big real number + caption */
  stat?: string;
  statLabel?: string;
  /** compare — two columns */
  compare?: SlideCompare;
  /** cta — the action chip label (default "DM us to apply"). */
  ctaAction?: string;
  /** custom / hook only — optional full-bleed background image (data: URL, CORS-proof export). */
  imageDataUrl?: string;
}

/** Default eyebrow per variant when the slide doesn't supply one. */
const DEFAULT_EYEBROW: Partial<Record<MarketingVariant, string>> = {
  tip: "Tip",
  cta: "We're hiring",
};

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
  const t = resolveCardTheme(theme);
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 84 : 64;
  const innerW = W - PAD * 2;
  const paginated = !!page && page.total > 1;
  const hasImage =
    (variant === "custom" || variant === "hook") && !!imageDataUrl;

  // Over a photo we force a dark scrim + light ink so any theme stays legible.
  const onImageInk = "#ffffff";
  const ink = hasImage ? onImageInk : t.ink;
  const inkMuted = hasImage ? "rgba(255,255,255,0.80)" : t.inkMuted;
  const inkSubtle = hasImage ? "rgba(255,255,255,0.64)" : t.inkSubtle;
  const accent = hasImage ? "#ffffff" : t.accent;
  const hairline = hasImage ? "rgba(255,255,255,0.18)" : t.hairline;

  const sz = {
    eyebrow: isStory ? 26 : 22,
    quote: isStory ? 96 : 74,
    headline: isStory ? 92 : 70,
    hook: isStory ? 110 : 86,
    hookSub: isStory ? 46 : 38,
    sectionHead: isStory ? 70 : 56,
    listNum: isStory ? 84 : 66,
    listLabel: isStory ? 46 : 38,
    listDetail: isStory ? 33 : 27,
    bullet: isStory ? 46 : 38,
    statVal: isStory ? 380 : 300,
    statLabel: isStory ? 42 : 34,
    compareTitle: isStory ? 42 : 34,
    compareItem: isStory ? 34 : 28,
    body: isStory ? 40 : 32,
    attribution: isStory ? 30 : 25,
    foot: isStory ? 24 : 20,
  };

  const pageBg = hasImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(2,4,10,0.45) 0%, rgba(2,4,10,0.32) 40%, rgba(2,4,10,0.86) 100%), url(${imageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : themePageBackground(t);

  const shownEyebrow = (eyebrow ?? DEFAULT_EYEBROW[variant] ?? "").trim();

  // Body alignment: hook/quote/stat/tip/cta/custom read centered; list/checklist/compare
  // read top-down.
  const topAligned =
    variant === "list" || variant === "checklist" || variant === "compare";

  // ── Per-archetype body ──────────────────────────────────────────────────────
  let bodyBlock: React.ReactNode = null;

  if (variant === "quote") {
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 36 : 26,
          width: "100%",
        }}
      >
        <div
          aria-hidden
          style={{
            font: `700 ${isStory ? 140 : 110}px ${t.disp}`,
            color: accent,
            lineHeight: 1,
            opacity: hasImage ? 0.9 : 0.55,
          }}
        >
          &ldquo;
        </div>
        <div
          style={{
            font: `700 ${sz.quote}px ${t.disp}`,
            color: ink,
            lineHeight: 1.08,
            letterSpacing: "0.005em",
            width: "100%",
          }}
        >
          {text}
        </div>
      </div>
    );
  } else if (variant === "hook") {
    // Cover: bold scroll-stopper. SANS (not display) for the headline so a 2–3 line hook
    // measures correctly on export. Accent rule under the eyebrow for a designed feel.
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 30 : 22,
          width: "100%",
        }}
      >
        <div
          style={{
            font: `900 ${sz.hook}px ${t.sans}`,
            color: ink,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            width: "100%",
          }}
        >
          {headline}
        </div>
        {subheadline ? (
          <div
            style={{
              font: `500 ${sz.hookSub}px ${t.sans}`,
              color: inkMuted,
              lineHeight: 1.32,
              width: "100%",
            }}
          >
            {subheadline}
          </div>
        ) : null}
      </div>
    );
  } else if (variant === "stat") {
    // One big real number — the only place the DISPLAY face goes large, and it's a single
    // line sized with fitFontPx so it can never overflow the card width.
    const statText = (stat ?? "").trim();
    const statPx = fitFontPx(statText || "0", sz.statVal, innerW, 0.6);
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: isStory ? 14 : 10,
          width: "100%",
        }}
      >
        <div
          style={{
            font: `800 ${statPx}px ${t.disp}`,
            color: accent,
            lineHeight: 0.92,
            letterSpacing: "-0.01em",
          }}
        >
          {statText}
        </div>
        {statLabel ? (
          <div
            style={{
              font: `800 ${sz.statLabel}px ${t.sans}`,
              color: ink,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              width: "100%",
            }}
          >
            {statLabel}
          </div>
        ) : null}
        {body ? (
          <div
            style={{
              marginTop: isStory ? 12 : 8,
              font: `500 ${sz.body}px ${t.sans}`,
              color: inkMuted,
              lineHeight: 1.35,
              width: "100%",
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
          gap: isStory ? 16 : 12,
        }}
      >
        {headline ? (
          <div
            style={{
              font: `800 ${sz.sectionHead}px ${t.sans}`,
              color: ink,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              marginBottom: isStory ? 12 : 8,
              width: "100%",
            }}
          >
            {headline}
          </div>
        ) : null}
        {rows.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: isStory ? 26 : 20,
              paddingTop: i === 0 ? 0 : isStory ? 16 : 12,
              borderTop: i === 0 ? "none" : `1px solid ${hairline}`,
              width: "100%",
            }}
          >
            <div
              style={{
                font: `800 ${sz.listNum}px ${t.disp}`,
                color: accent,
                lineHeight: 0.9,
                minWidth: isStory ? 96 : 76,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: isStory ? 6 : 4,
                width: "100%",
              }}
            >
              <div
                style={{
                  font: `700 ${sz.listLabel}px ${t.sans}`,
                  color: ink,
                  lineHeight: 1.12,
                }}
              >
                {it.label}
              </div>
              {it.detail ? (
                <div
                  style={{
                    font: `500 ${sz.listDetail}px ${t.sans}`,
                    color: inkMuted,
                    lineHeight: 1.3,
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
          gap: isStory ? 22 : 16,
        }}
      >
        {headline ? (
          <div
            style={{
              font: `800 ${sz.sectionHead}px ${t.sans}`,
              color: ink,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              marginBottom: isStory ? 14 : 10,
              width: "100%",
            }}
          >
            {headline}
          </div>
        ) : null}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: isStory ? 22 : 16,
              width: "100%",
            }}
          >
            <div
              aria-hidden
              style={{
                font: `800 ${sz.bullet}px ${t.sans}`,
                color: hasImage ? "#0a0f1c" : t.onAccent,
                background: accent,
                width: isStory ? 50 : 42,
                height: isStory ? 50 : 42,
                borderRadius: t.sharp ? 0 : 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                flexShrink: 0,
                marginTop: isStory ? 4 : 2,
              }}
            >
              &#10003;
            </div>
            <div
              style={{
                font: `600 ${sz.bullet}px ${t.sans}`,
                color: ink,
                lineHeight: 1.25,
              }}
            >
              {line}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (variant === "compare") {
    const col = (c: SlideCompareColumn | undefined, highlight: boolean) => (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: isStory ? 18 : 14,
          padding: isStory ? 28 : 22,
          borderRadius: t.sharp ? 0 : 16,
          background: highlight
            ? t.accentSoft
            : hasImage
              ? "rgba(255,255,255,0.06)"
              : t.rankBg,
          border: highlight ? `1px solid ${accent}` : `1px solid ${hairline}`,
        }}
      >
        <div
          style={{
            font: `800 ${sz.compareTitle}px ${t.sans}`,
            color: highlight ? accent : ink,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          {c?.title}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isStory ? 12 : 9,
          }}
        >
          {(c?.items ?? []).filter(Boolean).map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: isStory ? 12 : 9,
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  color: highlight ? accent : inkSubtle,
                  font: `700 ${sz.compareItem}px ${t.sans}`,
                  lineHeight: 1.25,
                  flexShrink: 0,
                }}
              >
                {highlight ? "✓" : "·"}
              </span>
              <span
                style={{
                  font: `500 ${sz.compareItem}px ${t.sans}`,
                  color: inkMuted,
                  lineHeight: 1.25,
                }}
              >
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
    bodyBlock = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: isStory ? 24 : 18,
        }}
      >
        {headline ? (
          <div
            style={{
              font: `800 ${sz.sectionHead}px ${t.sans}`,
              color: ink,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              width: "100%",
            }}
          >
            {headline}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: isStory ? 24 : 18,
            width: "100%",
            alignItems: "stretch",
          }}
        >
          {col(compare?.left, false)}
          {col(compare?.right, true)}
        </div>
      </div>
    );
  } else {
    // tip | cta | custom — headline + body, with a CTA chip for the closing slide.
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
        {headline ? (
          <div
            style={{
              font: `800 ${sz.headline}px ${t.sans}`,
              color: ink,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
              width: "100%",
            }}
          >
            {headline}
          </div>
        ) : null}
        {body ? (
          <div
            style={{
              font: `500 ${sz.body}px ${t.sans}`,
              color: inkMuted,
              lineHeight: 1.35,
              width: "100%",
            }}
          >
            {body}
          </div>
        ) : null}
        {variant === "cta" ? (
          <div
            style={{
              marginTop: isStory ? 14 : 8,
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              font: `700 ${sz.body}px ${t.sans}`,
              color: hasImage ? "#0a0f1c" : t.onAccent,
              background: hasImage ? "#ffffff" : t.accent,
              padding: `${isStory ? 18 : 14}px ${isStory ? 34 : 26}px`,
              borderRadius: t.sharp ? 0 : 999,
              letterSpacing: "0.02em",
            }}
          >
            {(ctaAction ?? "").trim() || "DM us to apply"}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        width: W,
        height: H,
        ...pageBg,
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: t.sans,
        color: ink,
        overflow: "hidden",
      }}
    >
      {/* Masthead — agency + network + rule (matches the data cards) */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: `800 ${sz.eyebrow + 4}px ${t.sans}`,
            color: ink,
            letterSpacing: "0.04em",
          }}
        >
          {agencyName}
        </span>
        {network ? (
          <span
            style={{
              font: `600 ${sz.eyebrow}px ${t.sans}`,
              color: inkSubtle,
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
          background: hasImage ? "rgba(255,255,255,0.35)" : t.ruleStrong,
          marginTop: 14,
          opacity: 0.7,
        }}
      />

      {/* Eyebrow kicker + accent rule */}
      {shownEyebrow ? (
        <div
          style={{
            marginTop: isStory ? 30 : 22,
            display: "flex",
            alignItems: "center",
            gap: isStory ? 14 : 10,
          }}
        >
          <span
            style={{
              width: isStory ? 34 : 26,
              height: 3,
              background: accent,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              font: `800 ${sz.eyebrow}px ${t.sans}`,
              letterSpacing: "0.18em",
              color: accent,
              textTransform: "uppercase",
            }}
          >
            {shownEyebrow}
          </span>
        </div>
      ) : null}

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: topAligned ? "flex-start" : "center",
          paddingTop: topAligned ? (isStory ? 36 : 26) : 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {bodyBlock}
      </div>

      {/* Quote attribution — anchored above the footer so multi-line quote text can't overlap it. */}
      {variant === "quote" && attribution ? (
        <div
          style={{
            marginBottom: isStory ? 22 : 16,
            font: `600 ${sz.attribution}px ${t.sans}`,
            color: inkMuted,
            letterSpacing: "0.04em",
          }}
        >
          — {attribution}
        </div>
      ) : null}

      {/* Footer — page stamp (matches the data cards) */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: `700 ${sz.foot}px ${t.sans}`,
            color: inkMuted,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {network || agencyName}
        </span>
        {paginated ? (
          <span
            style={{
              font: `600 ${sz.foot}px ${t.sans}`,
              color: inkSubtle,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Page {page.index} / {page.total}
          </span>
        ) : null}
      </div>
    </div>
  );
}
