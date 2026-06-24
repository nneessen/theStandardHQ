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

// Strictly descending AP so ranks are unambiguous across page boundaries.
const producers: ProducerRow[] = Array.from({ length: n }, (_, i) => ({
  agentName: makeName(i),
  apTotal: Math.round(18600 - i * 290),
  policyCount: Math.max(1, 15 - Math.floor(i / 3)),
}));

const config = { ...DEFAULT_CONFIG, view, format, cardTheme, topN };
const labels = buildPeriodLabels(new Date("2026-06-20T12:00:00Z"));
const dataPages = buildPreviewPages({
  config,
  producers,
  isSample: false,
  labels,
});

// ?deck=1 → a MIXED carousel (#8): the leaderboard lead card + every marketing variant,
// page-stamped, so we can Read each marketing card AND confirm a mixed deck is cohesive.
const wantDeck = params.get("deck") === "1";
const marketing: PreviewData[] = [
  {
    kind: "marketing",
    variant: "quote",
    theme: cardTheme,
    text: "Protect what matters most — your family's future starts with one honest conversation.",
    attribution: "The Standard",
  },
  {
    kind: "marketing",
    variant: "tip",
    theme: cardTheme,
    headline: "Lead with the why",
    body: "Open every call by asking what they're protecting. The product follows the purpose, never the other way around.",
  },
  {
    kind: "marketing",
    variant: "cta",
    theme: cardTheme,
    headline: "Join our team",
    body: "We're growing across the region. Build a career helping families protect their future.",
  },
  {
    kind: "marketing",
    variant: "custom",
    theme: cardTheme,
    headline: "A $1,000,000 month",
    body: "Our biggest month yet — thank you to every producer who made it happen.",
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
