// src/features/underwriting/hooks/guides/useParseGuide.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { extractionGateway } from "@/services/document-extraction";
import type {
  ExtractionRequest,
  ExtractionFeatures,
} from "@/types/document-extraction.types";
import { guideQueryKeys } from "./useUnderwritingGuides";

export interface ParseGuideInput {
  guideId: string;
  storagePath: string;
  /** When true, routes to PaddleOCR adapter (tables + layout + OCR). */
  useOcr?: boolean;
}

export interface ParseGatewayResult {
  pageCount: number;
  sectionCount: number;
  characterCount: number;
  tableCount: number;
  durationMs: number;
  adapterUsed: string;
}

/**
 * Trigger PDF parsing for an underwriting guide via the extraction gateway.
 * Default: text-layer extraction. With useOcr: true, routes to PaddleOCR.
 */
export function useParseGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      guideId,
      storagePath,
      useOcr,
    }: ParseGuideInput): Promise<ParseGatewayResult> => {
      const features: ExtractionFeatures | undefined = useOcr
        ? { ocr: true, tables: true, layout: true }
        : undefined;

      const request: ExtractionRequest = {
        source: {
          type: "storage_path",
          bucket: "underwriting-guides",
          path: storagePath,
        },
        mode: "uw_guide",
        features,
        context: { guideId },
      };

      // Show progress toast — OCR on large guides can take several minutes
      const progressToast = toast.loading(
        "Parsing guide with OCR — this may take a few minutes for large documents...",
      );

      let result, adapterUsed, durationMs;
      try {
        ({ result, adapterUsed, durationMs } =
          await extractionGateway.extract(request));
      } finally {
        toast.dismiss(progressToast);
      }

      return {
        pageCount: result.metadata.pageCount,
        sectionCount: result.pages.length,
        characterCount: result.fullText.length,
        tableCount: result.tables.length,
        durationMs,
        adapterUsed,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
      const adapter = data.adapterUsed === "paddle-ocr" ? " (OCR)" : " (text)";
      const tables = data.tableCount > 0 ? `, ${data.tableCount} tables` : "";
      toast.success(
        `Guide parsed${adapter}: ${data.pageCount} pages, ${data.sectionCount} sections${tables}`,
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
