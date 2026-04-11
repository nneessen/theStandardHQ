// src/features/agent-roadmap/constants.ts

/** Supabase Storage bucket holding roadmap images. Created in migration 20260411150238. */
export const ROADMAP_STORAGE_BUCKET = "roadmap-content";

/** Max content blocks per item. Enforced client-side only; DB has no limit. */
export const MAX_CONTENT_BLOCKS_PER_ITEM = 50;

/** Max content_blocks payload size in bytes. Large items slow down tree queries. */
export const MAX_CONTENT_BLOCKS_PAYLOAD_BYTES = 500_000;

/** Debounce delay for autosave fields (matches useDebouncedField default). */
export const AUTOSAVE_DEBOUNCE_MS = 500;
