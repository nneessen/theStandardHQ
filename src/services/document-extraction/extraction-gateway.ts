// src/services/document-extraction/extraction-gateway.ts
// Central gateway routing extraction requests to the appropriate adapter.
// All consumers call the gateway — never an adapter directly.

import type { ExtractionRequest } from "../../types/document-extraction.types";
import type { ExtractionAdapter, GatewayResult } from "./core/types";
import { UwTextAdapter } from "./adapters/uw-text-adapter";
import { TrainingRailwayAdapter } from "./adapters/training-railway-adapter";

class ExtractionGateway {
  private adapters: ExtractionAdapter[] = [];

  constructor() {
    // Register adapters in priority order (first match wins)
    this.adapters = [new UwTextAdapter(), new TrainingRailwayAdapter()];
  }

  /** Register an additional adapter (e.g. PaddleOCR). */
  registerAdapter(adapter: ExtractionAdapter): void {
    this.adapters.unshift(adapter); // Higher priority than defaults
  }

  /** Route a request to the first matching adapter and return the result. */
  async extract(request: ExtractionRequest): Promise<GatewayResult> {
    const adapter = this.adapters.find((a) => a.canHandle(request));
    if (!adapter) {
      throw new Error(
        `[ExtractionGateway] No adapter found for mode="${request.mode}"`,
      );
    }

    console.log(
      `[ExtractionGateway] Routing mode="${request.mode}" → adapter="${adapter.name}"`,
    );

    const start = performance.now();
    const result = await adapter.extract(request);
    const durationMs = Math.round(performance.now() - start);

    console.log(
      `[ExtractionGateway] Completed in ${durationMs}ms — ${result.pages.length} pages, ${result.tables.length} tables, confidence=${result.confidence}`,
    );

    return { result, adapterUsed: adapter.name, durationMs };
  }
}

/** Singleton gateway instance. */
export const extractionGateway = new ExtractionGateway();
