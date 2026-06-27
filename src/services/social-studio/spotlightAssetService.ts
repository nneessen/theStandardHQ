// src/services/social-studio/spotlightAssetService.ts
// Storage access for the Spotlight (Social Studio) agent photo. Lives in the
// service layer so the feature/UI never touches the Supabase client directly
// (eslint: UI/features must not import infrastructure).

import { supabase } from "../base/supabase";

const BUCKET = "spotlight-assets";
const PHOTO_KEY = "aotw-photo";
const POST_KEY = "social-post";
const CAROUSEL_PREFIX = "carousel";
const SCHEDULED_PREFIX = "scheduled";
const DECK_PREFIX = "decks";

/**
 * Read a File as a data: URL — the card's render source. A data URL is what makes
 * the in-app preview AND the PNG export capture the image with zero
 * cross-origin dependency (a remote URL silently drops from the export on a CORS
 * miss). Pure; shared by the photo upload and the (storage-free) background upload.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch a public image URL and return it as a data: URL, so a card that renders the image can
 * be rasterized to PNG with zero cross-origin dependency. modern-screenshot embeds the bytes
 * inline instead of refetching at capture time — a remote <img> can silently drop from the
 * export on a CORS miss. Used to inline an agent's profile photo (public `recruiting-assets`
 * bucket, served `ACAO:*`) before AOTW / welcome-card export. Throws on a fetch/read failure so
 * the caller can fall back to the placeholder.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch image failed (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export interface UploadedAgentPhoto {
  /** data: URL the card renders (CORS-proof in the PNG export). */
  dataUrl: string;
  /** Cache-busted public Storage URL, kept for later Instagram posting. */
  storageUrl: string;
}

/**
 * Upload the AOTW agent photo to the public spotlight-assets bucket under a stable
 * per-owner key (upsert → re-uploads never orphan a prior face). Returns the render
 * data URL and the public URL atomically (both only on full success).
 */
export async function uploadAgentPhoto(
  file: File,
): Promise<UploadedAgentPhoto> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const path = `${uid}/${PHOTO_KEY}`;
  const [dataUrl] = await Promise.all([
    readFileAsDataUrl(file),
    supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true })
      .then(({ error }) => {
        if (error) throw error;
      }),
  ]);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust the stable URL so a later consumer (P2/P3 IG posting) fetches the
  // newest upload, not a CDN-cached prior image at the same key.
  return { dataUrl, storageUrl: `${pub.publicUrl}?v=${Date.now()}` };
}

/**
 * Upload a RENDERED post image (a PNG data: URL from the in-app screenshot) to the
 * public bucket so Instagram can fetch it (the Graph API requires a public https URL).
 * Stable per-owner key + cache-busted URL → no orphan accumulation, and IG always
 * fetches the newest render. Returns the public URL. (Used by "Post to Instagram".)
 */
export async function uploadGeneratedPost(dataUrl: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${POST_KEY}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

/**
 * Upload N rendered carousel slides, each under a UNIQUE per-publish key
 * ({uid}/carousel/{batchId}/{i}.png) — a carousel needs N DISTINCT public URLs.
 * The key is namespaced by a fresh batch id PER CALL (not a stable per-index key):
 * if two posts (or a publish retry) ran concurrently, stable keys would overwrite
 * the in-flight post's slides while Instagram is still fetching them server-side,
 * publishing a mixed-content carousel. Unique immutable keys make each publish own
 * its own slots, so no cache-bust is needed. Slides upload concurrently; the caller
 * caps the count at Instagram's 10-slide limit. Returns the public URLs in slide order.
 */
export async function uploadCarouselSlides(
  dataUrls: string[],
): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const batchId = crypto.randomUUID();
  const folder = `${uid}/${CAROUSEL_PREFIX}/${batchId}`;
  try {
    return await Promise.all(
      dataUrls.map(async (dataUrl, i) => {
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${folder}/${i}.png`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (error) throw error;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return pub.publicUrl;
      }),
    );
  } catch (e) {
    // A partial batch (one slide failed after others uploaded) would otherwise leave
    // world-readable orphans behind — the keys are unique + immutable, so nothing else
    // ever GCs them. Best-effort cleanup of the whole batch folder before rethrowing.
    await removeCarouselBatch(uid, batchId, dataUrls.length).catch(() => {});
    throw e;
  }
}

/**
 * Best-effort GC of an immediate-publish carousel batch's slides (on a partial-upload
 * failure rollback). Keys are deterministic ({uid}/carousel/{batchId}/{i}.png), so no
 * Storage list() is needed; removing a key that never uploaded is a no-op, so passing the
 * full requested count is safe.
 */
async function removeCarouselBatch(
  uid: string,
  batchId: string,
  slideCount: number,
): Promise<void> {
  const folder = `${uid}/${CAROUSEL_PREFIX}/${batchId}`;
  const keys = Array.from(
    { length: slideCount },
    (_, i) => `${folder}/${i}.png`,
  );
  await supabase.storage.from(BUCKET).remove(keys);
}

/**
 * Upload a rendered post image for a SCHEDULED post under a UNIQUE per-post key
 * ({uid}/scheduled/{postId}.png). Unlike uploadGeneratedPost's stable key (which the
 * next "Post Now" overwrites), each scheduled image must survive untouched until the
 * cron worker fires it — so the key is the row id. The worker (on publish) or a Cancel
 * GCs the object afterward. Returns the stable public URL stored on the row (NOT
 * cache-busted: the object never changes).
 */
export async function uploadScheduledPost(
  dataUrl: string,
  postId: string,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${SCHEDULED_PREFIX}/${postId}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * Upload a rendered CAROUSEL's slides for a SCHEDULED post under a per-post folder
 * ({uid}/scheduled/{postId}/{i}.png). Like uploadScheduledPost the key is derived from the
 * row id (so images survive untouched until the cron worker fires), but a carousel keeps
 * every slide under the post's own folder so the worker / Cancel can GC the whole set by
 * prefix. Slides upload concurrently; returns the public URLs in slide order.
 */
export async function uploadScheduledCarousel(
  dataUrls: string[],
  postId: string,
): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  return Promise.all(
    dataUrls.map(async (dataUrl, i) => {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${uid}/${SCHEDULED_PREFIX}/${postId}/${i}.png`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return pub.publicUrl;
    }),
  );
}

/**
 * Delete a scheduled post's image(s) (on Cancel or a failed schedule rollback) — mirrors the
 * worker's post-publish GC so a cancelled post doesn't leave world-readable images behind.
 * Keys are deterministic, so NO Storage list() is needed (review #6): pass `slideCount` (>1)
 * for a carousel and the slides at {postId}/{i}.png (i = 0..slideCount-1) are removed; omit it
 * (or 0/1) for a single image at {postId}.png. Removing a missing key is a no-op, so over-
 * specifying the count (e.g. on a partial-upload rollback) is safe. Best-effort: the row is
 * already removed and the local Storage emulator 400s on object DELETE (prod removes cleanly),
 * so the caller never blocks on this.
 */
export async function removeScheduledPost(
  postId: string,
  slideCount = 0,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const folder = `${uid}/${SCHEDULED_PREFIX}/${postId}`;
  const keys =
    slideCount > 1
      ? Array.from({ length: slideCount }, (_, i) => `${folder}/${i}.png`)
      : [`${folder}.png`];
  await supabase.storage.from(BUCKET).remove(keys);
}

/**
 * Upload one marketing-slide image (a data: URL) for a SAVED DECK under a per-deck folder
 * ({uid}/decks/{deckId}/{slideIndex}.png) and return its public URL. Lets a saved deck persist
 * a small Storage URL instead of a multi-MB base64 blob inside the row's jsonb (review #7).
 */
export async function uploadDeckImage(
  deckId: string,
  slideIndex: number,
  dataUrl: string,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${DECK_PREFIX}/${deckId}/${slideIndex}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * Best-effort GC of a deck's stored slide images (on delete or save-rollback). The caller
 * doesn't track the object names, so this lists then removes — deck save/delete is a rare,
 * deliberate action, so the extra round-trip is acceptable here.
 */
export async function removeDeckImages(deckId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const folder = `${uid}/${DECK_PREFIX}/${deckId}`;
  const { data: listed } = await supabase.storage.from(BUCKET).list(folder);
  if (listed?.length) {
    await supabase.storage
      .from(BUCKET)
      .remove(listed.map((o) => `${folder}/${o.name}`));
  }
}

/**
 * Delete the owner's AOTW photo object — "Remove" must not leave a face
 * world-readable in the public bucket. Best-effort; the caller clears the UI even
 * if the delete fails.
 */
export async function removeAgentPhoto(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (uid) {
    await supabase.storage.from(BUCKET).remove([`${uid}/${PHOTO_KEY}`]);
  }
}
