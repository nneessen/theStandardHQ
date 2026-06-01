/* Helper to set the stagger index custom property (--i) used by reveal effects. */
import type { CSSProperties } from "react";

export function staggerStyle(i: number, extra?: CSSProperties): CSSProperties {
  return { ["--i" as string]: i, ...extra } as CSSProperties;
}
