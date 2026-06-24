// supabase/functions/instagram-publish-post/index.ts
// Publishes a Social Studio graphic to the agency's connected Instagram account via the
// Instagram Content Publishing API (graph.instagram.com). Accepts imageUrls[] + mediaType
// and routes (mechanics live in ../_shared/instagram-publish.ts):
//   • STORIES            → single Story image, no caption
//   • FEED, 1 image      → single feed post
//   • FEED, 2–10 images  → carousel (per-child containers → CAROUSEL parent → publish)
// An optional integrationId pins WHICH connected account to post to (multi-account);
// it is validated against the caller's agency before use.
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
  runInstagramCarouselPublishFlow,
  type MetaError,
} from "../_shared/instagram-publish.ts";

const IG_CAROUSEL_MAX = 10;

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
    // New shape: imageUrls[] + mediaType ("FEED"|"STORIES") + optional integrationId.
    // Back-compat: a lone `imageUrl` is accepted as a single-element feed post.
    const body = await req.json().catch(() => null);
    const rawUrls: unknown = Array.isArray(body?.imageUrls)
      ? body.imageUrls
      : body?.imageUrl
        ? [body.imageUrl]
        : [];
    const imageUrls: string[] = (rawUrls as unknown[])
      .filter((u): u is string => typeof u === "string")
      .slice(0, IG_CAROUSEL_MAX);
    const caption: string = body?.caption ?? "";
    const mediaType: "FEED" | "STORIES" =
      body?.mediaType === "STORIES" ? "STORIES" : "FEED";
    const integrationId: string | undefined =
      typeof body?.integrationId === "string" ? body.integrationId : undefined;
    if (
      imageUrls.length === 0 ||
      !imageUrls.every((u) => /^https:\/\//i.test(u))
    ) {
      return json(
        { ok: false, error: "A public https image URL is required." },
        400,
      );
    }
    // A Story posts a single frame. Reject a multi-image Story explicitly rather
    // than silently publishing only imageUrls[0] and dropping the rest.
    if (mediaType === "STORIES" && imageUrls.length > 1) {
      return json({ ok: false, error: "A Story accepts a single image." }, 400);
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

    // Base query: only the caller's agency, active + connected accounts. When the
    // client names an integrationId we additionally pin to THAT row — the extra
    // imo_id/is_active/connected filters are the ownership check (a foreign or
    // disconnected id simply yields no row → NOT_CONNECTED, never another agency's
    // account). With no id we keep the historical most-recent fallback. A factory
    // (not a reassigned `let`) keeps PostgREST's result-type inference intact.
    const baseIntegrationQuery = () =>
      supabase
        .from("instagram_integrations")
        .select(
          "id, instagram_user_id, instagram_username, access_token_encrypted, token_expires_at",
        )
        .eq("imo_id", imoId)
        .eq("is_active", true)
        .eq("connection_status", "connected");
    const { data: integration } = await (
      integrationId
        ? baseIntegrationQuery().eq("id", integrationId)
        : baseIntegrationQuery()
    )
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

    // ── Run the right shared flow; map its result to our HTTP responses ─────────
    //   STORIES → single Story image (no caption); >1 feed image → carousel; else
    //   the single-image feed flow. All three return the same PublishFlowResult union.
    const result =
      mediaType === "STORIES"
        ? await runInstagramPublishFlow({
            igUserId,
            accessToken,
            imageUrl: imageUrls[0],
            caption: "",
            mediaType: "STORIES",
          })
        : imageUrls.length > 1
          ? await runInstagramCarouselPublishFlow({
              igUserId,
              accessToken,
              imageUrls,
              caption,
            })
          : await runInstagramPublishFlow({
              igUserId,
              accessToken,
              imageUrl: imageUrls[0],
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
