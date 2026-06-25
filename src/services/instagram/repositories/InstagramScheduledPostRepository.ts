// src/services/instagram/repositories/InstagramScheduledPostRepository.ts
// Data access for scheduled Instagram FEED posts (Social Studio). The table is
// grant-hardened: authenticated has SELECT only, so reads go through the RLS-scoped
// query but ALL writes go through the SECURITY DEFINER RPCs (schedule_instagram_post /
// cancel_instagram_scheduled_post) — this is intentionally NOT a BaseRepository
// straight-mirror (a direct .insert()/.delete() would be denied at the grant layer).

import { BaseRepository } from "@/services/base/BaseRepository";
import type {
  InstagramScheduledPost,
  InstagramScheduledPostRow,
  InstagramScheduledPostInsert,
} from "@/types/instagram.types";

export class InstagramScheduledPostRepository extends BaseRepository<
  InstagramScheduledPost,
  InstagramScheduledPostInsert
> {
  constructor() {
    super("instagram_scheduled_posts");
  }

  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): InstagramScheduledPost {
    const row = dbRecord as unknown as InstagramScheduledPostRow;
    return {
      ...row,
      isPastDue:
        new Date(row.scheduled_for) < new Date() && row.status === "pending",
    };
  }

  /** Schedule a post via the SECURITY DEFINER RPC (the only write path). */
  async schedule(
    input: InstagramScheduledPostInsert,
  ): Promise<InstagramScheduledPost> {
    const { data, error } = await this.client.rpc("schedule_instagram_post", {
      p_id: input.id,
      p_integration_id: input.integration_id,
      p_image_url: input.image_url,
      p_caption: input.caption,
      p_view: input.view,
      p_card_theme: input.card_theme,
      p_scheduled_for: input.scheduled_for,
    });
    if (error) throw this.handleError(error, "schedule");
    return this.transformFromDB(data as Record<string, unknown>);
  }

  /**
   * Schedule a multi-slide CAROUSEL via the SECURITY DEFINER RPC (the only write path).
   * No `image_url` here: the RPC derives the mirror column from p_image_urls[1] itself,
   * so the caller supplies only the ordered array (review #10).
   */
  async scheduleCarousel(
    input: Omit<InstagramScheduledPostInsert, "image_url"> & {
      image_urls: string[];
    },
  ): Promise<InstagramScheduledPost> {
    const { data, error } = await this.client.rpc(
      "schedule_instagram_carousel",
      {
        p_id: input.id,
        p_integration_id: input.integration_id,
        p_image_urls: input.image_urls,
        p_caption: input.caption,
        p_view: input.view,
        p_card_theme: input.card_theme,
        p_scheduled_for: input.scheduled_for,
      },
    );
    if (error) throw this.handleError(error, "scheduleCarousel");
    return this.transformFromDB(data as Record<string, unknown>);
  }

  /**
   * Cancel (hard-delete) a pending post via RPC. Returns the removed row so the caller
   * can GC its Storage image.
   */
  async cancel(id: string): Promise<InstagramScheduledPost> {
    const { data, error } = await this.client.rpc(
      "cancel_instagram_scheduled_post",
      { p_id: id },
    );
    if (error) throw this.handleError(error, "cancel");
    return this.transformFromDB(data as Record<string, unknown>);
  }

  /** The agency's scheduled posts (RLS-scoped SELECT), soonest first. */
  async findByImo(imoId: string): Promise<InstagramScheduledPost[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("imo_id", imoId)
      .order("scheduled_for", { ascending: true });

    if (error) throw this.handleError(error, "findByImo");
    return (data || []).map((row) => this.transformFromDB(row));
  }
}
