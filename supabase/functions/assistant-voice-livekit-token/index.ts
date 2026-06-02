// assistant-voice-livekit-token — mints a short-lived LiveKit room access token for
// the signed-in user so the browser can join the realtime voice room. The LiveKit
// API secret is server-only and never reaches the client (the browser only ever sees
// a scoped, expiring JWT for one room).
//
// TRUST MODEL: the participant `identity` is set to the VERIFIED auth user id and
// signed by LiveKit. So when the agent worker is dispatched into the room, the human
// participant's identity IS the real user id — the worker can act on that user's
// behalf (RLS-scoped) without the model or client ever supplying an id. One stable
// room per user (`jarvis-<uid>`); LiveKit + the Agents framework own room lifecycle.
//
// Part of M1 of the voice rebuild (plans/active/continue-20260602-jarvis-voice-
// secondbrain-master-plan.md). The agent worker registers with LiveKit Cloud and is
// auto-dispatched — it does NOT need a token from here; this endpoint is the client's.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { authorizeVoiceCaller } from "../_shared/assistant-voice-auth.ts";
import { AccessToken } from "npm:livekit-server-sdk@2";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Keep-warm ping (mirrors the other voice fns): boot a cold isolate without minting.
  if (new URL(req.url).searchParams.get("warm") === "1")
    return json({ ok: true, warm: true });

  const auth = await authorizeVoiceCaller(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const url = Deno.env.get("LIVEKIT_URL");
  if (!apiKey || !apiSecret || !url) {
    // Misconfiguration, not the caller's fault — fail closed and say so.
    console.error("assistant-voice-livekit-token: LIVEKIT_* secrets not set");
    return json({ error: "Realtime voice is not configured yet." }, 503);
  }

  const userId = auth.caller.userId;
  const room = `jarvis-${userId}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    // Short TTL: the token only needs to live long enough to join; the connection
    // persists after. Re-mint on reconnect.
    ttl: "15m",
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true, // mic audio
    canSubscribe: true, // agent audio
    canPublishData: true, // control/data channel (e.g. barge-in signals, text)
  });

  const token = await at.toJwt();
  console.log(
    `assistant-voice-livekit-token user=${userId} room=${room} issued`,
  );
  return json({ token, url, room });
});
