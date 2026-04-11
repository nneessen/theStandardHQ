// src/features/agent-roadmap/services/roadmapStorage.ts
//
// Upload / delete images for roadmap content blocks.
// Bucket: roadmap-content (created in migration 20260411150238)
// Path pattern: {agencyId}/{roadmapId}/{itemId}/{uuid}-{filename}
//
// Three layers of defense against malicious uploads:
//   1. Client-side whitelist of extensions + MIME types + size (this file)
//   2. Supabase Storage bucket allowed_mime_types enforcement
//   3. RLS policy requiring is_super_admin() for INSERT
// Any one layer rejects the upload. Don't rely on just the bucket.

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

/** 10 MB — matches the bucket's file_size_limit in the migration */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Accepted extensions for image blocks. Kept in sync with the bucket's
 *  allowed_mime_types (see 20260411150238_agent_roadmap_rls.sql). */
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
]);

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

/** Strip unsafe characters, collapse separators, enforce a max length.
 *  Exported for unit testing — see roadmapStorage.test.ts. */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Extract the final extension from a filename, rejecting anything that isn't
 *  in the allowed set. Exported for testing. */
export function extractAllowedExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  const ext = parts[parts.length - 1];
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `File type ".${ext ?? ""}" is not supported. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
    );
  }
  return ext;
}

export const roadmapStorage = {
  /**
   * Upload an image to the roadmap-content bucket.
   * Validates client-side before hitting the network so the user gets a
   * fast, specific error instead of a generic storage-layer failure.
   */
  async uploadImage({
    file,
    agencyId,
    roadmapId,
    itemId,
  }: UploadRoadmapImageInput): Promise<UploadedImage> {
    // 1. Size check — fail fast before allocating the upload
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      );
    }

    // 2. MIME type — must be an image (also protects against double-extension
    //    renames like payload.html.png where the browser reports the real type)
    if (!file.type.startsWith("image/") || !ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(
        `File type "${file.type || "unknown"}" is not a supported image format.`,
      );
    }

    // 3. Extension — must be whitelisted. This catches cases where the MIME
    //    check above is bypassed (e.g., empty file.type) AND prevents the
    //    storage path from ending in something non-image-looking.
    const ext = extractAllowedExtension(file.name);

    const uuid = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const storagePath = `${agencyId}/${roadmapId}/${itemId}/${uuid}-${safeName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(ROADMAP_STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
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
