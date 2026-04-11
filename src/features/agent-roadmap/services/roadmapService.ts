// src/features/agent-roadmap/services/roadmapService.ts
//
// All CRUD + RPC wrappers for the Agent Roadmap feature.
// Single export: `roadmapService`. Methods are grouped by entity and follow
// the convention used by trainingModuleService.ts.

import { supabase } from "@/services/base";
import type {
  RoadmapTemplateRow,
  RoadmapSectionRow,
  RoadmapItem,
  RoadmapItemRow,
  RoadmapTree,
  RoadmapSectionWithItems,
  CreateRoadmapInput,
  UpdateRoadmapInput,
  CreateSectionInput,
  UpdateSectionInput,
  CreateItemInput,
  UpdateItemInput,
} from "../types/roadmap";
import type { RoadmapContentBlock } from "../types/contentBlocks";
import { validateContentBlocks } from "./contentBlocksValidator";

/**
 * Narrow the raw DB item row (which has `content_blocks: Json`) into our
 * strongly-typed RoadmapItem. Trusts that content already in the DB was
 * validated on write — this is a structural cast, not a runtime check.
 */
function rowToItem(row: RoadmapItemRow): RoadmapItem {
  return {
    ...row,
    content_blocks:
      (row.content_blocks as unknown as RoadmapContentBlock[]) ?? [],
  };
}

export const roadmapService = {
  // ==========================================================================
  // Templates
  // ==========================================================================

  /**
   * List all roadmaps visible to the current user in their agency.
   * Agents see only published roadmaps (RLS enforced).
   * Super-admins see everything.
   */
  async listRoadmaps(agencyId: string): Promise<RoadmapTemplateRow[]> {
    const { data, error } = await supabase
      .from("roadmap_templates")
      .select("*")
      .eq("agency_id", agencyId)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(`listRoadmaps failed: ${error.message}`);
    return data ?? [];
  },

  async getRoadmap(roadmapId: string): Promise<RoadmapTemplateRow | null> {
    const { data, error } = await supabase
      .from("roadmap_templates")
      .select("*")
      .eq("id", roadmapId)
      .maybeSingle();

    if (error) throw new Error(`getRoadmap failed: ${error.message}`);
    return data;
  },

  /**
   * Load a complete roadmap tree: template + sections + items, all ordered.
   * Used by both the admin editor and the agent runner.
   */
  async getRoadmapTree(roadmapId: string): Promise<RoadmapTree | null> {
    const { data: template, error: tplErr } = await supabase
      .from("roadmap_templates")
      .select("*")
      .eq("id", roadmapId)
      .maybeSingle();

    if (tplErr)
      throw new Error(`getRoadmapTree (template) failed: ${tplErr.message}`);
    if (!template) return null;

    const { data: sections, error: secErr } = await supabase
      .from("roadmap_sections")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .order("sort_order", { ascending: true });

    if (secErr)
      throw new Error(`getRoadmapTree (sections) failed: ${secErr.message}`);

    const { data: items, error: itemErr } = await supabase
      .from("roadmap_items")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .order("sort_order", { ascending: true });

    if (itemErr)
      throw new Error(`getRoadmapTree (items) failed: ${itemErr.message}`);

    const itemsBySection = new Map<string, RoadmapItem[]>();
    for (const row of items ?? []) {
      const typed = rowToItem(row);
      const arr = itemsBySection.get(typed.section_id) ?? [];
      arr.push(typed);
      itemsBySection.set(typed.section_id, arr);
    }

    const sectionsWithItems: RoadmapSectionWithItems[] = (sections ?? []).map(
      (section) => ({
        ...section,
        items: itemsBySection.get(section.id) ?? [],
      }),
    );

    return {
      ...template,
      sections: sectionsWithItems,
    };
  },

  async createRoadmap(
    input: CreateRoadmapInput,
    createdBy: string,
  ): Promise<RoadmapTemplateRow> {
    const { data, error } = await supabase
      .from("roadmap_templates")
      .insert({
        agency_id: input.agency_id,
        title: input.title,
        description: input.description ?? null,
        icon: input.icon ?? null,
        imo_id: input.imo_id ?? null,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (error) throw new Error(`createRoadmap failed: ${error.message}`);
    return data;
  },

  async updateRoadmap(
    roadmapId: string,
    patch: UpdateRoadmapInput,
  ): Promise<RoadmapTemplateRow> {
    const { data, error } = await supabase
      .from("roadmap_templates")
      .update(patch)
      .eq("id", roadmapId)
      .select("*")
      .single();

    if (error) throw new Error(`updateRoadmap failed: ${error.message}`);
    return data;
  },

  async deleteRoadmap(roadmapId: string): Promise<void> {
    const { error } = await supabase
      .from("roadmap_templates")
      .delete()
      .eq("id", roadmapId);

    if (error) throw new Error(`deleteRoadmap failed: ${error.message}`);
  },

  async setDefaultRoadmap(roadmapId: string): Promise<void> {
    const { error } = await supabase.rpc("roadmap_set_default", {
      p_roadmap_id: roadmapId,
    });
    if (error) throw new Error(`setDefaultRoadmap failed: ${error.message}`);
  },

  // ==========================================================================
  // Sections
  // ==========================================================================

  async createSection(input: CreateSectionInput): Promise<RoadmapSectionRow> {
    // Compute next sort_order at the end of the roadmap
    const { data: existing, error: countErr } = await supabase
      .from("roadmap_sections")
      .select("sort_order")
      .eq("roadmap_id", input.roadmap_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (countErr)
      throw new Error(`createSection (count) failed: ${countErr.message}`);
    const nextOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    // agency_id is auto-populated by the roadmap_sections_inherit trigger
    const { data, error } = await supabase
      .from("roadmap_sections")
      .insert({
        roadmap_id: input.roadmap_id,
        title: input.title,
        description: input.description ?? null,
        sort_order: nextOrder,
        // agency_id will be set by trigger, but TypeScript requires a value.
        // We pass a placeholder that the trigger overrides.
        agency_id: "00000000-0000-0000-0000-000000000000",
      })
      .select("*")
      .single();

    if (error) throw new Error(`createSection failed: ${error.message}`);
    return data;
  },

  async updateSection(
    sectionId: string,
    patch: UpdateSectionInput,
  ): Promise<RoadmapSectionRow> {
    const { data, error } = await supabase
      .from("roadmap_sections")
      .update(patch)
      .eq("id", sectionId)
      .select("*")
      .single();

    if (error) throw new Error(`updateSection failed: ${error.message}`);
    return data;
  },

  async deleteSection(sectionId: string): Promise<void> {
    const { error } = await supabase
      .from("roadmap_sections")
      .delete()
      .eq("id", sectionId);

    if (error) throw new Error(`deleteSection failed: ${error.message}`);
  },

  async reorderSections(
    roadmapId: string,
    orderedIds: string[],
  ): Promise<void> {
    const { error } = await supabase.rpc("roadmap_reorder_sections", {
      p_roadmap_id: roadmapId,
      p_ordered_ids: orderedIds,
    });
    if (error) throw new Error(`reorderSections failed: ${error.message}`);
  },

  // ==========================================================================
  // Items
  // ==========================================================================

  async createItem(input: CreateItemInput): Promise<RoadmapItem> {
    const { data: existing, error: countErr } = await supabase
      .from("roadmap_items")
      .select("sort_order")
      .eq("section_id", input.section_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (countErr)
      throw new Error(`createItem (count) failed: ${countErr.message}`);
    const nextOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    // roadmap_id and agency_id are set by the roadmap_items_inherit trigger.
    const { data, error } = await supabase
      .from("roadmap_items")
      .insert({
        section_id: input.section_id,
        title: input.title,
        summary: input.summary ?? null,
        is_required: input.is_required ?? true,
        is_published: input.is_published ?? true,
        estimated_minutes: input.estimated_minutes ?? null,
        sort_order: nextOrder,
        content_blocks: [],
        // Placeholders — triggers will overwrite
        roadmap_id: "00000000-0000-0000-0000-000000000000",
        agency_id: "00000000-0000-0000-0000-000000000000",
      })
      .select("*")
      .single();

    if (error) throw new Error(`createItem failed: ${error.message}`);
    return rowToItem(data);
  },

  async updateItem(
    itemId: string,
    patch: UpdateItemInput,
  ): Promise<RoadmapItem> {
    // If content_blocks is being updated, validate it first
    const validatedPatch: Record<string, unknown> = { ...patch };
    if (patch.content_blocks !== undefined) {
      validatedPatch.content_blocks = validateContentBlocks(
        patch.content_blocks,
      );
    }

    const { data, error } = await supabase
      .from("roadmap_items")
      .update(validatedPatch)
      .eq("id", itemId)
      .select("*")
      .single();

    if (error) throw new Error(`updateItem failed: ${error.message}`);
    return rowToItem(data);
  },

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from("roadmap_items")
      .delete()
      .eq("id", itemId);
    if (error) throw new Error(`deleteItem failed: ${error.message}`);
  },

  async reorderItems(sectionId: string, orderedIds: string[]): Promise<void> {
    const { error } = await supabase.rpc("roadmap_reorder_items", {
      p_section_id: sectionId,
      p_ordered_ids: orderedIds,
    });
    if (error) throw new Error(`reorderItems failed: ${error.message}`);
  },

  async moveItem(
    itemId: string,
    targetSectionId: string,
    newIndex: number,
  ): Promise<void> {
    const { error } = await supabase.rpc("roadmap_move_item", {
      p_item_id: itemId,
      p_target_section_id: targetSectionId,
      p_new_index: newIndex,
    });
    if (error) throw new Error(`moveItem failed: ${error.message}`);
  },
};
