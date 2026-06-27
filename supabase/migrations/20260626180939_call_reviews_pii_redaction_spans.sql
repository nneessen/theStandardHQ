-- ============================================================================
-- Call Reviews — PII redaction, Phase 1: detection output columns
-- ============================================================================
-- Phase 0 added redaction_status and locked sharing. Phase 1 adds AI/regex PII
-- detection inside transcribe-call-recording: it redacts the transcript text in
-- place and records the audio time-spans to mute later (Phase 2 ffmpeg worker).
--
--   redaction_spans   — JSONB array of { start, end, type } seconds-based ranges
--                       of spoken PII to MUTE in the audio. Built best-effort
--                       from Deepgram word timings; the human review (Phase 3)
--                       can adjust before approval. NULL until detection runs.
--   redaction_detector— which detectors actually ran, so the reviewer knows how
--                       much to trust the auto-redaction:
--                       'claude+regex' | 'regex_only' | 'none' | 'failed'.
--                       ('regex_only' = the Claude verification pass was
--                       unavailable, e.g. AI rate-limited or Anthropic down →
--                       review more carefully.)
--
-- Both nullable/additive. No CHECK on the detector enum (enforced in TS).
-- ============================================================================

ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS redaction_spans    JSONB,
  ADD COLUMN IF NOT EXISTS redaction_detector TEXT;
