// src/services/settings/call-types/CallTypeRepository.ts
import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";

type CallTypeRow = Database["public"]["Tables"]["kpi_call_types"]["Row"];
type CallTypeInsert = Database["public"]["Tables"]["kpi_call_types"]["Insert"];
type CallTypeUpdate = Database["public"]["Tables"]["kpi_call_types"]["Update"];

const TABLE = "kpi_call_types" as const;

export class CallTypeRepository {
  /**
   * Get all call types (including inactive) for an IMO, ordered by sort_order then name.
   */
  async getAllForImo(imoId: string): Promise<CallTypeRow[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("imo_id", imoId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /**
   * Get only active call types for an IMO, ordered by sort_order then name.
   */
  async getActiveForImo(imoId: string): Promise<CallTypeRow[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /**
   * Create a new call type.
   */
  async create(payload: CallTypeInsert): Promise<CallTypeRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No data returned from insert");
    return data;
  }

  /**
   * Update an existing call type by id.
   */
  async update(id: string, patch: CallTypeUpdate): Promise<CallTypeRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No data returned from update");
    return data;
  }

  /**
   * Delete a call type by id.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
