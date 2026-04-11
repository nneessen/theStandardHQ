// src/features/agent-roadmap/services/roadmapStorage.ts
//
// Upload / delete images for roadmap content blocks.
// Bucket: roadmap-content (created in migration 20260411150238)
// Path pattern: {agencyId}/{roadmapId}/{itemId}/{uuid}-{filename}
//
// RLS enforces super-admin-only writes, so unauthorized uploads fail
// at the storage layer (not just in the UI).

import { supabase } from "@/services/base";
import { ROADMAP_STORAGE_BUCKET } from "../constants";

export interface UploadRoadmapImageInput {
  file: File;
  agencyId: string;
  roadmapId: string;
  itemId: string;
}

export interface UploadedImage {
  url: string;
  storagePath: string;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export const roadmapStorage = {
  /**
   * Upload an image to the roadmap-content bucket.
   * Returns the public URL + the storage path (store both on the block so we
   * can delete later).
   */
  async uploadImage({
    file,
    agencyId,
    roadmapId,
    itemId,
  }: UploadRoadmapImageInput): Promise<UploadedImage> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const uuid = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const storagePath = `${agencyId}/${roadmapId}/${itemId}/${uuid}-${safeName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(ROADMAP_STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(ROADMAP_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
    };
  },

  /**
   * Delete an image from the roadmap-content bucket.
   * Failures are logged but not thrown — orphaned storage is acceptable
   * per the feature plan (rarely-occurring, bounded by Nick being the sole
   * author). A future cleanup job can reap.
   */
  async deleteImage(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(ROADMAP_STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn(
        `[roadmapStorage] Failed to delete ${storagePath}:`,
        error.message,
      );
    }
  },
};
