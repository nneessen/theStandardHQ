// scripts/social-studio-export-render/entry.tsx
//
// FAITHFUL export-path harness for the Social Studio crop bug (WI-1).
//
// Unlike scripts/leaderboard-card-render (which mounts a STANDALONE card with no
// transform ancestor and screenshots it natively — so it renders a perfect 1080×H
// every time and can NEVER show the crop bug), this harness mounts the REAL
// <SocialPreview>. SocialPreview wraps the card in `transform: scale()` to fit the
// preview pane, and the in-app export captures the node that lives INSIDE that
// transform. We then call the SAME domToPng(cardRef.current,{scale:1}) the app's
// SocialStudioPage.renderCardPng() uses, so whatever the user actually gets when
// they hit "Post"/"Download" is exactly what this harness produces.
//
// URL params: ?view=daily|weekly|monthly|aotw &format=portrait|square|story
//             &theme=spotlight|editorial|lift &topN=<n> &page=<i>

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { SocialPreview } from "@/features/social-studio/components/SocialPreview";
import {
  buildPreviewData,
  buildPeriodLabels,
  type ProducerRow,
} from "@/features/social-studio/previewModel";
import {
  DEFAULT_CONFIG,
  type SocialView,
} from "@/features/social-studio/types";
import {
  normalizeCardTheme,
  renderCardToPng,
  type SocialFormat,
} from "@/features/social-cards";

declare global {
  interface Window {
    __READY__?: boolean;
    // The exact in-app export, exposed so run.mjs can decode the resulting PNG and
    // assert its pixel dimensions equal FORMAT_DIMS (the only honest WI-1 check).
    __exportPng?: () => Promise<string>;
  }
}

// Descending-AP roster, large enough to also exercise pagination (WI-4) later.
const NAMES = [
  "Marcus Webb",
  "Alyssa Chen",
  "Priya Nair",
  "Jordan Mercer",
  "Devon Brooks",
  "Sofia Alvarez",
  "Tyrone Wallace",
  "Hannah Kim",
  "Liam O'Connor",
  "Grace Okafor",
  "Noah Bennett",
  "Maya Russo",
  "Caleb Stone",
  "Isabella Cruz",
  "Ethan Fowler",
  "Olivia Hart",
  "Mason Reid",
  "Ava Delgado",
  "Lucas Pine",
  "Emma Vance",
  "Logan Frost",
  "Chloe Marsh",
];
const producers: ProducerRow[] = NAMES.map((agentName, i) => ({
  agentName,
  apTotal: Math.round(16800 - i * 620),
  policyCount: Math.max(1, 13 - Math.floor(i / 2)),
}));

const params = new URLSearchParams(location.search);
const view = (params.get("view") || "daily") as SocialView;
const format = (params.get("format") || "portrait") as SocialFormat;
const cardTheme = normalizeCardTheme(params.get("theme"));
const topN = Number(params.get("topN") || "10");

const config = { ...DEFAULT_CONFIG, view, format, cardTheme, topN };
// Fixed `now` → deterministic period labels across runs.
const labels = buildPeriodLabels(new Date("2026-06-20T12:00:00Z"));
const previewData = buildPreviewData({
  config,
  producers,
  isSample: false,
  labels,
});

function App() {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Use the SAME exporter the app uses (renderCardToPng) on the SAME node
    // (cardRef.current, which SocialPreview now attaches to its off-screen full-size
    // copy) — so this harness is byte-for-byte what SocialStudioPage.renderCardPng()
    // produces and can never drift from it.
    window.__exportPng = async () => {
      if (!cardRef.current) throw new Error("cardRef not ready");
      return renderCardToPng(cardRef.current, format);
    };

    void (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res();
                img.onerror = () => res();
              }),
        ),
      );
      await new Promise((r) => setTimeout(r, 200));
      window.__READY__ = true;
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <SocialPreview
        data={previewData}
        format={format}
        agencyName="THE STANDARD"
        network="EPIC LIFE"
        isSample={false}
        isLoading={false}
        showPolicies
        cardRef={cardRef}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
