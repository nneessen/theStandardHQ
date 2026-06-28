// src/features/social-cards/MarketingCard.tsx
// Marketing slides for the carousel builder (#8) — NOT one template with swapped text. Each
// archetype is its OWN layered composition with a distinct background, framing device and
// graphic elements, so a deck reads like a designed carousel and swiping feels dynamic:
//   hook   — bold poster: gold diagonal band, ghost index numeral, last-word highlight
//   stat   — gold spotlight: sunburst rays behind a giant dark number on a gold field
//   list   — timeline: a gold rail threads numbered nodes through offset row cards
//   checklist — neobrutalist cards with hard offset shadows + check chips on a dot grid
//   compare — split screen: hard diagonal, ✗ panel vs glowing ✓ panel, VS emblem
//   quote  — editorial: a giant ghost quotation mark behind a bold pull-quote
//   tip    — a tilted highlight card (sticky-note) with a star badge
//   cta    — action close: violet→magenta, keyword sticker, comment bubble, big arrow
//   custom — copy over the user's own photo.
//
// Self-contained (own palette + fonts) → pixel-faithful PNG export.
// EXPORT QUIRK: modern-screenshot under-measures multi-line DISPLAY-font height → multi-line
// copy uses heavy SANS; the DISPLAY face is used only for single-line text sized to fit.

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
  theme?: CardTheme;
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

const BIG = '"Big Shoulders Display","Arial Black",system-ui,sans-serif';
const SANS = '"Inter",system-ui,sans-serif';

// On-brand-but-vivid palette (indigo heritage, pushed bold for marketing).
const C = {
  night: "#0a0a18",
  ink: "#100a26",
  gold: "#fde047",
  goldDeep: "#f5c518",
  goldInk: "#1a1205",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  magenta: "#d946ef",
  cyan: "#22d3ee",
  white: "#ffffff",
} as const;

const DEFAULT_EYEBROW: Partial<Record<MarketingVariant, string>> = {
  tip: "Pro tip",
  cta: "Now hiring",
};

export function MarketingCard(props: MarketingCardProps) {
  const { variant, format = "portrait", theme = "spotlight", page } = props;
  const isStory = format === "story";
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = isStory ? 92 : 76;
  const light = resolveCardTheme(theme).mode === "light";
  const eyebrow = (props.eyebrow ?? DEFAULT_EYEBROW[variant] ?? "").trim();
  // Slides whose stage is light (the gold stat field) need dark chrome.
  const chromeDark = variant === "stat";

  const ctx: Ctx = { ...props, W, H, PAD, isStory, light, eyebrow, page };

  let inner: React.ReactNode;
  let bg: React.CSSProperties;
  switch (variant) {
    case "stat":
      [inner, bg] = renderStat(ctx);
      break;
    case "list":
      [inner, bg] = renderList(ctx);
      break;
    case "checklist":
      [inner, bg] = renderChecklist(ctx);
      break;
    case "compare":
      [inner, bg] = renderCompare(ctx);
      break;
    case "quote":
      [inner, bg] = renderQuote(ctx);
      break;
    case "tip":
      [inner, bg] = renderTip(ctx);
      break;
    case "cta":
      [inner, bg] = renderCta(ctx);
      break;
    case "custom":
      [inner, bg] = renderCustom(ctx);
      break;
    case "hook":
    default:
      [inner, bg] = renderHook(ctx);
      break;
  }

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: SANS,
        ...bg,
      }}
    >
      {inner}
      <ProgressDots ctx={ctx} dark={chromeDark} />
      <BrandTag ctx={ctx} dark={chromeDark} />
    </div>
  );
}

// ── shared context + helpers ───────────────────────────────────────────────
interface Ctx extends MarketingCardProps {
  W: number;
  H: number;
  PAD: number;
  isStory: boolean;
  light: boolean;
  eyebrow: string;
  page?: CardPageInfo;
}

/** Progress dots, bottom-left — the one piece of consistent wayfinding. */
function ProgressDots({ ctx, dark }: { ctx: Ctx; dark: boolean }) {
  const { page, PAD, isStory } = ctx;
  if (!page || page.total <= 1) return null;
  const onColor = dark ? C.goldInk : C.gold;
  const offColor = dark ? "rgba(26,18,5,0.32)" : "rgba(255,255,255,0.4)";
  return (
    <div
      style={{
        position: "absolute",
        left: PAD,
        bottom: isStory ? 56 : 44,
        display: "flex",
        gap: isStory ? 10 : 8,
        zIndex: 5,
      }}
    >
      {Array.from({ length: page.total }).map((_, i) => {
        const on = i + 1 === page.index;
        return (
          <span
            key={i}
            style={{
              width: on ? (isStory ? 30 : 26) : isStory ? 10 : 9,
              height: isStory ? 10 : 9,
              borderRadius: 999,
              background: on ? onColor : offColor,
              boxShadow: on && !dark ? `0 0 12px ${C.gold}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/** Small agency tag, bottom-right. */
function BrandTag({ ctx, dark }: { ctx: Ctx; dark: boolean }) {
  const { agencyName, network, PAD, isStory } = ctx;
  return (
    <div
      style={{
        position: "absolute",
        right: PAD,
        bottom: isStory ? 54 : 42,
        font: `800 ${isStory ? 22 : 18}px ${SANS}`,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: dark ? "rgba(26,18,5,0.5)" : "rgba(255,255,255,0.45)",
        zIndex: 5,
      }}
    >
      {network || agencyName}
    </div>
  );
}

/** A rotated accent sticker tag. */
function Sticker({
  text,
  isStory,
  bg = C.gold,
  ink = C.goldInk,
  rotate = -2.5,
}: {
  text: string;
  isStory: boolean;
  bg?: string;
  ink?: string;
  rotate?: number;
}) {
  return (
    <span
      style={{
        alignSelf: "flex-start",
        font: `800 ${isStory ? 26 : 22}px ${SANS}`,
        color: ink,
        background: bg,
        padding: `${isStory ? 12 : 10}px ${isStory ? 24 : 18}px`,
        borderRadius: 999,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        transform: `rotate(${rotate}deg)`,
        boxShadow: `0 14px 36px ${bg}55`,
      }}
    >
      {text}
    </span>
  );
}

/** A radial dot-grid texture overlay. */
function dotGrid(color: string, gap: number): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundImage: `radial-gradient(${color} 2px, transparent 2px)`,
    backgroundSize: `${gap}px ${gap}px`,
    pointerEvents: "none",
  };
}

/** A blurred color orb that bleeds off an edge. */
function orb(
  color: string,
  size: number,
  pos: Partial<Record<"top" | "left" | "right" | "bottom", number>>,
  opacity = 0.55,
): React.CSSProperties {
  return {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: 999,
    background: color,
    filter: "blur(10px)",
    opacity,
    pointerEvents: "none",
    ...pos,
  };
}

/** Sunburst rays via stacked rotated bars (modern-screenshot-safe). */
function Sunburst({
  size,
  color,
  count = 16,
}: {
  size: number;
  color: string;
  count?: number;
}) {
  return (
    <div style={{ position: "absolute", width: size, height: size }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 0.5,
            height: size * 0.045,
            background: color,
            transformOrigin: "0% 50%",
            transform: `rotate(${(360 / count) * i}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// Heuristic display-font fit for one line (Big Shoulders ≈ condensed; 0.6 is safe).
const fitOneLine = (s: string, max: number, avail: number, em = 0.6) =>
  Math.max(36, Math.min(max, Math.floor(avail / Math.max(1, s.length * em))));

// ════════════════════════════════════════════════════════════════════════════
// HOOK — bold poster: dark night, gold diagonal band, ghost index numeral
// ════════════════════════════════════════════════════════════════════════════
function renderHook(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { W, H, PAD, isStory, eyebrow, page } = ctx;
  const headline = (ctx.headline ?? "").trim();
  const onPhoto = !!ctx.imageDataUrl;
  const words = headline.split(/\s+/).filter(Boolean);
  const lastWord = words.length > 1 ? words.pop()! : "";
  const lead = words.join(" ");
  const hl = headline.length;
  const size = isStory
    ? hl < 28
      ? 168
      : hl < 46
        ? 140
        : 116
    : hl < 22
      ? 138
      : hl < 38
        ? 116
        : hl < 56
          ? 98
          : 84;
  const idx = page ? String(page.index).padStart(2, "0") : "";

  const bg: React.CSSProperties = onPhoto
    ? {
        backgroundImage: `linear-gradient(176deg, rgba(7,6,20,0.40) 0%, rgba(7,6,20,0.30) 36%, rgba(7,6,20,0.92) 100%), url(${ctx.imageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(155deg, ${C.indigo} 0%, ${C.night} 46%, ${C.ink} 100%)`,
      };

  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      {!onPhoto && (
        <>
          <div
            style={orb(
              C.magenta,
              isStory ? 420 : 340,
              { top: -120, right: -120 },
              0.5,
            )}
          />
          <div style={dotGrid("rgba(255,255,255,0.08)", 34)} />
          {/* gold diagonal band across the lower third */}
          <div
            style={{
              position: "absolute",
              left: -40,
              right: -40,
              bottom: isStory ? 250 : 210,
              height: isStory ? 150 : 124,
              background: `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})`,
              transform: "rotate(-4deg)",
              opacity: 0.16,
            }}
          />
          {/* ghost index numeral */}
          {idx ? (
            <div
              style={{
                position: "absolute",
                right: isStory ? 30 : 8,
                bottom: isStory ? 150 : 120,
                font: `800 ${isStory ? 560 : 460}px ${BIG}`,
                color: "rgba(255,255,255,0.05)",
                lineHeight: 0.7,
              }}
            >
              {idx}
            </div>
          ) : null}
        </>
      )}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: isStory ? 32 : 24,
        }}
      >
        {eyebrow ? <Sticker text={eyebrow} isStory={isStory} /> : null}
        {headline ? (
          <div
            style={{
              font: `900 ${size}px ${SANS}`,
              color: C.white,
              lineHeight: 0.97,
              letterSpacing: "-0.03em",
              textShadow: onPhoto ? "0 4px 30px rgba(0,0,0,0.5)" : "none",
            }}
          >
            {lead}{" "}
            {lastWord ? (
              <span style={{ color: C.gold }}>{lastWord}</span>
            ) : null}
          </div>
        ) : null}
        <span
          style={{
            width: isStory ? 140 : 110,
            height: isStory ? 12 : 9,
            background: C.gold,
            borderRadius: 999,
            boxShadow: `0 0 24px ${C.gold}`,
          }}
        />
        {ctx.subheadline ? (
          <div
            style={{
              font: `500 ${isStory ? 44 : 36}px ${SANS}`,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.3,
              maxWidth: "92%",
            }}
          >
            {ctx.subheadline}
          </div>
        ) : null}
      </div>
      {/* swipe cue, bottom center-ish */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: isStory ? 52 : 42,
          transform: "translateX(-50%)",
          font: `800 ${isStory ? 22 : 18}px ${SANS}`,
          color: C.gold,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        Swipe <span style={{ fontSize: isStory ? 28 : 24 }}>→</span>
      </div>
    </div>
  );
  void W;
  void H;
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// STAT — gold spotlight: sunburst behind a giant dark number on a gold field
// ════════════════════════════════════════════════════════════════════════════
function renderStat(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { W, PAD, isStory, eyebrow } = ctx;
  const stat = (ctx.stat ?? "").trim();
  const innerW = W - PAD * 2;
  const statPx = stat ? fitOneLine(stat, isStory ? 460 : 380, innerW, 0.62) : 0;
  const bg: React.CSSProperties = {
    background: `radial-gradient(120% 90% at 50% 42%, ${C.gold} 0%, ${C.goldDeep} 70%, #e0a90a 100%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          ...dotGrid("rgba(26,18,5,0.08)", 30),
        }}
      />
      {/* deliberate ray-fan from the bottom-right corner */}
      <div
        style={{
          position: "absolute",
          right: isStory ? -280 : -230,
          bottom: isStory ? -280 : -230,
          opacity: 0.14,
        }}
      >
        <Sunburst size={isStory ? 920 : 780} color={C.goldInk} count={28} />
      </div>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: isStory ? 18 : 14,
        }}
      >
        {eyebrow ? (
          <Sticker
            text={eyebrow}
            isStory={isStory}
            bg={C.goldInk}
            ink={C.gold}
            rotate={-2}
          />
        ) : null}
        {stat ? (
          <div
            style={{
              font: `800 ${statPx}px ${BIG}`,
              color: C.goldInk,
              lineHeight: 0.84,
              letterSpacing: "-0.02em",
            }}
          >
            {stat}
          </div>
        ) : null}
        {ctx.statLabel ? (
          <div
            style={{
              font: `800 ${isStory ? 52 : 42}px ${SANS}`,
              color: C.goldInk,
              lineHeight: 1.06,
              letterSpacing: "-0.01em",
              maxWidth: "92%",
            }}
          >
            {ctx.statLabel}
          </div>
        ) : null}
        {ctx.body ? (
          <div
            style={{
              marginTop: isStory ? 10 : 6,
              font: `600 ${isStory ? 38 : 30}px ${SANS}`,
              color: "rgba(26,18,5,0.72)",
              lineHeight: 1.32,
              maxWidth: "90%",
            }}
          >
            {ctx.body}
          </div>
        ) : null}
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// LIST — timeline: a gold rail threads numbered nodes through offset row cards
// ════════════════════════════════════════════════════════════════════════════
function renderList(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory } = ctx;
  const rows = (ctx.items ?? []).filter((it) => it && (it.label || it.detail));
  const node = isStory ? 82 : 68;
  const bg: React.CSSProperties = {
    background: `linear-gradient(160deg, ${C.ink} 0%, ${C.night} 70%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={orb(
          C.violet,
          isStory ? 360 : 300,
          { bottom: -120, right: -120 },
          0.4,
        )}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {ctx.headline ? (
          <SectionHead text={ctx.headline} isStory={isStory} />
        ) : null}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: isStory ? 18 : 13,
          }}
        >
          {/* the rail */}
          <div
            style={{
              position: "absolute",
              left: node / 2 - 2,
              top: node / 2,
              bottom: node / 2,
              width: 4,
              background: `linear-gradient(${C.gold}, ${C.violet})`,
              opacity: 0.5,
              borderRadius: 999,
            }}
          />
          {rows.map((it, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: isStory ? 26 : 20,
              }}
            >
              <div
                style={{
                  width: node,
                  height: node,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: i === 0 ? C.gold : C.night,
                  border: `3px solid ${i === 0 ? C.gold : "rgba(253,224,71,0.55)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: i === 0 ? `0 0 26px ${C.gold}88` : "none",
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    font: `800 ${isStory ? 46 : 38}px ${BIG}`,
                    color: i === 0 ? C.goldInk : C.white,
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: `${isStory ? 18 : 14}px ${isStory ? 26 : 20}px`,
                }}
              >
                <div
                  style={{
                    font: `800 ${isStory ? 42 : 35}px ${SANS}`,
                    color: C.white,
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {it.label}
                </div>
                {it.detail ? (
                  <div
                    style={{
                      marginTop: 3,
                      font: `500 ${isStory ? 32 : 26}px ${SANS}`,
                      color: "rgba(255,255,255,0.66)",
                      lineHeight: 1.25,
                    }}
                  >
                    {it.detail}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// CHECKLIST — neobrutalist cards with hard offset shadows on a dot grid
// ════════════════════════════════════════════════════════════════════════════
function renderChecklist(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory } = ctx;
  const lines = (ctx.bullets ?? []).filter(Boolean);
  const bg: React.CSSProperties = {
    background: `linear-gradient(150deg, ${C.violet} 0%, ${C.ink} 55%, ${C.night} 100%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div style={dotGrid("rgba(255,255,255,0.07)", 32)} />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: isStory ? 18 : 13,
        }}
      >
        {ctx.headline ? (
          <SectionHead text={ctx.headline} isStory={isStory} />
        ) : null}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: isStory ? 24 : 18,
              padding: `${isStory ? 22 : 17}px ${isStory ? 26 : 22}px`,
              background: C.night,
              border: `2px solid ${C.gold}`,
              borderRadius: 16,
              boxShadow: `${isStory ? 10 : 8}px ${isStory ? 10 : 8}px 0 0 rgba(253,224,71,0.32)`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: isStory ? 52 : 44,
                height: isStory ? 52 : 44,
                borderRadius: 999,
                background: C.gold,
                color: C.goldInk,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `800 ${isStory ? 30 : 25}px ${SANS}`,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              &#10003;
            </span>
            <span
              style={{
                font: `700 ${isStory ? 42 : 34}px ${SANS}`,
                color: C.white,
                lineHeight: 1.2,
                flex: 1,
                minWidth: 0,
              }}
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// COMPARE — split screen: hard diagonal, ✗ panel vs glowing ✓ panel, VS emblem
// ════════════════════════════════════════════════════════════════════════════
function renderCompare(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory } = ctx;
  const cmp = ctx.compare;
  const bg: React.CSSProperties = {
    background: `linear-gradient(105deg, #241327 0% 50%, ${C.ink} 50% 100%)`,
  };
  const colItems = (items: string[] | undefined, win: boolean) =>
    (items ?? []).filter(Boolean).map((line, i) => (
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
            background: win ? C.gold : "rgba(255,255,255,0.08)",
            color: win ? C.goldInk : "#ef6f7b",
            border: win ? "none" : "2px solid rgba(239,111,123,0.6)",
            font: `800 ${isStory ? 22 : 18}px ${SANS}`,
            lineHeight: 1,
          }}
        >
          {win ? "✓" : "✕"}
        </span>
        <span
          style={{
            font: `500 ${isStory ? 34 : 27}px ${SANS}`,
            color: win ? C.white : "rgba(255,255,255,0.62)",
            lineHeight: 1.26,
          }}
        >
          {line}
        </span>
      </div>
    ));
  const panel = (c: SlideCompareColumn | undefined, win: boolean) => (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: isStory ? 18 : 14,
        padding: isStory ? 34 : 28,
        borderRadius: 24,
        background: win
          ? "linear-gradient(160deg, rgba(253,224,71,0.18), rgba(217,70,239,0.14))"
          : "rgba(255,255,255,0.04)",
        border: `2px solid ${win ? C.gold : "rgba(255,255,255,0.12)"}`,
        boxShadow: win ? `0 24px 70px rgba(253,224,71,0.20)` : "none",
      }}
    >
      <div
        style={{
          font: `800 ${isStory ? 40 : 32}px ${SANS}`,
          color: win ? C.gold : "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
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
        {colItems(c?.items, win)}
      </div>
    </div>
  );
  const inner = cmp ? (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: isStory ? 28 : 22,
        }}
      >
        {ctx.headline ? (
          <SectionHead text={ctx.headline} isStory={isStory} />
        ) : null}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: isStory ? 40 : 34,
            alignItems: "stretch",
          }}
        >
          {panel(cmp.left, false)}
          {panel(cmp.right, true)}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: isStory ? 84 : 68,
              height: isStory ? 84 : 68,
              borderRadius: 999,
              background: C.night,
              border: `3px solid ${C.gold}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `900 ${isStory ? 32 : 26}px ${SANS}`,
              color: C.gold,
              boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 24px ${C.gold}66`,
              zIndex: 3,
            }}
          >
            VS
          </div>
        </div>
      </div>
    </div>
  ) : null;
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// QUOTE — editorial: a giant ghost quotation mark behind a bold pull-quote
// ════════════════════════════════════════════════════════════════════════════
function renderQuote(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory } = ctx;
  const bg: React.CSSProperties = {
    background: `radial-gradient(120% 80% at 80% 12%, #1c1340 0%, ${C.night} 70%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={orb(
          C.magenta,
          isStory ? 360 : 300,
          { top: -110, right: -90 },
          0.4,
        )}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: PAD - (isStory ? 24 : 18),
          top: isStory ? 150 : 110,
          font: `800 ${isStory ? 640 : 540}px ${BIG}`,
          color: "rgba(253,224,71,0.14)",
          lineHeight: 0.7,
        }}
      >
        &ldquo;
      </div>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: isStory ? 32 : 24,
        }}
      >
        <div
          style={{
            font: `800 ${isStory ? 90 : 70}px ${SANS}`,
            color: C.white,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
          }}
        >
          {ctx.text}
        </div>
        {ctx.attribution ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                width: isStory ? 56 : 46,
                height: 4,
                background: C.gold,
                borderRadius: 999,
              }}
            />
            <span
              style={{
                font: `700 ${isStory ? 34 : 28}px ${SANS}`,
                color: C.gold,
                letterSpacing: "0.02em",
              }}
            >
              {ctx.attribution}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// TIP — a tilted highlight card (sticky-note) with a star badge on a dot grid
// ════════════════════════════════════════════════════════════════════════════
function renderTip(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory, eyebrow } = ctx;
  const bg: React.CSSProperties = {
    background: `linear-gradient(160deg, ${C.indigo} 0%, ${C.ink} 60%, ${C.night} 100%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div style={dotGrid("rgba(255,255,255,0.07)", 32)} />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            background: C.gold,
            color: C.goldInk,
            borderRadius: 28,
            padding: isStory ? 64 : 52,
            transform: "rotate(-1.5deg)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: isStory ? 24 : 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                width: isStory ? 64 : 54,
                height: isStory ? 64 : 54,
                borderRadius: 16,
                background: C.goldInk,
                color: C.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `800 ${isStory ? 38 : 32}px ${SANS}`,
                transform: "rotate(3deg)",
              }}
            >
              ★
            </span>
            <span
              style={{
                font: `800 ${isStory ? 28 : 23}px ${SANS}`,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow || "Pro tip"}
            </span>
          </div>
          {ctx.headline ? (
            <div
              style={{
                font: `900 ${isStory ? 80 : 62}px ${SANS}`,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
              }}
            >
              {ctx.headline}
            </div>
          ) : null}
          {ctx.body ? (
            <div
              style={{
                font: `500 ${isStory ? 42 : 34}px ${SANS}`,
                lineHeight: 1.32,
                color: "rgba(26,18,5,0.82)",
              }}
            >
              {ctx.body}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// CTA — action close: violet→magenta, keyword sticker, comment bubble, arrow
// ════════════════════════════════════════════════════════════════════════════
function renderCta(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory, eyebrow } = ctx;
  const action = (ctx.ctaAction ?? "").trim() || "DM us to apply";
  const bg: React.CSSProperties = {
    background: `linear-gradient(150deg, ${C.violet} 0%, ${C.magenta} 55%, ${C.indigo} 100%)`,
  };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={orb(
          C.gold,
          isStory ? 360 : 300,
          { top: -110, right: -110 },
          0.4,
        )}
      />
      <div style={dotGrid("rgba(255,255,255,0.10)", 34)} />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: isStory ? 30 : 22,
        }}
      >
        {eyebrow ? <Sticker text={eyebrow} isStory={isStory} /> : null}
        {ctx.headline ? (
          <div
            style={{
              font: `900 ${isStory ? 100 : 78}px ${SANS}`,
              color: C.white,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            {ctx.headline}
          </div>
        ) : null}
        {ctx.body ? (
          <div
            style={{
              font: `500 ${isStory ? 44 : 36}px ${SANS}`,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.32,
              maxWidth: "92%",
            }}
          >
            {ctx.body}
          </div>
        ) : null}
        <div
          style={{
            marginTop: isStory ? 14 : 8,
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            font: `900 ${isStory ? 46 : 38}px ${SANS}`,
            color: C.goldInk,
            background: C.gold,
            padding: `${isStory ? 28 : 22}px ${isStory ? 46 : 36}px`,
            borderRadius: 999,
            boxShadow: `0 20px 54px rgba(0,0,0,0.35)`,
          }}
        >
          {action}
          <span style={{ fontSize: isStory ? 48 : 40, lineHeight: 1 }}>→</span>
        </div>
      </div>
    </div>
  );
  return [inner, bg];
}

// ════════════════════════════════════════════════════════════════════════════
// CUSTOM — copy over the user's own photo (rich scrim).
// ════════════════════════════════════════════════════════════════════════════
function renderCustom(ctx: Ctx): [React.ReactNode, React.CSSProperties] {
  const { PAD, isStory, eyebrow } = ctx;
  const bg: React.CSSProperties = ctx.imageDataUrl
    ? {
        backgroundImage: `linear-gradient(176deg, rgba(7,6,20,0.34) 0%, rgba(7,6,20,0.30) 40%, rgba(7,6,20,0.92) 100%), url(${ctx.imageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: `linear-gradient(155deg, ${C.indigo}, ${C.night})` };
  const inner = (
    <div style={{ position: "absolute", inset: 0, padding: PAD }}>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: isStory ? 26 : 20,
          paddingBottom: isStory ? 90 : 70,
        }}
      >
        {eyebrow ? <Sticker text={eyebrow} isStory={isStory} /> : null}
        {ctx.headline ? (
          <div
            style={{
              font: `900 ${isStory ? 96 : 74}px ${SANS}`,
              color: C.white,
              lineHeight: 1.03,
              letterSpacing: "-0.025em",
              textShadow: "0 4px 30px rgba(0,0,0,0.5)",
            }}
          >
            {ctx.headline}
          </div>
        ) : null}
        {ctx.body ? (
          <div
            style={{
              font: `500 ${isStory ? 44 : 35}px ${SANS}`,
              color: "rgba(255,255,255,0.86)",
              lineHeight: 1.32,
              maxWidth: "92%",
            }}
          >
            {ctx.body}
          </div>
        ) : null}
      </div>
    </div>
  );
  return [inner, bg];
}

/** Big bold section heading used by list / checklist / compare. */
function SectionHead({ text, isStory }: { text: string; isStory: boolean }) {
  return (
    <div
      style={{
        font: `900 ${isStory ? 72 : 56}px ${SANS}`,
        color: C.white,
        lineHeight: 1.02,
        letterSpacing: "-0.025em",
        marginBottom: isStory ? 16 : 12,
      }}
    >
      {text}
    </div>
  );
}
