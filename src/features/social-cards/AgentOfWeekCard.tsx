// src/features/social-cards/AgentOfWeekCard.tsx
// "Agent of the Week" hero — a single-agent spotlight, art-directed on the AGENCY'S
// OWN brand system (src/index.css): indigo #6366f1/#4f46e5/#818cf8, slate ink
// #0f172a, surfaces #1e293b/#0a0f1c/#141a2a, off-whites/grays — and the app fonts
// Big Shoulders Display (--font-display) + Inter (--font-sans), both loaded in
// index.html. The agent PHOTO is the hero: full-color, crisp, prominent — never
// hidden behind an overlay.
//
// Three design directions (stable keys are LEGACY ids so saved templates keep
// working — the rendered look + UI label have moved on):
//   • aurora    → "Spotlight" — dark indigo stage, glowing 3D portrait, 3D stat cards
//   • editorial → "Editorial" — black & white magazine, indigo 3D offset plate
//   • noir      → "Lift"      — light raised card, large portrait, rounded depth
//
// Everything renders in-browser, so the in-app PNG download (modern-screenshot) is
// pixel-faithful — no external render service, no PII leaving the tenant.

import { usd, FORMAT_DIMS, type SocialFormat } from "./socialFormat";
import { copyText, type CopyField, type CopyMap } from "./templateCopy";

// ── Editable text labels (the live agent name / AP / policies stay dynamic). ──
export const AOTW_COPY: CopyField[] = [
  {
    key: "agentOfWeekLabel",
    label: "Spotlight label",
    default: "Agent of the Week",
  },
  {
    key: "annualPremiumLabel",
    label: "AP stat label",
    default: "Annual Premium",
  },
  { key: "policiesLabel", label: "Policies stat label", default: "Policies" },
];

export type AowDesign = "aurora" | "editorial" | "noir";

/**
 * Optional per-card customization (Style panel). Every field is optional; an omitted
 * field uses the design's signature value, so the three looks render as approved
 * unless the owner deliberately overrides something.
 */
export interface AowStyle {
  /** Override the hero display font (the big name). Null/empty → Big Shoulders Display.
   *  Small supporting labels stay Inter for legibility regardless. */
  fontDisplay?: string | null;
  /** Override the card background (any CSS `background`). Null → design default. Only
   *  meaningful on the dark Spotlight design. */
  background?: string | null;
  /** Uploaded background image as a data: URL — Spotlight only (it has light text, so
   *  a dark scrim keeps it legible). Takes precedence over `background`. */
  backgroundImageUrl?: string | null;
  /** Multiplier on the agent-name size. Default 1. */
  titleScale?: number;
  /** Multiplier on the agency-name size. Default 1. */
  agencyScale?: number;
}

export interface AgentOfWeekCardProps {
  agencyName: string;
  network?: string;
  /** e.g. "WEEK OF JUN 14–20". */
  periodLabel: string;
  agent: {
    name: string;
    ap: number;
    policies: number;
    photoUrl?: string | null;
  };
  format?: SocialFormat;
  design?: AowDesign;
  /** Photo focal point ("x% y%") — drag-to-reposition in the studio. Default centered. */
  photoPosition?: string;
  style?: AowStyle;
  /** Per-field text overrides (keyed by AOTW_COPY keys); blank → the default. */
  copy?: CopyMap;
}

const BIG = '"Big Shoulders Display", "Arial Black", system-ui, sans-serif';
const SANS = '"Inter", system-ui, sans-serif';

// Brand tokens (src/index.css).
const C = {
  indigo: "#6366f1",
  indigoStrong: "#4f46e5",
  indigoLight: "#818cf8",
  ink: "#0f172a",
  slate: "#1e293b",
  dark: "#0a0f1c",
  cardDk: "#141a2a",
  white: "#ffffff",
  canvas: "#f8f9fb",
  line: "#e2e8f0",
  mute: "#64748b",
  subtle: "#94a3b8",
  pale: "#f1f5f9",
} as const;

// Each design's default background (overridable on Spotlight via style.background).
const DESIGN_BG: Record<AowDesign, string> = {
  aurora: C.dark,
  editorial: C.white,
  noir: C.canvas,
};

// Big Shoulders Display is condensed → more chars fit; scale the hero name by length
// so it stays on one line, then apply the owner's titleScale. (Deterministic — no DOM
// measuring — so it's identical in the live preview and the screenshot export.)
function heroNamePx(name: string, base: number, scale: number): number {
  const n = (name ?? "").length;
  const f = n <= 12 ? 1 : n <= 16 ? 0.84 : n <= 21 ? 0.7 : n <= 27 ? 0.58 : 0.5;
  return Math.round(base * f * scale);
}

// A crisp, full-color photo in a shaped frame. Never an overlay over the face — the
// frame (ring / shadow / offset plate) sits AROUND the subject. Renders a neutral
// branded placeholder when no photo was uploaded so the composition still holds.
function Photo({
  url,
  w,
  h,
  radius,
  objectPosition = "50% 50%",
  style,
}: {
  url?: string | null;
  w: number | string;
  h: number | string;
  radius: number | string;
  /** CSS object-position focal point ("x% y%") so the face can be dragged into frame. */
  objectPosition?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        flex: "none",
        borderRadius: radius,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${C.cardDk}, ${C.slate})`,
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
            objectPosition,
            display: "block",
            filter: "contrast(1.04) saturate(1.05)",
          }}
        />
      ) : null}
    </div>
  );
}

export function AgentOfWeekCard({
  agencyName,
  network,
  periodLabel,
  agent,
  format = "portrait",
  design = "aurora",
  photoPosition = "50% 50%",
  style,
  copy,
}: AgentOfWeekCardProps) {
  const { w: W, h: H } = FORMAT_DIMS[format];
  const st = style ?? {};
  const titleScale = st.titleScale ?? 1;
  const agencyScale = st.agencyScale ?? 1;
  const dispFont = st.fontDisplay || BIG;
  // Editable labels (shared across all three designs).
  const lblAotw = copyText(copy, "agentOfWeekLabel", "Agent of the Week");
  const lblAp = copyText(copy, "annualPremiumLabel", "Annual Premium");
  const lblPol = copyText(copy, "policiesLabel", "Policies");

  const base: React.CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  // ════════════════════════════════════════════════════════════════════════
  // EDITORIAL — black & white magazine, indigo 3D offset plate, huge type
  // ════════════════════════════════════════════════════════════════════════
  if (design === "editorial") {
    const pad = 80;
    return (
      <div
        style={{
          ...base,
          background: C.white,
          color: C.ink,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          padding: pad,
        }}
      >
        {/* masthead + heavy rule */}
        <div style={{ flex: "none" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
            }}
          >
            <span
              style={{
                font: `800 ${25 * agencyScale}px ${SANS}`,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "62%",
              }}
            >
              {agencyName}
            </span>
            <span
              style={{
                font: `600 14px ${SANS}`,
                letterSpacing: "0.18em",
                color: C.mute,
                textTransform: "uppercase",
              }}
            >
              {network ?? ""}
            </span>
          </div>
          <div style={{ height: 3, background: C.ink, marginTop: 18 }} />
        </div>

        {/* photo block — crisp photo + offset indigo plate behind (3D print depth) */}
        <div
          style={{
            flex: 1,
            position: "relative",
            minHeight: 0,
            margin: "40px 0",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "translate(18px, 18px)",
              background: C.indigo,
            }}
          />
          <Photo
            url={agent.photoUrl}
            w="100%"
            h="100%"
            radius={2}
            objectPosition={photoPosition}
            style={
              {
                position: "absolute",
                inset: 0,
                border: `3px solid ${C.ink}`,
                boxSizing: "border-box",
              } as React.CSSProperties
            }
          />
        </div>

        {/* tag + huge name */}
        <div style={{ flex: "none" }}>
          <span
            style={{
              display: "inline-block",
              background: C.ink,
              color: C.white,
              font: `700 13px ${SANS}`,
              letterSpacing: "0.12em",
              padding: "9px 15px",
              textTransform: "uppercase",
            }}
          >
            {lblAotw}
          </span>
          <div
            style={{
              font: `800 ${heroNamePx(agent.name, 130, titleScale)}px/0.86 ${dispFont}`,
              color: C.ink,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              marginTop: 14,
            }}
          >
            {agent.name}
          </div>
        </div>

        {/* stat band — sharp rules, two columns + period */}
        <div
          style={{
            flex: "none",
            borderTop: `3px solid ${C.ink}`,
            paddingTop: 24,
            display: "flex",
            alignItems: "flex-start",
            gap: 36,
          }}
        >
          <div>
            <div style={{ font: `800 76px/0.86 ${dispFont}`, color: C.ink }}>
              {usd(agent.ap)}
            </div>
            <div
              style={{
                font: `600 13px ${SANS}`,
                letterSpacing: "0.12em",
                color: C.mute,
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {lblAp}
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 32 }}>
            <div style={{ font: `800 76px/0.86 ${dispFont}`, color: C.ink }}>
              {agent.policies}
            </div>
            <div
              style={{
                font: `600 13px ${SANS}`,
                letterSpacing: "0.12em",
                color: C.mute,
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {lblPol}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div
              style={{
                font: `600 12px ${SANS}`,
                letterSpacing: "0.1em",
                color: C.subtle,
                textTransform: "uppercase",
              }}
            >
              {periodLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // NOIR key → "LIFT" — light raised card, large portrait, rounded 3D depth
  // ════════════════════════════════════════════════════════════════════════
  if (design === "noir") {
    const inset = Math.round(W * 0.05);
    const portraitH = Math.round(H * 0.41);
    const portraitW = Math.min(
      Math.round(W * 0.5),
      Math.round(portraitH * 0.9),
    );
    return (
      <div
        style={{
          ...base,
          background: C.canvas,
          fontFamily: SANS,
          padding: inset,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: C.white,
            borderRadius: 30,
            border: `1px solid ${C.line}`,
            boxShadow: "0 30px 70px rgba(15,23,42,0.14)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: "44px 50px 40px",
            boxSizing: "border-box",
          }}
        >
          {/* indigo top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              background: `linear-gradient(90deg, ${C.indigo}, ${C.indigoStrong})`,
            }}
          />
          {/* masthead */}
          <div
            style={{
              flex: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
            }}
          >
            <span
              style={{
                font: `800 ${23 * agencyScale}px ${SANS}`,
                letterSpacing: "0.03em",
                color: C.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "62%",
              }}
            >
              {agencyName}
            </span>
            <span
              style={{
                font: `600 12px ${SANS}`,
                letterSpacing: "0.22em",
                color: C.subtle,
                textTransform: "uppercase",
              }}
            >
              {network ?? ""}
            </span>
          </div>

          {/* portrait + kicker + name grouped, centered in the flexible middle */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 26,
              minHeight: 0,
            }}
          >
            <div
              style={{
                font: `700 14px ${SANS}`,
                letterSpacing: "0.32em",
                color: C.indigo,
                textTransform: "uppercase",
              }}
            >
              {lblAotw}
            </div>
            <Photo
              url={agent.photoUrl}
              w={portraitW}
              h={portraitH}
              radius={24}
              objectPosition={photoPosition}
              style={{
                boxShadow:
                  "0 28px 52px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(99,102,241,0.55)",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  font: `700 ${heroNamePx(agent.name, 92, titleScale)}px/0.92 ${dispFont}`,
                  color: C.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {agent.name}
              </div>
              <div
                style={{
                  width: 68,
                  height: 5,
                  borderRadius: 3,
                  background: C.indigo,
                  margin: "20px auto 0",
                }}
              />
            </div>
          </div>

          {/* two rounded depth stat cards */}
          <div style={{ flex: "none", display: "flex", gap: 26 }}>
            <LiftStat value={usd(agent.ap)} label={lblAp} font={dispFont} />
            <LiftStat
              value={String(agent.policies)}
              label={lblPol}
              font={dispFont}
            />
          </div>
          <div
            style={{
              flex: "none",
              textAlign: "center",
              marginTop: 22,
              font: `600 12px ${SANS}`,
              letterSpacing: "0.2em",
              color: C.subtle,
              textTransform: "uppercase",
            }}
          >
            {periodLabel}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // AURORA key → "SPOTLIGHT" — dark indigo stage, glowing 3D portrait
  // ════════════════════════════════════════════════════════════════════════
  // A custom photo background (Spotlight only) replaces the indigo stage; a dark scrim
  // keeps the light text legible. Otherwise the layered indigo glow renders.
  const bgImage = st.backgroundImageUrl || null;
  const rootBg = bgImage
    ? `url("${bgImage}") center / cover no-repeat`
    : st.background || DESIGN_BG.aurora;
  const portraitH = Math.round(H * 0.46);
  const portraitW = Math.min(
    Math.round(W * 0.54),
    Math.round(portraitH * 0.92),
  );
  return (
    <div
      style={{
        ...base,
        background: rootBg,
        color: C.pale,
        fontFamily: SANS,
      }}
    >
      {/* layered indigo atmosphere (only on the default stage, not over a photo bg) */}
      {!bgImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(58% 40% at 50% 33%, rgba(99,102,241,0.45), rgba(99,102,241,0) 66%)," +
              "radial-gradient(85% 42% at 50% -4%, rgba(40,52,74,0.85), rgba(40,52,74,0) 70%)," +
              "radial-gradient(95% 55% at 50% 112%, rgba(2,4,10,0.95), rgba(2,4,10,0) 62%)",
          }}
        />
      )}
      {bgImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,4,10,0.45), rgba(2,4,10,0.72))",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "74px 80px 80px",
          boxSizing: "border-box",
        }}
      >
        {/* masthead + hairline */}
        <div style={{ flex: "none" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span
              style={{
                font: `800 ${24 * agencyScale}px ${SANS}`,
                letterSpacing: "0.06em",
                color: C.white,
                whiteSpace: "nowrap",
              }}
            >
              {agencyName}
            </span>
            <span
              style={{
                font: `600 13px ${SANS}`,
                letterSpacing: "0.26em",
                color: C.subtle,
                textTransform: "uppercase",
              }}
            >
              {network ?? ""}
            </span>
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(241,245,249,0.12)",
              marginTop: 22,
            }}
          />
        </div>

        {/* portrait + kicker + name, centered in the flexible middle */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            minHeight: 0,
          }}
        >
          <Photo
            url={agent.photoUrl}
            w={portraitW}
            h={portraitH}
            radius={30}
            objectPosition={photoPosition}
            style={{
              boxShadow:
                "0 38px 80px rgba(0,0,0,0.62), 0 0 96px rgba(99,102,241,0.5), inset 0 0 0 2px rgba(129,140,248,0.85)",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                font: `700 16px ${SANS}`,
                letterSpacing: "0.36em",
                color: C.indigoLight,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              {lblAotw}
            </div>
            <div
              style={{
                font: `700 ${heroNamePx(agent.name, 116, titleScale)}px/0.92 ${dispFont}`,
                color: C.white,
                letterSpacing: "0.005em",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {agent.name}
            </div>
          </div>
        </div>

        {/* two lifted stat cards + period */}
        <div style={{ flex: "none" }}>
          <div style={{ display: "flex", gap: 26 }}>
            <SpotlightStat
              value={usd(agent.ap)}
              label={lblAp}
              font={dispFont}
            />
            <SpotlightStat
              value={String(agent.policies)}
              label={lblPol}
              font={dispFont}
            />
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 22,
              font: `600 12px ${SANS}`,
              letterSpacing: "0.24em",
              color: C.mute,
              textTransform: "uppercase",
            }}
          >
            {periodLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

// Dark lifted stat card (Spotlight) — indigo top accent, 3D shadow.
function SpotlightStat({
  value,
  label,
  font,
}: {
  value: string;
  label: string;
  font: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        background: C.cardDk,
        border: "1px solid rgba(241,245,249,0.10)",
        borderRadius: 18,
        padding: "30px 18px 24px",
        textAlign: "center",
        boxShadow: "0 18px 34px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 48,
          height: 4,
          borderRadius: 3,
          background: C.indigo,
        }}
      />
      <div style={{ font: `700 64px/1 ${font}`, color: C.white }}>{value}</div>
      <div
        style={{
          font: `600 12px ${SANS}`,
          letterSpacing: "0.18em",
          color: C.subtle,
          textTransform: "uppercase",
          marginTop: 10,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Light rounded depth stat card (Lift) — indigo top accent, soft lift shadow.
function LiftStat({
  value,
  label,
  font,
}: {
  value: string;
  label: string;
  font: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        background: C.canvas,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        padding: "32px 18px 26px",
        textAlign: "center",
        boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 46,
          height: 4,
          borderRadius: 3,
          background: C.indigo,
        }}
      />
      <div style={{ font: `700 64px/1 ${font}`, color: C.ink }}>{value}</div>
      <div
        style={{
          font: `600 12px ${SANS}`,
          letterSpacing: "0.18em",
          color: C.mute,
          textTransform: "uppercase",
          marginTop: 10,
        }}
      >
        {label}
      </div>
    </div>
  );
}
