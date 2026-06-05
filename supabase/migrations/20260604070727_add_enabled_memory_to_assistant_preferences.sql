-- supabase/migrations/20260604070727_add_enabled_memory_to_assistant_preferences.sql
-- Add enabled_memory to assistant_preferences: opt-in gate for Jarvis durable memory.
--
-- When true (the default), the orchestrator injects the user's jarvis_memory rows into
-- the system prompt and lets the saveMemory tool write. When false, neither happens.
-- Default ON because gating the headline "remembers you" feature off would make it inert
-- until toggled, and it is the user's own data. Purely additive — backfills every existing
-- row to true (NOT NULL DEFAULT), no behavior change for anything else.

ALTER TABLE public.assistant_preferences
  ADD COLUMN IF NOT EXISTS enabled_memory BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assistant_preferences.enabled_memory IS
  'Opt-in gate for Jarvis durable memory: when true, jarvis_memory rows are injected into the system prompt and saveMemory may write. Default true.';
