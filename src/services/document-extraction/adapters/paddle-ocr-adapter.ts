// src/services/document-extraction/adapters/paddle-ocr-adapter.ts
// Adapter wrapping the PaddleOCR extraction service (PP-Structure).
// Normalizes the PaddleOCR response into the canonical ExtractionResult
// and persists it to the DB in the UwParsedContent format for downstream
// consumers (criteria extraction, AI analysis).

import { supabase } from "../../base/supabase";
import type {
  ExtractionRequest,
  ExtractionResult,
  CanonicalPage,
  CanonicalTable,
  CanonicalBlock,
  ExtractionWarning,
} from "../../../types/document-extraction.types";
import type { ExtractionAdapter } from "../core/types";

// ─── PaddleOCR service response types ─────────────────────────────────────────

interface PaddleBlock {
  block_id: string;
  type: "heading" | "paragraph" | "list" | "table";
  text: string;
  table_id?: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface PaddleTable {
  table_id: string;
  page_number: number;
  table_index: number;
  rows: number;
  cols: number;
  values: string[][];
  html: string;
  confidence: number;
  source_engine: string;
}

interface PaddlePage {
  page_number: number;
  width: number;
  height: number;
  text: string;
  blocks: PaddleBlock[];
  tables: PaddleTable[];
}

interface PaddleOcrResponse {
  document_id: string;
  page_count: number;
  pages: PaddlePage[];
  tables: PaddleTable[];
  processing_time_ms: number;
  engine_version: string;
}

/**
 * Legacy format expected by downstream edge functions
 * (extract-underwriting-criteria, underwriting-ai-analyze).
 */
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

// ─── Configuration ────────────────────────────────────────────────────────────

/** Proxied through Vite dev server + Vercel rewrite to avoid CORS. */
const EXTRACTOR_URL = "/api/paddle-ocr";

/** Default timeout (10 minutes — large guides with 50+ pages need time for OCR). */
const DEFAULT_TIMEOUT_MS = 600_000;

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class PaddleOcrAdapter implements ExtractionAdapter {
  readonly name = "paddle-ocr";

  /**
   * Handles uw_guide requests when OCR/table/layout features are explicitly
   * requested. Default (no features) goes to UwTextAdapter.
   */
  canHandle(request: ExtractionRequest): boolean {
    if (request.mode !== "uw_guide") return false;

    const f = request.features;
    if (!f) return false;

    return !!(f.ocr || f.tables || f.layout);
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const guideId = request.context?.guideId;

    // SECURITY + RACE GUARD: Atomically set parsing_status = "processing"
    // via UPDATE (not SELECT). This validates three things in one query:
    //   1. Guide exists (row found)
    //   2. User has write access (RLS UPDATE policy requires is_imo_admin())
    //   3. Guide is not already being parsed (neq "processing")
    // If count=0: guide is missing, user lacks admin rights, or it's already parsing.
    if (guideId) {
      const { count, error } = await supabase
        .from("underwriting_guides")
        .update(
          { parsing_status: "processing", parsing_error: null },
          { count: "exact" },
        )
        .eq("id", guideId)
        .neq("parsing_status", "processing");

      if (error) {
        throw new Error(
          `[PaddleOcrAdapter] Failed to acquire guide ${guideId}: ${error.message}`,
        );
      }

      if (count === 0) {
        throw new Error(
          `[PaddleOcrAdapter] Guide ${guideId} not found, not accessible (requires admin), or already being parsed`,
        );
      }
    }

    try {
      const result = await this.performExtraction(request);

      // Persist OCR results to DB in legacy format for downstream consumers
      if (guideId) {
        const persistError = await this.persistParsedContent(guideId, result);
        if (persistError) {
          result.warnings.push({
            code: "PERSISTENCE_FAILED",
            message: `Failed to persist parsed content to DB: ${persistError}`,
          });
        }
      }

      return result;
    } catch (err) {
      // Mark guide as failed
      if (guideId) {
        await this.updateGuideStatus(
          guideId,
          "failed",
          err instanceof Error ? err.message : "Unknown OCR error",
        );
      }
      throw err;
    }
  }

  /** Core extraction: download PDF → call OCR → normalize. */
  private async performExtraction(
    request: ExtractionRequest,
  ): Promise<ExtractionResult> {
    const file = await this.resolveFile(request);

    const formData = new FormData();
    formData.append("file", file);

    const timeoutMs = request.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Pass API key if configured (cost-control gate on Railway service)
    const headers: Record<string, string> = {};
    const apiKey = import.meta.env.VITE_PADDLEOCR_API_KEY;
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(EXTRACTOR_URL, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `[PaddleOcrAdapter] OCR service timed out after ${timeoutMs}ms`,
        );
      }
      throw new Error(
        `[PaddleOcrAdapter] OCR service unreachable: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown");
      throw new Error(
        `[PaddleOcrAdapter] OCR service error ${response.status}: ${text}`,
      );
    }

    const ocrResult: PaddleOcrResponse = await response.json();
    return this.normalize(ocrResult, request.context);
  }

  /** Resolve the PDF file from the request source. */
  private async resolveFile(request: ExtractionRequest): Promise<File | Blob> {
    const { source } = request;

    if (source.type === "file") {
      return source.file;
    }

    if (source.type === "storage_path") {
      const { data, error } = await supabase.storage
        .from(source.bucket)
        .download(source.path);
      if (error || !data) {
        throw new Error(
          `[PaddleOcrAdapter] Failed to download from storage: ${error?.message ?? "empty response"}`,
        );
      }
      return new File([data], source.path.split("/").pop() ?? "document.pdf", {
        type: "application/pdf",
      });
    }

    if (source.type === "signed_url") {
      const res = await fetch(source.url);
      if (!res.ok) {
        throw new Error(
          `[PaddleOcrAdapter] Failed to fetch signed URL: ${res.status}`,
        );
      }
      const blob = await res.blob();
      return new File([blob], "document.pdf", { type: "application/pdf" });
    }

    throw new Error(
      `[PaddleOcrAdapter] Unsupported source type: ${(source as { type: string }).type}`,
    );
  }

  // ─── DB persistence ───────────────────────────────────────────────────────

  /**
   * Convert canonical ExtractionResult to the UwParsedContent format
   * expected by extract-underwriting-criteria and underwriting-ai-analyze,
   * then write it to the DB.
   */
  private async persistParsedContent(
    guideId: string,
    result: ExtractionResult,
  ): Promise<string | null> {
    const parsedContent: UwParsedContent = {
      fullText: result.fullText,
      sections: result.pages.map((page) => ({
        pageNumber: page.pageNumber,
        content: page.text,
      })),
      pageCount: result.metadata.pageCount,
      extractedAt: result.extractedAt,
      metadata: {
        title: result.metadata.title,
        author: result.metadata.author,
      },
    };

    const { error } = await supabase
      .from("underwriting_guides")
      .update({
        parsed_content: JSON.stringify(parsedContent),
        parsing_status: "completed",
        parsing_error: null,
      })
      .eq("id", guideId);

    if (error) {
      console.error(
        `[PaddleOcrAdapter] Failed to persist parsed_content for guide ${guideId}:`,
        error.message,
      );
      // Don't throw — the extraction succeeded, persistence failure is non-fatal.
      // Return the error message so the caller can surface it as a warning.
      return error.message;
    }

    return null;
  }

  /** Update parsing_status (and optionally parsing_error) on the guide row. */
  private async updateGuideStatus(
    guideId: string,
    status: string,
    errorMsg?: string,
  ): Promise<void> {
    const update: Record<string, string | null> = {
      parsing_status: status,
      parsing_error: errorMsg ?? null,
    };

    const { error } = await supabase
      .from("underwriting_guides")
      .update(update)
      .eq("id", guideId);

    if (error) {
      console.error(
        `[PaddleOcrAdapter] Failed to update guide status to "${status}":`,
        error.message,
      );
    }
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  /** Convert PaddleOCR response → canonical ExtractionResult. */
  private normalize(
    raw: PaddleOcrResponse,
    context?: Record<string, string>,
  ): ExtractionResult {
    const warnings: ExtractionWarning[] = [];

    // Normalize tables
    const tables: CanonicalTable[] = raw.tables.map((t) => ({
      tableId: t.table_id,
      pageNumber: t.page_number,
      tableIndex: t.table_index,
      rows: t.rows,
      cols: t.cols,
      values: t.values,
      confidence: t.confidence,
      sourceEngine: t.source_engine,
    }));

    // Build canonical pages
    const pages: CanonicalPage[] = raw.pages.map((page) => {
      const blocks: CanonicalBlock[] = page.blocks.map((b) => ({
        blockId: b.block_id,
        type: b.type === "table" ? "table_ref" : b.type,
        text: b.text,
        tableId: b.table_id,
      }));

      const pageTables = tables.filter(
        (t) => t.pageNumber === page.page_number,
      );

      return {
        pageNumber: page.page_number,
        text: page.text,
        blocks,
        tables: pageTables,
        ocrUsed: true,
      };
    });

    // Assemble full text
    const fullText = pages.map((p) => p.text).join("\n\n");

    // Compute aggregate confidence
    const allConfidences = raw.pages.flatMap((p) =>
      p.blocks.map((b) => b.confidence),
    );
    const confidence =
      allConfidences.length > 0
        ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        : 0.5;

    // Warn about low-confidence pages
    for (const page of raw.pages) {
      const pageConf = page.blocks.length
        ? page.blocks.reduce((sum, b) => sum + b.confidence, 0) /
          page.blocks.length
        : 0;
      if (pageConf > 0 && pageConf < 0.5) {
        warnings.push({
          code: "LOW_OCR_CONFIDENCE",
          message: `Page ${page.page_number} has low OCR confidence (${(pageConf * 100).toFixed(0)}%)`,
          pageNumber: page.page_number,
        });
      }
    }

    // Warn about empty pages
    const emptyPages = raw.pages.filter(
      (p) => p.blocks.length === 0 || p.text.trim().length === 0,
    );
    if (emptyPages.length > 0) {
      warnings.push({
        code: "EMPTY_PAGES",
        message: `${emptyPages.length} page(s) produced no extractable content`,
      });
    }

    return {
      documentId: raw.document_id,
      extractor: {
        provider: "paddle-ocr",
        providerVersion: raw.engine_version,
        pipelineVersion: "1.0.0",
      },
      metadata: {
        pageCount: raw.page_count,
        sourceType: "scanned", // PaddleOCR always treats input as image
      },
      pages,
      fullText,
      tables,
      warnings,
      confidence,
      extractedAt: new Date().toISOString(),
      context,
    };
  }
}
