import { useCallback, useRef } from "react";

export type SoundCue =
  | "boot"
  | "send"
  | "response"
  | "toolTick"
  | "approve"
  | "error";

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor })
      .webkitAudioContext ??
    null
  );
}

interface ToneSpec {
  freq: number;
  toFreq?: number;
  type?: OscillatorType;
  /** Seconds from now to start. */
  at?: number;
  dur?: number;
  gain?: number;
}

/**
 * Procedural Jarvis UI sound. Synthesizes short sci-fi cues with the Web Audio API
 * — no binary assets to ship. One shared AudioContext is created lazily on the first
 * play (which must follow a user gesture). All playback is gated on `enabled`.
 */
export function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const ctx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioCtor();
    if (!Ctor) return null;
    ctxRef.current = new Ctor();
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (ac: AudioContext, master: number, specs: ToneSpec[]) => {
      const now = ac.currentTime;
      for (const s of specs) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = s.type ?? "sine";
        const start = now + (s.at ?? 0);
        const dur = s.dur ?? 0.15;
        const peak = (s.gain ?? 0.2) * master;
        osc.frequency.setValueAtTime(s.freq, start);
        if (s.toFreq) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(1, s.toFreq),
            start + dur,
          );
        }
        // Quick attack, smooth exponential release — avoids clicks.
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      }
    },
    [],
  );

  const play = useCallback(
    (cue: SoundCue) => {
      if (!enabled) return;
      const ac = ctx();
      if (!ac) return;
      if (ac.state === "suspended") void ac.resume();

      switch (cue) {
        case "boot":
          tone(ac, 0.5, [
            { freq: 120, toFreq: 640, type: "sine", dur: 0.6, gain: 0.28 },
            { freq: 60, toFreq: 220, type: "triangle", dur: 0.7, gain: 0.18 },
            { freq: 880, type: "sine", at: 0.55, dur: 0.25, gain: 0.16 },
          ]);
          break;
        case "send":
          tone(ac, 0.5, [
            { freq: 420, toFreq: 920, type: "sine", dur: 0.12, gain: 0.18 },
          ]);
          break;
        case "response":
          tone(ac, 0.5, [
            { freq: 660, type: "sine", dur: 0.12, gain: 0.16 },
            { freq: 880, type: "sine", at: 0.1, dur: 0.16, gain: 0.16 },
          ]);
          break;
        case "toolTick":
          tone(ac, 0.5, [
            { freq: 1200, type: "triangle", dur: 0.04, gain: 0.08 },
          ]);
          break;
        case "approve":
          tone(ac, 0.5, [
            { freq: 520, type: "triangle", dur: 0.1, gain: 0.18 },
            { freq: 780, type: "triangle", at: 0.09, dur: 0.18, gain: 0.18 },
          ]);
          break;
        case "error":
          tone(ac, 0.5, [
            { freq: 300, toFreq: 150, type: "sawtooth", dur: 0.28, gain: 0.14 },
          ]);
          break;
      }
    },
    [enabled, ctx, tone],
  );

  return { play };
}
