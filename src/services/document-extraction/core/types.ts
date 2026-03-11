// src/services/document-extraction/core/types.ts
// Internal service types — adapter interface and routing config.

import type {
  ExtractionRequest,
  ExtractionResult,
} from "../../../types/document-extraction.types";

/** Every extraction adapter must implement this interface. */
export interface ExtractionAdapter {
  /** Human-readable adapter name (e.g. "uw-text-layer", "railway-ocr"). */
  readonly name: string;

  /** Returns true if this adapter can handle the given request. */
  canHandle(request: ExtractionRequest): boolean;

  /**
   * Execute extraction and return a canonical result.
   * Throws on unrecoverable errors.
   */
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
}

/** Result wrapper used by the gateway to add routing metadata. */
export interface GatewayResult {
  result: ExtractionResult;
  /** Which adapter handled the request. */
  adapterUsed: string;
  /** Total wall-clock time in ms. */
  durationMs: number;
}
