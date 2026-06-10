-- Drop the orphaned Slack enum types (final piece of the full Slack removal).
-- These enums (slack_connection_status, slack_message_status,
-- slack_notification_type) backed columns on the now-dropped Slack tables.
-- Verified on prod: NO remaining column uses any of them, so DROP TYPE without
-- CASCADE is safe (it would error rather than silently cascade if still in use).

BEGIN;

DROP TYPE IF EXISTS public.slack_connection_status;
DROP TYPE IF EXISTS public.slack_message_status;
DROP TYPE IF EXISTS public.slack_notification_type;

COMMIT;

-- Verification: zero Slack types should remain.
SELECT 'slack_types_left' AS check, count(*) AS n
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname ILIKE '%slack%';
