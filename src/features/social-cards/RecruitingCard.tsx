// src/features/social-cards/RecruitingCard.tsx
// Recruiting graphics for The Standard / Epic Life — a SERIES of visually distinct
// templates built around the agency's pitch: 100% inbound, no outbound, Monday–Friday
// 10–5 ET, no weekends, no shared/aged/over-called leads — "get your life back."
//
// Deliberately its OWN look (warm ink / cream / amber / emerald), NOT the app's indigo
// leaderboard/AOTW palette, so these read as a separate campaign. Five variants, each a
// different layout + emphasis:
//   • manifesto — bold strikethrough list of the grind they DON'T do → the inbound payoff
//   • hours     — a bankers'-hours weekly grid (Mon–Fri 10–5 lit, weekends "yours")
//   • seal      — an "inbound only" certification emblem (premium, badge-like)
//   • lifeback  — an airy serif "get your life back" lifestyle card
//   • compare   — a "most agencies vs The Standard" split
//
// Pure/presentational: no hooks, no data. Deterministic sizing (no DOM measuring) so the
// live preview and the modern-screenshot PNG export render identically.

import type { CSSProperties, ReactNode } from "react";
import {
  FORMAT_DIMS,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";

export type RecruitingVariant =
  | "manifesto"
  | "hours"
  | "seal"
  | "lifeback"
  | "compare";

export interface RecruitingCardProps {
  agencyName: string;
  network?: string;
  variant?: RecruitingVariant; // default "manifesto"
  format?: SocialFormat; // default "portrait"
  /** Optional headline override; each variant has a strong default. */
  headline?: string;
  page?: CardPageInfo;
}

// ── Brand palette (recruiting campaign — intentionally distinct from the app indigo) ──
const C = {
  ink: "#0d0f14",
  ink2: "#161a22",
  inkLine: "rgba(255,255,255,0.10)",
  cream: "#f6f1e7",
  cream2: "#ece2cf",
  creamLine: "rgba(13,15,20,0.10)",
  amber: "#e0a44d",
  amberSoft: "#f1cd92",
  emerald: "#2f7d65",
  emeraldDk: "#123a30",
  red: "#df5b54",
  mute: "#8b9099",
  inkMuteOnCream: "#6b6256",
} as const;

const BIG = '"Big Shoulders Display","Arial Narrow",system-ui,sans-serif';
const SANS = '"Inter",system-ui,sans-serif';
const GROTESK = '"Space Grotesk","Inter",system-ui,sans-serif';
const SERIF = '"Instrument Serif",Georgia,"Times New Roman",serif';

// ── Baked copy (The Standard's pitch) ──
const DONTS = [
  "Cold calls",
  "Outbound dialing",
  "Nights & weekends",
  "Aged & shared leads",
  "Leads dialed 100 times",
];
const CHIPS = [
  "Inbound only",
  "No outbound",
  "M–F · 10–5 ET",
  "No weekends",
  "Fresh leads",
  "Quality of life",
];
const COMPARE_THEM = [
  "Cold calls all day",
  "Nights & weekends",
  "Aged, shared leads",
  "Dial-til-you-drop burnout",
];
const COMPARE_US = [
  "100% inbound calls",
  "Mon–Fri · 10–5 ET",
  "Fresh leads only",
  "Quality of life",
];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];

function Footer({
  agencyName,
  network,
  onDark,
  page,
}: {
  agencyName: string;
  network?: string;
  onDark: boolean;
  page?: CardPageInfo;
}) {
  const color = onDark ? "rgba(255,255,255,0.62)" : C.inkMuteOnCream;
  const line = onDark ? C.inkLine : C.creamLine;
  return (
    <div
      style={{
        flex: "none",
        marginTop: 28,
        paddingTop: 18,
        borderTop: `1.5px solid ${line}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          font: `700 17px ${SANS}`,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color,
        }}
      >
        {network ? `${agencyName} · ${network}` : agencyName}
      </span>
      <span
        style={{
          font: `700 14px ${SANS}`,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color,
        }}
      >
        {page ? `${page.index} / ${page.total}` : "Now hiring"}
      </span>
    </div>
  );
}

function Eyebrow({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div
      style={{
        font: `700 18px ${SANS}`,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

export function RecruitingCard({
  agencyName,
  network,
  variant = "manifesto",
  format = "portrait",
  headline,
  page,
}: RecruitingCardProps) {
  const { w: W, h: H } = FORMAT_DIMS[format];
  // Vertical breathing room scales with the canvas; padding a touch tighter on square.
  const pad = format === "square" ? 70 : 88;

  const base: CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  };

  // ════════════════════════════════════════════════════════════════════════
  // MANIFESTO — strikethrough the grind, land on the inbound payoff
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "manifesto") {
    return (
      <div
        style={{
          ...base,
          padding: pad,
          background: `radial-gradient(120% 80% at 100% 0%, ${C.ink2}, ${C.ink} 60%)`,
          color: "#fff",
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.amber}>We don't do the grind</Eyebrow>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: format === "square" ? 6 : 12,
            minHeight: 0,
          }}
        >
          {DONTS.map((d) => (
            <div
              key={d}
              style={{
                font: `800 ${format === "square" ? 76 : 88}px/0.98 ${BIG}`,
                letterSpacing: "-0.01em",
                color: "rgba(255,255,255,0.34)",
                textDecoration: "line-through",
                textDecorationColor: C.red,
                textDecorationThickness: 7,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {d}
            </div>
          ))}
          <div
            style={{
              marginTop: format === "square" ? 14 : 26,
              font: `800 ${format === "square" ? 84 : 100}px/0.96 ${BIG}`,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#fff",
            }}
          >
            {headline ?? "Just inbound."}
            <br />
            <span style={{ color: C.amber }}>Just quality of life.</span>
          </div>
        </div>

        <Footer agencyName={agencyName} network={network} onDark page={page} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // HOURS — bankers' hours weekly grid (Mon–Fri 10–5 lit, weekends "yours")
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "hours") {
    const cellGap = 12;
    return (
      <div
        style={{
          ...base,
          padding: pad,
          background: C.cream,
          color: C.ink,
          fontFamily: GROTESK,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.emerald}>Bankers' hours, on purpose</Eyebrow>
          <div
            style={{
              marginTop: 18,
              font: `700 ${format === "square" ? 62 : 72}px/1.0 ${GROTESK}`,
              letterSpacing: "-0.02em",
            }}
          >
            {headline ?? "We clock out at five."}
          </div>
        </div>

        {/* Weekly grid */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "stretch",
            gap: cellGap,
            margin: `${format === "square" ? 30 : 48}px 0`,
            minHeight: 0,
          }}
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              style={{
                flex: 1,
                borderRadius: 18,
                background: "#fff",
                border: `1.5px solid ${C.creamLine}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  font: `700 18px ${GROTESK}`,
                  letterSpacing: "0.12em",
                  textAlign: "center",
                  padding: "14px 0 8px",
                  color: C.inkMuteOnCream,
                }}
              >
                {d}
              </div>
              {/* lit 10–5 working band */}
              <div
                style={{
                  flex: 1,
                  margin: "0 10px 12px",
                  borderRadius: 12,
                  background: `linear-gradient(180deg, ${C.emerald}, ${C.emeraldDk})`,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span style={{ font: `700 26px ${GROTESK}` }}>10</span>
                <span style={{ font: `700 13px ${GROTESK}`, opacity: 0.7 }}>
                  to
                </span>
                <span style={{ font: `700 26px ${GROTESK}` }}>5</span>
              </div>
            </div>
          ))}
          {/* weekend = yours (letters stacked down the column so it can't overflow the
              narrow cell — deterministic, rasterizer-safe, and reads as intentional) */}
          <div
            style={{
              flex: 1,
              borderRadius: 18,
              background: C.ink,
              border: `1.5px solid ${C.ink}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "18px 6px",
            }}
          >
            <div
              style={{
                font: `700 15px ${GROTESK}`,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.5)",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              SAT
              <br />
              SUN
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {"YOURS".split("").map((ch, i) => (
                <span
                  key={i}
                  style={{
                    font: `800 ${format === "square" ? 40 : 48}px/0.9 ${BIG}`,
                    color: C.amber,
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: "none" }}>
          <div
            style={{
              font: `500 ${format === "square" ? 24 : 28}px/1.3 ${GROTESK}`,
              color: C.inkMuteOnCream,
            }}
          >
            No nights. No weekends. No outbound — ever.
          </div>
          <Footer
            agencyName={agencyName}
            network={network}
            onDark={false}
            page={page}
          />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SEAL — "inbound only" certification emblem
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "seal") {
    const ring = format === "square" ? 440 : 520;
    return (
      <div
        style={{
          ...base,
          padding: pad,
          background: `radial-gradient(110% 70% at 50% 0%, ${C.emerald} -10%, ${C.emeraldDk} 55%, #0c2620 100%)`,
          color: "#fff",
          fontFamily: SANS,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "none", textAlign: "center", width: "100%" }}>
          <Eyebrow color={C.amberSoft}>The Standard guarantee</Eyebrow>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: ring,
              height: ring,
              borderRadius: "50%",
              border: `3px solid ${C.amber}`,
              boxShadow: `0 0 0 14px rgba(224,164,77,0.10), inset 0 0 0 2px rgba(224,164,77,0.35)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 40,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                font: `700 15px ${SANS}`,
                letterSpacing: "0.34em",
                color: C.amberSoft,
                textTransform: "uppercase",
              }}
            >
              100% ·
            </span>
            <span
              style={{
                font: `800 ${ring * 0.2}px/0.86 ${BIG}`,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              Inbound
              <br />
              Only
            </span>
            <div
              style={{
                width: 64,
                height: 3,
                background: C.amber,
                borderRadius: 2,
                margin: "18px 0",
              }}
            />
            <span
              style={{
                font: `700 17px ${SANS}`,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Zero cold calls
            </span>
          </div>
        </div>

        <div style={{ flex: "none", width: "100%", textAlign: "center" }}>
          <div
            style={{
              font: `800 ${format === "square" ? 56 : 66}px/1.0 ${BIG}`,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
            }}
          >
            {headline ?? "Certified quality of life"}
          </div>
          <Footer
            agencyName={agencyName}
            network={network}
            onDark
            page={page}
          />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // LIFEBACK — airy serif lifestyle card
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "lifeback") {
    return (
      <div
        style={{
          ...base,
          padding: pad,
          background: `linear-gradient(160deg, ${C.cream} 0%, ${C.cream2} 55%, ${C.amberSoft} 130%)`,
          color: C.ink,
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.emerald}>
            {network ?? "Inbound insurance sales"}
          </Eyebrow>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              font: `400 ${format === "square" ? 150 : 184}px/0.92 ${SERIF}`,
              letterSpacing: "-0.01em",
            }}
          >
            {headline ?? "Get your life back."}
          </div>
          <div
            style={{
              marginTop: 34,
              maxWidth: "84%",
              font: `400 ${format === "square" ? 30 : 34}px/1.4 ${SANS}`,
              color: C.inkMuteOnCream,
            }}
          >
            Inbound-only insurance sales. Monday to Friday, ten to five Eastern.
            Then you're off — no outbound, no weekends, no aged leads.
          </div>
        </div>

        {/* value chips */}
        <div
          style={{
            flex: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {CHIPS.map((c) => (
            <span
              key={c}
              style={{
                font: `600 22px ${SANS}`,
                letterSpacing: "0.01em",
                color: C.ink,
                background: "rgba(255,255,255,0.6)",
                border: `1.5px solid ${C.creamLine}`,
                borderRadius: 999,
                padding: "10px 20px",
              }}
            >
              {c}
            </span>
          ))}
        </div>

        <Footer
          agencyName={agencyName}
          network={network}
          onDark={false}
          page={page}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // COMPARE — "most agencies" vs "The Standard"
  // ════════════════════════════════════════════════════════════════════════
  const colHead = (accent: string, onDark: boolean): CSSProperties => ({
    font: `800 24px ${SANS}`,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: onDark ? accent : C.inkMuteOnCream,
  });
  const rowItem = (
    text: string,
    onDark: boolean,
    accent: string,
    mark: string,
  ) => (
    <div
      key={text}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        font: `${onDark ? 700 : 500} ${format === "square" ? 30 : 35}px/1.18 ${SANS}`,
        color: onDark ? "#fff" : C.inkMuteOnCream,
      }}
    >
      <span
        style={{
          flex: "none",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: onDark ? accent : "transparent",
          border: onDark ? "none" : `2px solid ${C.red}`,
          color: onDark ? C.ink : C.red,
          font: `800 20px ${SANS}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        {mark}
      </span>
      <span>{text}</span>
    </div>
  );

  return (
    <div style={{ ...base, flexDirection: "column", background: C.ink }}>
      {/* headline strip */}
      <div
        style={{
          flex: "none",
          padding: `${pad * 0.7}px ${pad}px ${pad * 0.42}px`,
          background: C.ink,
        }}
      >
        <Eyebrow color={C.amber}>Same license. Different life.</Eyebrow>
        <div
          style={{
            marginTop: 14,
            font: `800 ${format === "square" ? 62 : 74}px/0.98 ${BIG}`,
            color: "#fff",
            textTransform: "uppercase",
          }}
        >
          {headline ?? "Pick your day-to-day"}
        </div>
      </div>

      {/* split body */}
      <div
        style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}
      >
        {/* them */}
        <div
          style={{
            flex: 1,
            background: C.cream2,
            padding: `${pad * 0.55}px ${pad * 0.62}px`,
            display: "flex",
            flexDirection: "column",
            gap: format === "square" ? 18 : 26,
            justifyContent: "center",
          }}
        >
          <div style={colHead(C.red, false)}>Most agencies</div>
          {COMPARE_THEM.map((t) => rowItem(t, false, C.red, "✕"))}
        </div>
        {/* us */}
        <div
          style={{
            flex: 1,
            background: `linear-gradient(180deg, ${C.ink2}, ${C.ink})`,
            padding: `${pad * 0.55}px ${pad * 0.62}px`,
            display: "flex",
            flexDirection: "column",
            gap: format === "square" ? 18 : 26,
            justifyContent: "center",
          }}
        >
          <div style={colHead(C.amber, true)}>{agencyName}</div>
          {COMPARE_US.map((t) => rowItem(t, true, C.amber, "✓"))}
        </div>
        {/* VS badge */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: C.amber,
            color: C.ink,
            font: `800 30px ${BIG}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          VS
        </div>
      </div>

      {/* footer strip */}
      <div
        style={{
          flex: "none",
          padding: `0 ${pad}px ${pad * 0.7}px`,
          background: C.ink,
        }}
      >
        <Footer agencyName={agencyName} network={network} onDark page={page} />
      </div>
    </div>
  );
}
