// assistant-voice-token — STUB.
//
// The command center is voice-ready by design but no realtime voice provider is wired
// yet. This endpoint authenticates the caller (so the client flow is real) and returns
// a clear "not configured" response. It deliberately mints NO credential.
//
// TODO(voice): when a realtime provider is chosen, mint a short-lived, user-scoped
// ephemeral credential here (server-side only) and return it. Never expose a provider
// API key to the browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error } = await db.auth.getUser(token);
  if (error || !userData?.user) return json({ error: "Unauthorized" }, 401);

  return json({
    available: false,
    reason: "voice_not_configured",
    message:
      "Voice sessions are not configured yet. Text chat is fully available in the command center.",
  });
});
