import { lazy, Suspense } from "react";
import { useReducedMotion } from "framer-motion";

// Lazy boundary — keeps `three` out of the main bundle. The WebGL canvas only
// loads when an orb actually mounts; until then (and under reduced motion) the
// soft cyan halo below is the fallback look.
const JarvisOrbCanvas = lazy(() => import("./JarvisOrbCanvas"));

export interface JarvisOrbViewProps {
  /** Orb diameter in px. */
  size?: number;
  className?: string;
}

/**
 * The Twin Shells Jarvis orb with its soft radial cyan halo. Ported from
 * TheBoard.jsx `JarvisOrbView`. Cyan is reserved for Jarvis/AI. Degrades to a
 * static halo (no WebGL) under prefers-reduced-motion and during chunk load.
 */
export function JarvisOrbView({ size = 56, className }: JarvisOrbViewProps) {
  const prefersReduced = useReducedMotion();
  const haloInset = -Math.round(size * 0.24);
  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: haloInset,
          pointerEvents: "none",
          background:
            "radial-gradient(circle, rgba(70,216,245,0.28), rgba(70,216,245,0) 66%)",
        }}
      />
      {!prefersReduced && (
        <Suspense fallback={null}>
          <JarvisOrbCanvas size={size} />
        </Suspense>
      )}
    </div>
  );
}
