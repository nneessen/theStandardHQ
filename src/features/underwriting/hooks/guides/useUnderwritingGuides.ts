// src/features/underwriting/hooks/useUnderwritingGuides.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { guideStorageService } from "@/services/underwriting/repositories/guideStorageService";
import { toast } from "sonner";
import type { UnderwritingGuide } from "../../types/underwriting.types";

export const guideQueryKeys = {
  all: ["underwriting-guides"] as const,
  list: (imoId: string) => [...guideQueryKeys.all, "list", imoId] as const,
  detail: (id: string) => [...guideQueryKeys.all, "detail", id] as const,
  byCarrier: (imoId: string, carrierId: string) =>
    [...guideQueryKeys.all, "carrier", imoId, carrierId] as const,
};

interface GuideWithCarrier extends UnderwritingGuide {
  carrier?: {
    id: string;
    name: string;
  };
}

/**
 * Fetch all underwriting guides for the current IMO
 */
export function useUnderwritingGuides() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: guideQueryKeys.list(imoId || ""),
    queryFn: async (): Promise<GuideWithCarrier[]> => {
      if (!imoId) throw new Error("No IMO ID available");

      const { data, error } = await supabase
        .from("underwriting_guides")
        .select(
          `
          *,
          carrier:carriers(id, name)
        `,
        )
        .eq("imo_id", imoId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch guides: ${error.message}`);
      }

      return (data || []) as GuideWithCarrier[];
    },
    enabled: !!imoId,
  });
}

/**
 * Fetch a single guide by ID
 */
export function useUnderwritingGuide(id: string | undefined) {
  return useQuery({
    queryKey: guideQueryKeys.detail(id || ""),
    queryFn: async (): Promise<GuideWithCarrier | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("underwriting_guides")
        .select(
          `
          *,
          carrier:carriers(id, name)
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch guide: ${error.message}`);
      }

      return data as GuideWithCarrier;
    },
    enabled: !!id,
  });
}

interface UploadGuideInput {
  carrierId: string;
  name: string;
  file: File;
  version?: string;
  effectiveDate?: string;
  expirationDate?: string;
}

/**
 * Upload a new underwriting guide
 */
export function useUploadGuide() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UploadGuideInput): Promise<UnderwritingGuide> => {
      if (!user?.imo_id) throw new Error("No IMO ID available");
      if (!user?.id) throw new Error("No user ID available");

      // Validate file type
      if (input.file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed");
      }

      // Upload file to storage
      const { storagePath, fileSize } = await guideStorageService.upload(
        user.imo_id,
        input.carrierId,
        input.file,
      );

      // Create database record
      const { data, error } = await supabase
        .from("underwriting_guides")
        .insert({
          imo_id: user.imo_id,
          carrier_id: input.carrierId,
          name: input.name,
          file_name: input.file.name,
          storage_path: storagePath,
          file_size_bytes: fileSize,
          uploaded_by: user.id,
          version: input.version || null,
          effective_date: input.effectiveDate || null,
          expiration_date: input.expirationDate || null,
          parsing_status: "pending",
        })
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if database insert fails
        await guideStorageService.delete(storagePath).catch(console.error);
        throw new Error(`Failed to save guide: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
      toast.success("Guide uploaded successfully");
    },
    onError: (error) => {
      toast.error(`Failed to upload guide: ${error.message}`);
    },
  });
}

interface UpdateGuideInput {
  id: string;
  name?: string;
  version?: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
}

/**
 * Update an existing guide's metadata
 */
export function useUpdateGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateGuideInput): Promise<UnderwritingGuide> => {
      const { data, error } = await supabase
        .from("underwriting_guides")
        .update({
          name: input.name,
          version: input.version,
          effective_date: input.effectiveDate,
          expiration_date: input.expirationDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update guide: ${error.message}`);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
      queryClient.setQueryData(guideQueryKeys.detail(data.id), data);
      toast.success("Guide updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update guide: ${error.message}`);
    },
  });
}

/**
 * Delete a guide (storage + database)
 */
export function useDeleteGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guide: UnderwritingGuide): Promise<void> => {
      // Delete from storage first
      await guideStorageService.delete(guide.storage_path);

      // Then delete database record
      const { error } = await supabase
        .from("underwriting_guides")
        .delete()
        .eq("id", guide.id);

      if (error) {
        throw new Error(`Failed to delete guide: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
      toast.success("Guide deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete guide: ${error.message}`);
    },
  });
}

/**
 * Get a signed URL for viewing/downloading a guide
 */
export function useGuideSignedUrl(storagePath: string | undefined) {
  return useQuery({
    queryKey: ["guide-signed-url", storagePath],
    queryFn: async (): Promise<string | null> => {
      if (!storagePath) return null;
      return guideStorageService.getSignedUrl(storagePath);
    },
    enabled: !!storagePath,
    staleTime: 1000 * 60 * 30, // 30 minutes (URL valid for 1 hour)
  });
}
