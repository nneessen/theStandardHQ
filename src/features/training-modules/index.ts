// src/features/training-modules/index.ts

export type * from "./types/training-module.types";

// Hooks exposed for reuse by other features (cross-feature imports must go
// through this barrel, see eslint.config.js no-restricted-imports rule).
export { useDebouncedField } from "./hooks/useDebouncedField";
