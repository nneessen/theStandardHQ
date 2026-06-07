// Data layer for the guided recruiting-page wizard.
// Lives in a feature hook (the only place UI features may touch services /
// supabase per eslint boundaries). Provides: load branding, SILENT save (no
// toast — the wizard autosaves on each step, so it controls its own feedback),
// asset upload/delete, and the recruiter-slug save (with availability check).

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { brandingSettingsService } from "@/services/recruiting/brandingSettingsService";
import { supabase } from "@/services/base/supabase";
import type {
  RecruitingPageSettingsInput,
  RecruitingAssetType,
} from "@/types/recruiting-theme.types";

// Same cache key the settings branding query used, so reads stay coherent.
const BRANDING_QUERY_KEY = ["brandingSettings", "current"] as const;

export type SlugSaveResult = { ok: true } | { ok: false; error: string };

export function useRecruitingPageEditor() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: () => brandingSettingsService.getSettings(),
    staleTime: 5 * 60 * 1000,
  });

  // Silent upsert — updates the cache directly, never toasts.
  const saveBranding = useCallback(
    async (input: RecruitingPageSettingsInput) => {
      const saved = await brandingSettingsService.upsertSettings(input);
      queryClient.setQueryData(BRANDING_QUERY_KEY, saved);
      return saved;
    },
    [queryClient],
  );

  const uploadAsset = useCallback(
    (file: File, type: RecruitingAssetType) =>
      brandingSettingsService.uploadAsset(file, type),
    [],
  );

  const deleteAsset = useCallback(
    (url: string) => brandingSettingsService.deleteAsset(url),
    [],
  );

  // Reserve / change the recruiter slug on user_profiles. Returns a tagged
  // result so the wizard can show a friendly inline message.
  const saveSlug = useCallback(
    async (slug: string, userId: string): Promise<SlugSaveResult> => {
      if (!userId) return { ok: false, error: "You're not signed in." };
      const { data: existing, error: checkError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("recruiter_slug", slug)
        .neq("id", userId)
        .maybeSingle();
      if (checkError)
        return { ok: false, error: "Couldn't check that link. Try again." };
      if (existing)
        return {
          ok: false,
          error: "That link is already taken — try another.",
        };

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ recruiter_slug: slug })
        .eq("id", userId);
      if (updateError)
        return { ok: false, error: "Couldn't save your link. Try again." };

      await queryClient.invalidateQueries({ queryKey: ["recruiter-slug"] });
      return { ok: true };
    },
    [queryClient],
  );

  return {
    settings,
    isLoading,
    saveBranding,
    uploadAsset,
    deleteAsset,
    saveSlug,
  };
}
