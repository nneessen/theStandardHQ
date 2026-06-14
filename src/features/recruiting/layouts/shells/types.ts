// src/features/recruiting/layouts/shells/types.ts
// Props every recruiting-page SHELL receives. The dispatcher (registry.tsx)
// computes ctx + styleVars + mode ONCE and hands them to the chosen shell, so
// shells never recompute theming — they only arrange the hero, content, and form.

import type { CSSProperties, ReactElement } from "react";
import type {
  RecruitingDesignSpec,
  PaletteMode,
} from "@/types/recruiting-design-spec.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import type { BlockRenderContext } from "../blocks";

export interface ShellProps {
  /** The validated, render-safe design spec (theme + ordered blocks + layout). */
  spec: RecruitingDesignSpec;
  /** The recruiter's resolved theme (logo, headshot, calendar, disclaimer, …). */
  theme: RecruitingPageTheme;
  /** Render context handed to every block (real recruiter data + callbacks). */
  ctx: BlockRenderContext;
  /** CSS variables (palette/fonts/radius) to apply on the shell root. */
  styleVars: CSSProperties;
  /** Light/dark, mirrors spec.theme.mode. */
  mode: PaletteMode;
}

export type ShellComponent = (props: ShellProps) => ReactElement;
