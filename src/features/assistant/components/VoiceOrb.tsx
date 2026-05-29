import { useEffect } from "react";
import { Loader2, Mic, MicOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AssistantVoiceSession } from "../hooks/useAssistantVoiceSession";

interface Props {
  voice: AssistantVoiceSession;
  assistantName?: string;
}

const STATE_LABEL: Record<string, string> = {
  idle: "Start a voice session",
  checking: "Starting…",
  unavailable: "Voice unavailable",
  listening: "Listening — just speak",
  capturing: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

/**
 * Voice control for the command center. Click once to start a hands-free session
 * (grants mic), then talk naturally — the orb animates by state and shifts color
 * while the assistant is speaking back.
 */
export function VoiceOrb({ voice, assistantName = "Jarvis" }: Props) {
  const { state, message, available, start, stop } = voice;
  const isActive =
    state === "listening" ||
    state === "capturing" ||
    state === "thinking" ||
    state === "speaking";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking" || state === "checking";
  const hearsYou = state === "listening" || state === "capturing";
  // Probe (gated behind voice_enabled) reported the backend isn't configured.
  const notConfigured = available === false && !isActive;

  // Surface a one-time reason when voice can't run (no mic, unsupported browser).
  useEffect(() => {
    if (state === "unavailable" && message) toast.error(message);
  }, [state, message]);

  const handleClick = () => {
    if (isActive) stop();
    else if (notConfigured)
      toast.info("Voice isn't configured yet. Text chat is fully available.");
    else void start();
  };

  const Icon = isThinking
    ? Loader2
    : isSpeaking
      ? Volume2
      : state === "unavailable"
        ? MicOff
        : Mic;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        notConfigured
          ? "Voice isn't configured yet"
          : `${STATE_LABEL[state] ?? "Voice"}${
              isActive ? ` — click to stop ${assistantName}` : ""
            }`
      }
      aria-label={
        isActive
          ? "Stop voice session"
          : `Start voice session with ${assistantName}`
      }
      aria-pressed={isActive}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-full ring-1 transition-colors",
        isSpeaking
          ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/40 dark:text-emerald-400"
          : hearsYou
            ? "bg-sky-500/15 text-sky-600 ring-sky-500/40 dark:text-sky-400"
            : notConfigured
              ? "bg-muted text-muted-foreground/60 ring-border"
              : "bg-primary/10 text-primary ring-primary/30 hover:bg-primary/20",
      )}
    >
      {/* Pulsing halo while listening; steady glow while speaking. */}
      {hearsYou && (
        <span
          className="absolute inset-0 animate-ping rounded-full bg-sky-500/30"
          aria-hidden
        />
      )}
      {isSpeaking && (
        <span
          className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/30 blur-md"
          aria-hidden
        />
      )}
      {!isActive && (
        <span
          className="absolute inset-0 rounded-full bg-primary/20 blur-md"
          aria-hidden
        />
      )}

      {isSpeaking ? (
        <SoundWave />
      ) : (
        <Icon
          className={cn(
            "relative h-4 w-4",
            isThinking && "animate-spin",
            state === "capturing" && "scale-110",
          )}
        />
      )}
    </button>
  );
}

/** Three bars bouncing to suggest speech output. */
function SoundWave() {
  return (
    <span className="relative flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 animate-pulse rounded-full bg-current"
          style={{
            height: i === 1 ? "0.85rem" : "0.55rem",
            animationDelay: `${i * 120}ms`,
            animationDuration: "700ms",
          }}
        />
      ))}
    </span>
  );
}
