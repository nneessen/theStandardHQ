// src/services/recruiting/brandingSettingsService.ts
// Service for managing recruiting page branding settings
// Security-hardened with URL validation and proper JSONB handling

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import type {
  RecruitingPageSettings,
  RecruitingPageSettingsInput,
  RecruitingAssetType,
} from "@/types/recruiting-theme.types";
import {
  RECRUITING_ASSETS_BUCKET,
  getAssetPath,
} from "@/types/recruiting-theme.types";
import {
  validateSettingsRow,
  validateBrandingInput,
  isValidSafeUrl,
  isValidHexColor,
} from "@/lib/recruiting-validation";

/**
 * Extract storage path from a Supabase storage URL
 * Uses URL API for robust parsing instead of string manipulation
 */
function extractStoragePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/");

    // Expected path: /storage/v1/object/public/recruiting-assets/{user_id}/...
    const bucketIndex = pathParts.findIndex(
      (p) => p === RECRUITING_ASSETS_BUCKET,
    );
    if (bucketIndex === -1 || bucketIndex >= pathParts.length - 1) {
      return null;
    }

    // Return everything after the bucket name
    return decodeURIComponent(pathParts.slice(bucketIndex + 1).join("/"));
  } catch {
    logger.warn("Failed to parse storage URL", "brandingSettingsService");
    return null;
  }
}

/**
 * Service for managing recruiting page branding settings
 */
export const brandingSettingsService = {
  /**
   * Get the current user's branding settings
   * Returns validated data with proper JSONB typing
   */
  async getSettings(): Promise<RecruitingPageSettings | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        logger.warn("No authenticated user", "brandingSettingsService");
        return null;
      }

      const { data, error } = await supabase
        .from("recruiting_page_settings")
        .select("*")
        .eq("user_id", user.user.id)
        .maybeSingle();

      if (error) {
        logger.error(
          "Failed to get branding settings",
          error,
          "brandingSettingsService",
        );
        throw error;
      }

      // Validate and return typed data
      return validateSettingsRow(data);
    } catch (error) {
      logger.error(
        "Error getting branding settings",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },

  /**
   * Create or update the current user's branding settings
   * Validates all input before saving
   */
  async upsertSettings(
    input: RecruitingPageSettingsInput,
  ): Promise<RecruitingPageSettings> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error("Not authenticated");
      }

      // Validate input before sending to database
      const validatedInput = validateBrandingInput(input);

      // Additional URL validation for safety
      const urlFields = [
        "calendly_url",
        "logo_light_url",
        "logo_dark_url",
        "hero_image_url",
        "headshot_url",
      ] as const;
      for (const field of urlFields) {
        const value = validatedInput[field];
        if (value && !isValidSafeUrl(value)) {
          throw new Error(
            `Invalid URL for ${field}: must use http:// or https://`,
          );
        }
      }

      // Validate social link URLs
      if (validatedInput.social_links) {
        const socialLinks = validatedInput.social_links;
        const knownKeys = [
          "facebook",
          "instagram",
          "twitter",
          "youtube",
        ] as const;
        for (const key of knownKeys) {
          const url = socialLinks[key];
          if (url && typeof url === "string" && !isValidSafeUrl(url)) {
            throw new Error(
              `Invalid URL for social link ${key}: must use http:// or https://`,
            );
          }
        }
      }

      // Validate color format
      if (
        validatedInput.primary_color &&
        !isValidHexColor(validatedInput.primary_color)
      ) {
        throw new Error("Invalid primary_color: must be in #RRGGBB format");
      }
      if (
        validatedInput.accent_color &&
        !isValidHexColor(validatedInput.accent_color)
      ) {
        throw new Error("Invalid accent_color: must be in #RRGGBB format");
      }

      // Get user's IMO for the required imo_id field
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("imo_id")
        .eq("id", user.user.id)
        .single();

      if (profileError || !profile?.imo_id) {
        throw new Error("User profile not found or missing IMO");
      }

      const { data, error } = await supabase
        .from("recruiting_page_settings")
        .upsert(
          {
            user_id: user.user.id,
            imo_id: profile.imo_id,
            ...validatedInput,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        )
        .select()
        .single();

      if (error) {
        logger.error(
          "Failed to upsert branding settings",
          error,
          "brandingSettingsService",
        );
        throw error;
      }

      // Validate returned data
      const validated = validateSettingsRow(data);
      if (!validated) {
        throw new Error("Invalid data returned from database");
      }

      return validated;
    } catch (error) {
      logger.error(
        "Error upserting branding settings",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },

  /**
   * Upload an asset (logo or hero image) to the recruiting-assets bucket
   * Returns the public URL of the uploaded file
   */
  async uploadAsset(file: File, type: RecruitingAssetType): Promise<string> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error("Not authenticated");
      }

      // Generate storage path: {user_id}/{type}_{timestamp}_{filename}
      const storagePath = getAssetPath(user.user.id, type, file.name);

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(RECRUITING_ASSETS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false, // Don't overwrite, use unique paths
        });

      if (uploadError) {
        logger.error(
          "Failed to upload asset",
          uploadError,
          "brandingSettingsService",
        );
        throw uploadError;
      }

      // Get public URL (bucket is public)
      const { data: urlData } = supabase.storage
        .from(RECRUITING_ASSETS_BUCKET)
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    } catch (error) {
      logger.error(
        "Error uploading asset",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },

  /**
   * Delete an asset from the recruiting-assets bucket
   * Uses robust URL parsing instead of string manipulation
   */
  async deleteAsset(url: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error("Not authenticated");
      }

      // Extract storage path using URL parsing
      const storagePath = extractStoragePathFromUrl(url);
      if (!storagePath) {
        logger.warn(
          "Could not extract storage path from URL",
          "brandingSettingsService",
        );
        return;
      }

      // Verify the path belongs to the current user (RLS also enforces this)
      if (!storagePath.startsWith(user.user.id)) {
        throw new Error("Cannot delete asset that doesn't belong to you");
      }

      const { error } = await supabase.storage
        .from(RECRUITING_ASSETS_BUCKET)
        .remove([storagePath]);

      if (error) {
        logger.error(
          "Failed to delete asset",
          error,
          "brandingSettingsService",
        );
        throw error;
      }
    } catch (error) {
      logger.error(
        "Error deleting asset",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },

  /**
   * Delete all assets for a user from the recruiting-assets bucket
   */
  async deleteAllUserAssets(userId: string): Promise<void> {
    try {
      // List all files in the user's folder
      const { data: files, error: listError } = await supabase.storage
        .from(RECRUITING_ASSETS_BUCKET)
        .list(userId);

      if (listError) {
        logger.error(
          "Failed to list user assets",
          listError,
          "brandingSettingsService",
        );
        throw listError;
      }

      if (!files || files.length === 0) {
        return; // No files to delete
      }

      // Build paths for deletion
      const filePaths = files.map((file) => `${userId}/${file.name}`);

      // Delete all files
      const { error: deleteError } = await supabase.storage
        .from(RECRUITING_ASSETS_BUCKET)
        .remove(filePaths);

      if (deleteError) {
        logger.error(
          "Failed to delete user assets",
          deleteError,
          "brandingSettingsService",
        );
        throw deleteError;
      }

      logger.info(
        `Deleted ${filePaths.length} assets for user ${userId}`,
        "brandingSettingsService",
      );
    } catch (error) {
      logger.error(
        "Error deleting all user assets",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },

  /**
   * Delete the current user's branding settings
   * Also cleans up all associated assets in storage
   */
  async deleteSettings(): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error("Not authenticated");
      }

      // First, delete all assets for this user
      await this.deleteAllUserAssets(user.user.id);

      // Then delete the settings row
      const { error } = await supabase
        .from("recruiting_page_settings")
        .delete()
        .eq("user_id", user.user.id);

      if (error) {
        logger.error(
          "Failed to delete branding settings",
          error,
          "brandingSettingsService",
        );
        throw error;
      }
    } catch (error) {
      logger.error(
        "Error deleting branding settings",
        error instanceof Error ? error : String(error),
        "brandingSettingsService",
      );
      throw error;
    }
  },
};

export default brandingSettingsService;
