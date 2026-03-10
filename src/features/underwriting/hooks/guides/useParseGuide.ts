// src/features/underwriting/hooks/useParseGuide.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";
import { guideQueryKeys } from "./useUnderwritingGuides";

interface ParseGuideResult {
  success: boolean;
  guideId: string;
  pageCount: number;
  sectionCount: number;
  characterCount: number;
  elapsed: number;
}

interface ParseGuideError {
  success: false;
  error: string;
}

/**
 * Trigger PDF parsing for an underwriting guide
 * Calls the parse-underwriting-guide edge function
 */
export function useParseGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guideId: string): Promise<ParseGuideResult> => {
      const { data, error } = await supabase.functions.invoke<
        ParseGuideResult | ParseGuideError
      >("parse-underwriting-guide", {
        body: { guideId },
      });

      if (error) {
        throw new Error(`Failed to parse guide: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error((data as ParseGuideError)?.error || "Parsing failed");
      }

      return data as ParseGuideResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
      toast.success(
        `Guide parsed successfully: ${data.pageCount} pages, ${data.sectionCount} sections`,
      );
    },
    onError: (error) => {
      toast.error(`Failed to parse guide: ${error.message}`);
    },
  });
}

/**
 * Check if a guide has been parsed
 */
export function isGuideParsed(parsingStatus: string | null): boolean {
  return parsingStatus === "completed";
}

/**
 * Check if parsing is in progress
 */
export function isParsingInProgress(parsingStatus: string | null): boolean {
  return parsingStatus === "processing";
}

/**
 * Check if parsing failed
 */
export function hasParsingFailed(parsingStatus: string | null): boolean {
  return parsingStatus === "failed";
}
