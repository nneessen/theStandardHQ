// src/features/underwriting/hooks/useUnderwritingGuides.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
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
  const { effectiveImoId } = useImo();
  // Read the SAME tenant the upload + carrier picker use (effectiveImoId), so a
  // super-admin acting in a non-home IMO sees and manages the IMO they're acting
  // in — not their home IMO. Mirrors useUploadGuide's writeImoId fallback, so the
  // list, the carrier picker, and the write target never disagree.
  const imoId = effectiveImoId ?? user?.imo_id;

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
  const { effectiveImoId } = useImo();

  return useMutation({
    mutationFn: async (input: UploadGuideInput): Promise<UnderwritingGuide> => {
      if (!user?.imo_id) throw new Error("No IMO ID available");
      if (!user?.id) throw new Error("No user ID available");

      // Validate file type
      if (input.file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed");
      }

      // Upload file to storage
      const writeImoId = effectiveImoId ?? user.imo_id;
      const { storagePath, fileSize } = await guideStorageService.upload(
        writeImoId,
        input.carrierId,
        input.file,
      );

      // Create database record
      const { data, error } = await supabase
        .from("underwriting_guides")
        .insert({
          imo_id: writeImoId,
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
 * Delete a guide (database row first, storage file as best-effort cleanup).
 *
 * Order matters: the DB delete cascades SET NULL onto rule_sets / criteria
 * referencing this guide and removes the row the user can see in the UI.
 * The storage delete is RLS-finicky on the `underwriting-guides` bucket
 * (the policy expression looks correct but the Storage HTTP API rejects
 * authenticated DELETEs from the browser with "new row violates RLS"),
 * so we treat it as best-effort: a failed storage cleanup leaves an orphan
 * PDF in S3 but the user can always remove the guide from the system.
 *
 * Orphan PDFs are tolerable; a delete button that doesn't delete is not.
 */
export function useDeleteGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guide: UnderwritingGuide): Promise<void> => {
      const { error } = await supabase
        .from("underwriting_guides")
        .delete()
        .eq("id", guide.id);

      if (error) {
        throw new Error(`Failed to delete guide: ${error.message}`);
      }

      try {
        await guideStorageService.delete(guide.storage_path);
      } catch (storageError) {
        console.warn(
          `[useDeleteGuide] Guide ${guide.id} removed from DB but storage cleanup failed (file orphaned, safe to ignore):`,
          storageError,
        );
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

/**
 * Open a guide PDF in a new tab via a freshly minted signed URL.
 *
 * The blank tab is opened synchronously inside the click gesture so the browser
 * doesn't block it as a pop-up; it is then redirected once the signed URL
 * resolves. Signed URLs are generated on demand (per click) rather than
 * pre-fetched for every guide, keeping the library list render fast.
 */
export async function openGuidePdf(storagePath: string): Promise<void> {
  const popup = window.open("", "_blank");
  if (!popup) {
    throw new Error(
      "Pop-up blocked. Allow pop-ups for this site, then click View again.",
    );
  }
  try {
    const url = await guideStorageService.getSignedUrl(storagePath);
    if (!url) {
      popup.close();
      throw new Error("Could not create a secure link for this PDF.");
    }
    popup.location.href = url;
  } catch (err) {
    popup.close();
    throw err;
  }
}
