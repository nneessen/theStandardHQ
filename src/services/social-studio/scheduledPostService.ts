// src/services/social-studio/scheduledPostService.ts
// Orchestrates scheduling a Social Studio graphic to Instagram: upload the rendered PNG
// under the post's unique key, then create the queue row via the SECURITY DEFINER RPC.
// The cron worker (instagram-process-scheduled-posts) publishes due rows and GCs images.

import { InstagramScheduledPostRepository } from "@/services/instagram/repositories";
import {
  uploadScheduledPost,
  uploadScheduledCarousel,
  removeScheduledPost,
} from "./spotlightAssetService";
import type {
  InstagramScheduledPost,
  InstagramScheduledPostInsert,
} from "@/types/instagram.types";

const repo = new InstagramScheduledPostRepository();

export interface SchedulePostInput {
  /** Client-generated uuid — also the Storage image key, so it must exist before upload. */
  postId: string;
  integrationId: string | null;
  /** Rendered card PNG as a data: URL. */
  dataUrl: string;
  caption: string;
  view: string;
  cardTheme: string;
  scheduledFor: Date;
}

/**
 * Schedule a post: upload the image first (so the row can point at a live URL), then
 * insert the queue row. If the row insert fails, the just-uploaded image is GC'd so we
 * don't orphan it.
 */
export async function schedulePost(
  input: SchedulePostInput,
): Promise<InstagramScheduledPost> {
  const imageUrl = await uploadScheduledPost(input.dataUrl, input.postId);
  const payload: InstagramScheduledPostInsert = {
    id: input.postId,
    integration_id: input.integrationId,
    image_url: imageUrl,
    caption: input.caption || null,
    view: input.view || null,
    card_theme: input.cardTheme || null,
    scheduled_for: input.scheduledFor.toISOString(),
  };
  try {
    return await repo.schedule(payload);
  } catch (e) {
    await removeScheduledPost(input.postId).catch(() => {});
    throw e;
  }
}

export interface ScheduleCarouselInput {
  /** Client-generated uuid — also the Storage folder key, so it must exist before upload. */
  postId: string;
  integrationId: string | null;
  /** Rendered slide PNGs as data: URLs, in order (2-10). */
  dataUrls: string[];
  caption: string;
  view: string;
  cardTheme: string;
  scheduledFor: Date;
}

/**
 * Schedule a CAROUSEL: upload every slide under the post's folder first, then insert the
 * queue row via the carousel RPC (which stores image_urls + derives image_url=image_urls[1]).
 * The UPLOAD is inside the try (review #5): if any slide upload fails mid-batch — or the row
 * insert fails — every already-uploaded slide is GC'd so we never orphan world-readable PNGs.
 */
export async function scheduleCarousel(
  input: ScheduleCarouselInput,
): Promise<InstagramScheduledPost> {
  try {
    const imageUrls = await uploadScheduledCarousel(
      input.dataUrls,
      input.postId,
    );
    return await repo.scheduleCarousel({
      id: input.postId,
      integration_id: input.integrationId,
      image_urls: imageUrls,
      caption: input.caption || null,
      view: input.view || null,
      card_theme: input.cardTheme || null,
      scheduled_for: input.scheduledFor.toISOString(),
    });
  } catch (e) {
    // Intended slide count (some may not have uploaded) — removing a key that doesn't exist
    // is a no-op, so passing the full count cleans up any partial upload deterministically.
    await removeScheduledPost(input.postId, input.dataUrls.length).catch(
      () => {},
    );
    throw e;
  }
}

/** Cancel a pending post (hard-delete via RPC) and GC its image(s). */
export async function cancelScheduledPost(id: string): Promise<void> {
  // cancel() returns the removed row, so we know the exact shape (carousel slide count vs
  // single image) and can GC deterministically without a Storage list() (review #6).
  const removed = await repo.cancel(id);
  await removeScheduledPost(id, removed.image_urls?.length ?? 0).catch(
    () => {},
  );
}

/** All scheduled posts for an agency (RLS-scoped), soonest first. */
export async function getScheduledPosts(
  imoId: string,
): Promise<InstagramScheduledPost[]> {
  return repo.findByImo(imoId);
}
