// src/features/recruiting/layouts/shells/scaffolds.tsx
//
// Two reusable scaffolds that carry the hard-won VIEWPORT-CORRECTNESS (the form
// must never clip the viewport) and the centralized form mount. Every shell
// composes one of these instead of re-deriving the tricky h-svh / min-h-0 chain.
//
//   • PinnedFormShell  — desktop two-pane: content pane + form pane EACH scroll
//     internally (h-svh, overflow-hidden root; per-pane min-h-0 + overflow-y-auto).
//     Mobile: natural document flow. This is the proven AiComposedLayout pattern.
//   • NaturalScrollShell — single-column natural document scroll, form inline.

import type { ReactNode } from "react";
import {
  ShellRoot,
  ShellHeader,
  ContentStream,
  FormSlot,
  splitFormAndContent,
} from "./shellKit";
import type { ShellProps } from "./types";

/**
 * Desktop two-pane shell with the lead form pinned in the right pane. The LEFT
 * pane's inner content is supplied by the caller (`left`); the right form pane is
 * standardized (centered, internal-scroll). Both panes scroll independently so a
 * tall form/content never clips the viewport.
 */
export function PinnedFormShell({
  shell,
  left,
  leftBgImage = null,
  gridCols = "1.1fr 0.9fr",
  leftSurface,
}: {
  shell: ShellProps;
  /** Inner content of the left/content pane (e.g. header + content blocks). */
  left: ReactNode;
  /** Optional faint background image behind the left pane (e.g. hero_image_url). */
  leftBgImage?: string | null;
  /** CSS grid-template-columns value for the lg two-pane split. */
  gridCols?: string;
  /** Override the left pane surface class (default derives from mode). */
  leftSurface?: string;
}) {
  const { spec, theme, ctx, styleVars, mode } = shell;
  const { formBlock } = splitFormAndContent(spec);
  const contentSurface =
    leftSurface ?? (mode === "dark" ? "surface-dark" : "surface-base");

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
      className="lg:h-svh lg:overflow-hidden"
      innerClassName="lg:h-full"
    >
      <div
        className="lg:grid lg:h-full"
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* LEFT / CONTENT — scrolls internally on desktop */}
        <div
          className={`${contentSurface} relative overflow-hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col`}
        >
          {leftBgImage && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${encodeURI(leftBgImage)})`,
                opacity: mode === "dark" ? 0.18 : 0.1,
              }}
            />
          )}
          <div className="relative z-10 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            {left}
          </div>
        </div>

        {/* RIGHT / FORM — scrolls internally on desktop */}
        <aside className="surface-paper lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-l lg:border-[var(--landing-border-strong)]">
          <div className="flex flex-col overflow-y-auto p-6 sm:p-8 xl:p-10 lg:min-h-0 lg:flex-1">
            {/* my-auto centers a short form; tall forms still scroll from top. */}
            <div className="my-auto w-full">
              <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />
            </div>
          </div>
        </aside>
      </div>
    </ShellRoot>
  );
}

/**
 * Single-column, natural-document-scroll shell. The form renders inline in the
 * content stream (no pinning, so no viewport-clip risk). When `children` is
 * omitted it renders a sensible default: header → content blocks → form. Custom
 * shells pass their own `children` (composed from the shellKit pieces).
 */
export function NaturalScrollShell({
  shell,
  maxWidth = "max-w-3xl",
  children,
}: {
  shell: ShellProps;
  maxWidth?: string;
  children?: ReactNode;
}) {
  const { spec, theme, ctx, styleVars, mode } = shell;
  const { formBlock, contentBlocks } = splitFormAndContent(spec);

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
    >
      <div className={`mx-auto w-full ${maxWidth} px-5 py-8 sm:px-8 lg:py-14`}>
        {children ?? (
          <div className="flex flex-col gap-10 lg:gap-14">
            <ShellHeader ctx={ctx} theme={theme} />
            <ContentStream
              blocks={contentBlocks}
              ctx={ctx}
              className="flex flex-col gap-10 lg:gap-14"
            />
            <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />
          </div>
        )}
      </div>
    </ShellRoot>
  );
}
