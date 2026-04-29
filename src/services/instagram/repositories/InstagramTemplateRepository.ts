// src/services/instagram/repositories/InstagramTemplateRepository.ts
import { BaseRepository } from "@/services/base/BaseRepository";
import type {
  InstagramMessageTemplate,
  InstagramMessageTemplateInsert,
  InstagramMessageTemplateUpdate,
} from "@/types/instagram.types";

export class InstagramTemplateRepository extends BaseRepository<
  InstagramMessageTemplate,
  InstagramMessageTemplateInsert,
  InstagramMessageTemplateUpdate
> {
  constructor() {
    super("instagram_message_templates");
  }

  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): InstagramMessageTemplate {
    // No computed fields for templates - direct mapping
    return dbRecord as unknown as InstagramMessageTemplate;
  }

  protected transformToDB(
    data: InstagramMessageTemplateInsert | InstagramMessageTemplateUpdate,
  ): Record<string, unknown> {
    return { ...data };
  }

  async update(
    id: string,
    updates: InstagramMessageTemplateUpdate,
  ): Promise<InstagramMessageTemplate> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(this.transformToDB(updates))
      .eq("id", id)
      .select();

    if (error) throw this.handleError(error, "update");
    if (!data || data.length === 0) {
      throw new Error(
        "You don't have permission to edit this template, or it no longer exists.",
      );
    }
    return this.transformFromDB(data[0]);
  }

  /**
   * Find active templates for an IMO (legacy)
   */
  async findActiveByImoId(imoId: string): Promise<InstagramMessageTemplate[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .order("use_count", { ascending: false });

    if (error) throw this.handleError(error, "findActiveByImoId");
    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find active templates for a user (personal + system templates)
   * Includes system templates (user_id = NULL) and user-specific templates
   */
  async findByUserId(userId: string): Promise<InstagramMessageTemplate[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("is_active", true)
      .order("use_count", { ascending: false });

    if (error) throw this.handleError(error, "findByUserId");
    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find templates filtered by prospect type and/or message stage
   * Includes system templates (user_id = NULL) and user-specific templates
   */
  async findByFilters(
    userId: string,
    filters: {
      prospectType?: string;
      messageStage?: string;
    },
  ): Promise<InstagramMessageTemplate[]> {
    let query = this.client
      .from(this.tableName)
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("is_active", true);

    if (filters.prospectType) {
      query = query.eq("category", filters.prospectType);
    }

    if (filters.messageStage) {
      query = query.eq("message_stage", filters.messageStage);
    }

    const { data, error } = await query.order("use_count", {
      ascending: false,
    });

    if (error) throw this.handleError(error, "findByFilters");
    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Soft delete a template (set is_active to false)
   * Includes user_id check for defense-in-depth (RLS also enforces this)
   */
  async softDelete(id: string, userId?: string): Promise<void> {
    let query = this.client
      .from(this.tableName)
      .update({ is_active: false })
      .eq("id", id);

    // Add user_id verification if provided
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;

    if (error) throw this.handleError(error, "softDelete");
  }

  /**
   * Clear category from all templates that match the given category value
   * Used when a custom category is deleted
   */
  async clearCategory(userId: string, categoryValue: string): Promise<number> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ category: null })
      .eq("user_id", userId)
      .eq("category", categoryValue)
      .select("id");

    if (error) throw this.handleError(error, "clearCategory");
    return data?.length ?? 0;
  }
}
