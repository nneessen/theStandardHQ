// scripts/social-studio-export-render/entry.tsx
//
// FAITHFUL export-path harness for Social Studio. It mounts the REAL CardExportHost —
// the same off-screen, full-size host the app's Download/Post path uses — builds the
// page set with the REAL buildPreviewPages, and calls the REAL exportAll() (shared
// renderCardToPng). So every PNG here is byte-for-byte what the app would post, and we
// can assert pixel dims == FORMAT_DIMS AND eyeball pagination (contiguous ranks, no
// last-row clip, top-aligned partial pages).
//
// URL params: ?view=daily|weekly|monthly|aotw &format=portrait|square|story
//             &theme=spotlight|editorial|lift &topN=5|10|20|50|all &n=<rosterSize>

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import {
  CardExportHost,
  type CardExportHandle,
} from "@/features/social-studio/components/CardExportHost";
import {
  buildPreviewPages,
  buildPeriodLabels,
  type ProducerRow,
} from "@/features/social-studio/previewModel";
import {
  DEFAULT_CONFIG,
  type SocialView,
} from "@/features/social-studio/types";
import { normalizeCardTheme, type SocialFormat } from "@/features/social-cards";
import { MARKETING_COPY_CAPS } from "@/features/social-studio/marketingCopyCaps";
import type { PreviewData } from "@/features/social-studio/components/SocialPreview";

declare global {
  interface Window {
    __READY__?: boolean;
    __exportAll?: () => Promise<string[]>;
    __pageCount?: number;
  }
}

const FIRST = [
  "Marcus",
  "Alyssa",
  "Priya",
  "Jordan",
  "Devon",
  "Sofia",
  "Tyrone",
  "Hannah",
  "Liam",
  "Grace",
  "Noah",
  "Maya",
  "Caleb",
  "Isabella",
  "Ethan",
  "Olivia",
  "Mason",
  "Ava",
  "Lucas",
  "Emma",
  "Logan",
  "Chloe",
];
const LAST = [
  "Webb",
  "Chen",
  "Nair",
  "Mercer",
  "Brooks",
  "Alvarez",
  "Wallace",
  "Kim",
  "O'Connor",
  "Okafor",
  "Bennett",
  "Russo",
  "Stone",
  "Cruz",
  "Fowler",
  "Hart",
  "Reid",
  "Delgado",
  "Pine",
  "Vance",
  "Frost",
  "Marsh",
];
const makeName = (i: number) =>
  `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;

const params = new URLSearchParams(location.search);
const view = (params.get("view") || "daily") as SocialView;
const format = (params.get("format") || "portrait") as SocialFormat;
const cardTheme = normalizeCardTheme(params.get("theme"));
const topNParam = params.get("topN") || "all";
const topN: number | "all" = topNParam === "all" ? "all" : Number(topNParam);
const n = Number(params.get("n") || "47");
// Recruiting view only: which template variant to render (manifesto|hours|seal|lifeback|compare).
const recruitingVariant = params.get("variant") || undefined;

// Strictly descending AP so ranks are unambiguous across page boundaries.
const producers: ProducerRow[] = Array.from({ length: n }, (_, i) => ({
  agentName: makeName(i),
  apTotal: Math.round(18600 - i * 290),
  policyCount: Math.max(1, 15 - Math.floor(i / 3)),
}));

const config = {
  ...DEFAULT_CONFIG,
  view,
  format,
  cardTheme,
  topN,
  // The `variant` param drives recruitingVariant (recruiting view) AND welcomeVariant
  // (newagent view) — they're independent fields, so setting both is harmless.
  ...(recruitingVariant
    ? {
        recruitingVariant:
          recruitingVariant as typeof DEFAULT_CONFIG.recruitingVariant,
        welcomeVariant:
          recruitingVariant as typeof DEFAULT_CONFIG.welcomeVariant,
      }
    : {}),
};
const labels = buildPeriodLabels(new Date("2026-06-20T12:00:00Z"));
const dataPages = buildPreviewPages({
  config,
  producers,
  isSample: false,
  labels,
});

// A canvas-drawn gradient stands in for an uploaded photo so we can Read the custom
// variant's image path (dark scrim + forced-light ink) without embedding a huge data URL.
function gradientDataUrl(): string {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 600;
  const g = c.getContext("2d");
  if (!g) return "";
  const grad = g.createLinearGradient(0, 0, 600, 600);
  grad.addColorStop(0, "#1e3a8a");
  grad.addColorStop(1, "#9333ea");
  g.fillStyle = grad;
  g.fillRect(0, 0, 600, 600);
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.beginPath();
  g.arc(430, 160, 200, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL("image/png");
}

// ?deck=1 → a MIXED carousel (#8): the leaderboard lead card + every marketing variant,
// page-stamped, so we can Read each marketing card AND confirm a mixed deck is cohesive.
// ?stress=1 → fill each marketing field to the AI-draft length cap (socialMarketingCopy
// service / social-marketing-copy edge fn: text 140, headline 40, body 160, attribution
// 40) so we can prove the longest possible draft still fits the card frame (the #1 lesson:
// overflow:hidden hides a clip — caps must hold at the boundary, not just for short copy).
const wantDeck = params.get("deck") === "1";
const wantStress = params.get("stress") === "1";
// Shared with the editor + the server-authoritative edge fn (review #14).
const COPY_CAPS = MARKETING_COPY_CAPS;
const STRESS_WORDS =
  "protecting families with honest guidance and steady commitment every single day builds lasting trust that compounds over time and quietly changes lives across our whole community".split(
    " ",
  );
// Largest whole-word string <= maxLen — exactly what the edge fn's word-boundary cap emits.
function fill(maxLen: number): string {
  let s = "";
  for (let i = 0; i < 256; i++) {
    const w = STRESS_WORDS[i % STRESS_WORDS.length];
    const next = s ? `${s} ${w}` : w;
    if (next.length > maxLen) break;
    s = next;
  }
  return s;
}
const marketing: PreviewData[] = [
  {
    kind: "marketing",
    variant: "quote",
    theme: cardTheme,
    text: wantStress
      ? fill(COPY_CAPS.text)
      : "Protect what matters most — your family's future starts with one honest conversation.",
    attribution: wantStress ? fill(COPY_CAPS.attribution) : "The Standard",
  },
  {
    kind: "marketing",
    variant: "tip",
    theme: cardTheme,
    headline: wantStress ? fill(COPY_CAPS.headline) : "Lead with the why",
    body: wantStress
      ? fill(COPY_CAPS.body)
      : "Open every call by asking what they're protecting. The product follows the purpose, never the other way around.",
  },
  {
    kind: "marketing",
    variant: "cta",
    theme: cardTheme,
    headline: wantStress ? fill(COPY_CAPS.headline) : "Join our team",
    body: wantStress
      ? fill(COPY_CAPS.body)
      : "We're growing across the region. Build a career helping families protect their future.",
  },
  {
    kind: "marketing",
    variant: "custom",
    theme: cardTheme,
    headline: wantStress ? fill(COPY_CAPS.headline) : "A $1,000,000 month",
    body: wantStress
      ? fill(COPY_CAPS.body)
      : "Our biggest month yet — thank you to every producer who made it happen.",
    imageDataUrl: gradientDataUrl(),
  },
];
const pages: PreviewData[] = wantDeck
  ? [dataPages[0], ...marketing].map((p, i, arr) =>
      p.kind === "aotw"
        ? p
        : { ...p, page: { index: i + 1, total: arr.length } },
    )
  : dataPages;

function App() {
  const hostRef = useRef<CardExportHandle>(null);

  useEffect(() => {
    window.__pageCount = pages.length;
    window.__exportAll = async () => {
      if (!hostRef.current) throw new Error("export host not ready");
      return hostRef.current.exportAll();
    };
    void (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 250));
      window.__READY__ = true;
    })();
  }, []);

  return (
    <CardExportHost
      ref={hostRef}
      pages={pages}
      format={format}
      agencyName="THE STANDARD"
      network="EPIC LIFE"
      showPolicies
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
