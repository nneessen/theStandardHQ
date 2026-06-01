/*
 * useJarvisTypewriter — drives the Jarvis showcase demo: types a "You" prompt,
 * then types the "Jarvis" answer, pauses, and cycles to the next exchange.
 * Ported from the reference's jType()/jAns() loop. Pure React state + setTimeout;
 * returns the current partial strings to render. Honors reduced motion by
 * showing the first exchange statically.
 *
 * This is a SHOWCASE only — it never calls the real assistant. The public page
 * cannot run Jarvis (it is gated to authenticated internal users), so the demo
 * is canned, and the "Ask Jarvis" CTA routes to Apply.
 */

import { useEffect, useRef, useState } from "react";
import type { JarvisExchange } from "../data/content";

export function useJarvisTypewriter(
  exchanges: JarvisExchange[],
  reducedMotion: boolean,
) {
  const [you, setYou] = useState("");
  const [jarvis, setJarvis] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!exchanges.length) return;

    if (reducedMotion) {
      setYou(exchanges[0].you);
      setJarvis(exchanges[0].jarvis);
      return;
    }

    let cancelled = false;
    let idx = 0;
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.current.push(t);
    };

    const typeAnswer = () => {
      const a = exchanges[idx].jarvis;
      let i = 0;
      const step = () => {
        setJarvis(a.slice(0, i++));
        if (i <= a.length) schedule(step, 20);
        else
          schedule(() => {
            idx = (idx + 1) % exchanges.length;
            typePrompt();
          }, 2400);
      };
      step();
    };

    const typePrompt = () => {
      const c = exchanges[idx].you;
      setYou("");
      setJarvis("");
      let i = 0;
      const step = () => {
        setYou(c.slice(0, i++));
        if (i <= c.length) schedule(step, 36);
        else schedule(typeAnswer, 440);
      };
      step();
    };

    typePrompt();

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [exchanges, reducedMotion]);

  return { you, jarvis };
}
