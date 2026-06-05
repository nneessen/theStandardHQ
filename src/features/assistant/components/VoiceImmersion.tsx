import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ArcReactor, type ReactorMode } from "./hud/ArcReactorLazy";
import { useDocumentVisible } from "../lib/useDocumentVisible";
import type { VoiceSessionUi } from "../hooks/voiceSession.types";

interface Props {
  voice: VoiceSessionUi;
  assistantName: string;
  accent: string;
}

const CAPTION: Record<string, string> = {
  listening: "LISTENING",
  capturing: "LISTENING",
  thinking: "PROCESSING",
  checking: "CONNECTING",
  speaking: "SPEAKING",
};

// Per-state hint under the caption so the user knows exactly when to talk. The key fix for
// "it looked ready but didn't hear me": "connecting" and "speaking" read as NOT-yet, only
// "listening" says go ahead.
const HINT: Record<string, string> = {
  checking: "Connecting to Jarvis — one moment…",
  speaking: "Jarvis is speaking…",
  thinking: "Working on it…",
  listening: "Go ahead — I'm listening",
  capturing: "I hear you…",
};

function reactorMode(state: string): ReactorMode {
  if (state === "listening" || state === "capturing") return "listening";
  if (state === "thinking" || state === "checking") return "thinking";
  if (state === "speaking") return "speaking";
  return "idle";
}

/**
 * Full-screen voice takeover: a giant arc reactor + a live audio-reactive waveform
 * driven by the mic analyser exposed from the voice session. Visible whenever a
 * session is active; ESC, the close button, or a backdrop click ends it.
 */
export function VoiceImmersion({ voice, assistantName, accent }: Props) {
  const active =
    voice.state === "listening" ||
    voice.state === "capturing" ||
    voice.state === "thinking" ||
    voice.state === "checking" ||
    voice.state === "speaking";

  const [level, setLevel] = useState(0);

  // Pulse the reactor core with the mic ONLY while the agent is actually listening; hold it
  // calm (0) otherwise so connecting/speaking never looks like it's hearing you (matches the
  // waveform gating below).
  const hearing = voice.state === "listening" || voice.state === "capturing";
  useEffect(() => {
    if (!hearing) {
      setLevel(0);
      return;
    }
    const id = setInterval(
      () => setLevel(Math.min(1, voice.getLevel() * 6)),
      100,
    );
    return () => clearInterval(id);
  }, [hearing, voice]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") voice.stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, voice]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-[#050811]/95 backdrop-blur-md"
          onClick={() => voice.stop()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              voice.stop();
            }}
            aria-label="End voice session"
            className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full border text-muted-foreground transition-colors hover:text-foreground"
            style={{ borderColor: `${accent}44` }}
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-72 w-72">
              <ArcReactor
                mode={reactorMode(voice.state)}
                accent={accent}
                audioLevel={level}
                className="h-full w-full"
              />
            </div>

            <Waveform voice={voice} accent={accent} />

            <div
              className="font-display mt-6 text-2xl font-bold uppercase tracking-[0.35em]"
              style={{ color: accent, textShadow: `0 0 24px ${accent}66` }}
            >
              {CAPTION[voice.state] ?? assistantName}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {voice.message ??
                HINT[voice.state] ??
                "Speak naturally — press ESC to end"}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const BARS = 56;

function Waveform({
  voice,
  accent,
}: {
  voice: VoiceSessionUi;
  accent: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useDocumentVisible();
  // Mic-reactive bars ONLY when the agent is actually listening; during connecting / speaking /
  // thinking we show a synthetic envelope so live mic motion never implies "I'm hearing you".
  const listening = voice.state === "listening" || voice.state === "capturing";
  const speaking = voice.state === "speaking";
  const thinking = voice.state === "thinking";
  const connecting = voice.state === "checking";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bins = new Uint8Array(1024);
    let raf = 0;
    let phase = 0;

    const draw = () => {
      phase += 0.08;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const hasMic = voice.getFrequencyData(bins);
      const gap = 3;
      const barW = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        let mag: number;
        if (hasMic && listening) {
          // Average a slice of the low-mid spectrum for each bar.
          const start = Math.floor((i / BARS) * 240);
          const end = start + 8;
          let sum = 0;
          for (let j = start; j < end; j++) sum += bins[j];
          mag = sum / 8 / 255;
        } else {
          // Synthetic envelope when we are NOT actively listening. Connecting is the calmest
          // (a faint idle shimmer) so it reads clearly as "not ready yet".
          const base = speaking
            ? 0.55
            : thinking
              ? 0.3
              : connecting
                ? 0.08
                : 0.12;
          mag =
            base +
            Math.sin(phase + i * 0.4) * 0.18 +
            Math.sin(phase * 1.7 + i) * 0.1;
        }
        mag = Math.max(0.04, Math.min(1, mag));
        const barH = mag * h;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.4 + mag * 0.6;
        ctx.fillRect(i * (barW + gap), (h - barH) / 2, barW, barH);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [voice, accent, visible, listening, speaking, thinking, connecting]);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={80}
      className="mt-6 h-20 w-[520px] max-w-[80vw]"
      aria-hidden
    />
  );
}
