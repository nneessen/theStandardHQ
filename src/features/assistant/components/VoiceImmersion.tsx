import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
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

// The status pill is the legible "can I talk yet?" signal — the cue the owner kept asking for.
// AMBER while connecting (NOT yet), GREEN the instant the agent is actually listening (go
// ahead), accent while it thinks/speaks. The disabled→ready transition is unmistakable because
// the colour AND the words change, not just a caption.
type StatusTone = "wait" | "ready" | "busy";
const STATUS: Record<string, { text: string; tone: StatusTone }> = {
  checking: {
    text: "Connecting — waking Jarvis, this can take ~20s",
    tone: "wait",
  },
  listening: { text: "Ready — go ahead and speak", tone: "ready" },
  capturing: { text: "I hear you…", tone: "ready" },
  thinking: { text: "Working on it…", tone: "busy" },
  speaking: { text: "Jarvis is speaking…", tone: "busy" },
};

const TONE_COLOR: Record<StatusTone, string> = {
  wait: "#f59e0b", // amber — not ready yet
  ready: "#22c55e", // green — go ahead
  busy: "", // filled with accent at render time
};

function reactorMode(state: string): ReactorMode {
  if (state === "listening" || state === "capturing") return "listening";
  if (state === "thinking" || state === "checking") return "thinking";
  if (state === "speaking") return "speaking";
  return "idle";
}

/**
 * Full-screen voice takeover: a giant arc reactor + a live audio-reactive waveform
 * driven by the mic analyser. Stays up across the WHOLE session including failures —
 * on an error it shows the specific reason + Retry / Use-text instead of vanishing, so
 * a failed connect never silently dumps the user back to the Command Center.
 */
export function VoiceImmersion({ voice, assistantName, accent }: Props) {
  const isError = voice.state === "unavailable";
  const active =
    voice.state === "listening" ||
    voice.state === "capturing" ||
    voice.state === "thinking" ||
    voice.state === "checking" ||
    voice.state === "speaking" ||
    isError;

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

  // Autoplay blocked: the hook sets this message and the browser won't play the agent's audio
  // until a gesture. Tapping must RESUME audio, never end the session (the old backdrop-stop bug).
  const audioBlocked = voice.message === "Tap to enable audio.";
  const status = !audioBlocked ? STATUS[voice.state] : undefined;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-[#050811]/95 backdrop-blur-md"
          // A backdrop click ends a LIVE session, but in the error view it must do nothing —
          // the explicit Try-again / Use-text buttons are the only actions there.
          onClick={isError ? undefined : () => voice.stop()}
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

          {isError ? (
            <div
              className="flex max-w-sm flex-col items-center px-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="grid h-16 w-16 place-items-center rounded-full border"
                style={{ borderColor: "#f59e0b66", color: "#f59e0b" }}
              >
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div
                className="font-display mt-5 text-xl font-bold uppercase tracking-[0.28em]"
                style={{ color: "#f59e0b" }}
              >
                Voice didn't start
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {voice.message ?? "Something interrupted the connection."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void voice.start()}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.03]"
                  style={{ background: accent, color: "#050811" }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => voice.stop()}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  style={{ borderColor: `${accent}44` }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Use text instead
                </button>
              </div>
            </div>
          ) : (
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

              {audioBlocked ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void voice.resumeAudio();
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03]"
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  <Volume2 className="h-4 w-4" />
                  Tap to enable audio
                </button>
              ) : status ? (
                <StatusPill
                  text={status.text}
                  color={
                    status.tone === "busy" ? accent : TONE_COLOR[status.tone]
                  }
                  pulse={status.tone === "ready"}
                />
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">
                  Speak naturally — press ESC to end
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The legible status indicator: a coloured dot + words, both of which change with readiness. */
function StatusPill({
  text,
  color,
  pulse,
}: {
  text: string;
  color: string;
  pulse: boolean;
}) {
  return (
    <div
      className="mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium"
      style={{ borderColor: `${color}55`, color, background: `${color}12` }}
    >
      <span className="relative grid h-2.5 w-2.5 place-items-center">
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: color }}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
      </span>
      {text}
    </div>
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
