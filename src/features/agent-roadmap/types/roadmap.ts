// src/features/agent-roadmap/types/roadmap.ts
//
// Domain types for the Agent Roadmap feature.
// These wrap the raw database row types with typed content_blocks and
// convenient tree structures for the admin editor + agent runner.

import type { Database } from "@/types/database.types";
import type { RoadmapContentBlock } from "./contentBlocks";

// ============================================================================
// Raw row types (pulled directly from generated database.types.ts)
// ============================================================================

export type RoadmapTemplateRow =
  Database["public"]["Tables"]["roadmap_templates"]["Row"];
export type RoadmapTemplateInsert =
  Database["public"]["Tables"]["roadmap_templates"]["Insert"];
export type RoadmapTemplateUpdate =
  Database["public"]["Tables"]["roadmap_templates"]["Update"];

export type RoadmapSectionRow =
  Database["public"]["Tables"]["roadmap_sections"]["Row"];
export type RoadmapSectionInsert =
  Database["public"]["Tables"]["roadmap_sections"]["Insert"];
export type RoadmapSectionUpdate =
  Database["public"]["Tables"]["roadmap_sections"]["Update"];

export type RoadmapItemRow =
  Database["public"]["Tables"]["roadmap_items"]["Row"];
export type RoadmapItemInsert =
  Database["public"]["Tables"]["roadmap_items"]["Insert"];
export type RoadmapItemUpdate =
  Database["public"]["Tables"]["roadmap_items"]["Update"];

export type RoadmapItemProgressRow =
  Database["public"]["Tables"]["roadmap_item_progress"]["Row"];
export type RoadmapItemProgressInsert =
  Database["public"]["Tables"]["roadmap_item_progress"]["Insert"];
export type RoadmapItemProgressUpdate =
  Database["public"]["Tables"]["roadmap_item_progress"]["Update"];

export type RoadmapProgressStatus =
  Database["public"]["Enums"]["roadmap_progress_status"];

// ============================================================================
// Domain types with typed content_blocks
// ============================================================================

/**
 * RoadmapItem with content_blocks narrowed to the discriminated union type.
 * Use this when working with items in the UI layer — the raw row type has
 * content_blocks as `Json`, which is too loose for rendering.
 */
export interface RoadmapItem extends Omit<RoadmapItemRow, "content_blocks"> {
  content_blocks: RoadmapContentBlock[];
}

/**
 * Section with its items already loaded and sorted.
 * Produced by roadmapService.getRoadmapTree().
 */
export interface RoadmapSectionWithItems extends RoadmapSectionRow {
  items: RoadmapItem[];
}

/**
 * A full roadmap tree: template + sections + items, all ordered.
 * This is the shape the editor and runner both consume.
 */
export interface RoadmapTree extends RoadmapTemplateRow {
  sections: RoadmapSectionWithItems[];
}

/**
 * Per-user progress keyed by item_id. Used for the agent runner to look up
 * "what's my state on this item" without iterating the array every render.
 */
export type RoadmapProgressMap = Map<string, RoadmapItemProgressRow>;

// ============================================================================
// Input types for service mutations (narrower than the raw Insert type)
// ============================================================================

export interface CreateRoadmapInput {
  agency_id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  imo_id?: string | null;
}

export interface UpdateRoadmapInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  is_published?: boolean;
  sort_order?: number;
}

export interface CreateSectionInput {
  roadmap_id: string;
  title: string;
  description?: string | null;
}

export interface UpdateSectionInput {
  title?: string;
  description?: string | null;
}

export interface CreateItemInput {
  section_id: string;
  title: string;
  summary?: string | null;
  is_required?: boolean;
  is_published?: boolean;
  estimated_minutes?: number | null;
}

export interface UpdateItemInput {
  title?: string;
  summary?: string | null;
  content_blocks?: RoadmapContentBlock[];
  is_required?: boolean;
  is_published?: boolean;
  estimated_minutes?: number | null;
}

export interface UpsertProgressInput {
  item_id: string;
  status: RoadmapProgressStatus;
  notes?: string | null;
}

// ============================================================================
// Computed / derived types for the runner UI
// ============================================================================

export interface RoadmapCompletionStats {
  /** Required items that count toward completion */
  requiredTotal: number;
  /** Required items where status is 'completed' OR 'skipped' */
  requiredDone: number;
  /** 0–100 integer percent */
  percent: number;
  /** Non-required items total (shown as secondary metric) */
  optionalTotal: number;
  /** Non-required items completed or skipped */
  optionalDone: number;
}

/**
 * Team progress overview row — one per user in the agency for a given roadmap.
 * Used by the super-admin monitoring panel.
 */
export interface RoadmapTeamProgressRow {
  user_id: string;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  completed_count: number;
  in_progress_count: number;
  skipped_count: number;
  required_total: number;
  required_done: number;
  percent: number;
  last_activity_at: string | null;
}
