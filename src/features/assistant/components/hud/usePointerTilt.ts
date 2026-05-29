import { useEffect } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/**
 * Tracks the pointer at the window level and returns spring-smoothed rotateX/rotateY
 * motion values for a subtle holographic parallax tilt. Attaches its own window
 * listener (independent of any WebGL renderer lifecycle) and goes inert under
 * prefers-reduced-motion.
 */
export function usePointerTilt(maxDeg = 5) {
  const reduced = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 55, damping: 18, mass: 0.6 });
  const rotateY = useSpring(ry, { stiffness: 55, damping: 18, mass: 0.6 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      ry.set(nx * maxDeg * 2);
      rx.set(-ny * maxDeg * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, rx, ry, maxDeg]);

  return { rotateX, rotateY };
}
