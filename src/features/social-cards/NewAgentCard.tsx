// src/features/social-cards/NewAgentCard.tsx
// "Welcome New Agent" hero — a single-agent welcome graphic sized for Instagram.
// Three design directions share the agency's chosen theme (stable keys match the
// broader card library — saved templates keep working):
//   • spotlight  — dark indigo stage, glowing 3D portrait, light text (default)
//   • editorial  — black & white magazine, indigo 3D offset plate, typographic
//   • lift       — clean light raised card, rounded portrait, soft shadows
//
// Pure/presentational: no hooks, no data fetching. The caller passes a data: URL
// for agent.photoUrl so the PNG export (modern-screenshot) renders identically to
// the live preview and no PII leaves the tenant.

import type { CSSProperties } from "react";
import {
  FORMAT_DIMS,
  initials,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import {
  resolveCardTheme,
  themePageBackground,
  type CardTheme,
} from "./themes";

export interface NewAgentCardProps {
  agencyName: string;
  network?: string;
  agent: { name: string; photoUrl?: string | null };
  format?: SocialFormat; // default "portrait"
  theme?: CardTheme; // default "spotlight"
  page?: CardPageInfo; // optional carousel stamp (usually omit)
}

const BIG = '"Big Shoulders Display", "Arial Black", system-ui, sans-serif';
const SANS = '"Inter", system-ui, sans-serif';

// Brand tokens (src/index.css) — same palette as AgentOfWeekCard. Used for fixed
// structural values (shadows, photo frame, placeholder) that don't vary by theme.
const C = {
  indigo: "#6366f1",
  indigoLight: "#818cf8",
  ink: "#0f172a",
  slate: "#1e293b",
  cardDk: "#141a2a",
  white: "#ffffff",
} as const;

// Big Shoulders Display is condensed → scale the hero name by character count so it
// stays on one line. Deterministic (no DOM measuring) → identical in the live
// preview and the screenshot export.
function heroNamePx(name: string, base: number): number {
  const n = (name ?? "").length;
  const f = n <= 12 ? 1 : n <= 16 ? 0.84 : n <= 21 ? 0.7 : n <= 27 ? 0.58 : 0.5;
  return Math.round(base * f);
}

// The agent's headshot in a shaped frame. Renders a dark branded placeholder with
// the agent's initials when no photo URL is provided so the composition holds.
function Photo({
  url,
  initial,
  w,
  h,
  radius,
  objectPosition = "50% 50%",
  style,
}: {
  url?: string | null;
  /** Agent initials rendered in the placeholder when photoUrl is absent. */
  initial: string;
  w: number | string;
  h: number | string;
  radius: number | string;
  /** CSS object-position focal point ("x% y%"). Default centered. */
  objectPosition?: string;
  style?: CSSProperties;
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
            objectPosition,
            display: "block",
            filter: "contrast(1.04) saturate(1.05)",
          }}
        />
      ) : (
        // Placeholder: agent initials in the brand accent tint — legible on the
        // dark gradient background regardless of which theme is active.
        <span
          style={{
            font: `800 ${
              typeof h === "number" ? Math.round(h * 0.36) : 220
            }px/1 ${BIG}`,
            color: "rgba(129,140,248,0.70)",
            letterSpacing: "-0.02em",
            userSelect: "none",
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

export function NewAgentCard({
  agencyName,
  network,
  agent,
  format = "portrait",
  theme = "spotlight",
  page,
}: NewAgentCardProps) {
  const t = resolveCardTheme(theme);
  const { w: W, h: H } = FORMAT_DIMS[format];
  const agentInitials = initials(agent.name);

  const base: CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  // Hero photo dimensions — no stat band at the bottom means a larger portrait fits
  // cleanly. Width is capped at 70% of canvas and at 0.84× the height to keep a
  // natural portrait aspect ratio.
  const photoH = Math.round(
    H * (format === "story" ? 0.47 : format === "square" ? 0.52 : 0.55),
  );
  const photoW = Math.min(Math.round(W * 0.7), Math.round(photoH * 0.84));

  // ════════════════════════════════════════════════════════════════════════
  // EDITORIAL — black & white magazine, indigo 3D offset plate, huge type
  // ════════════════════════════════════════════════════════════════════════
  if (t.key === "editorial") {
    const pad = 80;
    return (
      <div
        style={{
          ...base,
          ...themePageBackground(t),
          color: t.ink,
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
                font: `800 25px ${SANS}`,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "62%",
              }}
            >
              {agencyName}
            </span>
            {network && (
              <span
                style={{
                  font: `600 14px ${SANS}`,
                  letterSpacing: "0.18em",
                  color: t.inkMuted,
                  textTransform: "uppercase",
                }}
              >
                {network}
              </span>
            )}
          </div>
          <div style={{ height: 3, background: t.ruleStrong, marginTop: 18 }} />
        </div>

        {/* photo block — crisp headshot + offset indigo plate (3D print depth) */}
        <div
          style={{
            flex: 1,
            position: "relative",
            minHeight: 0,
            margin: "36px 0",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "translate(18px, 18px)",
              background: t.accent,
            }}
          />
          <Photo
            url={agent.photoUrl}
            initial={agentInitials}
            w="100%"
            h="100%"
            radius={t.panelRadius}
            style={
              {
                position: "absolute",
                inset: 0,
                border: `3px solid ${t.ink}`,
                boxSizing: "border-box",
              } as CSSProperties
            }
          />
        </div>

        {/* welcome tag + hero name */}
        <div style={{ flex: "none" }}>
          <span
            style={{
              display: "inline-block",
              background: t.ink,
              color: C.white,
              font: `700 13px ${SANS}`,
              letterSpacing: "0.12em",
              padding: "9px 15px",
              textTransform: "uppercase",
            }}
          >
            Welcome to the Team
          </span>
          <div
            style={{
              font: `800 ${heroNamePx(agent.name, 130)}px/0.86 ${BIG}`,
              color: t.ink,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              marginTop: 14,
            }}
          >
            {agent.name}
          </div>
        </div>

        {/* footer: rule + agency credit + optional page stamp */}
        <div
          style={{
            flex: "none",
            borderTop: `3px solid ${t.ruleStrong}`,
            paddingTop: 22,
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              font: `600 13px ${SANS}`,
              letterSpacing: "0.12em",
              color: t.inkMuted,
              textTransform: "uppercase",
            }}
          >
            {network ? `${agencyName} · ${network}` : agencyName}
          </span>
          {page && (
            <span
              style={{
                font: `600 12px ${SANS}`,
                letterSpacing: "0.1em",
                color: t.inkSubtle,
                textTransform: "uppercase",
              }}
            >
              {page.index} / {page.total}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // LIFT — clean light raised card, rounded portrait, soft depth shadows
  // ════════════════════════════════════════════════════════════════════════
  if (t.key === "lift") {
    const inset = Math.round(W * 0.05);
    return (
      <div
        style={{
          ...base,
          ...themePageBackground(t),
          fontFamily: SANS,
          padding: inset,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: t.panelBg,
            borderRadius: 30,
            border: `1px solid ${t.panelBorder}`,
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
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentStrong})`,
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
                font: `800 23px ${SANS}`,
                letterSpacing: "0.03em",
                color: t.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "62%",
              }}
            >
              {agencyName}
            </span>
            {network && (
              <span
                style={{
                  font: `600 12px ${SANS}`,
                  letterSpacing: "0.22em",
                  color: t.inkSubtle,
                  textTransform: "uppercase",
                }}
              >
                {network}
              </span>
            )}
          </div>

          {/* eyebrow kicker + portrait + name, centered in the flexible middle */}
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
                color: t.accent,
                textTransform: "uppercase",
              }}
            >
              Welcome to the Team
            </div>
            <Photo
              url={agent.photoUrl}
              initial={agentInitials}
              w={photoW}
              h={photoH}
              radius={24}
              style={{
                boxShadow:
                  "0 28px 52px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(99,102,241,0.55)",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  font: `700 ${heroNamePx(agent.name, 92)}px/0.92 ${BIG}`,
                  color: t.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {agent.name}
              </div>
              {/* indigo accent underline */}
              <div
                style={{
                  width: 68,
                  height: 5,
                  borderRadius: 3,
                  background: t.accent,
                  margin: "20px auto 0",
                }}
              />
            </div>
          </div>

          {/* footer: page stamp if present; reserves bottom balance otherwise */}
          <div
            style={{
              flex: "none",
              textAlign: "center",
              marginTop: 22,
              font: `600 12px ${SANS}`,
              letterSpacing: "0.2em",
              color: t.inkSubtle,
              textTransform: "uppercase",
              minHeight: 20,
            }}
          >
            {page ? `${page.index} / ${page.total}` : ""}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SPOTLIGHT — dark indigo stage, glowing 3D portrait, light text (default)
  // ════════════════════════════════════════════════════════════════════════
  // themePageBackground returns the dark base + the layered indigo atmosphere
  // gradient via backgroundImage so no separate overlay div is needed.
  return (
    <div
      style={{
        ...base,
        ...themePageBackground(t),
        color: t.ink,
        fontFamily: SANS,
      }}
    >
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
                font: `800 24px ${SANS}`,
                letterSpacing: "0.06em",
                color: C.white,
                whiteSpace: "nowrap",
              }}
            >
              {agencyName}
            </span>
            {network && (
              <span
                style={{
                  font: `600 13px ${SANS}`,
                  letterSpacing: "0.26em",
                  color: t.inkMuted,
                  textTransform: "uppercase",
                }}
              >
                {network}
              </span>
            )}
          </div>
          <div style={{ height: 1, background: t.hairline, marginTop: 22 }} />
        </div>

        {/* center: eyebrow kicker + large portrait + name */}
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
          <div
            style={{
              font: `700 16px ${SANS}`,
              letterSpacing: "0.36em",
              color: t.accentStrong,
              textTransform: "uppercase",
            }}
          >
            Welcome to the Team
          </div>
          <Photo
            url={agent.photoUrl}
            initial={agentInitials}
            w={photoW}
            h={photoH}
            radius={30}
            style={{
              boxShadow:
                "0 38px 80px rgba(0,0,0,0.62), 0 0 96px rgba(99,102,241,0.5), inset 0 0 0 2px rgba(129,140,248,0.85)",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                font: `700 ${heroNamePx(agent.name, 116)}px/0.92 ${BIG}`,
                color: t.ink,
                letterSpacing: "0.005em",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {agent.name}
            </div>
            {/* indigo accent underline */}
            <div
              style={{
                width: 68,
                height: 5,
                borderRadius: 3,
                background: t.accent,
                margin: "18px auto 0",
              }}
            />
          </div>
        </div>

        {/* footer: page stamp if present; reserves bottom spacing otherwise */}
        <div
          style={{
            flex: "none",
            textAlign: "center",
            font: `600 12px ${SANS}`,
            letterSpacing: "0.24em",
            color: t.inkMuted,
            textTransform: "uppercase",
            minHeight: 20,
          }}
        >
          {page ? `${page.index} / ${page.total}` : ""}
        </div>
      </div>
    </div>
  );
}
