// src/services/underwriting/quickQuotePresetsService.ts
// Service for managing per-user Quick Quote preset configurations

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";

type Row = Database["public"]["Tables"]["user_quick_quote_presets"]["Row"];
type Insert =
  Database["public"]["Tables"]["user_quick_quote_presets"]["Insert"];

export type PresetTuple = [number, number, number];

export interface QuickQuotePresets {
  coveragePresets: PresetTuple[];
  budgetPresets: PresetTuple[];
}

/**
 * Transform database row to typed presets
 */
function transformRow(row: Row): QuickQuotePresets {
  return {
    coveragePresets: (row.coverage_presets as unknown as PresetTuple[]) ?? [],
    budgetPresets: (row.budget_presets as unknown as PresetTuple[]) ?? [],
  };
}

export const quickQuotePresetsService = {
  /**
   * Get a user's Quick Quote presets
   */
  async getPresets(userId: string): Promise<QuickQuotePresets | null> {
    const { data, error } = await supabase
      .from("user_quick_quote_presets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[quickQuotePresetsService] Error fetching presets:",
        error,
      );
      throw error;
    }

    return data ? transformRow(data) : null;
  },

  /**
   * Upsert a user's Quick Quote presets
   */
  async upsertPresets(
    userId: string,
    presets: Partial<QuickQuotePresets>,
  ): Promise<QuickQuotePresets> {
    const upsertData: Insert = {
      user_id: userId,
    };

    if (presets.coveragePresets !== undefined) {
      upsertData.coverage_presets =
        presets.coveragePresets as unknown as Insert["coverage_presets"];
    }
    if (presets.budgetPresets !== undefined) {
      upsertData.budget_presets =
        presets.budgetPresets as unknown as Insert["budget_presets"];
    }

    const { data, error } = await supabase
      .from("user_quick_quote_presets")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error(
        "[quickQuotePresetsService] Error upserting presets:",
        error,
      );
      throw error;
    }

    return transformRow(data);
  },
};
