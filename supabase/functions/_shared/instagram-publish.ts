// supabase/functions/_shared/instagram-publish.ts
// PURE Instagram Content-Publishing mechanics, shared by the synchronous "Post Now"
// edge fn (instagram-publish-post) and the scheduled-post cron worker
// (instagram-process-scheduled-posts).
//
// Scope is deliberately narrow: given an ALREADY-RESOLVED access token + IG user id,
// run the 3-step image flow and CLASSIFY the outcome. It does NOT touch the database,
// refresh tokens, resolve integrations, or build HTTP responses — those side effects
// differ per caller (one returns a 200/4xx to the browser, the other updates a queue
// row), so each caller maps the structured result itself. That keeps the just-verified
// publish fn's auth/token/DB logic exactly where it was.
//
//   1. POST /{ig-user-id}/media          { image_url, caption } → creation container
//   2. GET  /{creation-id}?fields=status_code  (poll until FINISHED)
//   3. POST /{ig-user-id}/media_publish  { creation_id }        → live media id

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

export async function runInstagramPublishFlow(
  opts: PublishFlowOptions,
): Promise<PublishFlowResult> {
  const graph = opts.graphBase ?? DEFAULT_GRAPH;
  const timeoutMs = opts.fetchTimeoutMs ?? 20000;
  const pollAttempts = opts.pollAttempts ?? 6;
  const pollIntervalMs = opts.pollIntervalMs ?? 1500;
  const { igUserId, accessToken, imageUrl, caption } = opts;

  // ── 1. Create the media container ──────────────────────────────────────────
  const t1 = withTimeout(timeoutMs);
  let containerData: { id?: string; error?: MetaError };
  try {
    const res = await fetch(`${graph}/${igUserId}/media`, {
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
    return {
      ok: false,
      reason: "transport",
      stage: "container",
      aborted: e instanceof Error && e.name === "AbortError",
    };
  } finally {
    t1.done();
  }
  if (containerData.error) {
    return {
      ok: false,
      reason: "meta_error",
      stage: "container",
      metaError: containerData.error,
    };
  }
  const creationId = containerData.id;
  if (!creationId) return { ok: false, reason: "no_container" };

  // ── 2. Wait for the container to finish processing (images are usually fast) ─
  for (let i = 0; i < pollAttempts; i++) {
    const s = await fetch(
      `${graph}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
    )
      .then((r) => r.json())
      .catch(() => null);
    const code = s?.status_code as string | undefined;
    if (code === "FINISHED") break;
    if (code === "ERROR" || code === "EXPIRED") {
      return { ok: false, reason: "media_error" };
    }
    if (i === pollAttempts - 1) {
      // Don't publish a container that never finished — that errors confusingly.
      return { ok: false, reason: "processing" };
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // ── 3. Publish ──────────────────────────────────────────────────────────────
  const t2 = withTimeout(timeoutMs);
  let publishData: { id?: string; error?: MetaError };
  try {
    const res = await fetch(`${graph}/${igUserId}/media_publish`, {
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
    return {
      ok: false,
      reason: "transport",
      stage: "publish",
      aborted: e instanceof Error && e.name === "AbortError",
    };
  } finally {
    t2.done();
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
