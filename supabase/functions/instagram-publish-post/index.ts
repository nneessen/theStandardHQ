// supabase/functions/instagram-publish-post/index.ts
// Publishes a single IMAGE post to the agency's connected Instagram feed (the Social
// Studio graphics). Two-step Instagram Content Publishing API (graph.instagram.com):
//   1. POST /{ig-user-id}/media        { image_url, caption }   → creation container
//   2. (poll the container until FINISHED)
//   3. POST /{ig-user-id}/media_publish { creation_id }         → live media id
//
// Reuses the existing Instagram integration (instagram_integrations): the long-lived
// token (AES-256-GCM encrypted) already carries `instagram_business_content_publish`
// scope, so NO re-auth is needed. Auth + decrypt + token-refresh-on-190 mirror
// instagram-send-message exactly.
//
// PRIVACY/AUTH: owner-scoped. We resolve the CALLER's imo_id and post to THAT agency's
// connected account; the image must be a PUBLIC https URL (the spotlight-assets bucket).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  isTokenAboutToExpire,
  isTokenRecentlyExpired,
  attemptTokenRefresh,
  updateIntegrationToken,
  markIntegrationExpired,
} from "../_shared/instagram-token-refresh.ts";

const GRAPH = "https://graph.instagram.com/v21.0";
const CAPTION_MAX = 2200;

interface MetaError {
  message: string;
  type?: string;
  code: number;
  error_subcode?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ ok: false, error: "Server configuration error" }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return json({ ok: false, error: "Authorization required" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ ok: false, error: "Invalid or expired token" }, 401);
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const imageUrl: string = body?.imageUrl ?? "";
    const caption: string = body?.caption ?? "";
    if (!/^https:\/\//i.test(imageUrl)) {
      return json(
        { ok: false, error: "A public https image URL is required." },
        400,
      );
    }
    if (caption.length > CAPTION_MAX) {
      return json(
        {
          ok: false,
          error: `Caption exceeds the ${CAPTION_MAX}-character limit.`,
        },
        400,
      );
    }

    // ── Resolve the caller's agency + its connected Instagram account ──────────
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("imo_id")
      .eq("id", user.id)
      .maybeSingle();
    const imoId = profile?.imo_id as string | undefined;
    if (!imoId) {
      return json(
        { ok: false, error: "No agency found for this account." },
        400,
      );
    }

    const { data: integration } = await supabase
      .from("instagram_integrations")
      .select(
        "id, instagram_user_id, instagram_username, access_token_encrypted, connection_status, is_active, token_expires_at",
      )
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!integration) {
      return json(
        {
          ok: false,
          error:
            "Instagram isn't connected for this agency. Connect a Business/Creator account in Settings → Integrations first.",
          code: "NOT_CONNECTED",
        },
        400,
      );
    }

    // ── Token: decrypt + proactive refresh (same as instagram-send-message) ────
    let accessToken = await decrypt(integration.access_token_encrypted);
    if (isTokenAboutToExpire(integration.token_expires_at, 7)) {
      const refresh = await attemptTokenRefresh(
        integration.access_token_encrypted,
      );
      if (refresh.success && refresh.newToken && refresh.newExpiresAt) {
        await updateIntegrationToken(
          supabase,
          integration.id,
          refresh.newToken,
          refresh.newExpiresAt,
        );
        accessToken = await decrypt(refresh.newToken);
      }
    }

    const igUserId = integration.instagram_user_id;

    // Shared Meta-error handler — token-expiry path mirrors instagram-send-message.
    const handleMetaError = async (err: MetaError, stage: string) => {
      console.error(`[instagram-publish-post] ${stage} error:`, err);
      if (err.code === 190) {
        if (isTokenRecentlyExpired(integration.token_expires_at)) {
          const refresh = await attemptTokenRefresh(
            integration.access_token_encrypted,
          );
          if (refresh.success && refresh.newToken && refresh.newExpiresAt) {
            await updateIntegrationToken(
              supabase,
              integration.id,
              refresh.newToken,
              refresh.newExpiresAt,
            );
            return json(
              {
                ok: false,
                error: "Token was refreshed. Please retry.",
                code: "TOKEN_REFRESHED",
                retry: true,
              },
              200,
            );
          }
        }
        await markIntegrationExpired(supabase, integration.id, err.message);
        return json(
          {
            ok: false,
            error: "Instagram token expired. Please reconnect.",
            code: "TOKEN_EXPIRED",
          },
          401,
        );
      }
      if ([4, 17, 32, 613].includes(err.code)) {
        return json(
          {
            ok: false,
            error: "Rate limited by Instagram. Please try again later.",
            code: "RATE_LIMITED",
          },
          429,
        );
      }
      if ([1, 2].includes(err.code)) {
        return json(
          {
            ok: false,
            error: "Instagram is temporarily unavailable. Please try again.",
            code: "SERVER_ERROR",
          },
          503,
        );
      }
      return json(
        { ok: false, error: err.message || `Failed at ${stage}.` },
        400,
      );
    };

    const withTimeout = (ms: number) => {
      const c = new AbortController();
      const id = setTimeout(() => c.abort(), ms);
      return { signal: c.signal, done: () => clearTimeout(id) };
    };

    // ── 1. Create the media container ──────────────────────────────────────────
    const t1 = withTimeout(20000);
    let containerData: { id?: string; error?: MetaError };
    try {
      const res = await fetch(`${GRAPH}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
        signal: t1.signal,
      });
      containerData = await res.json();
    } catch (e) {
      t1.done();
      const aborted = e instanceof Error && e.name === "AbortError";
      return json(
        {
          ok: false,
          error: aborted
            ? "Instagram request timed out."
            : "Network error creating the post.",
        },
        aborted ? 504 : 502,
      );
    }
    t1.done();
    if (containerData.error)
      return handleMetaError(containerData.error, "container");
    const creationId = containerData.id;
    if (!creationId) {
      return json(
        { ok: false, error: "Instagram did not return a media container." },
        502,
      );
    }

    // ── 2. Wait for the container to finish processing (images are usually fast) ─
    let ready = false;
    for (let i = 0; i < 6; i++) {
      const s = await fetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
      )
        .then((r) => r.json())
        .catch(() => null);
      const code = s?.status_code as string | undefined;
      if (code === "FINISHED") {
        ready = true;
        break;
      }
      if (code === "ERROR" || code === "EXPIRED") {
        return json(
          {
            ok: false,
            error:
              "Instagram couldn't process the image. Check it's a public JPG/PNG, 4:5–1.91:1.",
          },
          400,
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Don't publish a container that never finished — that errors confusingly.
    if (!ready) {
      return json(
        {
          ok: false,
          error:
            "Instagram is still processing the image — please try again in a moment.",
          code: "PROCESSING",
        },
        504,
      );
    }

    // ── 3. Publish ─────────────────────────────────────────────────────────────
    const t2 = withTimeout(20000);
    let publishData: { id?: string; error?: MetaError };
    try {
      const res = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
        signal: t2.signal,
      });
      publishData = await res.json();
    } catch (e) {
      t2.done();
      const aborted = e instanceof Error && e.name === "AbortError";
      return json(
        {
          ok: false,
          error: aborted
            ? "Instagram publish timed out."
            : "Network error publishing the post.",
        },
        aborted ? 504 : 502,
      );
    }
    t2.done();
    if (publishData.error) return handleMetaError(publishData.error, "publish");
    if (!publishData.id) {
      return json(
        { ok: false, error: "Instagram did not confirm the post." },
        502,
      );
    }

    console.log(
      `[instagram-publish-post] Published media ${publishData.id} to @${integration.instagram_username}`,
    );
    return json(
      {
        ok: true,
        mediaId: publishData.id,
        username: integration.instagram_username,
      },
      200,
    );
  } catch (err) {
    console.error("[instagram-publish-post] Error:", err);
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500,
    );
  }
});
