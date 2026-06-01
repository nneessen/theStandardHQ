/*
 * useCanvasActive — returns true only when the referenced element is on screen
 * AND the tab is visible. Three.js canvases gate their rAF loop on this so a
 * hero shader / 10-plane gallery never burn GPU while scrolled away or
 * backgrounded. Mirrors the visibility-gating used by the board orb / ArcReactor.
 */

import { useEffect, useState, type RefObject } from "react";

export function useCanvasActive(ref: RefObject<HTMLElement | null>): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let onScreen = false;
    const update = () => setActive(onScreen && !document.hidden);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        update();
      },
      { rootMargin: "100px" },
    );
    io.observe(el);

    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);

  return active;
}
