// src/features/kpi/hooks/useWordTracks.ts
// Query + mutation hooks for kpi_word_tracks (personal-owned, Phase 1).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { kpiKeys, useKpiIdentity } from "./kpiKeys";
import type {
  WordTrackInsert,
  WordTrackRow,
  WordTrackUpdate,
} from "../types/kpi.types";

// ─── Read: the current user's active word tracks ────────────────────────────

async function fetchWordTracks(ownerId: string): Promise<WordTrackRow[]> {
  const { data, error } = await supabase
    .from("kpi_word_tracks")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useWordTracks() {
  const { user } = useAuth();
  const ownerId = user?.id ?? "";

  return useQuery({
    queryKey: kpiKeys.wordTracks(ownerId),
    queryFn: () => fetchWordTracks(ownerId),
    enabled: !!ownerId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

// ─── Write: create or update a personal word track ──────────────────────────

export type WordTrackCreateInput = Omit<
  WordTrackInsert,
  "imo_id" | "owner_id" | "created_by"
>;

export function useUpsertWordTrack() {
  const queryClient = useQueryClient();
  const { userId, imoId } = useKpiIdentity();

  return useMutation({
    mutationFn: async (
      input:
        | { mode: "create"; values: WordTrackCreateInput }
        | { mode: "update"; id: string; values: WordTrackUpdate },
    ) => {
      if (input.mode === "update") {
        const { data, error } = await supabase
          .from("kpi_word_tracks")
          .update(input.values)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as WordTrackRow;
      }

      if (!userId || !imoId) {
        throw new Error("Your account is not linked to an IMO yet.");
      }
      const payload: WordTrackInsert = {
        ...input.values,
        imo_id: imoId,
        owner_id: userId,
        created_by: userId,
      };
      const { data, error } = await supabase
        .from("kpi_word_tracks")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as WordTrackRow;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.mode === "create" ? "Word track added" : "Word track updated",
      );
      queryClient.invalidateQueries({ queryKey: kpiKeys.all });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save word track",
      );
    },
  });
}

// ─── Delete: hard-delete a personal-owned word track ────────────────────────

export function useDeleteWordTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kpi_word_tracks")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      toast.success("Word track deleted");
      queryClient.invalidateQueries({ queryKey: kpiKeys.all });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete word track",
      );
    },
  });
}
