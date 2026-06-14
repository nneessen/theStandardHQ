// src/features/recruiting/layouts/shells/shellKit.tsx
//
// Shared building blocks every recruiting-page SHELL composes. Centralizing these
// keeps the 8 shells thin and guarantees the load-bearing invariants in ONE place:
//   • the lead form is ALWAYS rendered through BlockRenderer/FormBlock (so the
//     single-form guarantee and the "__preview__" submit-inertness hold for every
//     shell — never hand-mount LeadInterestForm in a shell).
//   • headshots render via encodeURI (untrusted recruiter asset URL).
//   • background decoration + header chrome are identical across shells.

import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type {
  RecruitingDesignSpec,
  DesignBlock,
  BackgroundStyle,
} from "@/types/recruiting-design-spec.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import { BlockRenderer, type BlockRenderContext } from "../blocks";

// Header logo height per the recruiter's chosen logo_size.
export const LOGO_HEADER_HEIGHT: Record<string, number> = {
  small: 28,
  medium: 36,
  large: 48,
  xlarge: 64,
};

/** Split a validated spec into its single form block + the content blocks. */
export function splitFormAndContent(spec: RecruitingDesignSpec): {
  formBlock: DesignBlock | undefined;
  contentBlocks: DesignBlock[];
} {
  return {
    formBlock: spec.blocks.find((b) => b.type === "form"),
    contentBlocks: spec.blocks.filter((b) => b.type !== "form"),
  };
}

/** Background decoration (topo grid / floating shapes / lattice). */
export function Decoration({ style }: { style: BackgroundStyle }) {
  if (style === "flat") return null;
  if (style === "floating-shapes") {
    return (
      <>
        <div className="topo-grid absolute inset-0 pointer-events-none opacity-60" />
        <div
          className="floating-shape floating-shape-1 hidden md:block"
          style={{ top: "-6%", right: "-4%" }}
        />
        <div
          className="floating-shape floating-shape-2 hidden md:block"
          style={{ bottom: "8%", left: "-3%" }}
        />
      </>
    );
  }
  if (style === "lattice") {
    return (
      <>
        <div className="topo-grid absolute inset-0 pointer-events-none" />
        <div
          className="floating-shape floating-shape-ring hidden lg:block"
          style={{ top: "12%", left: "46%" }}
        />
      </>
    );
  }
  return <div className="topo-grid absolute inset-0 pointer-events-none" />;
}

/** Logo (or wordmark) + an Agent Login link. */
export function ShellHeader({
  ctx,
  theme,
  className = "",
}: {
  ctx: BlockRenderContext;
  theme: RecruitingPageTheme;
  className?: string;
}) {
  const logoHeight = LOGO_HEADER_HEIGHT[theme.logo_size ?? "medium"] ?? 36;
  return (
    <header className={`flex items-center justify-between gap-4 ${className}`}>
      {ctx.logoUrl ? (
        <img
          src={ctx.logoUrl}
          alt={ctx.displayName}
          className="w-auto object-contain"
          style={{ height: logoHeight }}
        />
      ) : (
        <span
          className="font-display font-black uppercase tracking-tight text-xl"
          style={{ color: "var(--spec-primary)" }}
        >
          {ctx.displayName}
        </span>
      )}
      <a
        href="/login"
        className="hidden sm:inline-flex landing-badge-pill transition-colors"
      >
        Agent Login
        <ArrowRight className="h-3 w-3" />
      </a>
    </header>
  );
}

/**
 * Recruiter headshot/portrait. Renders nothing if the recruiter has not uploaded
 * one — shells must tolerate its absence. `shape` controls the crop.
 */
export function Headshot({
  ctx,
  className = "",
  shape = "circle",
}: {
  ctx: BlockRenderContext;
  className?: string;
  shape?: "circle" | "rounded" | "square";
}) {
  if (!ctx.headshotUrl) return null;
  const radius =
    shape === "circle"
      ? "rounded-full"
      : shape === "rounded"
        ? "rounded-2xl"
        : "rounded-none";
  return (
    <img
      src={encodeURI(ctx.headshotUrl)}
      alt={ctx.recruiterFullName || ctx.displayName}
      className={`${radius} object-cover ${className}`}
    />
  );
}

/** Map the content blocks (everything except the form) through BlockRenderer. */
export function ContentStream({
  blocks,
  ctx,
  className = "",
}: {
  blocks: DesignBlock[];
  ctx: BlockRenderContext;
  className?: string;
}) {
  return (
    <div className={className}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} ctx={ctx} />
      ))}
    </div>
  );
}

/**
 * The lead-form slot. ALWAYS rendered through BlockRenderer/FormBlock so the
 * single-form guarantee + preview inertness hold. Appends the recruiter's
 * disclaimer beneath the form when present.
 */
export function FormSlot({
  formBlock,
  ctx,
  theme,
  className = "",
}: {
  formBlock: DesignBlock | undefined;
  ctx: BlockRenderContext;
  theme: RecruitingPageTheme;
  className?: string;
}) {
  if (!formBlock) return null;
  return (
    <div className={className}>
      <BlockRenderer block={formBlock} ctx={ctx} />
      {theme.disclaimer_text && (
        <p className="mt-6 text-eyebrow font-mono leading-relaxed opacity-80">
          {theme.disclaimer_text}
        </p>
      )}
    </div>
  );
}

/**
 * Common root wrapper: applies the spec's CSS variables, the .theme-landing
 * editorial tokens, the data-mode (light/dark), and the background decoration.
 * Every shell renders its structure INSIDE this.
 */
export function ShellRoot({
  styleVars,
  mode,
  backgroundStyle,
  className = "",
  innerClassName = "",
  children,
}: {
  styleVars: CSSProperties;
  mode: "light" | "dark";
  backgroundStyle: BackgroundStyle;
  className?: string;
  /** Applied to the z-10 content wrapper — e.g. "lg:h-full" for pinned shells. */
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`theme-landing surface-base relative w-full ${className}`}
      style={styleVars}
      data-mode={mode}
    >
      <Decoration style={backgroundStyle} />
      <div className={`relative z-10 ${innerClassName}`}>{children}</div>
    </div>
  );
}
