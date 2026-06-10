-- Widen is_epic_life_imo to recognize the LOCAL dev Epic Life row, not just prod.
--
-- WHY: is_epic_life_imo hardcodes the PRODUCTION Epic Life UUID
-- (89514211-f2bd-4440-9527-90a472c5e622). On the local dev database, Epic Life is
-- a separately-seeded row with a DIFFERENT id (2fd256e9-9abb-445e-b405-62436555648a),
-- so the gate returned false locally and every Epic Life feature gated on it
-- (Slack-dark behavior AND the new /call-reviews transcription pipeline) silently
-- misfired — transcribe-call-recording returned 403 for legitimate local uploads.
--
-- The prod UUID is unchanged; the local UUID matches NO row on prod, so this is a
-- harmless no-op there and a true parity fix locally. Identity semantics are
-- preserved: the function still answers "is this the Epic Life IMO?", correct in
-- both environments.

CREATE OR REPLACE FUNCTION public.is_epic_life_imo(p_imo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_imo_id IN (
    '89514211-f2bd-4440-9527-90a472c5e622'::uuid,  -- prod Epic Life
    '2fd256e9-9abb-445e-b405-62436555648a'::uuid   -- local dev Epic Life (no row on prod)
  );
$function$;

COMMENT ON FUNCTION public.is_epic_life_imo(uuid) IS
  'Returns true for the Epic Life IMO (prod 89514211… or local-dev 2fd256e9…). Epic Life is intentionally Slack-dark and is the only IMO with the /call-reviews transcription feature enabled. The local UUID matches no row on prod, so it is a no-op there.';

NOTIFY pgrst, 'reload schema';
