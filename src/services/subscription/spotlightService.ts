// src/services/subscription/spotlightService.ts
// Service for managing feature spotlights and user views

import { supabase } from "@/services/base";
import { logger } from "../base/logger";
import type { Database } from "@/types/database.types";

// Database row types
type FeatureSpotlightRow =
  Database["public"]["Tables"]["feature_spotlights"]["Row"];
type FeatureSpotlightInsert =
  Database["public"]["Tables"]["feature_spotlights"]["Insert"];
type FeatureSpotlightUpdate =
  Database["public"]["Tables"]["feature_spotlights"]["Update"];
type UserSpotlightViewRow =
  Database["public"]["Tables"]["user_spotlight_views"]["Row"];

// Public types
export interface SpotlightHighlight {
  icon: string;
  label: string;
}

export interface FeatureSpotlight extends Omit<
  FeatureSpotlightRow,
  "highlights" | "logos"
> {
  highlights: SpotlightHighlight[];
  logos: string[];
}

export interface CreateSpotlightParams {
  title: string;
  subtitle?: string;
  description?: string;
  highlights?: SpotlightHighlight[];
  logos?: string[];
  cta_text?: string;
  cta_link?: string;
  hero_icon?: string;
  accent_color?: string;
  target_audience?: string;
  priority?: number;
  is_active?: boolean;
  created_by?: string;
}

export type UpdateSpotlightParams = Partial<CreateSpotlightParams>;

export type UserSpotlightView = UserSpotlightViewRow;

function parseRow(row: FeatureSpotlightRow): FeatureSpotlight {
  let highlights: SpotlightHighlight[] = [];
  let logos: string[] = [];
  try {
    const rawH = row.highlights;
    if (Array.isArray(rawH)) {
      highlights = rawH as unknown as SpotlightHighlight[];
    }
  } catch {
    // fallback to empty array
  }
  try {
    const rawL = row.logos;
    if (Array.isArray(rawL)) {
      logos = rawL as unknown as string[];
    }
  } catch {
    // fallback to empty array
  }
  return { ...row, highlights, logos };
}

class SpotlightService {
  // ============================================
  // Spotlight CRUD
  // ============================================

  async getActiveSpotlights(): Promise<FeatureSpotlight[]> {
    const { data, error } = await supabase
      .from("feature_spotlights")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      logger.error(
        "Failed to fetch active spotlights",
        error,
        "SpotlightService",
      );
      throw error;
    }
    return (data || []).map(parseRow);
  }

  async getAllSpotlights(): Promise<FeatureSpotlight[]> {
    const { data, error } = await supabase
      .from("feature_spotlights")
      .select("*")
      .order("priority", { ascending: false });

    if (error) {
      logger.error("Failed to fetch all spotlights", error, "SpotlightService");
      throw error;
    }
    return (data || []).map(parseRow);
  }

  async createSpotlight(
    params: CreateSpotlightParams,
  ): Promise<FeatureSpotlight> {
    const insert: FeatureSpotlightInsert = {
      title: params.title,
      subtitle: params.subtitle,
      description: params.description,
      highlights: (params.highlights ||
        []) as unknown as Database["public"]["Tables"]["feature_spotlights"]["Insert"]["highlights"],
      logos: (params.logos ||
        []) as unknown as Database["public"]["Tables"]["feature_spotlights"]["Insert"]["logos"],
      cta_text: params.cta_text,
      cta_link: params.cta_link,
      hero_icon: params.hero_icon,
      accent_color: params.accent_color,
      target_audience: params.target_audience,
      priority: params.priority,
      is_active: params.is_active,
      created_by: params.created_by,
    };

    const { data, error } = await supabase
      .from("feature_spotlights")
      .insert(insert)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create spotlight", error, "SpotlightService");
      throw error;
    }
    return parseRow(data);
  }

  async updateSpotlight(
    id: string,
    params: UpdateSpotlightParams,
  ): Promise<void> {
    const update: FeatureSpotlightUpdate = {};
    if (params.title !== undefined) update.title = params.title;
    if (params.subtitle !== undefined) update.subtitle = params.subtitle;
    if (params.description !== undefined)
      update.description = params.description;
    if (params.highlights !== undefined) {
      update.highlights =
        params.highlights as unknown as Database["public"]["Tables"]["feature_spotlights"]["Update"]["highlights"];
    }
    if (params.logos !== undefined) {
      update.logos =
        params.logos as unknown as Database["public"]["Tables"]["feature_spotlights"]["Update"]["logos"];
    }
    if (params.cta_text !== undefined) update.cta_text = params.cta_text;
    if (params.cta_link !== undefined) update.cta_link = params.cta_link;
    if (params.hero_icon !== undefined) update.hero_icon = params.hero_icon;
    if (params.accent_color !== undefined)
      update.accent_color = params.accent_color;
    if (params.target_audience !== undefined)
      update.target_audience = params.target_audience;
    if (params.priority !== undefined) update.priority = params.priority;
    if (params.is_active !== undefined) update.is_active = params.is_active;

    const { error } = await supabase
      .from("feature_spotlights")
      .update(update)
      .eq("id", id);

    if (error) {
      logger.error("Failed to update spotlight", error, "SpotlightService");
      throw error;
    }
  }

  async deleteSpotlight(id: string): Promise<void> {
    const { error } = await supabase
      .from("feature_spotlights")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Failed to delete spotlight", error, "SpotlightService");
      throw error;
    }
  }

  // ============================================
  // User Views
  // ============================================

  async getUserViews(userId: string): Promise<UserSpotlightView[]> {
    const { data, error } = await supabase
      .from("user_spotlight_views")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to fetch user views", error, "SpotlightService");
      throw error;
    }
    return data || [];
  }

  async recordView(userId: string, spotlightId: string): Promise<void> {
    const { error } = await supabase
      .from("user_spotlight_views")
      .upsert(
        {
          user_id: userId,
          spotlight_id: spotlightId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,spotlight_id" },
      );

    if (error) {
      logger.error(
        "Failed to record spotlight view",
        error,
        "SpotlightService",
      );
      throw error;
    }
  }

  async resetUserViews(userId: string): Promise<void> {
    const { error } = await supabase
      .from("user_spotlight_views")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to reset user views", error, "SpotlightService");
      throw error;
    }
  }
}

export const spotlightService = new SpotlightService();
