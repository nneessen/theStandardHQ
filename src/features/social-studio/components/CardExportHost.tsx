// src/features/social-studio/components/CardExportHost.tsx
//
// Off-screen, full-size render host for PNG export. Two reasons it exists:
//   1. The on-screen SocialPreview is scaled with transform:scale() to fit the pane,
//      so it must NEVER be the capture source (modern-screenshot would size the canvas
//      from the shrunk bounding rect — the WI-1 "one eighth" crop).
//   2. A multi-page carousel needs EVERY page rasterized, not just the previewed one.
//
// So this host mounts each page at native 1080×H, far off-canvas and inert, and
// exposes an imperative exportAll()/exportOne() that runs the SHARED renderCardToPng()
// over each page's node — the same exporter the verify harness uses.

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  cardThemeWrapperClass,
  renderCardToPng,
  FORMAT_DIMS,
  type SocialFormat,
} from "@/features/social-cards";
import { SocialCardSwitch, type PreviewData } from "./SocialPreview";

export interface CardExportHandle {
  /** Rasterize every page in order → one PNG data URL per page (the carousel). */
  exportAll: () => Promise<string[]>;
  /** Rasterize a single page (e.g. the one being previewed) for Post Now / Download. */
  exportOne: (index: number) => Promise<string | null>;
}

interface CardExportHostProps {
  pages: PreviewData[];
  format: SocialFormat;
  agencyName: string;
  network?: string;
  showPolicies: boolean;
}

export const CardExportHost = forwardRef<CardExportHandle, CardExportHostProps>(
  function CardExportHost(
    { pages, format, agencyName, network, showPolicies },
    ref,
  ) {
    const nodes = useRef<(HTMLDivElement | null)[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        exportAll: async () => {
          const out: string[] = [];
          // Sequential (not Promise.all): each capture awaits document.fonts.ready and
          // is CPU-heavy; serializing keeps memory flat and the order deterministic.
          for (let i = 0; i < pages.length; i++) {
            const node = nodes.current[i];
            if (node) out.push(await renderCardToPng(node, format));
          }
          return out;
        },
        exportOne: async (i) => {
          const node = nodes.current[i];
          return node ? renderCardToPng(node, format) : null;
        },
      }),
      [pages, format],
    );

    const naturalW = FORMAT_DIMS[format].w;

    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -100000,
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        {pages.map((data, i) => (
          <div
            // Index key is correct here: the page list is fully derived from config
            // (no identity/reordering), and every page re-renders with fresh data.
            key={i}
            ref={(el) => {
              nodes.current[i] = el;
            }}
            className={cardThemeWrapperClass(data.theme)}
            style={{ width: naturalW }}
          >
            <SocialCardSwitch
              data={data}
              format={format}
              agencyName={agencyName}
              network={network}
              showPolicies={showPolicies}
            />
          </div>
        ))}
      </div>
    );
  },
);
