// src/features/recruiting/components/wizard/DesignPreviewFrame.tsx
//
// Hosts the live-preview iframe (points at /internal/design-preview). Posts the
// current spec + preview theme to the iframe via postMessage and offers a real
// desktop/mobile width toggle — the iframe's element width IS the inner viewport
// width, so AiComposedLayout's responsive breakpoints resolve accurately. This
// is how we visually prove the form fits the viewport (the original complaint).
//
// SCALING: at desktop (1180px logical), the iframe is wider than its max-w-3xl
// container. We keep the iframe's style.width at the logical frame width so the
// internal viewport stays accurate, but wrap it in a div scaled via
// `transform: scale(ratio)` with an explicit scaled height so no overflow occurs.
// The measurement div is a plain w-full block — its clientWidth is parent-capped
// and not inflated by the oversized iframe child.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  // measureRef: a plain block div whose clientWidth is parent-constrained (not
  // pushed by the iframe child). We observe it to compute the scale ratio.
  const measureRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [view, setView] = useState<ViewWidth>("desktop");
  const [ready, setReady] = useState(false);

  // Measure container width immediately before first paint to avoid a flash.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // scale ≤ 1: desktop may need to shrink; mobile (390) fits inside, so cap at 1.
  const frameWidth = WIDTHS[view];
  const scale =
    containerWidth !== null
      ? Math.min(1, containerWidth / frameWidth)
      : view === "mobile"
        ? 1
        : 0; // hide until measured to avoid flash at full 1180px

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
      {/* Measure div: plain w-full block — its clientWidth is parent-capped, not
          inflated by the oversized iframe below. */}
      <div ref={measureRef} className="w-full" />
      <div className="overflow-hidden p-3">
        {spec ? (
          // Outer div acts as the "scaled bounding box" so the parent sees the
          // correctly-sized footprint (no horizontal overflow).
          <div
            style={{
              width: "100%",
              height: scale > 0 ? PREVIEW_HEIGHT * scale : 0,
              overflow: "hidden",
            }}
          >
            <iframe
              ref={iframeRef}
              src={PREVIEW_PATH}
              title="Recruiting page preview"
              style={{
                // Keep logical frame width so internal viewport breakpoints resolve correctly.
                width: frameWidth,
                height: PREVIEW_HEIGHT,
                border: 0,
                transformOrigin: "top left",
                transform: `scale(${scale})`,
                visibility: scale > 0 ? "visible" : "hidden",
              }}
              className="block rounded bg-white shadow-sm"
            />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-v2-ink-subtle">
            Generate a design to see your live preview.
          </div>
        )}
      </div>
    </div>
  );
}
