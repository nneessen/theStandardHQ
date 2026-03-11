// src/types/document-extraction.types.ts
// Canonical document extraction contract — shared across all extraction modes.
// Consumers depend on these types, never on provider-specific response shapes.

// ─────────────────────────────────────────────────────────────────────────────
// Request
// ─────────────────────────────────────────────────────────────────────────────

/** How the source document is provided to the extraction pipeline. */
export type ExtractionSource =
  | { type: "file"; file: File }
  | { type: "storage_path"; bucket: string; path: string }
  | { type: "signed_url"; url: string };

/** Processing mode — determines adapter routing and downstream schema. */
export type ExtractionMode = "uw_guide" | "training_module";

/** Feature flags controlling which extraction capabilities are requested. */
export interface ExtractionFeatures {
  text?: boolean;
  ocr?: boolean;
  layout?: boolean;
  tables?: boolean;
}

/** Optional extraction parameters. */
export interface ExtractionOptions {
  /** Restrict extraction to specific pages (1-indexed). */
  pageRange?: { start: number; end: number };
  /** Max processing time in ms before the extractor should abort. */
  timeoutMs?: number;
  /** Whether to fall back to a simpler extractor on failure. */
  fallbackOnError?: boolean;
}

/** Top-level extraction request. */
export interface ExtractionRequest {
  source: ExtractionSource;
  mode: ExtractionMode;
  features?: ExtractionFeatures;
  options?: ExtractionOptions;
  /** Contextual metadata passed through to the result (e.g. carrier_id). */
  context?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response
// ─────────────────────────────────────────────────────────────────────────────

/** Identity and version of the extractor that produced the result. */
export interface ExtractorInfo {
  provider: string;
  providerVersion: string;
  pipelineVersion: string;
}

/** Document-level metadata. */
export interface ExtractionMetadata {
  title?: string;
  author?: string;
  pageCount: number;
  sourceType: "text_layer" | "scanned" | "mixed" | "unknown";
}

/** A single detected table within a page. */
export interface CanonicalTable {
  tableId: string;
  pageNumber: number;
  tableIndex?: number;
  rows: number;
  cols: number;
  /** Raw cell values in row-major order. */
  values: string[][];
  confidence: number;
  sourceEngine: string;
}

/** A content block within a page (heading, paragraph, list, etc.). */
export interface CanonicalBlock {
  blockId: string;
  type: "heading" | "paragraph" | "list" | "table_ref" | "other";
  text: string;
  /** If type=table_ref, references a CanonicalTable.tableId. */
  tableId?: string;
}

/** Per-page extraction output. */
export interface CanonicalPage {
  pageNumber: number;
  text: string;
  blocks: CanonicalBlock[];
  tables: CanonicalTable[];
  ocrUsed: boolean;
}

/** Structured warning from the extraction pipeline. */
export interface ExtractionWarning {
  code: string;
  message: string;
  pageNumber?: number;
}

/** Canonical extraction result — the single contract all consumers depend on. */
export interface ExtractionResult {
  documentId: string;
  extractor: ExtractorInfo;
  metadata: ExtractionMetadata;
  pages: CanonicalPage[];
  fullText: string;
  tables: CanonicalTable[];
  warnings: ExtractionWarning[];
  /** Overall extraction confidence 0–1. */
  confidence: number;
  extractedAt: string;
  /** Pass-through context from the request. */
  context?: Record<string, string>;
}
