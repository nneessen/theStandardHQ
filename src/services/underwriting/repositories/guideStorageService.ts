// src/services/underwriting/guideStorageService.ts

import { supabase } from "../../base/supabase";

const STORAGE_BUCKET = "underwriting-guides";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Service for handling underwriting guide file storage operations
 *
 * Storage path structure: {imoId}/{carrierId}/{timestamp}_{sanitizedFilename}
 * Example: abc-123/carrier-456/1703123456_prudential_guide_2024.pdf
 */
class GuideStorageService {
  /**
   * Sanitize a filename for safe storage
   */
  private sanitizeFileName(name: string): string {
    const lastDot = name.lastIndexOf(".");
    const extension = lastDot > 0 ? name.slice(lastDot) : "";
    const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

    const sanitizedBase = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    return `${sanitizedBase}${extension.toLowerCase()}`;
  }

  /**
   * Build the storage path for a guide
   */
  buildStoragePath(imoId: string, carrierId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedName = this.sanitizeFileName(fileName);
    return `${imoId}/${carrierId}/${timestamp}_${sanitizedName}`;
  }

  /**
   * Upload a guide PDF to storage
   */
  async upload(
    imoId: string,
    carrierId: string,
    file: File,
  ): Promise<{ storagePath: string; fileSize: number }> {
    const storagePath = this.buildStoragePath(imoId, carrierId, file.name);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (error) {
      throw new Error(`Failed to upload guide: ${error.message}`);
    }

    return { storagePath, fileSize: file.size };
  }

  /**
   * Download a guide from storage
   */
  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) {
      throw new Error(`Failed to download guide: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a signed URL for a guide
   */
  async getSignedUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error("Failed to create signed URL:", error);
      return null;
    }

    return data?.signedUrl || null;
  }

  /**
   * Delete a guide from storage
   */
  async delete(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Failed to delete guide: ${error.message}`);
    }
  }

  /**
   * Delete multiple guides from storage
   */
  async deleteMany(storagePaths: string[]): Promise<void> {
    if (storagePaths.length === 0) return;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storagePaths);

    if (error) {
      throw new Error(`Failed to delete guides: ${error.message}`);
    }
  }
}

// Export singleton instance
export const guideStorageService = new GuideStorageService();
export { GuideStorageService };
