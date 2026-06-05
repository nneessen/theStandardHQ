import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";

// The edge functions in a voice turn cold-start independently on Supabase. With the
// command center's near-zero background traffic, every turn pays that tax (measured at
// ~0.9-2.5s per function). Pinging each with `?warm=1` boots the isolate (and loads its
// modules, including the orchestrator's heavy Anthropic SDK import) so the next real turn
// runs hot. Each ping returns immediately before any auth/DB/AI work.
//
// The ORCHESTRATOR is on BOTH paths — the legacy browser pipeline AND the realtime worker
// call it — so it is always warmed when voice is on. The STT/TTS edge functions are
// LEGACY-only: the realtime worker does STT/TTS server-side via Deepgram/ElevenLabs and
// never touches these, so they're warmed only on the legacy path (see `includeLegacyVoice`).
const ORCHESTRATOR_TARGET = "assistant-orchestrator";
const LEGACY_VOICE_TARGETS = [
  "assistant-voice-stt",
  "assistant-voice-tts",
] as const;

// Supabase keeps an idle isolate hot for a few minutes; re-ping inside that window
// while the page is open so a turn never lands on a cold function.
const REWARM_INTERVAL_MS = 4 * 60 * 1000;

async function pingOne(fn: string, token: string): Promise<void> {
  try {
    // `?warm=1` rather than a custom header: the shared CORS allow-list only
    // permits authorization/apikey/content-type, so a custom request header
    // would be rejected by the browser preflight and the ping would never fire.
    await fetch(`${supabaseFunctionsUrl}/${fn}?warm=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      keepalive: true,
    });
  } catch {
    /* warming is best-effort; a failed ping just means the next turn is cold */
  }
}

/**
 * Keeps the Jarvis edge functions warm while the command center is mounted.
 *
 * @param enabled gate warming on the page being open and voice being enabled, so we
 *   don't ping when the feature is unused.
 * @param includeLegacyVoice also warm the legacy STT/TTS edge functions. Pass false on
 *   the realtime path (the worker handles STT/TTS server-side) so only the orchestrator —
 *   which BOTH paths call — is warmed.
 * @returns `warm()` to pre-warm imperatively (e.g. the instant the mic opens,
 *   before the user finishes speaking).
 */
export function useKeepWarm(enabled: boolean, includeLegacyVoice = true) {
  const inFlightRef = useRef(false);

  const warm = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const targets = includeLegacyVoice
        ? [ORCHESTRATOR_TARGET, ...LEGACY_VOICE_TARGETS]
        : [ORCHESTRATOR_TARGET];
      await Promise.all(targets.map((fn) => pingOne(fn, token)));
    } finally {
      inFlightRef.current = false;
    }
  }, [includeLegacyVoice]);

  useEffect(() => {
    if (!enabled) return;
    void warm(); // warm immediately on open
    const id = window.setInterval(() => void warm(), REWARM_INTERVAL_MS);
    // Re-warm when the tab regains focus after being hidden (likely idle long
    // enough for the isolates to have gone cold).
    const onVisible = () => {
      if (document.visibilityState === "visible") void warm();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, warm]);

  return { warm };
}
