// src/features/call-reviews/hooks/useCallMarkers.ts
// Markers CRUD on kpi_call_markers. Reads are IMO-wide (collaborative training
// annotations); any IMO agent can add a marker; only the author or an IMO admin
// can edit/delete (enforced by RLS).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";
import type { CallMarkerRow, CallMarkerType } from "../types";

export interface MarkersData {
  markers: CallMarkerRow[];
  creatorNames: Record<string, string>;
}

async function fetchMarkers(recordingId: string): Promise<MarkersData> {
  const { data, error } = await supabase
    .from("kpi_call_markers")
    .select("*")
    .eq("recording_id", recordingId)
    .order("start_seconds", { ascending: true });
  if (error) throw new Error(error.message);
  const markers = (data ?? []) as CallMarkerRow[];

  const creatorIds = Array.from(new Set(markers.map((m) => m.created_by)));
  const creatorNames: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", creatorIds);
    for (const p of profiles ?? []) {
      const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
      creatorNames[p.id] = name || "Someone";
    }
  }
  return { markers, creatorNames };
}

export function useCallMarkers(recordingId: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.markers(recordingId ?? "none"),
    queryFn: () => fetchMarkers(recordingId as string),
    enabled: !!recordingId,
    staleTime: 30_000,
  });
}

export interface MarkerFormValues {
  start_seconds: number;
  end_seconds: number | null;
  label: string;
  note: string | null;
  marker_type: CallMarkerType;
}

export function useCreateMarker(recordingId: string) {
  const queryClient = useQueryClient();
  const { userId, imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (values: MarkerFormValues) => {
      if (!userId || !imoId)
        throw new Error("Your account is not linked to an IMO yet.");
      // imo_id is also derived from the parent recording by trigger; we supply it
      // to satisfy the NOT NULL column + the WITH CHECK (= get_my_imo_id()).
      const { data, error } = await supabase
        .from("kpi_call_markers")
        .insert({
          recording_id: recordingId,
          imo_id: imoId,
          created_by: userId,
          ...values,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as CallMarkerRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.markers(recordingId),
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to add marker"),
  });
}

export function useUpdateMarker(recordingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<MarkerFormValues>;
    }) => {
      const { error } = await supabase
        .from("kpi_call_markers")
        .update(patch)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.markers(recordingId),
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to update marker"),
  });
}

export function useDeleteMarker(recordingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kpi_call_markers")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.markers(recordingId),
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete marker"),
  });
}
