// src/features/recruiting/components/wizard/DesignPreviewFrame.tsx
//
// Hosts the live-preview iframe (points at /internal/design-preview). Posts the
// current spec + preview theme to the iframe via postMessage and offers a real
// desktop/mobile width toggle — the iframe's element width IS the inner viewport
// width, so AiComposedLayout's responsive breakpoints resolve accurately. This
// is how we visually prove the form fits the viewport (the original complaint).

import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { RecruitingDesignSpec } from "@/types/recruiting-design-spec.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";

const PREVIEW_PATH = "/internal/design-preview";
const PREVIEW_KEY = "design-preview";
const PREVIEW_HEIGHT = 680;

type ViewWidth = "desktop" | "mobile";
const WIDTHS: Record<ViewWidth, number> = { desktop: 1180, mobile: 390 };

export function DesignPreviewFrame({
  spec,
  theme,
}: {
  spec: RecruitingDesignSpec | null;
  theme: Partial<RecruitingPageTheme>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<ViewWidth>("desktop");
  const [ready, setReady] = useState(false);

  // The child posts "ready" once it's listening.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      if ((ev.data as { source?: string })?.source === "design-preview-ready") {
        setReady(true);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Push the spec/theme to the iframe whenever they change (and once ready).
  useEffect(() => {
    if (!spec) return;
    // Snapshot for the child's first-paint fallback (covers the load race).
    try {
      sessionStorage.setItem(PREVIEW_KEY, JSON.stringify({ spec, theme }));
    } catch {
      // ignore quota/serialization issues
    }
    iframeRef.current?.contentWindow?.postMessage(
      { source: "design-preview", spec, theme },
      window.location.origin,
    );
  }, [spec, theme, ready]);

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card-tinted">
      <div className="flex items-center justify-between border-b border-v2-ring px-3 py-2">
        <span className="text-xs font-medium text-v2-ink">Live preview</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("desktop")}
            aria-pressed={view === "desktop"}
            aria-label="Desktop preview"
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              view === "desktop"
                ? "bg-info/10 text-info"
                : "text-v2-ink-subtle hover:text-v2-ink"
            }`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("mobile")}
            aria-pressed={view === "mobile"}
            aria-label="Mobile preview"
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              view === "mobile"
                ? "bg-info/10 text-info"
                : "text-v2-ink-subtle hover:text-v2-ink"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="overflow-auto p-3"
        style={{ maxHeight: PREVIEW_HEIGHT + 40 }}
      >
        {spec ? (
          <iframe
            ref={iframeRef}
            src={PREVIEW_PATH}
            title="Recruiting page preview"
            style={{
              width: WIDTHS[view],
              height: PREVIEW_HEIGHT,
              border: 0,
            }}
            className="mx-auto block rounded bg-white shadow-sm"
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-v2-ink-subtle">
            Generate a design to see your live preview.
          </div>
        )}
      </div>
    </div>
  );
}
