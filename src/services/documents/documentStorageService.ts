// src/services/documents/documentStorageService.ts
import { supabase } from "../base/supabase";
import type {
  DocumentCategory,
  InsuranceDocumentType,
} from "../../types/documents.types";
import { getCategoryForDocumentType } from "../../types/documents.types";

const STORAGE_BUCKET = "user-documents";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Service for handling document file storage operations
 *
 * Storage path structure: {userId}/{category}/{documentType}/{timestamp}_{sanitizedFilename}
 * Example: abc-123/licensing/resident_license/1703123456_state_license.pdf
 */
class DocumentStorageService {
  /**
   * Sanitize a filename for safe storage
   * Removes special characters, preserves extension
   */
  private sanitizeFileName(name: string): string {
    // Get the extension
    const lastDot = name.lastIndexOf(".");
    const extension = lastDot > 0 ? name.slice(lastDot) : "";
    const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

    // Sanitize the base name: replace non-alphanumeric with underscores, lowercase
    const sanitizedBase = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_") // Collapse multiple underscores
      .replace(/^_|_$/g, ""); // Trim leading/trailing underscores

    return `${sanitizedBase}${extension.toLowerCase()}`;
  }

  /**
   * Build the storage path for a document
   */
  buildStoragePath(
    userId: string,
    category: DocumentCategory,
    documentType: InsuranceDocumentType,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedName = this.sanitizeFileName(fileName);
    return `${userId}/${category}/${documentType}/${timestamp}_${sanitizedName}`;
  }

  /**
   * Upload a file to storage with category organization
   *
   * @param userId - The user's ID (first path segment for RLS)
   * @param documentType - The specific document type
   * @param file - The file to upload
   * @param category - Optional category override (auto-detected from documentType if not provided)
   */
  async upload(
    userId: string,
    documentType: InsuranceDocumentType | string,
    file: File,
    category?: DocumentCategory,
  ): Promise<{ storagePath: string }> {
    // Auto-detect category if not provided
    const resolvedCategory =
      category ||
      getCategoryForDocumentType(documentType as InsuranceDocumentType);

    const storagePath = this.buildStoragePath(
      userId,
      resolvedCategory,
      documentType as InsuranceDocumentType,
      file.name,
    );

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file);

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    return { storagePath };
  }

  /**
   * Upload with legacy signature for backward compatibility
   * @deprecated Use upload(userId, documentType, file, category) instead
   */
  async uploadLegacy(
    userId: string,
    documentType: string,
    file: File,
  ): Promise<{ storagePath: string }> {
    const fileName = `${Date.now()}_${file.name}`;
    const storagePath = `${userId}/${documentType}/${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file);

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    return { storagePath };
  }

  /**
   * Download a file from storage
   */
  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) {
      throw new Error(`Failed to download document: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a signed URL for a document
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
   * Delete a file from storage
   */
  async delete(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from storage
   */
  async deleteMany(storagePaths: string[]): Promise<void> {
    if (storagePaths.length === 0) return;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storagePaths);

    if (error) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Move a file to a different path
   */
  async move(fromPath: string, toPath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .move(fromPath, toPath);

    if (error) {
      throw new Error(`Failed to move document: ${error.message}`);
    }
  }

  /**
   * Copy a file to a different path
   */
  async copy(fromPath: string, toPath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .copy(fromPath, toPath);

    if (error) {
      throw new Error(`Failed to copy document: ${error.message}`);
    }
  }

  /**
   * List files in a user's folder
   */
  async listUserFiles(
    userId: string,
    category?: DocumentCategory,
    documentType?: InsuranceDocumentType,
  ): Promise<{ name: string; id: string }[]> {
    let path = userId;
    if (category) {
      path += `/${category}`;
      if (documentType) {
        path += `/${documentType}`;
      }
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(path);

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (data || []).filter(
      (f): f is typeof f & { id: string } => f.id !== null,
    );
  }
}

// Export singleton instance
export const documentStorageService = new DocumentStorageService();
export { DocumentStorageService };
