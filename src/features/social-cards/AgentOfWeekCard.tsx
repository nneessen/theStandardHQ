// src/features/leaderboard/social/AgentOfWeekCard.tsx
// Bespoke "Agent of the Week" hero — deliberately NOT the leaderboard table.
// A single-agent spotlight built on real editorial principles: dominant subject,
// strong typographic hierarchy, intentional negative space, one confident accent.
//
// Three self-contained design directions (own palettes + fonts, independent of the
// app theme tokens — these are creative templates, not the dashboard look):
//   • aurora    — vibrant gradient + glassmorphism, geometric display (Unbounded)
//   • editorial — warm cream magazine cover, oversized serif (Instrument Serif)
//   • noir      — dark cinematic spotlight + gold, modern display (Syne)
//
// Fonts load via the app index.html (and the render harness <link>). Step-3
// customization: an optional `style` prop lets the studio override the display
// font, the background, and the name / agency-name sizes WITHOUT touching the
// per-design defaults (every field is optional → existing callers are unchanged).

import { usd, FORMAT_DIMS, type SocialFormat } from "./socialFormat";

export type AowDesign = "aurora" | "editorial" | "noir";

/**
 * Optional per-card customization (Step 3). Every field is optional; when a field
 * is omitted the design's own signature value is used, so the three approved looks
 * render identically to before unless the owner deliberately overrides something.
 */
export interface AowStyle {
  /** Override the hero display font-family (the big name + the design's signature
   *  numerals; in aurora it also drives the agency wordmark). Null/empty → the
   *  design's signature font. The small supporting labels (the "Agent of the Week"
   *  eyebrow, period, stat captions) stay grotesk for legibility regardless. */
  fontDisplay?: string | null;
  /** Override the card background (any CSS `background` value). Null → design default. */
  background?: string | null;
  /** Uploaded background image as a data: URL. When set it layers behind the
   *  content with a fixed dark scrim for legibility and takes precedence over
   *  `background`. Only offered for the light-text designs (aurora / noir). */
  backgroundImageUrl?: string | null;
  /** Multiplier on the agent-name size. Default 1. */
  titleScale?: number;
  /** Multiplier on the agency-name size. Default 1 (the owner wants "a lot larger"). */
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
  style?: AowStyle;
}

const FONT = {
  unbounded: '"Unbounded", system-ui, sans-serif',
  syne: '"Syne", system-ui, sans-serif',
  grotesk: '"Space Grotesk", system-ui, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
};

// Each design's signature display font (used when style.fontDisplay is unset).
const SIGNATURE_FONT: Record<AowDesign, string> = {
  aurora: FONT.unbounded,
  editorial: FONT.serif,
  noir: FONT.syne,
};

// Each design's default background (used when neither style.backgroundImageUrl
// nor style.background is set).
const DESIGN_BG: Record<AowDesign, string> = {
  aurora: "linear-gradient(150deg, #5b6bff 0%, #8b5cf6 42%, #ff6a8d 100%)",
  editorial: "#f4efe3",
  noir: "radial-gradient(80% 60% at 50% 32%, #241a10 0%, #0c0b0d 60%, #060507 100%)",
};

type PhotoShapeKind = "arch" | "circle" | "blob";

/**
 * The agent's UPLOADED photo cropped into a distinctive shape (never a plain
 * rectangle): an editorial "arch", a ringed "circle", or an organic "blob". Render
 * this ONLY when a photo exists — there is intentionally no initials/monogram
 * placeholder (it added clutter with no information; the name carries the identity).
 */
function PhotoShape({
  url,
  shape,
  w,
  h,
  ring,
}: {
  url: string;
  shape: PhotoShapeKind;
  w: number;
  h: number;
  ring: string;
}) {
  const radius =
    shape === "circle"
      ? "50%"
      : shape === "arch"
        ? `${w / 2}px ${w / 2}px 26px 26px`
        : "62% 38% 47% 53% / 58% 52% 48% 42%";
  return (
    <div
      style={{
        width: w,
        height: h,
        flex: "none",
        borderRadius: radius,
        overflow: "hidden",
        border: ring,
        boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
      }}
    >
      <img
        src={url}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
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
  style,
}: AgentOfWeekCardProps) {
  const { w: W, h: H } = FORMAT_DIMS[format];

  // Resolve the Step-3 customization with per-design fallbacks.
  const st = style ?? {};
  const titleScale = st.titleScale ?? 1;
  const agencyScale = st.agencyScale ?? 1;
  const dispFont = st.fontDisplay || SIGNATURE_FONT[design];
  // Self-defending: a background image only makes sense on the light-text designs
  // (the scrim is dark). Ignore it on editorial (dark text on cream) so a future
  // caller — e.g. a Step-4 saved template — can't darken editorial into illegibility.
  const bgImage = design !== "editorial" ? st.backgroundImageUrl || null : null;
  const rootBg = bgImage
    ? `url("${bgImage}") center / cover no-repeat`
    : st.background || DESIGN_BG[design];

  const base: React.CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  // Dark legibility scrim, rendered FIRST (behind the content) only when a custom
  // background image is set. Keeps the light-text designs readable over any photo.
  const scrim = bgImage ? (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.62))",
        pointerEvents: "none",
      }}
    />
  ) : null;

  if (design === "editorial") {
    return (
      <div style={{ ...base, background: rootBg, padding: 84 }}>
        {scrim}
        {/* corner index */}
        <div
          style={{
            position: "absolute",
            inset: 84,
            border: "1px solid rgba(26,23,20,0.16)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 36,
          }}
        >
          {/* masthead */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span
              style={{
                font: `700 ${19 * agencyScale}px ${FONT.grotesk}`,
                letterSpacing: "0.32em",
                color: "#1a1714",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "60%",
              }}
            >
              {agencyName}
            </span>
            <span
              style={{
                font: `400 18px ${FONT.grotesk}`,
                letterSpacing: "0.32em",
                color: "#9a8f7d",
                textTransform: "uppercase",
              }}
            >
              {network ?? ""}
            </span>
          </div>

          {/* arch portrait, upper-right — only when a photo was uploaded */}
          {agent.photoUrl && (
            <div style={{ position: "absolute", top: 96, right: 4 }}>
              <PhotoShape
                url={agent.photoUrl}
                shape="arch"
                w={228}
                h={300}
                ring="5px solid #1a1714"
              />
            </div>
          )}

          {/* hero */}
          <div>
            <div
              style={{
                font: `700 22px ${FONT.grotesk}`,
                letterSpacing: "0.42em",
                color: "#ef5a3c",
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              Agent of the Week
            </div>
            <div
              style={{
                font: `400 ${168 * titleScale}px ${dispFont}`,
                lineHeight: 0.92,
                color: "#1a1714",
                letterSpacing: "-0.01em",
                maxWidth: 560,
              }}
            >
              {agent.name}
            </div>
            {/* `italic` MUST live inside the font shorthand — a separate fontStyle key
                before `font` gets reset to normal by the shorthand. Follows dispFont so
                the picked font reaches this caption too (default dispFont = the serif). */}
            <div
              style={{
                marginTop: 26,
                font: `italic 400 38px ${dispFont}`,
                color: "#6b5f4d",
              }}
            >
              — top producer, {periodLabel.toLowerCase()}
            </div>
          </div>

          {/* stat strip */}
          <div
            style={{
              borderTop: "2px solid #1a1714",
              paddingTop: 26,
              display: "flex",
              gap: 64,
              alignItems: "flex-end",
            }}
          >
            <div>
              <div
                style={{
                  font: `700 15px ${FONT.grotesk}`,
                  letterSpacing: "0.26em",
                  color: "#9a8f7d",
                  textTransform: "uppercase",
                }}
              >
                Annual Premium
              </div>
              <div
                style={{
                  font: `500 92px ${FONT.grotesk}`,
                  color: "#1a1714",
                  letterSpacing: "-0.02em",
                  marginTop: 6,
                }}
              >
                {usd(agent.ap)}
              </div>
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div
                style={{
                  font: `700 15px ${FONT.grotesk}`,
                  letterSpacing: "0.26em",
                  color: "#9a8f7d",
                  textTransform: "uppercase",
                }}
              >
                Policies
              </div>
              <div
                style={{
                  font: `500 56px ${FONT.grotesk}`,
                  color: "#ef5a3c",
                  marginTop: 6,
                }}
              >
                {agent.policies}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (design === "noir") {
    return (
      <div
        style={{
          ...base,
          background: rootBg,
          padding: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          justifyContent: "space-between",
        }}
      >
        {scrim}
        {/* vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 240px 60px rgba(0,0,0,0.7)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            flexWrap: "wrap",
            gap: 12,
            font: `700 16px ${FONT.grotesk}`,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              fontSize: 16 * agencyScale,
              color: "#e8b75a",
              whiteSpace: "nowrap",
            }}
          >
            {agencyName}
          </span>
          <span style={{ color: "rgba(232,183,90,0.5)" }}>{network ?? ""}</span>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* medallion — gold-ringed photo, only when one was uploaded */}
          {agent.photoUrl && (
            <div
              style={{
                marginBottom: 40,
                borderRadius: "50%",
                boxShadow: "0 0 70px rgba(232,183,90,0.45)",
              }}
            >
              <PhotoShape
                url={agent.photoUrl}
                shape="circle"
                w={196}
                h={196}
                ring="5px solid #e8b75a"
              />
            </div>
          )}
          <div
            style={{
              font: `700 19px ${FONT.grotesk}`,
              letterSpacing: "0.5em",
              color: "#e8b75a",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Agent of the Week
          </div>
          <div
            style={{
              font: `800 ${132 * titleScale}px ${dispFont}`,
              lineHeight: 0.94,
              color: "#f7f3ea",
              letterSpacing: "-0.02em",
            }}
          >
            {agent.name}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            gap: 56,
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div>
            <div
              style={{
                font: `400 16px ${FONT.grotesk}`,
                letterSpacing: "0.3em",
                color: "rgba(247,243,234,0.5)",
                textTransform: "uppercase",
              }}
            >
              Annual Premium
            </div>
            <div
              style={{
                font: `800 84px ${dispFont}`,
                color: "#e8b75a",
                textShadow: "0 0 40px rgba(232,183,90,0.4)",
                lineHeight: 1,
              }}
            >
              {usd(agent.ap)}
            </div>
          </div>
          <div style={{ paddingBottom: 16 }}>
            <div
              style={{
                font: `400 16px ${FONT.grotesk}`,
                letterSpacing: "0.3em",
                color: "rgba(247,243,234,0.5)",
                textTransform: "uppercase",
              }}
            >
              Policies · {periodLabel.replace(/^WEEK OF\s*/i, "")}
            </div>
            <div style={{ font: `700 64px ${dispFont}`, color: "#f7f3ea" }}>
              {agent.policies}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Exhaustiveness: editorial + noir are handled above, leaving only "aurora".
  // If a 4th AowDesign is ever added, this assignment fails to compile — forcing a
  // real render branch instead of silently falling through to the aurora layout.
  if (design !== "aurora") {
    const _exhaustive: never = design;
    void _exhaustive;
  }

  // default: aurora
  return (
    <div
      style={{
        ...base,
        background: rootBg,
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: FONT.grotesk,
      }}
    >
      {scrim}
      {/* soft light blobs */}
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          top: -180,
          right: -160,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.35), transparent 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          bottom: -200,
          left: -120,
          background:
            "radial-gradient(circle, rgba(91,107,255,0.5), transparent 60%)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <span
          style={{
            font: `800 ${22 * agencyScale}px ${dispFont}`,
            letterSpacing: "0.04em",
            color: "#fff",
          }}
        >
          {agencyName}
        </span>
        <span
          style={{
            font: `400 15px ${FONT.grotesk}`,
            letterSpacing: "0.28em",
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase",
          }}
        >
          {network ?? ""}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 52,
          alignItems: "center",
        }}
      >
        {agent.photoUrl && (
          <PhotoShape
            url={agent.photoUrl}
            shape="arch"
            w={372}
            h={468}
            ring="6px solid rgba(255,255,255,0.6)"
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "inline-block",
              padding: "9px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.4)",
              backdropFilter: "blur(6px)",
              font: `700 15px ${FONT.grotesk}`,
              letterSpacing: "0.3em",
              color: "#fff",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Agent of the Week
          </div>
          <div
            style={{
              font: `800 ${104 * titleScale}px ${dispFont}`,
              lineHeight: 0.88,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            {agent.name}
          </div>
        </div>
      </div>

      {/* glass stat panel */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: "34px 40px",
          borderRadius: 28,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.35)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              font: `500 15px ${FONT.grotesk}`,
              letterSpacing: "0.26em",
              color: "rgba(255,255,255,0.8)",
              textTransform: "uppercase",
            }}
          >
            Annual Premium
          </div>
          <div
            style={{
              font: `800 92px ${dispFont}`,
              color: "#fff",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {usd(agent.ap)}
          </div>
        </div>
        <div
          style={{
            width: 1,
            alignSelf: "stretch",
            background: "rgba(255,255,255,0.3)",
          }}
        />
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              font: `500 15px ${FONT.grotesk}`,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.8)",
              textTransform: "uppercase",
            }}
          >
            Policies
          </div>
          <div style={{ font: `800 56px ${dispFont}`, color: "#fff" }}>
            {agent.policies}
          </div>
          <div
            style={{
              font: `500 14px ${FONT.grotesk}`,
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              marginTop: 6,
            }}
          >
            {periodLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
