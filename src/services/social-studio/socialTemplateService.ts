// src/services/social-studio/socialTemplateService.ts
// CRUD for owner-saved Social Studio style templates (Spotlight). Plain object
// service, throw-on-error, RLS-enforced — mirrors src/services/prospects.
// The `config` column stores STYLE only (per-post photo/background-image content is
// stripped by toTemplateConfig before save).

import { supabase } from "../base/supabase";
import type { Database, Json } from "@/types/database.types";
import type { SocialTemplateConfig } from "@/features/social-studio/types";

type SocialTemplateRow =
  Database["public"]["Tables"]["social_templates"]["Row"];

/** A saved template with the `config` jsonb typed as the studio's style config. */
export interface SocialTemplate extends Omit<SocialTemplateRow, "config"> {
  config: SocialTemplateConfig;
}

export interface CreateSocialTemplateInput {
  name: string;
  config: SocialTemplateConfig;
  /** Tenant for the row — the studio's current IMO (useImo().imo.id). */
  imoId: string;
  agencyId: string | null;
}

const TABLE = "social_templates";

export const socialTemplateService = {
  /** The current owner's saved templates, newest first (RLS scopes to own rows). */
  async getMyTemplates(): Promise<SocialTemplate[]> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SocialTemplate[];
  },

  async createTemplate(
    input: CreateSocialTemplateInput,
  ): Promise<SocialTemplate> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        owner_id: user.id,
        imo_id: input.imoId,
        agency_id: input.agencyId,
        name: input.name,
        config: input.config as unknown as Json,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as SocialTemplate;
  },

  async deleteTemplate(id: string): Promise<void> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    // Filter by owner_id (defence-in-depth alongside RLS — symmetric with the read
    // and create paths) AND .select() the affected rows: PostgREST returns
    // error:null for a 0-row delete (RLS-blocked row or a stale id), which would
    // otherwise surface to the UI as a false "Template deleted." Surface it instead.
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Template not found or already deleted.");
    }
  },
};
