// src/services/analytics/index.ts

// Legacy service (to be refactored)
export { breakevenService } from "./breakevenService";

// New analytics services
export * from "./segmentationService";
export * from "./forecastService";
export * from "./attributionService";
export * from "./policyStatusService";

// Team analytics
export { teamAnalyticsService } from "./teamAnalyticsService";

// Lead vendor heat scoring
export * from "./leadVendorHeatService";
