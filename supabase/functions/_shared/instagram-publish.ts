// supabase/functions/_shared/instagram-publish.ts
// PURE Instagram Content-Publishing mechanics, shared by the synchronous "Post Now"
// edge fn (instagram-publish-post) and the scheduled-post cron worker
// (instagram-process-scheduled-posts).
//
// Scope is deliberately narrow: given an ALREADY-RESOLVED access token + IG user id,
// run the publish flow and CLASSIFY the outcome. It does NOT touch the database,
// refresh tokens, resolve integrations, or build HTTP responses — those side effects
// differ per caller (one returns a 200/4xx to the browser, the other updates a queue
// row), so each caller maps the structured result itself. That keeps the just-verified
// publish fn's auth/token/DB logic exactly where it was.
//
// Three flows share the same container→poll→publish primitives:
//   • Single feed image:  POST /{ig}/media { image_url, caption } → poll → media_publish
//   • Story (single):     POST /{ig}/media { image_url, media_type:"STORIES" } (NO caption)
//   • Carousel (2–10):    per child POST /{ig}/media { image_url, is_carousel_item:true }
//                         → poll each → POST /{ig}/media { media_type:"CAROUSEL",
//                         children:[…], caption } → poll → media_publish

const DEFAULT_GRAPH = "https://graph.instagram.com/v21.0";

export interface MetaError {
  message: string;
  type?: string;
  code: number;
  error_subcode?: number;
}

/** Discriminated outcome of the publish flow — no side effects, just facts. */
export type PublishFlowResult =
  | { ok: true; mediaId: string }
  // Instagram returned an error object at the container or publish step.
  | {
      ok: false;
      reason: "meta_error";
      stage: "container" | "publish";
      metaError: MetaError;
    }
  // The fetch itself failed (timeout/network) before/while talking to Instagram.
  | {
      ok: false;
      reason: "transport";
      stage: "container" | "publish";
      aborted: boolean;
    }
  // Container call succeeded but returned no creation id.
  | { ok: false; reason: "no_container" }
  // Poll reported the media as ERROR/EXPIRED — the image was rejected.
  | { ok: false; reason: "media_error" }
  // Container never reached FINISHED within the poll budget (still processing).
  | { ok: false; reason: "processing" }
  // Publish call succeeded but returned no media id.
  | { ok: false; reason: "no_publish_id" };

export interface PublishFlowOptions {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  /** "STORIES" routes the single image to the Story endpoint (no caption). Default feed. */
  mediaType?: "IMAGE" | "STORIES";
  graphBase?: string;
  fetchTimeoutMs?: number;
  pollAttempts?: number;
  pollIntervalMs?: number;
}

export interface CarouselPublishFlowOptions {
  igUserId: string;
  accessToken: string;
  /** 2–10 public https image URLs (the carousel slides, in order). */
  imageUrls: string[];
  caption: string;
  graphBase?: string;
  fetchTimeoutMs?: number;
  pollAttempts?: number;
  pollIntervalMs?: number;
}

function withTimeout(ms: number) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(id) };
}

/**
 * POST a creation container and return its id — or a terminal PublishFlowResult on
 * transport/meta/empty failure. `stage` is "container" for both the single image and
 * each carousel child/parent (they're all media-container creations).
 */
async function createContainer(
  graph: string,
  igUserId: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ id: string } | PublishFlowResult> {
  const t = withTimeout(timeoutMs);
  let data: { id?: string; error?: MetaError };
  try {
    const res = await fetch(`${graph}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: t.signal,
    });
    data = await res.json();
  } catch (e) {
    return {
      ok: false,
      reason: "transport",
      stage: "container",
      aborted: e instanceof Error && e.name === "AbortError",
    };
  } finally {
    t.done();
  }
  if (data.error) {
    return {
      ok: false,
      reason: "meta_error",
      stage: "container",
      metaError: data.error,
    };
  }
  if (!data.id) return { ok: false, reason: "no_container" };
  return { id: data.id };
}

/**
 * Poll a creation container until FINISHED. Returns null when finished; otherwise a
 * terminal PublishFlowResult error (media_error if rejected, processing if it never
 * settled within the budget). Images are usually fast.
 */
async function pollUntilFinished(
  graph: string,
  creationId: string,
  accessToken: string,
  attempts: number,
  intervalMs: number,
  timeoutMs: number,
): Promise<PublishFlowResult | null> {
  for (let i = 0; i < attempts; i++) {
    // Bound each status GET like the create/publish POSTs — a hung status
    // endpoint must not block the poll loop indefinitely (only the platform
    // hard timeout would otherwise stop it).
    const t = withTimeout(timeoutMs);
    const s = await fetch(
      `${graph}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
      { signal: t.signal },
    )
      .then((r) => r.json())
      .catch(() => null)
      .finally(() => t.done());
    const code = s?.status_code as string | undefined;
    if (code === "FINISHED") return null;
    if (code === "ERROR" || code === "EXPIRED") {
      return { ok: false, reason: "media_error" };
    }
    if (i === attempts - 1) {
      // Don't publish a container that never finished — that errors confusingly.
      return { ok: false, reason: "processing" };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, reason: "processing" };
}

/** Publish an already-FINISHED creation container → live media id. */
async function publishContainer(
  graph: string,
  igUserId: string,
  creationId: string,
  accessToken: string,
  timeoutMs: number,
): Promise<PublishFlowResult> {
  const t = withTimeout(timeoutMs);
  let publishData: { id?: string; error?: MetaError };
  try {
    const res = await fetch(`${graph}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
      signal: t.signal,
    });
    publishData = await res.json();
  } catch (e) {
    return {
      ok: false,
      reason: "transport",
      stage: "publish",
      aborted: e instanceof Error && e.name === "AbortError",
    };
  } finally {
    t.done();
  }
  if (publishData.error) {
    return {
      ok: false,
      reason: "meta_error",
      stage: "publish",
      metaError: publishData.error,
    };
  }
  if (!publishData.id) return { ok: false, reason: "no_publish_id" };
  return { ok: true, mediaId: publishData.id };
}

/**
 * Single-image publish (feed post or Story). Story containers carry `media_type:"STORIES"`
 * and NO caption (the Story endpoint ignores/rejects it); feed containers carry the caption.
 */
export async function runInstagramPublishFlow(
  opts: PublishFlowOptions,
): Promise<PublishFlowResult> {
  const graph = opts.graphBase ?? DEFAULT_GRAPH;
  const timeoutMs = opts.fetchTimeoutMs ?? 20000;
  const pollAttempts = opts.pollAttempts ?? 6;
  const pollIntervalMs = opts.pollIntervalMs ?? 1500;
  const { igUserId, accessToken, imageUrl, caption } = opts;
  const isStory = opts.mediaType === "STORIES";

  // ── 1. Create the media container ──────────────────────────────────────────
  const container = await createContainer(
    graph,
    igUserId,
    isStory
      ? {
          image_url: imageUrl,
          media_type: "STORIES",
          access_token: accessToken,
        }
      : { image_url: imageUrl, caption, access_token: accessToken },
    timeoutMs,
  );
  if ("ok" in container) return container; // terminal error
  const creationId = container.id;

  // ── 2. Wait for the container to finish processing ─────────────────────────
  const pollErr = await pollUntilFinished(
    graph,
    creationId,
    accessToken,
    pollAttempts,
    pollIntervalMs,
    timeoutMs,
  );
  if (pollErr) return pollErr;

  // ── 3. Publish ─────────────────────────────────────────────────────────────
  return publishContainer(graph, igUserId, creationId, accessToken, timeoutMs);
}

/**
 * Carousel publish (2–10 images). Each child is created with `is_carousel_item:true`
 * and NO caption, polled to FINISHED, then collected into a single CAROUSEL parent
 * that carries the caption; the parent is polled and published. The Graph API caps
 * carousels at 10 — the caller must pre-cap; this guards by slicing as a backstop.
 * A 0/1-image array routes to the single-image flow (IG rejects a <2-child carousel).
 */
export async function runInstagramCarouselPublishFlow(
  opts: CarouselPublishFlowOptions,
): Promise<PublishFlowResult> {
  const graph = opts.graphBase ?? DEFAULT_GRAPH;
  const timeoutMs = opts.fetchTimeoutMs ?? 20000;
  const pollAttempts = opts.pollAttempts ?? 6;
  const pollIntervalMs = opts.pollIntervalMs ?? 1500;
  const { igUserId, accessToken, caption } = opts;
  const imageUrls = opts.imageUrls.slice(0, 10);

  if (imageUrls.length < 2) {
    return runInstagramPublishFlow({
      igUserId,
      accessToken,
      imageUrl: imageUrls[0] ?? "",
      caption,
      graphBase: opts.graphBase,
      fetchTimeoutMs: opts.fetchTimeoutMs,
      pollAttempts: opts.pollAttempts,
      pollIntervalMs: opts.pollIntervalMs,
    });
  }

  // ── 1. Create + finish every child container concurrently ───────────────────
  //   The children are independent (caption goes on the PARENT only), so create
  //   and poll them in parallel — a serial loop makes wall-time scale linearly
  //   with slide count (~8s/child) and a full 10-slide deck can exceed the
  //   function/invoke timeout. Order is preserved by index for the parent.
  const children = await Promise.all(
    imageUrls.map(async (url): Promise<{ id: string } | PublishFlowResult> => {
      const child = await createContainer(
        graph,
        igUserId,
        { image_url: url, is_carousel_item: true, access_token: accessToken },
        timeoutMs,
      );
      if ("ok" in child) return child;
      const childPollErr = await pollUntilFinished(
        graph,
        child.id,
        accessToken,
        pollAttempts,
        pollIntervalMs,
        timeoutMs,
      );
      if (childPollErr) return childPollErr;
      return child;
    }),
  );
  const failed = children.find((c): c is PublishFlowResult => "ok" in c);
  if (failed) return failed;
  const childIds = (children as { id: string }[]).map((c) => c.id);

  // ── 2. Create + finish the CAROUSEL parent (children + caption) ─────────────
  const parent = await createContainer(
    graph,
    igUserId,
    {
      media_type: "CAROUSEL",
      children: childIds,
      caption,
      access_token: accessToken,
    },
    timeoutMs,
  );
  if ("ok" in parent) return parent;
  const parentPollErr = await pollUntilFinished(
    graph,
    parent.id,
    accessToken,
    pollAttempts,
    pollIntervalMs,
    timeoutMs,
  );
  if (parentPollErr) return parentPollErr;

  // ── 3. Publish the parent ───────────────────────────────────────────────────
  return publishContainer(graph, igUserId, parent.id, accessToken, timeoutMs);
}
