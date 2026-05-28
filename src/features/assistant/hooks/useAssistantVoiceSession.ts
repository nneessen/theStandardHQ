import { useCallback, useState } from "react";
import { supabase } from "@/services/base/supabase";

export type VoiceSessionState = "idle" | "checking" | "unavailable" | "active";

/**
 * Voice session interface (stub). The architecture is voice-ready: this hook is the
 * seam a realtime STT/TTS provider drops into. Today it calls the server-side token
 * endpoint, which reports "not configured" — no credential is minted, no key is
 * exposed to the browser.
 */
export function useAssistantVoiceSession() {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const start = useCallback(async () => {
    setState("checking");
    try {
      const { data } = await supabase.functions.invoke<{
        available?: boolean;
        message?: string;
      }>("assistant-voice-token", { body: {} });
      setState("unavailable");
      setMessage(data?.message ?? "Voice is not configured yet.");
      return data;
    } catch {
      setState("unavailable");
      setMessage("Voice is not configured yet.");
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    setState("idle");
    setMessage(null);
  }, []);

  // TODO(voice): sendTranscript() will forward transcribed speech to the orchestrator
  // once a realtime provider is wired.
  const sendTranscript = useCallback(async (_text: string) => {
    /* no-op until voice is implemented */
  }, []);

  return { state, message, available: false, start, stop, sendTranscript };
}
