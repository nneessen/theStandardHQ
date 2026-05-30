import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";

// The three edge functions in a voice turn (STT -> orchestrator -> TTS) each
// cold-start independently on Supabase. With the command center's near-zero
// background traffic, every turn pays that tax three times (measured at ~0.9-2.5s
// per function). Pinging each with `x-warm: 1` boots the isolate (and loads its
// modules, including the orchestrator's heavy Anthropic SDK import) so the next
// real turn runs hot. Each ping returns immediately before any auth/DB/AI work.
const WARM_TARGETS = [
  "assistant-orchestrator",
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
 * @param enabled gate warming on the page being open (and, for voice, the
 *   voice_enabled preference) so we don't ping when the feature is unused.
 * @returns `warm()` to pre-warm imperatively (e.g. the instant the mic opens,
 *   before the user finishes speaking).
 */
export function useKeepWarm(enabled: boolean) {
  const inFlightRef = useRef(false);

  const warm = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await Promise.all(WARM_TARGETS.map((fn) => pingOne(fn, token)));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

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
