// Shared character caps for AI-drafted marketing carousel copy (review #14).
//
// The server (supabase/functions/social-marketing-copy) is AUTHORITATIVE — it truncates a
// draft to these lengths. This module mirrors the same numbers for the editor `maxLength`
// attributes and the export stress harness, so the UI limit can't silently drift from what
// the server enforces. The Deno/Vite runtime split prevents a single literal shared import,
// so keep this in sync with the edge function's `CAPS`.
export const MARKETING_COPY_CAPS = {
  text: 140,
  attribution: 40,
  headline: 40,
  body: 160,
} as const;
