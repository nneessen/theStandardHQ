// src/features/social-cards/MarketingCard.tsx
// Non-data marketing slides for the carousel builder (#8): quote / tip / recruiting CTA /
// custom. Self-contained like the data cards (own theme palette + fonts → pixel-faithful
// PNG export), and shares their frame — themed page background, agency/network masthead +
// rule, and a footer page-stamp — so a mixed carousel (data + marketing) reads as ONE
// cohesive deck. Pure/presentational; all copy is passed in (typed manually or AI-drafted).

import {
  FORMAT_DIMS,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";

export type MarketingVariant = "quote" | "tip" | "cta" | "custom";

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
  /** quote */
  text?: string;
  attribution?: string;
  /** tip / cta / custom */
  headline?: string;
  body?: string;
  /** custom only — optional full-bleed background image (data: URL, CORS-proof export). */
  imageDataUrl?: string;
}

const EYEBROW: Record<MarketingVariant, string> = {
  quote: "",
  tip: "Tip",
  cta: "We're hiring",
  custom: "",
};

export function MarketingCard({
  variant,
  agencyName,
  network,
  format = "portrait",
  theme = "spotlight",
  page,
  text,
  attribution,
  headline,
  body,
  imageDataUrl,
}: MarketingCardProps) {
  const t = resolveCardTheme(theme);
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 84 : 64;
  const paginated = !!page && page.total > 1;
  const hasImage = variant === "custom" && !!imageDataUrl;

  // Over a photo we force a dark scrim + light ink so any theme stays legible.
  const onImageInk = "#ffffff";
  const ink = hasImage ? onImageInk : t.ink;
  const inkMuted = hasImage ? "rgba(255,255,255,0.78)" : t.inkMuted;
  const inkSubtle = hasImage ? "rgba(255,255,255,0.62)" : t.inkSubtle;
  const accent = hasImage ? "#ffffff" : t.accent;

  const sz = {
    eyebrow: isStory ? 26 : 22,
    quote: isStory ? 96 : 74,
    headline: isStory ? 92 : 70,
    body: isStory ? 40 : 32,
    attribution: isStory ? 30 : 25,
    foot: isStory ? 24 : 20,
  };

  const pageBg = hasImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(2,4,10,0.45) 0%, rgba(2,4,10,0.30) 40%, rgba(2,4,10,0.82) 100%), url(${imageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : themePageBackground(t);

  const eyebrow = EYEBROW[variant];

  // ── Variant body ──────────────────────────────────────────────────────────
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
  } else {
    // tip / cta / custom — headline + body, with a CTA chip for recruiting.
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
              font: `700 ${sz.headline}px ${t.disp}`,
              color: ink,
              lineHeight: 1.05,
              letterSpacing: "0.005em",
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
            DM us to apply
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

      {/* Eyebrow label (tip / hiring) */}
      {eyebrow ? (
        <div
          style={{
            marginTop: isStory ? 30 : 22,
            font: `800 ${sz.eyebrow}px ${t.sans}`,
            letterSpacing: "0.18em",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      {/* Body — vertically centered in the remaining space */}
      <div
        style={{
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

      {/* Quote attribution — anchored above the footer (a citation line) so the
          multi-line quote text can never overlap it, regardless of export metrics. */}
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
