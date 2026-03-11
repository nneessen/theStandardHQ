// src/services/document-extraction/adapters/uw-text-adapter.ts
// Adapter wrapping the existing UW guide parser edge function.
// Normalizes the ParsedContent response into the canonical ExtractionResult.

import { supabase } from "../../base/supabase";
import type {
  ExtractionRequest,
  ExtractionResult,
  CanonicalPage,
  CanonicalBlock,
  ExtractionWarning,
} from "../../../types/document-extraction.types";
import type { ExtractionAdapter } from "../core/types";

/** Shape returned by the parse-underwriting-guide edge function. */
interface UwParsedContent {
  fullText: string;
  sections: { pageNumber: number; content: string }[];
  pageCount: number;
  extractedAt: string;
  metadata: {
    title?: string;
    author?: string;
  };
}

/** Shape returned by the edge function HTTP response. */
interface ParseEdgeFunctionResponse {
  success: boolean;
  guideId: string;
  pageCount: number;
  sectionCount: number;
  characterCount: number;
}

export class UwTextAdapter implements ExtractionAdapter {
  readonly name = "uw-text-layer";

  canHandle(request: ExtractionRequest): boolean {
    return request.mode === "uw_guide";
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    // The UW parser works via a two-step flow:
    // 1. Upload PDF to storage → create underwriting_guides row
    // 2. Invoke parse-underwriting-guide edge function with guideId
    //
    // This adapter handles step 2 only. The guide must already exist in the DB
    // with its storage_path populated. The guideId is passed via request.context.
    const guideId = request.context?.guideId;
    if (!guideId) {
      throw new Error(
        "[UwTextAdapter] Missing guideId in request.context — guide must be pre-uploaded",
      );
    }

    // Invoke the edge function
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "parse-underwriting-guide",
      { body: { guideId } },
    );

    if (fnError) {
      throw new Error(
        `[UwTextAdapter] Edge function error: ${fnError.message}`,
      );
    }

    const fnResponse = fnData as ParseEdgeFunctionResponse;
    if (!fnResponse.success) {
      throw new Error("[UwTextAdapter] Edge function returned success=false");
    }

    // Fetch the parsed content from the DB (the edge function writes it there)
    const { data: guide, error: dbError } = await supabase
      .from("underwriting_guides")
      .select("parsed_content, parsing_status, parsing_error")
      .eq("id", guideId)
      .single();

    if (dbError || !guide) {
      throw new Error(
        `[UwTextAdapter] Failed to fetch parsed guide: ${dbError?.message ?? "not found"}`,
      );
    }

    if (guide.parsing_status !== "completed" || !guide.parsed_content) {
      throw new Error(
        `[UwTextAdapter] Guide parsing not complete: status=${guide.parsing_status}, error=${guide.parsing_error}`,
      );
    }

    const parsed: UwParsedContent =
      typeof guide.parsed_content === "string"
        ? JSON.parse(guide.parsed_content)
        : guide.parsed_content;

    return this.normalize(parsed, guideId, request.context);
  }

  /** Convert UW ParsedContent → canonical ExtractionResult. */
  private normalize(
    parsed: UwParsedContent,
    guideId: string,
    context?: Record<string, string>,
  ): ExtractionResult {
    const warnings: ExtractionWarning[] = [];

    // Build canonical pages from sections
    const pages: CanonicalPage[] = parsed.sections.map((section) => {
      const blocks: CanonicalBlock[] = [
        {
          blockId: `p${section.pageNumber}-b0`,
          type: "paragraph",
          text: section.content,
        },
      ];

      return {
        pageNumber: section.pageNumber,
        text: section.content,
        blocks,
        tables: [], // UW text-layer parser does not extract tables
        ocrUsed: false,
      };
    });

    // Warn if content seems thin (likely scanned/image-heavy PDF)
    const avgCharsPerPage =
      parsed.fullText.length / Math.max(parsed.pageCount, 1);
    if (avgCharsPerPage < 100) {
      warnings.push({
        code: "LOW_TEXT_DENSITY",
        message: `Average ${Math.round(avgCharsPerPage)} chars/page — document may be scanned or image-heavy`,
      });
    }

    // Warn about missing table extraction
    warnings.push({
      code: "NO_TABLE_EXTRACTION",
      message:
        "UW text-layer parser does not extract tables — consider OCR adapter for table-heavy documents",
    });

    return {
      documentId: guideId,
      extractor: {
        provider: "uw-text-layer",
        providerVersion: "1.0.0",
        pipelineVersion: "1.0.0",
      },
      metadata: {
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        pageCount: parsed.pageCount,
        sourceType: "text_layer",
      },
      pages,
      fullText: parsed.fullText,
      tables: [],
      warnings,
      confidence:
        avgCharsPerPage >= 200 ? 0.8 : avgCharsPerPage >= 100 ? 0.5 : 0.2,
      extractedAt: parsed.extractedAt,
      context,
    };
  }
}
