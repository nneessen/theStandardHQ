// src/services/document-extraction/index.ts
// Barrel export for the document extraction service boundary.

export { extractionGateway } from "./extraction-gateway";
export { UwTextAdapter } from "./adapters/uw-text-adapter";
export { TrainingRailwayAdapter } from "./adapters/training-railway-adapter";
export type { ExtractionAdapter, GatewayResult } from "./core/types";
