/*
 * "Inside the platform" — the lazy 3D flythrough. id="platform" is the nav
 * anchor target. The canvas flies REAL product screenshots when provided
 * (PRODUCT_SCREENSHOTS), otherwise abstract brand panels — it never fabricates
 * dashboards. Canvas only renders when motion is allowed; the copy overlay
 * reads over the charcoal bg either way.
 */

import { GalleryCanvasLazy } from "../three/GalleryCanvasLazy";
import { PRODUCT_SCREENSHOTS } from "../data/product-screenshots";

export function HqGallery({ reducedMotion }: { reducedMotion: boolean }) {
  const hasShots = PRODUCT_SCREENSHOTS.length > 0;
  return (
    <section className="gallery" id="platform">
      <div className="gallery-sticky">
        {!reducedMotion && (
          <GalleryCanvasLazy
            className="gal-canvas"
            shots={PRODUCT_SCREENSHOTS}
          />
        )}
        <div className="gallery-copy">
          <div className="eyebrow center">Inside the platform</div>
          <h2>
            What you see
            <br />
            when you log in.
          </h2>
          <p>
            {hasShots
              ? "Every screen is built for the job — not generalized for ten verticals."
              : "Purpose-built screens for every part of your day — not generalized for ten verticals."}
          </p>
        </div>
        <div className="gallery-foot">Scroll to fly through the platform</div>
      </div>
    </section>
  );
}
