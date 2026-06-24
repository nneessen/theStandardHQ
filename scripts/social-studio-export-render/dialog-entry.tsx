// scripts/social-studio-export-render/dialog-entry.tsx
// Renders the WI-5 PostConfirmDialog (open) so its Instagram chrome can be screenshotted
// headlessly. ?postType=post|story & ?slides=<n> drive the variant + carousel dots.

import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { PostConfirmDialog } from "@/features/social-studio/components/PostConfirmDialog";
import {
  buildPreviewPages,
  buildPeriodLabels,
  type ProducerRow,
} from "@/features/social-studio/previewModel";
import { DEFAULT_CONFIG } from "@/features/social-studio/types";

declare global {
  interface Window {
    __READY__?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const postType = (params.get("postType") || "post") as "post" | "story";
const format = postType === "story" ? "story" : "portrait";

const producers: ProducerRow[] = Array.from({ length: 12 }, (_, i) => ({
  agentName: `Agent ${String.fromCharCode(65 + i)}`,
  apTotal: 18000 - i * 700,
  policyCount: 12 - i,
}));
const config = {
  ...DEFAULT_CONFIG,
  view: "daily" as const,
  format,
  postType,
  topN: "all" as const,
};
const labels = buildPeriodLabels(new Date("2026-06-20T12:00:00Z"));
const pages = buildPreviewPages({ config, producers, isSample: false, labels });
const slideCount = Number(params.get("slides")) || pages.length;

function App() {
  useEffect(() => {
    void (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 250));
      window.__READY__ = true;
    })();
  }, []);
  return (
    <PostConfirmDialog
      open
      onOpenChange={() => {}}
      postType={postType}
      format={format}
      data={pages[0]}
      agencyName="THE STANDARD"
      network="EPIC LIFE"
      showPolicies
      handle="thestandard.agency"
      caption="June was massive 🔥 47 producers, $560K AP this month. So proud of this team — let's run it back."
      slideCount={slideCount}
      carouselReady={false}
      posting={false}
      onConfirm={() => {}}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
