// src/features/social-cards/NewAgentCard.tsx
// "Welcome New Agent" hero — a single-agent welcome graphic sized for Instagram.
// Its OWN celebratory identity (festive plum/gold/coral/mint), deliberately NOT the
// indigo leaderboard/AOTW palette, so a welcome post never looks like a data card.
// Three selectable designs (the `variant` prop):
//   • celebration — festive dark stage, confetti, glowing round portrait, gold accents
//   • badge       — bright cream card, "NEW AGENT" ribbon across the portrait, crisp
//   • marquee     — bold black editorial, giant WELCOME wordmark beside the portrait
//
// Pure/presentational: no hooks, no data fetching. The caller passes a data: URL for
// agent.photoUrl so the PNG export (modern-screenshot) renders identically to the live
// preview and no PII leaves the tenant. Deterministic (no DOM measuring, no randomness)
// so the off-screen export matches the on-screen preview pixel-for-pixel.

import type { CSSProperties } from "react";
import {
  FORMAT_DIMS,
  initials,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import type { CardTheme } from "./themes";
import {
  copyText,
  applyTokens,
  type CopyField,
  type CopyMap,
} from "./templateCopy";

export type WelcomeVariant = "celebration" | "badge" | "marquee";

export interface NewAgentCardProps {
  agencyName: string;
  network?: string;
  agent: { name: string; photoUrl?: string | null };
  format?: SocialFormat; // default "portrait"
  /** Which welcome design renders. Default "celebration". */
  variant?: WelcomeVariant;
  /** Per-field copy overrides (keyed by CopyField.key); blank → the default. */
  copy?: CopyMap;
  /** Kept for the card-wrapper class (SocialPreview); the welcome design has its own
   *  palette and does not use the shared theme. */
  theme?: CardTheme;
  page?: CardPageInfo; // optional carousel stamp (usually omit)
}

// ── Editable copy schema + built-in defaults. {agency} resolves to the agency name. ──
export const WELCOME_COPY: Record<WelcomeVariant, CopyField[]> = {
  celebration: [
    { key: "eyebrow", label: "Eyebrow", default: "Welcome to the team" },
    { key: "joined", label: "Tagline", default: "Just joined {agency}" },
  ],
  badge: [
    { key: "kicker", label: "Kicker", default: "Welcome to the team" },
    { key: "ribbon", label: "Ribbon", default: "New Agent" },
  ],
  marquee: [
    { key: "eyebrow", label: "Eyebrow", default: "Welcome to the team" },
    { key: "wordmark", label: "Big word", default: "WELCOME" },
    { key: "joined", label: "Tagline", default: "Just joined {agency}" },
  ],
};

function welcomeDefault(variant: WelcomeVariant, key: string): string {
  // Defensive `?.` — a bad variant (e.g. a dev harness passing a recruiting key) must
  // not crash on an undefined schema.
  return WELCOME_COPY[variant]?.find((f) => f.key === key)?.default ?? "";
}

const BIG = '"Big Shoulders Display", "Arial Black", system-ui, sans-serif';
const SANS = '"Inter", system-ui, sans-serif';

// Welcome palette (its own identity — distinct from the app indigo).
const W = {
  night: "#17132a",
  plum: "#2a1f4d",
  ink: "#121019",
  ink2: "#1d1830",
  cream: "#f7f1e6",
  creamCard: "#fffdf8",
  creamLine: "rgba(18,16,25,0.10)",
  gold: "#f0b94e",
  goldSoft: "#f6d18a",
  coral: "#f2667a",
  mint: "#46c7a2",
  violet: "#9b80e8",
  white: "#ffffff",
  inkMuteCream: "#6c6354",
} as const;

// Big Shoulders Display is condensed → scale the hero name by character count so it stays
// on one line. Deterministic → identical in the live preview and the screenshot export.
function heroNamePx(name: string, base: number): number {
  const n = (name ?? "").length;
  const f = n <= 12 ? 1 : n <= 16 ? 0.84 : n <= 21 ? 0.7 : n <= 27 ? 0.58 : 0.5;
  return Math.round(base * f);
}

// The agent's headshot in a shaped frame; a branded placeholder with the agent's initials
// when no photo URL is provided so the composition still holds.
function Photo({
  url,
  initial,
  w,
  h,
  radius,
  ring,
  style,
}: {
  url?: string | null;
  initial: string;
  w: number | string;
  h: number | string;
  radius: number | string;
  /** Border/ring color for the placeholder gradient + initials tint. */
  ring: string;
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
        background: `linear-gradient(135deg, ${W.ink2}, ${W.plum})`,
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
            objectPosition: "50% 50%",
            display: "block",
            filter: "contrast(1.04) saturate(1.05)",
          }}
        />
      ) : (
        <span
          style={{
            font: `800 ${typeof h === "number" ? Math.round(h * 0.36) : 220}px/1 ${BIG}`,
            color: ring,
            opacity: 0.8,
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

function Footer({
  agencyName,
  network,
  color,
  line,
  page,
}: {
  agencyName: string;
  network?: string;
  color: string;
  line: string;
  page?: CardPageInfo;
}) {
  return (
    <div
      style={{
        flex: "none",
        paddingTop: 20,
        borderTop: `1.5px solid ${line}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          font: `700 16px ${SANS}`,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color,
        }}
      >
        {network ? `${agencyName} · ${network}` : agencyName}
      </span>
      <span
        style={{
          font: `700 13px ${SANS}`,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color,
        }}
      >
        {page ? `${page.index} / ${page.total}` : "New teammate"}
      </span>
    </div>
  );
}

export function NewAgentCard({
  agencyName,
  network,
  agent,
  format = "portrait",
  variant = "celebration",
  copy,
  page,
}: NewAgentCardProps) {
  const { w: W_, h: H } = FORMAT_DIMS[format];
  const agentInitials = initials(agent.name);
  // Resolve a copy slot (override if non-blank, else default) + fill the {agency} token.
  const t = (key: string) =>
    applyTokens(copyText(copy, key, welcomeDefault(variant, key)), {
      agency: agencyName,
    });
  const photoH = Math.round(
    H * (format === "story" ? 0.42 : format === "square" ? 0.48 : 0.5),
  );
  const photoW = Math.min(Math.round(W_ * 0.62), Math.round(photoH * 0.84));

  const base: CSSProperties = {
    width: W_,
    height: H,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  // ════════════════════════════════════════════════════════════════════════
  // BADGE — bright cream card, "NEW AGENT" ribbon across the portrait
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "badge") {
    const inset = Math.round(W_ * 0.055);
    // Stories cover the top/bottom ~13% with IG UI — inset the card there.
    const insetBox =
      format === "story" ? `${inset + 180}px ${inset}px` : `${inset}px`;
    return (
      <div
        style={{
          ...base,
          background: W.cream,
          fontFamily: SANS,
          padding: insetBox,
        }}
      >
        <div
          style={{
            position: "relative",
            height: "100%",
            background: W.creamCard,
            borderRadius: 30,
            border: `1.5px solid ${W.creamLine}`,
            boxShadow: "0 30px 70px rgba(20,16,25,0.12)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: "46px 52px 40px",
            boxSizing: "border-box",
          }}
        >
          {/* top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              background: W.gold,
            }}
          />
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
                color: W.ink,
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
                  color: W.inkMuteCream,
                  textTransform: "uppercase",
                }}
              >
                {network}
              </span>
            )}
          </div>

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
            {/* portrait + corner ribbon */}
            <div style={{ position: "relative" }}>
              <Photo
                url={agent.photoUrl}
                initial={agentInitials}
                w={photoW}
                h={photoH}
                radius={24}
                ring={W.gold}
                style={{
                  boxShadow: "0 26px 50px rgba(20,16,25,0.18)",
                  border: `4px solid ${W.creamCard}`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 22,
                  left: -10,
                  background: W.ink,
                  color: W.gold,
                  font: `800 18px ${SANS}`,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "8px 18px",
                  borderRadius: 6,
                  boxShadow: "0 8px 18px rgba(20,16,25,0.3)",
                }}
              >
                {t("ribbon")}
              </div>
            </div>
            <div style={{ width: "100%", textAlign: "center" }}>
              <div
                style={{
                  font: `700 13px ${SANS}`,
                  letterSpacing: "0.3em",
                  color: W.inkMuteCream,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {t("kicker")}
              </div>
              <div
                style={{
                  font: `700 ${heroNamePx(agent.name, 92)}px/0.92 ${BIG}`,
                  color: W.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {agent.name}
              </div>
            </div>
          </div>

          <Footer
            agencyName={agencyName}
            network={network}
            color={W.inkMuteCream}
            line={W.creamLine}
            page={page}
          />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // MARQUEE — bold black editorial, giant WELCOME wordmark + framed portrait
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "marquee") {
    const pad = format === "square" ? 72 : 88;
    const padBox = format === "story" ? `${pad + 160}px ${pad}px` : `${pad}px`;
    return (
      <div
        style={{
          ...base,
          background: `radial-gradient(130% 90% at 0% 0%, ${W.ink2}, ${W.ink} 62%)`,
          color: W.white,
          fontFamily: SANS,
          padding: padBox,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: "none",
            font: `700 18px ${SANS}`,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: W.gold,
          }}
        >
          {t("eyebrow")}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 0,
            gap: 30,
          }}
        >
          {/* giant WELCOME wordmark */}
          <div
            style={{
              font: `800 ${format === "square" ? 124 : 150}px/0.82 ${BIG}`,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: W.white,
              whiteSpace: "nowrap",
            }}
          >
            {(() => {
              const wm = t("wordmark");
              const mid = Math.ceil(wm.length / 2);
              return (
                <>
                  {wm.slice(0, mid)}
                  <span style={{ color: W.gold }}>{wm.slice(mid)}</span>
                </>
              );
            })()}
          </div>

          {/* portrait + name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <Photo
              url={agent.photoUrl}
              initial={agentInitials}
              w={Math.round(photoH * 0.5)}
              h={Math.round(photoH * 0.5)}
              radius={20}
              ring={W.goldSoft}
              style={{
                border: `3px solid ${W.gold}`,
                boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  font: `700 ${heroNamePx(agent.name, 64)}px/0.92 ${BIG}`,
                  color: W.white,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {agent.name}
              </div>
              <div
                style={{
                  marginTop: 10,
                  font: `600 22px ${SANS}`,
                  letterSpacing: "0.04em",
                  color: W.goldSoft,
                }}
              >
                {t("joined")}
              </div>
            </div>
          </div>
        </div>

        <Footer
          agencyName={agencyName}
          network={network}
          color="rgba(255,255,255,0.6)"
          line="rgba(255,255,255,0.12)"
          page={page}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // CELEBRATION — elegant dark stage, gold hairline frame, glowing portrait (default)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        ...base,
        background: `radial-gradient(95% 65% at 50% 22%, #232b40 0%, #161b29 52%, #0d111b 100%)`,
        color: W.white,
        fontFamily: SANS,
      }}
    >
      {/* thin gold hairline frame — premium, not festive */}
      <div
        style={{
          position: "absolute",
          inset: format === "square" ? 34 : 44,
          border: `1.5px solid rgba(240,185,78,0.34)`,
          borderRadius: 4,
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
          padding:
            format === "story"
              ? "250px 96px"
              : format === "square"
                ? "82px 90px"
                : "100px 96px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: "none",
            textAlign: "center",
            font: `600 15px ${SANS}`,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: W.gold,
          }}
        >
          {t("eyebrow")}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 34,
            minHeight: 0,
          }}
        >
          <Photo
            url={agent.photoUrl}
            initial={agentInitials}
            w={photoW}
            h={photoW}
            radius="50%"
            ring={W.goldSoft}
            style={{
              border: `2px solid ${W.gold}`,
              boxShadow: `0 30px 70px rgba(0,0,0,0.5), 0 0 72px rgba(240,185,78,0.16)`,
            }}
          />
          <div style={{ width: "100%", textAlign: "center" }}>
            <div
              style={{
                font: `700 ${heroNamePx(agent.name, 100)}px/0.94 ${BIG}`,
                color: W.white,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {agent.name}
            </div>
            {/* thin gold rule, then the tagline in tracked caps — refined, no pill */}
            <div
              style={{
                width: 56,
                height: 2,
                background: W.gold,
                opacity: 0.9,
                margin: "22px auto 16px",
              }}
            />
            <div
              style={{
                font: `600 17px ${SANS}`,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: W.goldSoft,
              }}
            >
              {t("joined")}
            </div>
          </div>
        </div>

        <Footer
          agencyName={agencyName}
          network={network}
          color="rgba(255,255,255,0.55)"
          line="rgba(255,255,255,0.12)"
          page={page}
        />
      </div>
    </div>
  );
}
