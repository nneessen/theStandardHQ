// src/features/social-cards/RecruitingCard.tsx
// Recruiting graphics for The Standard / Epic Life — a SERIES of visually distinct
// templates built around the agency's pitch: 100% inbound, no outbound, Monday–Friday
// 10–5 ET, no weekends, no shared/aged/over-called leads — "get your life back."
//
// Deliberately its OWN look (warm ink / cream / amber / emerald), NOT the app's indigo
// leaderboard/AOTW palette. Five variants (the `variant` prop), and EVERY sentence is
// editable: each text slot resolves copy[field] ?? a built-in default (see RECRUITING_COPY),
// so the owner controls the wording. List slots (the strikethrough list, chips, vs-columns)
// edit one item per line.
//
// Pure/presentational: no hooks, no data. Deterministic sizing (no DOM measuring) so the
// live preview and the modern-screenshot PNG export render identically.

import type { CSSProperties, ReactNode } from "react";
import {
  FORMAT_DIMS,
  fitFontPx,
  type SocialFormat,
  type CardPageInfo,
} from "./socialFormat";
import {
  copyText,
  copyList,
  type CopyField,
  type CopyMap,
} from "./templateCopy";

export type RecruitingVariant =
  | "manifesto"
  | "hours"
  | "seal"
  | "lifeback"
  | "compare"
  | "bigstat"
  | "ticket"
  | "checklist"
  | "poster"
  | "neon"
  | "clock"
  | "highway"
  | "memo";

export interface RecruitingCardProps {
  agencyName: string;
  network?: string;
  variant?: RecruitingVariant; // default "manifesto"
  format?: SocialFormat; // default "portrait"
  /** Per-field copy overrides (keyed by CopyField.key); blank → the default. */
  copy?: CopyMap;
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
  inkMuteOnCream: "#6b6256",
  // Extended accents for the broader template set.
  navy: "#1c2c4d",
  navyDk: "#0e1830",
  lime: "#c7e85a",
  neon: "#5fe3c0",
  coral: "#e8745c",
  white: "#ffffff",
} as const;

const BIG = '"Big Shoulders Display","Arial Narrow",system-ui,sans-serif';
const SANS = '"Inter",system-ui,sans-serif';
const GROTESK = '"Space Grotesk","Inter",system-ui,sans-serif';
const SERIF = '"Instrument Serif",Georgia,"Times New Roman",serif';

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];

// ── Editable copy schema + built-in defaults (the customizer renders these fields) ──
export const RECRUITING_COPY: Record<RecruitingVariant, CopyField[]> = {
  manifesto: [
    { key: "eyebrow", label: "Eyebrow", default: "We don't do the grind" },
    {
      key: "donts",
      label: "The list (one per line)",
      list: true,
      default:
        "Cold calls\nOutbound dialing\nNights & weekends\nAged & shared leads\nLeads dialed 100 times",
    },
    { key: "payoff1", label: "Payoff line 1", default: "Just inbound." },
    {
      key: "payoff2",
      label: "Payoff line 2",
      default: "Just quality of life.",
    },
  ],
  hours: [
    { key: "eyebrow", label: "Eyebrow", default: "Bankers' hours, on purpose" },
    { key: "headline", label: "Headline", default: "We clock out at five." },
    { key: "weekend", label: "Weekend word", default: "YOURS" },
    {
      key: "subtext",
      label: "Subtext",
      multiline: true,
      default: "No nights. No weekends. No outbound — ever.",
    },
  ],
  seal: [
    { key: "eyebrow", label: "Eyebrow", default: "The Standard guarantee" },
    { key: "badge1", label: "Badge line 1", default: "Inbound" },
    { key: "badge2", label: "Badge line 2", default: "Only" },
    { key: "badgeSub", label: "Badge subtext", default: "Zero cold calls" },
    {
      key: "headline",
      label: "Headline",
      default: "Certified quality of life",
    },
  ],
  lifeback: [
    { key: "eyebrow", label: "Eyebrow", default: "Inbound insurance sales" },
    { key: "headline", label: "Headline", default: "Get your life back." },
    {
      key: "body",
      label: "Body",
      multiline: true,
      default:
        "Inbound-only insurance sales. Monday to Friday, ten to five Eastern. Then you're off — no outbound, no weekends, no aged leads.",
    },
    {
      key: "chips",
      label: "Chips (one per line)",
      list: true,
      default:
        "Inbound only\nNo outbound\nM–F · 10–5 ET\nNo weekends\nFresh leads\nQuality of life",
    },
  ],
  compare: [
    {
      key: "eyebrow",
      label: "Eyebrow",
      default: "Same license. Different life.",
    },
    { key: "headline", label: "Headline", default: "Pick your day-to-day" },
    { key: "themLabel", label: "Left column label", default: "Most agencies" },
    {
      key: "themItems",
      label: "Left column (one per line)",
      list: true,
      default:
        "Cold calls all day\nNights & weekends\nAged, shared leads\nDial-til-you-drop burnout",
    },
    {
      key: "usItems",
      label: "Right column (one per line)",
      list: true,
      default:
        "100% inbound calls\nMon–Fri · 10–5 ET\nFresh leads only\nQuality of life",
    },
  ],
  bigstat: [
    { key: "eyebrow", label: "Eyebrow", default: "The math is simple" },
    { key: "stat", label: "Big number", default: "0" },
    {
      key: "statLabel",
      label: "Under the number",
      default: "cold calls. ever.",
    },
    {
      key: "sub",
      label: "Supporting line",
      multiline: true,
      default: "100% inbound. Monday–Friday. Off at five.",
    },
  ],
  ticket: [
    { key: "eyebrow", label: "Eyebrow", default: "Boarding pass" },
    { key: "title", label: "Title", default: "One-way out of the grind" },
    { key: "from", label: "From", default: "The grind" },
    { key: "to", label: "To", default: "Quality of life" },
    {
      key: "rows",
      label: "Detail rows (Label — Value, one per line)",
      list: true,
      default:
        "Carrier — Inbound only\nHours — Mon–Fri · 10–5 ET\nWeekends — All yours\nCold calls — None",
    },
    { key: "stamp", label: "Stamp", default: "Now boarding" },
  ],
  checklist: [
    { key: "eyebrow", label: "Eyebrow", default: "Here's the deal" },
    { key: "headline", label: "Headline", default: "Everything you get" },
    {
      key: "items",
      label: "Checklist (one per line)",
      list: true,
      default:
        "100% inbound calls\nMonday–Friday, 10–5 ET\nWeekends off, always\nFresh leads only\nNo cold calling, ever\nA life outside of work",
    },
  ],
  poster: [
    { key: "eyebrow", label: "Eyebrow", default: "Now hiring inbound agents" },
    {
      key: "words",
      label: "Stacked words (one per line)",
      list: true,
      default: "GET\nYOUR\nLIFE\nBACK",
    },
    {
      key: "sub",
      label: "Supporting line",
      multiline: true,
      default: "Inbound only · Mon–Fri 10–5 · No weekends",
    },
  ],
  neon: [
    { key: "eyebrow", label: "Eyebrow", default: "Vacancy" },
    { key: "sign", label: "Neon sign text", default: "Now Hiring" },
    { key: "sub", label: "Tagline", default: "Inbound only. No cold calls." },
    {
      key: "rule",
      label: "Bottom rule",
      default: "Monday–Friday · 10–5 · Weekends off",
    },
  ],
  clock: [
    { key: "eyebrow", label: "Eyebrow", default: "Every single day" },
    { key: "headline", label: "Headline", default: "We're done at five." },
    {
      key: "sub",
      label: "Supporting line",
      multiline: true,
      default:
        "Inbound-only sales, Monday to Friday. When the clock hits five, you're off.",
    },
  ],
  highway: [
    { key: "eyebrow", label: "Eyebrow", default: "Take the next exit" },
    { key: "exit", label: "Exit tab", default: "EXIT 5" },
    { key: "dest", label: "Destination (on sign)", default: "Quality of Life" },
    {
      key: "sub",
      label: "Supporting line",
      multiline: true,
      default: "100% inbound · Mon–Fri 10–5 · Weekends off",
    },
  ],
  memo: [
    { key: "eyebrow", label: "Eyebrow", default: "Auto-reply" },
    { key: "subject", label: "Subject line", default: "Out of office" },
    {
      key: "body",
      label: "Body",
      multiline: true,
      default:
        "I'm off the clock — it's after five, or it's the weekend. Inbound-only sales means I actually get my life back. Back Monday at 10 ET.",
    },
    { key: "signoff", label: "Sign-off", default: "— An agent with a life" },
  ],
};

function defaultsFor(variant: RecruitingVariant, key: string): string {
  // Defensive `?.` — a bad variant must not crash on an undefined schema.
  return RECRUITING_COPY[variant]?.find((f) => f.key === key)?.default ?? "";
}

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
  copy,
  page,
}: RecruitingCardProps) {
  const { w: W, h: H } = FORMAT_DIMS[format];
  const pad = format === "square" ? 70 : 88;
  // Instagram Stories cover the top + bottom ~13% with their own UI (username/progress bar
  // up top, reply/"seen by" bar at the bottom). Inset Story content with extra top/bottom
  // padding so eyebrows, headlines and footers never sit behind that overlay. Feed posts
  // (4:5, 1:1) show edge-to-edge, so they keep the base padding. `padBox` is the root
  // padding string; horizontal stays `pad` (so the `W - 2*pad` fit math is unchanged).
  const padY = format === "story" ? pad + 160 : pad;
  const padBox = `${padY}px ${pad}px`;
  // Resolve a text/list slot: override if non-blank, else the variant's default.
  const t = (key: string) => copyText(copy, key, defaultsFor(variant, key));
  const l = (key: string) =>
    copyList(copy, key, defaultsFor(variant, key).split("\n"));

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
    // Auto-fit so a long custom line shrinks instead of clipping (WYSIWYG with the export).
    const avail = W - 2 * pad;
    const donts = l("donts");
    const dontBase = format === "square" ? 76 : 88;
    // ONE uniform size = the size that fits the LONGEST line (keeps the list even).
    const dontPx = donts.reduce(
      (px, d) => Math.min(px, fitFontPx(d, dontBase, avail, 0.52)),
      dontBase,
    );
    const payBase = format === "square" ? 84 : 100;
    const payPx = Math.min(
      fitFontPx(t("payoff1"), payBase, avail, 0.52),
      fitFontPx(t("payoff2"), payBase, avail, 0.52),
    );
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: `radial-gradient(120% 80% at 100% 0%, ${C.ink2}, ${C.ink} 60%)`,
          color: "#fff",
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.amber}>{t("eyebrow")}</Eyebrow>
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
          {donts.map((d, i) => (
            <div
              key={i}
              style={{
                font: `800 ${dontPx}px/0.98 ${BIG}`,
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
              font: `800 ${payPx}px/0.96 ${BIG}`,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {t("payoff1")}
            <br />
            <span style={{ color: C.amber }}>{t("payoff2")}</span>
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
    const weekendWord = t("weekend");
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: C.cream,
          color: C.ink,
          fontFamily: GROTESK,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.emerald}>{t("eyebrow")}</Eyebrow>
          <div
            style={{
              marginTop: 18,
              font: `700 ${format === "square" ? 62 : 72}px/1.0 ${GROTESK}`,
              letterSpacing: "-0.02em",
            }}
          >
            {t("headline")}
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
          {/* weekend = yours (letters stacked so a longer word still fits) */}
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
              {weekendWord
                .slice(0, 8)
                .split("")
                .map((ch, i) => (
                  <span
                    key={i}
                    style={{
                      font: `800 ${format === "square" ? 36 : 44}px/0.92 ${BIG}`,
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
            {t("subtext")}
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
          padding: padBox,
          background: `radial-gradient(110% 70% at 50% 0%, ${C.emerald} -10%, ${C.emeraldDk} 55%, #0c2620 100%)`,
          color: "#fff",
          fontFamily: SANS,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "none", textAlign: "center", width: "100%" }}>
          <Eyebrow color={C.amberSoft}>{t("eyebrow")}</Eyebrow>
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
              {t("badge1")}
              <br />
              {t("badge2")}
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
              {t("badgeSub")}
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
            {t("headline")}
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
          padding: padBox,
          background: `linear-gradient(160deg, ${C.cream} 0%, ${C.cream2} 55%, ${C.amberSoft} 130%)`,
          color: C.ink,
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.emerald}>{t("eyebrow")}</Eyebrow>
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
            {t("headline")}
          </div>
          <div
            style={{
              marginTop: 34,
              maxWidth: "84%",
              font: `400 ${format === "square" ? 30 : 34}px/1.4 ${SANS}`,
              color: C.inkMuteOnCream,
            }}
          >
            {t("body")}
          </div>
        </div>

        <div
          style={{ flex: "none", display: "flex", flexWrap: "wrap", gap: 12 }}
        >
          {l("chips").map((c, i) => (
            <span
              key={i}
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
  // BIGSTAT — one oversized number does the talking
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "bigstat") {
    const statPx = fitFontPx(
      t("stat"),
      format === "square" ? 600 : 700,
      W - 2 * pad,
      0.62,
    );
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: `radial-gradient(120% 90% at 50% 38%, ${C.ink2}, ${C.ink} 70%)`,
          color: "#fff",
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.amber}>{t("eyebrow")}</Eyebrow>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              font: `800 ${statPx}px/0.8 ${BIG}`,
              color: C.amber,
              letterSpacing: "-0.03em",
            }}
          >
            {t("stat")}
          </div>
          <div
            style={{
              marginTop: 4,
              font: `800 ${format === "square" ? 60 : 74}px/0.96 ${BIG}`,
              textTransform: "uppercase",
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            {t("statLabel")}
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <div
            style={{
              font: `500 ${format === "square" ? 26 : 30}px/1.3 ${SANS}`,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 8,
            }}
          >
            {t("sub")}
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
  // TICKET — a one-way boarding pass out of the grind
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "ticket") {
    const rows = l("rows").map((r) => {
      const idx = r.indexOf("—");
      return idx === -1
        ? { k: r.trim(), v: "" }
        : { k: r.slice(0, idx).trim(), v: r.slice(idx + 1).trim() };
    });
    const fieldLabel: CSSProperties = {
      font: `700 13px ${SANS}`,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: C.inkMuteOnCream,
    };
    const ticketPad = format === "square" ? 56 : 70;
    // FROM / connector / TO are deterministic columns: a fixed 90px connector and two
    // equal halves. Each big word is sized to fit its half (real Big Shoulders em ≈ 0.52,
    // 0.62 here over-estimates) so the row can never overflow the cream card.
    const routeColW = (W - 2 * ticketPad - 80 - 90 - 44) / 2;
    return (
      <div
        style={{
          ...base,
          padding: ticketPad,
          background: C.ink,
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            height: "100%",
            background: C.cream,
            borderRadius: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            color: C.ink,
          }}
        >
          {/* header strip */}
          <div
            style={{
              background: C.ink,
              color: C.cream,
              padding: "26px 40px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                font: `800 22px ${SANS}`,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
              }}
            >
              {t("eyebrow")}
            </span>
            <span
              style={{
                font: `700 16px ${SANS}`,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.amber,
              }}
            >
              {network || agencyName}
            </span>
          </div>

          {/* body — info anchored to the top, barcode pinned to the bottom (the
              canonical boarding-pass layout), so a tall Story reads as intentional
              ticket whitespace instead of a void. */}
          <div
            style={{
              flex: 1,
              padding: "40px 40px 34px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                font: `400 ${fitFontPx(t("title"), format === "square" ? 56 : 64, W - 280, 0.5)}px/1.0 ${SERIF}`,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 22,
                marginTop: 30,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={fieldLabel}>From</div>
                <div
                  style={{
                    font: `800 ${fitFontPx(t("from"), format === "square" ? 38 : 46, routeColW, 0.62)}px ${BIG}`,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("from")}
                </div>
              </div>
              <div
                style={{
                  flex: "none",
                  width: 90,
                  height: 2,
                  background: C.creamLine,
                  position: "relative",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    right: -4,
                    top: -19,
                    color: C.amber,
                    fontSize: 30,
                  }}
                >
                  ✈
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                <div style={fieldLabel}>To</div>
                <div
                  style={{
                    font: `800 ${fitFontPx(t("to"), format === "square" ? 38 : 46, routeColW, 0.62)}px ${BIG}`,
                    textTransform: "uppercase",
                    color: C.emerald,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("to")}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 30px",
                marginTop: 34,
              }}
            >
              {rows.slice(0, 4).map((r, i) => (
                <div key={i}>
                  <div style={fieldLabel}>{r.k}</div>
                  <div
                    style={{
                      font: `700 ${format === "square" ? 24 : 28}px ${SANS}`,
                      marginTop: 2,
                    }}
                  >
                    {r.v}
                  </div>
                </div>
              ))}
            </div>
            {/* spacer pushes the barcode to the bottom edge of the pass */}
            <div style={{ flex: 1, minHeight: 24 }} />
            {/* barcode — grounds the pass + reinforces the boarding-pass metaphor */}
            <div>
              <div
                style={{
                  height: 64,
                  background: `repeating-linear-gradient(90deg, ${C.ink} 0 4px, transparent 4px 7px, ${C.ink} 7px 9px, transparent 9px 14px, ${C.ink} 14px 19px, transparent 19px 22px)`,
                }}
              />
              <div
                style={{
                  marginTop: 9,
                  font: `700 13px ${SANS}`,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: C.inkMuteOnCream,
                }}
              >
                E-Ticket · 100% inbound · No cold calls
              </div>
            </div>
          </div>

          {/* perforated stub */}
          <div
            style={{
              borderTop: `2px dashed rgba(13,15,20,0.22)`,
              background: C.amber,
              color: C.ink,
              padding: "20px 40px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 24,
            }}
          >
            <span
              style={{
                flex: "none",
                font: `800 26px ${BIG}`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {t("stamp")}
            </span>
            <span
              style={{
                minWidth: 0,
                font: `700 14px ${SANS}`,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {network ? `${agencyName} · ${network}` : agencyName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // CHECKLIST — everything you get, with satisfying green checks
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "checklist") {
    const items = l("items");
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: C.cream,
          color: C.ink,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.emerald}>{t("eyebrow")}</Eyebrow>
          <div
            style={{
              marginTop: 16,
              font: `700 ${format === "square" ? 62 : 76}px/1.0 ${GROTESK}`,
              letterSpacing: "-0.02em",
            }}
          >
            {t("headline")}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: format === "square" ? 14 : 20,
            minHeight: 0,
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 22 }}
            >
              <span
                style={{
                  flex: "none",
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: C.emerald,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: `800 24px ${SANS}`,
                }}
              >
                ✓
              </span>
              <span
                style={{
                  font: `600 ${format === "square" ? 32 : 39}px/1.1 ${SANS}`,
                  color: C.ink,
                }}
              >
                {it}
              </span>
            </div>
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
  // POSTER — giant stacked words, a bold typographic hiring poster
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "poster") {
    const words = l("words").filter(Boolean);
    const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
    // Size each word to fit BOTH the column width (longest word) and the available
    // height (line count) — deterministic, so the stack never clips (no DOM measuring).
    const availH = H - 2 * padY - 240;
    const byWidth = (W - 2 * pad) / (Math.max(1, longest.length) * 0.58);
    const byHeight = availH / (Math.max(1, words.length) * 0.94);
    const wordPx = Math.max(44, Math.min(byWidth, byHeight, 250));
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: `linear-gradient(165deg, ${C.navy}, ${C.navyDk})`,
          color: C.cream,
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: C.amber,
              flex: "none",
            }}
          />
          <Eyebrow color={C.amber}>{t("eyebrow")}</Eyebrow>
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
          {words.map((w, i) => (
            <div
              key={i}
              style={{
                font: `800 ${wordPx}px/0.92 ${BIG}`,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: i === words.length - 1 ? C.amber : C.cream,
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <div style={{ flex: "none" }}>
          <div
            style={{
              font: `600 ${format === "square" ? 26 : 30}px/1.3 ${SANS}`,
              color: C.amberSoft,
              marginBottom: 8,
            }}
          >
            {t("sub")}
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
  // NEON — a glowing "now hiring" sign in a neon-framed window
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "neon") {
    const glow = (c: string) => `0 0 6px ${c}, 0 0 14px ${c}, 0 0 30px ${c}`;
    const signPx = fitFontPx(
      t("sign"),
      format === "square" ? 116 : 138,
      W - 2 * pad - 150,
      0.5,
    );
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: `radial-gradient(120% 80% at 50% 38%, #151922, ${C.ink} 78%)`,
          color: C.white,
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.neon}>
            <span style={{ textShadow: glow(C.neon) }}>● {t("eyebrow")}</span>
          </Eyebrow>
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
              border: `3px solid ${C.neon}`,
              borderRadius: 18,
              boxShadow: `${glow(C.neon)}, inset 0 0 22px rgba(95,227,192,0.22)`,
              padding: format === "square" ? "44px 52px" : "58px 72px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{
                font: `800 ${signPx}px/0.96 ${BIG}`,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: C.white,
                textShadow: glow(C.neon),
              }}
            >
              {t("sign")}
            </div>
            <div
              style={{
                width: 120,
                height: 3,
                background: C.neon,
                boxShadow: glow(C.neon),
              }}
            />
            <div
              style={{
                font: `500 ${format === "square" ? 28 : 32}px/1.3 ${SANS}`,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {t("sub")}
            </div>
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <div
            style={{
              textAlign: "center",
              font: `700 ${format === "square" ? 20 : 22}px ${SANS}`,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.amberSoft,
              marginBottom: 14,
            }}
          >
            {t("rule")}
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
  // CLOCK — a clock face stopped at 5:00 ("we're done at five")
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "clock") {
    const dia = format === "square" ? 360 : format === "story" ? 460 : 410;
    const hand = (deg: number, len: number, thick: number, color: string) => (
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "50%",
          width: thick,
          height: len,
          background: color,
          borderRadius: thick,
          transformOrigin: "50% 100%",
          transform: `translateX(-50%) rotate(${deg}deg)`,
        }}
      />
    );
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: `radial-gradient(120% 90% at 50% 32%, ${C.ink2}, ${C.ink} 72%)`,
          color: C.white,
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.amber}>{t("eyebrow")}</Eyebrow>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: format === "story" ? 56 : 40,
            minHeight: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              width: dia,
              height: dia,
              flex: "none",
              borderRadius: "50%",
              background: C.cream,
              boxShadow:
                "0 30px 70px rgba(0,0,0,0.5), inset 0 0 0 10px rgba(13,15,20,0.05)",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const major = i % 3 === 0;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 16,
                    width: major ? 6 : 3,
                    height: major ? 26 : 16,
                    background: major ? C.ink : "rgba(13,15,20,0.42)",
                    transformOrigin: `50% ${dia / 2 - 16}px`,
                    transform: `translateX(-50%) rotate(${i * 30}deg)`,
                  }}
                />
              );
            })}
            {/* hour hand → 5 o'clock (150°), minute hand → 12 (0°) */}
            {hand(150, dia * 0.26, 13, C.ink)}
            {hand(0, dia * 0.38, 8, C.amber)}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: C.ink,
                transform: "translate(-50%,-50%)",
                border: `4px solid ${C.amber}`,
              }}
            />
          </div>
          <div
            style={{
              font: `800 ${format === "square" ? 64 : 78}px/0.98 ${BIG}`,
              textTransform: "uppercase",
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            {t("headline")}
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <div
            style={{
              font: `500 ${format === "square" ? 26 : 30}px/1.3 ${SANS}`,
              color: "rgba(255,255,255,0.72)",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {t("sub")}
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
  // HIGHWAY — an interstate green guide sign: take the exit out of the grind
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "highway") {
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: "#15171c",
          color: C.white,
          fontFamily: SANS,
        }}
      >
        <div style={{ flex: "none" }}>
          <Eyebrow color={C.lime}>{t("eyebrow")}</Eyebrow>
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
              position: "relative",
              width: "100%",
              background: "#0f7a3f",
              border: "6px solid #fff",
              borderRadius: 22,
              padding: format === "square" ? "56px 48px" : "72px 56px",
              boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 44,
                transform: "translateY(-100%)",
                background: "#0f7a3f",
                border: "5px solid #fff",
                borderBottom: "none",
                borderRadius: "12px 12px 0 0",
                padding: "8px 22px",
                font: `800 ${format === "square" ? 30 : 36}px ${SANS}`,
                letterSpacing: "0.06em",
              }}
            >
              {t("exit")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: `800 ${fitFontPx(t("dest"), format === "square" ? 92 : 112, (W - 2 * pad) * 0.62, 0.6)}px/0.98 ${SANS}`,
                  letterSpacing: "-0.01em",
                }}
              >
                {t("dest")}
              </div>
              <div
                style={{
                  flex: "none",
                  font: `800 ${format === "square" ? 118 : 150}px/1 ${SANS}`,
                }}
              >
                ↗
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <div
            style={{
              font: `600 ${format === "square" ? 26 : 30}px/1.3 ${SANS}`,
              color: "rgba(255,255,255,0.72)",
              marginBottom: 8,
            }}
          >
            {t("sub")}
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
  // MEMO — an "out of office" auto-reply: the agent who has a life
  // ════════════════════════════════════════════════════════════════════════
  if (variant === "memo") {
    return (
      <div
        style={{
          ...base,
          padding: padBox,
          background: C.ink2,
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              background: C.cream,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              color: C.ink,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "20px 28px",
                borderBottom: `1.5px solid ${C.creamLine}`,
              }}
            >
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: C.red,
                }}
              />
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: C.amber,
                }}
              />
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: C.emerald,
                }}
              />
              <span
                style={{
                  marginLeft: 14,
                  font: `700 16px ${SANS}`,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: C.inkMuteOnCream,
                }}
              >
                {t("eyebrow")}
              </span>
            </div>
            <div
              style={{
                padding: format === "square" ? "40px 44px" : "54px 56px",
              }}
            >
              <div
                style={{
                  font: `800 ${fitFontPx(t("subject"), format === "square" ? 56 : 66, W - 2 * pad - 120, 0.56)}px ${GROTESK}`,
                  letterSpacing: "-0.01em",
                  marginBottom: 26,
                }}
              >
                {t("subject")}
              </div>
              <div
                style={{
                  font: `400 ${format === "square" ? 30 : 35}px/1.5 ${SANS}`,
                  color: "#39322a",
                }}
              >
                {t("body")}
              </div>
              <div
                style={{
                  marginTop: 34,
                  font: `600 ${format === "square" ? 24 : 27}px ${SANS}`,
                  color: C.inkMuteOnCream,
                }}
              >
                {t("signoff")}
              </div>
            </div>
          </div>
        </div>
        <Footer agencyName={agencyName} network={network} onDark page={page} />
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
    k: number,
  ) => (
    <div
      key={k}
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
      <div
        style={{
          flex: "none",
          padding: `${format === "story" ? pad + 130 : pad * 0.7}px ${pad}px ${pad * 0.42}px`,
          background: C.ink,
        }}
      >
        <Eyebrow color={C.amber}>{t("eyebrow")}</Eyebrow>
        <div
          style={{
            marginTop: 14,
            font: `800 ${format === "square" ? 62 : 74}px/0.98 ${BIG}`,
            color: "#fff",
            textTransform: "uppercase",
          }}
        >
          {t("headline")}
        </div>
      </div>

      <div
        style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}
      >
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
          <div style={colHead(C.red, false)}>{t("themLabel")}</div>
          {l("themItems").map((tx, i) => rowItem(tx, false, C.red, "✕", i))}
        </div>
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
          {l("usItems").map((tx, i) => rowItem(tx, true, C.amber, "✓", i))}
        </div>
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

      <div
        style={{
          flex: "none",
          padding: `0 ${pad}px ${format === "story" ? pad + 130 : pad * 0.7}px`,
          background: C.ink,
        }}
      >
        <Footer agencyName={agencyName} network={network} onDark page={page} />
      </div>
    </div>
  );
}
