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
  | "compare";

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
          {l("donts").map((d, i) => (
            <div
              key={i}
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
          padding: pad,
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
          padding: pad,
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
          padding: pad,
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
          padding: `${pad * 0.7}px ${pad}px ${pad * 0.42}px`,
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
          padding: `0 ${pad}px ${pad * 0.7}px`,
          background: C.ink,
        }}
      >
        <Footer agencyName={agencyName} network={network} onDark page={page} />
      </div>
    </div>
  );
}
