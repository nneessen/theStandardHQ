/*
 * Lazy boundary for GalleryCanvas so `three` is code-split out of the main
 * bundle and only fetched when the gallery section mounts. Fallback is null:
 * the section's copy overlay still reads over the charcoal background.
 */

import { lazy, Suspense } from "react";
import type { ProductShot } from "../data/product-screenshots";

const GalleryCanvas = lazy(() => import("./GalleryCanvas"));

export function GalleryCanvasLazy({
  className,
  shots,
}: {
  className?: string;
  shots?: ProductShot[];
}) {
  return (
    <Suspense fallback={null}>
      <GalleryCanvas className={className} shots={shots} />
    </Suspense>
  );
}
