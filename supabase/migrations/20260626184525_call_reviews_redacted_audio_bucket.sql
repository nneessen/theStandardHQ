-- ============================================================================
-- Call Reviews — PII redaction, Phase 2: redacted-audio bucket + state
-- ============================================================================
-- Phase 1 detects spoken SSN/banking PII and records audio mute-spans. Phase 2
-- adds the destination for the MUTED audio (produced by the Railway ffmpeg
-- audio-worker) and the state to track that muting step:
--
--   call-recordings-redacted bucket — holds the muted copy. PRIVATE. Peers stream
--     THIS (never the raw audio), and only once the recording is approved.
--   redacted_storage_path   — in-bucket path of the muted file (byte-identical to
--                             storage.objects.name so the approved-gate join works).
--   audio_redacted_at       — when muting completed.
--   audio_redaction_status  — muting sub-step: pending|processing|done|failed
--                             (TS-enforced enum). Distinct from redaction_status
--                             (the overall lifecycle) so "muting failed" vs
--                             "ready to review" is observable. Phase 3 approve
--                             requires 'done'.
--   audio_redaction_error   — failure detail for a stuck/failed muting job.
--
-- The worker writes these back via service_role (bypasses RLS). Authenticated
-- users get SELECT only on the redacted bucket: owner/upline/admin always, peers
-- only when the parent recording is approved.
-- ============================================================================

BEGIN;

-- ── A. State columns ────────────────────────────────────────────────────────
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS redacted_storage_path  TEXT,
  ADD COLUMN IF NOT EXISTS audio_redacted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audio_redaction_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audio_redaction_error  TEXT;

-- ── B. Redacted-audio bucket (private) ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings-redacted',
  'call-recordings-redacted',
  false,
  524288000, -- 500 MB
  ARRAY['audio/mpeg','audio/mp3']  -- worker always re-encodes to mp3
)
ON CONFLICT (id) DO NOTHING;

-- ── C. Storage SELECT — owner / upline / IMO-admin (mirrors the raw bucket) ──
-- Reviewers (and the recording's people) can always stream the muted file. Path
-- convention matches the raw bucket: {agent_id}/yyyy/mm/redacted_ts_file.mp3, so
-- foldername[1] is the owning agent.
DROP POLICY IF EXISTS "call_recordings_redacted_owner_select" ON storage.objects;
CREATE POLICY "call_recordings_redacted_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings-redacted'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.kpi_admin_can_access_agent(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
      OR is_upline_of(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
    )
  );

-- ── D. Storage SELECT — IMO-wide, ONLY for approved recordings ──────────────
-- A peer in the same IMO can stream the muted file ONLY once the recording is
-- approved. Exact-match join: the row's redacted_storage_path must equal
-- storage.objects.name (in-bucket path) — Phase 2/worker guarantees this.
DROP POLICY IF EXISTS "call_recordings_redacted_imo_select" ON storage.objects;
CREATE POLICY "call_recordings_redacted_imo_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings-redacted'
    AND EXISTS (
      SELECT 1 FROM public.kpi_call_recordings r
      WHERE r.redacted_storage_path = storage.objects.name
        AND r.redaction_status = 'approved'
        AND public.kpi_same_imo_agent(r.agent_id)
    )
  );

-- ── E. Revocation deny (parity with the raw bucket) ─────────────────────────
DROP POLICY IF EXISTS "revocation_deny_call_recordings_redacted" ON storage.objects;
CREATE POLICY "revocation_deny_call_recordings_redacted"
  ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    bucket_id <> 'call-recordings-redacted'
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  )
  WITH CHECK (
    bucket_id <> 'call-recordings-redacted'
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  );

COMMIT;
