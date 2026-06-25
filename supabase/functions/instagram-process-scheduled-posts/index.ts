// supabase/functions/instagram-process-scheduled-posts/index.ts
// CRON worker: publishes due Social Studio scheduled posts to the agency's connected
// Instagram feed. Mirrors instagram-process-scheduled (the scheduled-DM worker) but for
// the Content Publishing API, reusing the shared publish mechanics in
// _shared/instagram-publish.ts. Runs as service role (bypasses RLS); scheduled via
// pg_cron every 5 minutes (see the companion *_cron migration). Deploy --no-verify-jwt.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import {
  isTokenAboutToExpire,
  attemptTokenRefresh,
  updateIntegrationToken,
  markIntegrationExpired,
} from "../_shared/instagram-token-refresh.ts";
import {
  runInstagramPublishFlow,
  runInstagramCarouselPublishFlow,
} from "../_shared/instagram-publish.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MAX_RETRIES = 3;
// Atomic-claim batch size. Deliberately small: a carousel can take minutes to publish
// (per-slide container creation + 1.5s polling), so a small batch keeps one run far under
// the claim staleness window (45 min, see claim_due_instagram_posts) — that margin is what
// stops an overlapping cron tick from re-claiming and double-publishing. Backlogs simply
// drain across successive 5-minute ticks.
const CLAIM_LIMIT = 10;
const BUCKET = "spotlight-assets";

interface DuePost {
  id: string;
  imo_id: string;
  integration_id: string | null;
  image_url: string;
  /** Carousel slides (2-10). null/empty → single image at image_url. */
  image_urls: string[] | null;
  caption: string | null;
  scheduled_by: string;
  retry_count: number;
}

interface IntegrationRow {
  id: string;
  instagram_user_id: string;
  instagram_username: string;
  access_token_encrypted: string;
  token_expires_at: string | null;
}

interface ProcessResult {
  published: number;
  failed: number;
  expired: number;
  retrying: number;
  skipped: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // CRON auth: accept the service-role key (the cron job's bearer) or CRON_SECRET.
  const authHeader = req.headers.get("Authorization");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isAuthorized =
    authHeader === `Bearer ${CRON_SECRET}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (!isAuthorized) {
    console.error("[instagram-process-scheduled-posts] Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result: ProcessResult = {
    published: 0,
    failed: 0,
    expired: 0,
    retrying: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }
    // Cast to the shared helpers' client type (createClient infers a stricter schema
    // generic than the helpers declare — the same friction across the edge codebase).
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    ) as ReturnType<typeof createClient>;
    const now = new Date().toISOString();

    // ATOMIC CLAIM (review #1): stamp a per-run token on up to CLAIM_LIMIT due rows via
    // FOR UPDATE SKIP LOCKED, and process ONLY the rows we claimed. A row another tick is
    // still publishing stays invisible (its claim is fresh), so two overlapping ticks can
    // never publish the same post twice. Every terminal update below CAS-guards on runToken.
    const runToken = crypto.randomUUID();
    const { data, error } = await supabase.rpc("claim_due_instagram_posts", {
      p_claim_token: runToken,
      p_limit: CLAIM_LIMIT,
    });

    if (error) throw error;
    // The untyped service client returns the RPC payload as {}; cast to our row shape.
    const posts = (data as unknown as DuePost[] | null) ?? [];
    if (posts.length === 0) {
      return jsonResponse({ success: true, result });
    }

    // Group by the account each post should publish FROM: the specific integration the
    // user scheduled with (post.integration_id) when set, else a per-agency fallback
    // bucket. Honors per-post account selection (WI-6) while keeping the original "one
    // account lookup + one token decrypt per account" efficiency.
    const byKey = new Map<string, DuePost[]>();
    for (const p of posts) {
      const key = p.integration_id ?? `imo:${p.imo_id}`;
      const list = byKey.get(key) ?? [];
      list.push(p);
      byKey.set(key, list);
    }

    for (const [key, keyPosts] of byKey) {
      const imoId = keyPosts[0].imo_id;
      const namedIntegrationId = key.startsWith("imo:") ? null : key;

      // A NAMED account is pinned by id AND validated to belong to this agency (the
      // imo_id filter IS the ownership check). A NULL integration_id (legacy/single-
      // account posts) falls back to the agency's most-recent connected account.
      const integ = await resolveAccount(supabase, imoId, namedIntegrationId);

      if (!integ) {
        // Named-but-gone (the chosen account was disconnected/deleted since scheduling)
        // OR no connected account at all. EITHER WAY leave the posts PENDING — never
        // silently republish from a DIFFERENT account (wrong brand/audience). RELEASE the
        // claim so they retry on the NEXT 5-min tick (fire on reconnect) instead of being
        // invisible for the full stale window; never published here, so no double-post risk.
        await releaseClaims(supabase, keyPosts, runToken);
        console.log(
          `[instagram-process-scheduled-posts] No usable account for ${key}; releasing claim on ${keyPosts.length} pending`,
        );
        result.skipped += keyPosts.length;
        continue;
      }

      // Decrypt once; proactively refresh a token nearing expiry (same as the
      // synchronous publish fn). A decrypt failure means the stored token is
      // unusable → expire the account + these posts.
      let accessToken: string;
      try {
        accessToken = await decrypt(integ.access_token_encrypted);
        if (isTokenAboutToExpire(integ.token_expires_at, 7)) {
          const refresh = await attemptTokenRefresh(
            integ.access_token_encrypted,
          );
          if (refresh.success && refresh.newToken && refresh.newExpiresAt) {
            await updateIntegrationToken(
              supabase,
              integ.id,
              refresh.newToken,
              refresh.newExpiresAt,
            );
            accessToken = await decrypt(refresh.newToken);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Token decrypt failed";
        await markIntegrationExpired(supabase, integ.id, msg);
        for (const post of keyPosts) {
          await expirePost(
            supabase,
            post,
            `Token unavailable: ${msg}`,
            now,
            runToken,
          );
          result.expired++;
        }
        continue;
      }

      // Publish this agency's posts with a small concurrency cap (rate-limit safety).
      const outcomes = await processWithConcurrency(
        keyPosts,
        (post) => publishOne(supabase, integ, accessToken, post, now, runToken),
        5,
      );
      for (let i = 0; i < outcomes.length; i++) {
        const o = outcomes[i];
        if (o.status === "fulfilled") {
          if (o.value === "published") result.published++;
          else if (o.value === "expired") result.expired++;
          else if (o.value === "failed") result.failed++;
          else if (o.value === "retrying") result.retrying++;
        } else {
          // publishOne only throws on an UNEXPECTED exception (it returns a disposition for
          // every expected error). Mark such a post terminally FAILED — never leave it claimed
          // with status='pending', or it would be reclaimed after the stale window and could
          // double-post if the throw happened AFTER a successful Instagram publish. failPost
          // CAS-guards on runToken and releases the row from the pending set.
          const msg = o.reason?.message ?? "unknown error";
          await failPost(
            supabase,
            keyPosts[i],
            `Unexpected error: ${msg}`,
            now,
            /* terminal */ true,
            runToken,
          ).catch(() => {});
          result.failed++;
          result.errors.push(`Post ${keyPosts[i].id}: ${msg}`);
        }
      }
    }

    console.log("[instagram-process-scheduled-posts] Complete:", result);
    return jsonResponse({ success: true, result });
  } catch (err) {
    console.error("[instagram-process-scheduled-posts] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(msg);
    return jsonResponse({ success: false, error: msg, result }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Resolve the connected Instagram account a group of posts should publish from: a
 * specific integration when one was named (validated to belong to `imoId` + be active and
 * connected), else the agency's most-recent connected account (legacy/single-account
 * posts). Returns null when none is usable — the caller leaves those posts pending rather
 * than publish from the wrong account. The cast sidesteps the untyped client's row
 * inference (same pattern as the rest of this worker).
 */
async function resolveAccount(
  supabase: ReturnType<typeof createClient>,
  imoId: string,
  namedIntegrationId: string | null,
): Promise<IntegrationRow | null> {
  const sel = supabase
    .from("instagram_integrations")
    .select(
      "id, instagram_user_id, instagram_username, access_token_encrypted, token_expires_at",
    )
    .eq("imo_id", imoId)
    .eq("is_active", true)
    .eq("connection_status", "connected");
  const { data } = namedIntegrationId
    ? await sel.eq("id", namedIntegrationId).limit(1).maybeSingle()
    : await sel
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  return (data as unknown as IntegrationRow) ?? null;
}

/**
 * Publish a single post and persist its outcome. Returns the terminal/transient
 * disposition for the run tally.
 */
async function publishOne(
  supabase: ReturnType<typeof createClient>,
  integration: IntegrationRow,
  accessToken: string,
  post: DuePost,
  now: string,
  runToken: string,
): Promise<"published" | "failed" | "expired" | "retrying"> {
  // Back-compat discriminator: old rows have only image_url; carousel rows carry the
  // full ordered array. >1 URL → carousel flow (same one Post-Now already proved), else
  // the original single-image flow. Both return the same PublishFlowResult shape.
  const urls =
    post.image_urls && post.image_urls.length > 0
      ? post.image_urls
      : [post.image_url];
  // Defence-in-depth (review #12): the RPC blocks a carousel of <2 URLs, so a non-null
  // image_urls of length 1 is an invariant violation. Publish it as a single image (the
  // safe interpretation) but surface it loudly rather than silently.
  if (post.image_urls && post.image_urls.length === 1) {
    console.warn(
      `[instagram-process-scheduled-posts] Post ${post.id} has a 1-element image_urls (carousel expects >=2); publishing as a single image.`,
    );
  }
  const flow =
    urls.length > 1
      ? await runInstagramCarouselPublishFlow({
          igUserId: integration.instagram_user_id,
          accessToken,
          imageUrls: urls,
          caption: post.caption ?? "",
        })
      : await runInstagramPublishFlow({
          igUserId: integration.instagram_user_id,
          accessToken,
          imageUrl: urls[0],
          caption: post.caption ?? "",
        });

  if (flow.ok) {
    await supabase
      .from("instagram_scheduled_posts")
      .update({
        status: "published",
        published_at: now,
        published_media_id: flow.mediaId,
        last_error: null,
        updated_at: now,
      })
      .eq("id", post.id)
      .eq("claim_token", runToken);
    await gcImage(supabase, post);
    console.log(
      `[instagram-process-scheduled-posts] Published ${post.id} → media ${flow.mediaId} (@${integration.instagram_username})`,
    );
    return "published";
  }

  // A dead token is terminal for the whole account — mark it expired so the agency
  // is prompted to reconnect, and expire this post (retrying won't help).
  if (flow.reason === "meta_error" && flow.metaError.code === 190) {
    await markIntegrationExpired(
      supabase,
      integration.id,
      flow.metaError.message,
    );
    await expirePost(supabase, post, "Instagram token expired", now, runToken);
    return "expired";
  }

  // A rejected image won't get better on retry — fail it now.
  if (flow.reason === "media_error") {
    await failPost(
      supabase,
      post,
      "Instagram rejected the image (must be a public JPG/PNG, 4:5–1.91:1)",
      now,
      /* terminal */ true,
      runToken,
    );
    return "failed";
  }

  // Everything else (rate limit, server error, timeout, still-processing) is
  // transient: bump the retry counter and let the next cron tick try again, up to
  // MAX_RETRIES, after which it's marked failed.
  const errLabel =
    flow.reason === "meta_error"
      ? flow.metaError.message
      : flow.reason === "transport"
        ? flow.aborted
          ? "Instagram request timed out"
          : "Network error talking to Instagram"
        : flow.reason === "processing"
          ? "Instagram still processing the image"
          : flow.reason;
  const becameFailed = await failPost(
    supabase,
    post,
    errLabel,
    now,
    false,
    runToken,
  );
  return becameFailed ? "failed" : "retrying";
}

/**
 * Increment retry and either keep the post pending (will retry) or mark it failed once
 * retries are exhausted / when forced terminal. Returns true if the post is now failed.
 */
async function failPost(
  supabase: ReturnType<typeof createClient>,
  post: DuePost,
  errorMessage: string,
  now: string,
  terminal: boolean,
  runToken: string,
): Promise<boolean> {
  const newRetry = post.retry_count + 1;
  const isFailed = terminal || newRetry >= MAX_RETRIES;
  await supabase
    .from("instagram_scheduled_posts")
    .update({
      status: isFailed ? "failed" : "pending",
      retry_count: newRetry,
      last_error: errorMessage,
      updated_at: now,
      // On a transient retry, release the claim so the NEXT tick can re-claim immediately
      // (don't make it wait out the stale window). A terminal row moves to status='failed',
      // which claim_due_instagram_posts never re-claims (it only takes status='pending'), so
      // the leftover token on a failed row is harmless.
      ...(isFailed ? {} : { claim_token: null, claimed_at: null }),
    })
    .eq("id", post.id)
    .eq("claim_token", runToken);
  if (isFailed) await gcImage(supabase, post);
  return isFailed;
}

/** Mark a post terminally un-publishable (no account / dead token) and GC its image. */
async function expirePost(
  supabase: ReturnType<typeof createClient>,
  post: DuePost,
  errorMessage: string,
  now: string,
  runToken: string,
): Promise<void> {
  await supabase
    .from("instagram_scheduled_posts")
    .update({
      status: "expired",
      last_error: errorMessage,
      updated_at: now,
    })
    .eq("id", post.id)
    .eq("claim_token", runToken);
  await gcImage(supabase, post);
}

/**
 * Release this run's claim on a set of posts WITHOUT changing their status — they stay
 * 'pending' and become re-claimable on the next tick. Used when a post can't be acted on
 * this run for a NON-failure reason (no usable account yet) so it isn't stranded for the full
 * stale window. CAS-guarded on runToken so we only ever release what we claimed.
 */
async function releaseClaims(
  supabase: ReturnType<typeof createClient>,
  posts: DuePost[],
  runToken: string,
): Promise<void> {
  if (posts.length === 0) return;
  await supabase
    .from("instagram_scheduled_posts")
    .update({ claim_token: null, claimed_at: null })
    .in(
      "id",
      posts.map((p) => p.id),
    )
    .eq("claim_token", runToken);
}

/**
 * Best-effort delete of the post's Storage image(s) — keys are fully deterministic, so no
 * Storage list() is needed (review #6). A carousel's slides live at {uid}/scheduled/{id}/{i}.png
 * (i = 0..n-1, the upload index), a single image at {uid}/scheduled/{id}.png. Only ever called
 * on a TERMINAL state (published / failed / expired) — never when a post is left pending.
 */
async function gcImage(
  supabase: ReturnType<typeof createClient>,
  post: DuePost,
): Promise<void> {
  try {
    const folder = `${post.scheduled_by}/scheduled/${post.id}`;
    const isCarousel = !!post.image_urls && post.image_urls.length > 1;
    const keys = isCarousel
      ? post.image_urls!.map((_, i) => `${folder}/${i}.png`)
      : [`${folder}.png`];
    await supabase.storage.from(BUCKET).remove(keys);
  } catch (err) {
    console.warn(
      `[instagram-process-scheduled-posts] image GC failed for ${post.id}:`,
      err,
    );
  }
}

/** Run async work in batches with a concurrency cap (mirrors the DM worker). */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.allSettled(batch.map(processor))));
  }
  return results;
}
