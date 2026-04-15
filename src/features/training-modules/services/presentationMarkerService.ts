// src/features/training-modules/services/presentationMarkerService.ts
import { supabase } from "@/services/base";
import type {
  PresentationMarker,
  PresentationMarkerInsert,
  PresentationMarkerUpdate,
} from "../types/presentation-marker.types";

const MARKER_SELECT = `
  *,
  creator:user_profiles!presentation_markers_created_by_fkey(
    id, first_name, last_name
  )
`;

export const presentationMarkerService = {
  async listBySubmission(submissionId: string): Promise<PresentationMarker[]> {
    const { data, error } = await supabase
      .from("presentation_markers")
      .select(MARKER_SELECT)
      .eq("submission_id", submissionId)
      .order("timestamp_seconds", { ascending: true });

    if (error) throw new Error(`Failed to load markers: ${error.message}`);
    return (data as PresentationMarker[]) || [];
  },

  async create(input: PresentationMarkerInsert): Promise<PresentationMarker> {
    const { data, error } = await supabase
      .from("presentation_markers")
      .insert(input)
      .select(MARKER_SELECT)
      .single();

    if (error) throw new Error(`Failed to create marker: ${error.message}`);
    return data as PresentationMarker;
  },

  async update(
    id: string,
    patch: PresentationMarkerUpdate,
  ): Promise<PresentationMarker> {
    const { data, error } = await supabase
      .from("presentation_markers")
      .update(patch)
      .eq("id", id)
      .select(MARKER_SELECT)
      .single();

    if (error) throw new Error(`Failed to update marker: ${error.message}`);
    return data as PresentationMarker;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("presentation_markers")
      .delete()
      .eq("id", id);

    if (error) throw new Error(`Failed to delete marker: ${error.message}`);
  },
};
