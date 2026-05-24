// src/hooks/comps/index.ts

// TanStack Query hooks for compensation guide data fetching
export { useComps } from "./useComps";

// Mutation hooks for compensation operations
export { useCreateComp } from "./useCreateComp";
export { useUpdateComp } from "./useUpdateComp";
export { useDeleteComp } from "./useDeleteComp";

// New comp rates hooks
export {
  useCompRates,
  useCompRatesByProduct,
  useCompRatesByCarrier,
  useUpdateCompRate,
  useCreateCompRate,
  useDeleteCompRate,
  useBulkCreateCompRates,
  useBulkUpdateCompRates,
  compRatesKeys,
} from "./useCompRates";

// Contract-level commission lookup
export { useCompGuide } from "./useCompGuide";
