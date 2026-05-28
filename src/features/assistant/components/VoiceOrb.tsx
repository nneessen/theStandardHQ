import { Mic } from "lucide-react";
import { toast } from "sonner";
import { useAssistantVoiceSession } from "../hooks/useAssistantVoiceSession";

/**
 * Voice control. The interface is real (calls the server-side token endpoint) but no
 * realtime provider is wired yet, so it reports "coming soon". Visual orb is the seam
 * for the future live voice session.
 */
export function VoiceOrb() {
  const voice = useAssistantVoiceSession();

  const handleClick = async () => {
    const res = await voice.start();
    toast.info(res?.message ?? "Voice is not configured yet.");
    voice.stop();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Voice (coming soon)"
      aria-label="Start voice session"
      className="relative grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 transition hover:bg-primary/20"
    >
      <span
        className="absolute inset-0 rounded-full bg-primary/20 blur-md"
        aria-hidden
      />
      <Mic className="relative h-4 w-4" />
    </button>
  );
}
