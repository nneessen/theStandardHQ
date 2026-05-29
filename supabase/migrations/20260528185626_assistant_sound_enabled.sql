-- supabase/migrations/20260528185626_assistant_sound_enabled.sql
-- Adds the sound_enabled preference for the Jarvis command center's procedural
-- audio cues (boot/send/response/tool-tick/approve/error). Default ON, per product
-- decision. Idempotent so it is safe to re-run on either DB.

ALTER TABLE assistant_preferences
  ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN assistant_preferences.sound_enabled IS
  'When true, the command center plays procedural Web Audio UI cues. Default true.';
