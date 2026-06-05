// src/services/subscription/subscriptionSettingsService.ts
// Service for managing subscription settings (temporary access configuration)

import { supabase } from "@/services/base";
import type { Database } from "@/types/database.types";

type SubscriptionSettingsRow =
  Database["public"]["Tables"]["subscription_settings"]["Row"];
type SubscriptionSettingsUpdate =
  Database["public"]["Tables"]["subscription_settings"]["Update"];

/**
 * Configuration for temporary access period
 */
export interface TemporaryAccessConfig {
  enabled: boolean;
  endDate: string; // ISO string
  excludedFeatures: string[];
  testEmails: string[];
}

/**
 * Full subscription settings with audit info
 */
export interface SubscriptionSettings extends TemporaryAccessConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Transform database row to SubscriptionSettings
 */
function transformFromDB(row: SubscriptionSettingsRow): SubscriptionSettings {
  return {
    id: row.id,
    enabled: row.temporary_access_enabled,
    endDate: row.temporary_access_end_date,
    excludedFeatures: row.temporary_access_excluded_features,
    testEmails: row.temporary_access_test_emails,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/**
 * Transform TemporaryAccessConfig to database update format
 */
function transformToDB(
  config: Partial<TemporaryAccessConfig>,
  updatedBy: string,
): SubscriptionSettingsUpdate {
  const update: SubscriptionSettingsUpdate = {
    updated_by: updatedBy,
  };

  if (config.enabled !== undefined) {
    update.temporary_access_enabled = config.enabled;
  }
  if (config.endDate !== undefined) {
    update.temporary_access_end_date = config.endDate;
  }
  if (config.excludedFeatures !== undefined) {
    update.temporary_access_excluded_features = config.excludedFeatures;
  }
  if (config.testEmails !== undefined) {
    update.temporary_access_test_emails = config.testEmails;
  }

  return update;
}

class SubscriptionSettingsService {
  /**
   * Get the current subscription settings
   * Returns null if no settings exist (should never happen after migration)
   */
  async getSettings(): Promise<SubscriptionSettings | null> {
    // Use maybeSingle() so an empty result returns { data: null } instead of a
    // 406 (PGRST116). A deactivated/sunset user can lose RLS read access to the
    // singleton row; that is an expected empty state, not a hard error.
    const { data, error } = await supabase
      .from("subscription_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching subscription settings:", error);
      throw new Error(
        `Failed to fetch subscription settings: ${error.message}`,
      );
    }

    if (!data) {
      return null;
    }

    return transformFromDB(data);
  }

  /**
   * Get just the temporary access configuration
   */
  async getTemporaryAccessConfig(): Promise<TemporaryAccessConfig | null> {
    const settings = await this.getSettings();
    if (!settings) return null;

    return {
      enabled: settings.enabled,
      endDate: settings.endDate,
      excludedFeatures: settings.excludedFeatures,
      testEmails: settings.testEmails,
    };
  }

  /**
   * Update temporary access configuration
   * Only super admins can update (enforced by RLS)
   */
  async updateTemporaryAccessConfig(
    config: Partial<TemporaryAccessConfig>,
    updatedBy: string,
  ): Promise<SubscriptionSettings> {
    // Validate end date if provided
    if (config.endDate) {
      const date = new Date(config.endDate);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid end date format");
      }
    }

    // Validate features if provided
    if (config.excludedFeatures) {
      if (!Array.isArray(config.excludedFeatures)) {
        throw new Error("excludedFeatures must be an array");
      }
    }

    // Validate test emails if provided
    if (config.testEmails) {
      if (!Array.isArray(config.testEmails)) {
        throw new Error("testEmails must be an array");
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of config.testEmails) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }
      }
    }

    const updateData = transformToDB(config, updatedBy);

    // First get the current settings to get the ID (singleton table)
    const { data: currentSettings, error: fetchError } = await supabase
      .from("subscription_settings")
      .select("id")
      .limit(1)
      .single();

    if (fetchError || !currentSettings) {
      console.error(
        "Error fetching subscription settings for update:",
        fetchError,
      );
      throw new Error("Failed to find subscription settings to update");
    }

    // Update the specific row by ID
    const { data, error } = await supabase
      .from("subscription_settings")
      .update(updateData)
      .eq("id", currentSettings.id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating subscription settings:", error);
      throw new Error(
        `Failed to update subscription settings: ${error.message}`,
      );
    }

    return transformFromDB(data);
  }

  /**
   * Check if temporary access should be granted for a feature
   * This is the synchronous version that takes pre-fetched config
   */
  shouldGrantTemporaryAccess(
    feature: string,
    userEmail: string | undefined | null,
    config: TemporaryAccessConfig,
  ): boolean {
    // If temporary access is disabled, no access
    if (!config.enabled) {
      return false;
    }

    // Test accounts never get temporary access (they see real tier gating)
    if (userEmail) {
      const normalizedEmail = userEmail.toLowerCase();
      const isTestAccount = config.testEmails.some(
        (email) => email.toLowerCase() === normalizedEmail,
      );
      if (isTestAccount) {
        return false;
      }
    }

    // Check if we're past the end date
    const now = new Date();
    const endDate = new Date(config.endDate);
    if (now >= endDate) {
      return false;
    }

    // Check if feature is excluded
    if (config.excludedFeatures.includes(feature)) {
      return false;
    }

    return true;
  }

  /**
   * Get days remaining until temporary access ends
   */
  getDaysRemaining(endDate: string): number {
    const now = new Date();
    const end = new Date(endDate);
    if (now >= end) return 0;

    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const subscriptionSettingsService = new SubscriptionSettingsService();
