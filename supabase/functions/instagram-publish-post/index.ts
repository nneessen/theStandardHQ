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
import {
  runInstagramPublishFlow,
  type MetaError,
} from "../_shared/instagram-publish.ts";

const CAPTION_MAX = 2200;

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
    // Cast to the shared token-refresh helpers' client type (createClient infers a
    // stricter schema generic than they declare — friction shared across edge fns).
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY) as ReturnType<
      typeof createClient
    >;

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

    // ── Run the shared 3-step publish flow; map its result to our HTTP responses ─
    const result = await runInstagramPublishFlow({
      igUserId,
      accessToken,
      imageUrl,
      caption,
    });

    if (result.ok) {
      console.log(
        `[instagram-publish-post] Published media ${result.mediaId} to @${integration.instagram_username}`,
      );
      return json(
        {
          ok: true,
          mediaId: result.mediaId,
          username: integration.instagram_username,
        },
        200,
      );
    }

    switch (result.reason) {
      case "meta_error":
        return handleMetaError(result.metaError, result.stage);
      case "transport":
        return json(
          {
            ok: false,
            error:
              result.stage === "container"
                ? result.aborted
                  ? "Instagram request timed out."
                  : "Network error creating the post."
                : result.aborted
                  ? "Instagram publish timed out."
                  : "Network error publishing the post.",
          },
          result.aborted ? 504 : 502,
        );
      case "no_container":
        return json(
          { ok: false, error: "Instagram did not return a media container." },
          502,
        );
      case "media_error":
        return json(
          {
            ok: false,
            error:
              "Instagram couldn't process the image. Check it's a public JPG/PNG, 4:5–1.91:1.",
          },
          400,
        );
      case "processing":
        return json(
          {
            ok: false,
            error:
              "Instagram is still processing the image — please try again in a moment.",
            code: "PROCESSING",
          },
          504,
        );
      case "no_publish_id":
        return json(
          { ok: false, error: "Instagram did not confirm the post." },
          502,
        );
      default:
        return json({ ok: false, error: "Unexpected publish state." }, 500);
    }
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
