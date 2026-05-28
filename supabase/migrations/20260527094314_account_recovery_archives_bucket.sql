-- ============================================================================
-- Migration F — account-recovery-archives private bucket (DORMANT)
-- ============================================================================
-- Storage for the platform-sunset flow's two-stage archive:
--   snapshots/{user_id}/...  — the frozen export bundle, written by
--                              generate-user-export-bundle, kept until the wipe.
--   recovery/{user_id}/...   — a 30-day post-wipe copy, written by
--                              confirm-and-wipe-account; reaped by the day-30 GC
--                              in account-lifecycle-cron.
--
-- SERVICE-ROLE ONLY. The bucket is private and gets NO authenticated/anon
-- policies, so PostgREST/Storage denies every normal user by default (RLS on
-- storage.objects with no permissive policy = no access). The export/wipe edge
-- functions use the service-role client (bypasses RLS) to read/write, and hand
-- the user a short-lived signed URL to download — which needs no RLS grant.
--
-- This is intentionally NOT one of the three buckets the revocation storage gate
-- (Migration C) scopes, and it must never be granted to `authenticated`: a
-- revoked user must not reach another user's snapshot/recovery objects.
--
-- DORMANT: creating an empty bucket changes nothing until the edge functions
-- populate it. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-recovery-archives',
  'account-recovery-archives',
  false,
  1073741824, -- 1GB: full-account exports (xlsx + csv.zip + json) can be large
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policies for this bucket on purpose: service-role only.

COMMIT;
