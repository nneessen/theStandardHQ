/*
 * Lazy boundary for HeroShaderCanvas so `three` is code-split out of the main
 * bundle and only fetched when the hero mounts (and only when motion is allowed
 * — the parent decides). Fallback is null: the hero reads fine without the bg.
 */

import { lazy, Suspense } from "react";

const HeroShaderCanvas = lazy(() => import("./HeroShaderCanvas"));

export function HeroShaderCanvasLazy({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <HeroShaderCanvas className={className} />
    </Suspense>
  );
}
