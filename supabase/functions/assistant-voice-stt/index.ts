// assistant-voice-stt — speech-to-text for the Jarvis voice session.
//
// Receives a short audio clip (multipart form field "file"), transcribes it with
// OpenAI Whisper server-side, and returns the text. The OpenAI key never reaches
// the browser. The audio and transcript are NOT persisted or logged (M1 spirit:
// the caller's spoken words may contain client PII).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { authorizeVoiceCaller } from "../_shared/assistant-voice-auth.ts";

// Bound a single utterance. Whisper accepts up to 25MB; a hands-free turn is far
// smaller. Reject anything larger to cap cost and abuse.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

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

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json(
      {
        available: false,
        reason: "stt_not_configured",
        error: "Voice transcription isn't configured.",
      },
      200,
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return json({ error: "Expected multipart form data with a 'file'." }, 400);
  }
  if (!file) return json({ error: "No audio file provided." }, 400);
  if (file.size === 0) return json({ error: "Empty audio." }, 400);
  if (file.size > MAX_AUDIO_BYTES) {
    return json({ error: "Audio clip too large." }, 413);
  }

  const upstream = new FormData();
  // Whisper infers format from the filename extension; default to webm/opus,
  // which is what MediaRecorder produces in Chrome.
  const name = file.name && file.name.includes(".") ? file.name : "speech.webm";
  upstream.append("file", file, name);
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "json");

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch (e) {
    console.error("assistant-voice-stt fetch failed", e);
    return json({ error: "Transcription service unreachable." }, 502);
  }

  if (!resp.ok) {
    // Log status only — never the transcript or audio.
    console.error("assistant-voice-stt whisper error", resp.status);
    return json({ error: "Transcription failed." }, 502);
  }

  const data = (await resp.json().catch(() => null)) as {
    text?: string;
  } | null;
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  return json({ text });
});
