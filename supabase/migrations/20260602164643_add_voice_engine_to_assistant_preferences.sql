-- Add voice_engine to assistant_preferences: selects the Jarvis voice transport.
--   'legacy'   = browser MediaRecorder + Whisper STT + MediaSource MP3 playback (current path)
--   'realtime' = LiveKit Agents worker (Deepgram STT + ElevenLabs TTS + server VAD + barge-in)
--
-- This is the parallel-run gate for M1 of the realtime voice rebuild: the realtime client is
-- shown only to users who opt in, so the typed path and the existing legacy voice path stay
-- intact during cutover. Backfills every existing row to 'legacy' (NOT NULL DEFAULT), so it is
-- purely additive — no behavior changes for anyone until they flip their own preference.
--
-- No CHECK constraint — enum values are enforced in TypeScript per project convention
-- ("No CHECK constraints on enums; enforce via TypeScript").

ALTER TABLE public.assistant_preferences
  ADD COLUMN IF NOT EXISTS voice_engine text NOT NULL DEFAULT 'legacy';

COMMENT ON COLUMN public.assistant_preferences.voice_engine IS
  'Jarvis voice transport: legacy (browser MediaRecorder+Whisper+MSE) | realtime (LiveKit worker). TS-enforced enum; no CHECK per project convention.';
