// assistant-voice-tts — text-to-speech for the Jarvis voice session.
//
// Replaces the old assistant-voice-token stub. Takes the assistant's reply text,
// converts it to speech with ElevenLabs server-side (key never reaches the
// browser), and streams audio/mpeg straight back. The reply text is the same text
// already shown in the browser transcript, so speaking it crosses no new trust
// boundary — but we still never persist or log it (we log the char count only, for
// cost visibility).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { authorizeVoiceCaller } from "../_shared/assistant-voice-auth.ts";
import { toSpokenText } from "./spoken-text.ts";

// Default voice: ElevenLabs "Rachel" (overridable via ELEVENLABS_VOICE_ID secret
// or a per-request voiceId). eleven_turbo_v2_5 is the low-latency, lower-cost
// model — best fit for short conversational replies.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_turbo_v2_5";

// Cap synthesized length. Real replies are well under this; the ceiling bounds
// ElevenLabs spend on a runaway/abusive request.
const MAX_CHARS = 2000;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authorizeVoiceCaller(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  const body = (await req.json().catch(() => ({}))) as {
    text?: unknown;
    voiceId?: unknown;
    probe?: unknown;
  };

  // Probe mode: the orb checks availability on mount without synthesizing.
  if (body.probe === true) {
    return json({ available: !!apiKey });
  }

  if (!apiKey) {
    return json(
      {
        available: false,
        reason: "voice_not_configured",
        error:
          "Voice replies aren't configured yet. Text chat is fully available.",
      },
      200,
    );
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  const spoken = toSpokenText(rawText).slice(0, MAX_CHARS);
  if (!spoken) return json({ error: "No text to speak." }, 400);

  const voiceId =
    (typeof body.voiceId === "string" && body.voiceId) ||
    Deno.env.get("ELEVENLABS_VOICE_ID") ||
    DEFAULT_VOICE_ID;

  // Cost visibility without PII: log who + how many characters, never the text.
  console.log(
    `assistant-voice-tts user=${auth.caller.userId} chars=${spoken.length} voice=${voiceId}`,
  );

  // Speaking pace (ElevenLabs accepts 0.7–1.2; >1 is faster). Default a touch
  // quick for a snappier assistant; tunable via secret without a redeploy.
  const speedRaw = Number.parseFloat(Deno.env.get("ELEVENLABS_SPEED") ?? "1.1");
  const speed = Number.isFinite(speedRaw)
    ? Math.min(1.2, Math.max(0.7, speedRaw))
    : 1.1;

  let resp: Response;
  try {
    // optimize_streaming_latency trades a little quality for a much faster first
    // byte (0–4; 3 is a good balance) so playback can begin sooner.
    resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: spoken,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.4, similarity_boost: 0.75, speed },
        }),
      },
    );
  } catch (e) {
    console.error("assistant-voice-tts fetch failed", e);
    return json({ error: "Voice service unreachable." }, 502);
  }

  if (!resp.ok || !resp.body) {
    console.error("assistant-voice-tts elevenlabs error", resp.status);
    return json({ error: "Voice synthesis failed." }, 502);
  }

  // Stream the audio straight through as it synthesizes.
  return new Response(resp.body, {
    status: 200,
    headers: { ...cors, "Content-Type": "audio/mpeg" },
  });
});
