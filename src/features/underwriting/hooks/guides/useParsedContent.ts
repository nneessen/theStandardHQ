// src/features/underwriting/hooks/guides/useParsedContent.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface ParsedSection {
  pageNumber: number;
  content: string;
}

export interface ParsedContent {
  fullText: string;
  sections: ParsedSection[];
  pageCount: number;
  extractedAt?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    tables?: Array<{ page: number; html: string }>;
  };
}

export interface ParsedContentStats {
  totalChars: number;
  totalWords: number;
  pageCount: number;
  avgWordsPerPage: number;
  lowDensityPages: number[];
}

function computeStats(content: ParsedContent): ParsedContentStats {
  const totalChars = content.fullText.length;
  const totalWords = content.fullText
    .split(/\s+/)
    .filter((w) => w.length > 1).length;
  const pageCount = content.pageCount || content.sections.length;
  const avgWordsPerPage =
    pageCount > 0 ? Math.round(totalWords / pageCount) : 0;

  const lowDensityThreshold = avgWordsPerPage * 0.3;
  const lowDensityPages = content.sections
    .filter((s) => {
      const words = s.content.split(/\s+/).filter((w) => w.length > 1).length;
      return words < lowDensityThreshold && words > 0;
    })
    .map((s) => s.pageNumber);

  return {
    totalChars,
    totalWords,
    pageCount,
    avgWordsPerPage,
    lowDensityPages,
  };
}

/**
 * Fetches parsed_content from underwriting_guides for a given guide.
 */
export function useParsedContent(guideId: string | null) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: ["underwriting-guides", "parsed-content", guideId],
    queryFn: async () => {
      if (!guideId || !imoId) throw new Error("Missing guideId or imoId");

      const { data, error } = await supabase
        .from("underwriting_guides")
        .select("parsed_content, parsing_status, name")
        .eq("id", guideId)
        .eq("imo_id", imoId)
        .single();

      if (error)
        throw new Error(`Failed to fetch parsed content: ${error.message}`);
      if (!data?.parsed_content) return null;

      const content: ParsedContent = JSON.parse(data.parsed_content);
      const stats = computeStats(content);

      return { content, stats, guideName: data.name };
    },
    enabled: !!guideId && !!imoId,
  });
}
