-- TCPA / CAN-SPAM compliance: shared suppression (do-not-contact) + consent infrastructure.
--
-- ONE shared system for BOTH SMS (TCPA STOP) and email (CAN-SPAM unsubscribe), per the
-- 2026-05-31 compliance gap assessment. send-sms and the marketing-email paths check the
-- suppression list BEFORE sending; inbound STOP and unsubscribe-link clicks ADD to it.
--
-- Design notes:
--   * Suppression is GLOBAL per (channel, contact_value) — over-suppress rather than
--     under-suppress (the safe failure mode for compliance). imo_id/user_id are informational.
--   * contact_value is stored NORMALIZED by the caller: E.164 for sms, lowercased for email.
--   * No CHECK constraints on the channel/reason/status "enums" (per project rule — enforce in TS).
--   * RPCs are SECURITY DEFINER with pinned search_path, granted to service_role only
--     (edge functions call them via the admin client). Tables get RLS for authenticated reads.

BEGIN;

-- ============================ TABLES ============================

CREATE TABLE IF NOT EXISTS public.communication_suppression (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL,                 -- 'sms' | 'email'
  contact_value text NOT NULL,                 -- E.164 phone (sms) or lowercased email (email)
  reason        text NOT NULL,                 -- 'stop' | 'unsubscribe' | 'manual' | 'bounce' | 'complaint'
  imo_id        uuid REFERENCES public.imos(id) ON DELETE SET NULL,
  user_id       uuid,                          -- who/what triggered it (optional)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One active suppression per channel+contact (global). Re-suppression upserts.
CREATE UNIQUE INDEX IF NOT EXISTS communication_suppression_channel_contact_key
  ON public.communication_suppression (channel, contact_value);

CREATE TABLE IF NOT EXISTS public.communication_consent (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL,                 -- 'sms' | 'email'
  contact_value text NOT NULL,                 -- normalized as above
  status        text NOT NULL DEFAULT 'opted_in',   -- 'opted_in' | 'opted_out' | 'unknown'
  source        text,                          -- how consent was obtained (application form, manual, import)
  consent_text  text,                          -- the exact language the contact agreed to
  consented_at  timestamptz,
  imo_id        uuid REFERENCES public.imos(id) ON DELETE SET NULL,
  user_id       uuid,
  ip_address    text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS communication_consent_channel_contact_key
  ON public.communication_consent (channel, contact_value);

-- ============================ RLS ============================
-- Tables hold compliance records; reads are allowed to authenticated users (so the app can
-- show "this contact opted out"), writes go ONLY through the SECURITY DEFINER RPCs below.

ALTER TABLE public.communication_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_consent     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_suppression_read ON public.communication_suppression;
CREATE POLICY communication_suppression_read ON public.communication_suppression
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS communication_consent_read ON public.communication_consent;
CREATE POLICY communication_consent_read ON public.communication_consent
  FOR SELECT TO authenticated USING (true);

-- (No INSERT/UPDATE/DELETE policies → only service_role / the SECURITY DEFINER RPCs can write.)

-- ============================ RPCs ============================

-- is_suppressed: the pre-send gate. Returns TRUE when a contact must NOT be messaged.
CREATE OR REPLACE FUNCTION public.is_suppressed(p_channel text, p_contact text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_suppression
    WHERE channel = p_channel AND contact_value = p_contact
  );
$function$;

-- add_suppression: STOP / unsubscribe / bounce / manual. Idempotent upsert.
CREATE OR REPLACE FUNCTION public.add_suppression(
  p_channel text,
  p_contact text,
  p_reason  text DEFAULT 'manual',
  p_imo_id  uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.communication_suppression (channel, contact_value, reason, imo_id, user_id, metadata)
  VALUES (p_channel, p_contact, p_reason, p_imo_id, p_user_id, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (channel, contact_value)
  DO UPDATE SET reason = EXCLUDED.reason,
                imo_id = COALESCE(EXCLUDED.imo_id, public.communication_suppression.imo_id),
                user_id = COALESCE(EXCLUDED.user_id, public.communication_suppression.user_id),
                metadata = public.communication_suppression.metadata || EXCLUDED.metadata;
  -- Mark consent opted_out too, if a consent row exists.
  UPDATE public.communication_consent
     SET status = 'opted_out', updated_at = now()
   WHERE channel = p_channel AND contact_value = p_contact;
END;
$function$;

-- remove_suppression: START / re-subscribe. Clears the do-not-contact entry.
CREATE OR REPLACE FUNCTION public.remove_suppression(p_channel text, p_contact text)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  DELETE FROM public.communication_suppression
  WHERE channel = p_channel AND contact_value = p_contact;
$function$;

-- record_consent: store proof of opt-in (idempotent upsert by channel+contact).
CREATE OR REPLACE FUNCTION public.record_consent(
  p_channel text,
  p_contact text,
  p_status  text DEFAULT 'opted_in',
  p_source  text DEFAULT NULL,
  p_consent_text text DEFAULT NULL,
  p_imo_id  uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.communication_consent
    (channel, contact_value, status, source, consent_text, consented_at, imo_id, user_id, ip_address, metadata)
  VALUES
    (p_channel, p_contact, p_status, p_source, p_consent_text, now(), p_imo_id, p_user_id, p_ip_address, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (channel, contact_value)
  DO UPDATE SET status = EXCLUDED.status,
                source = COALESCE(EXCLUDED.source, public.communication_consent.source),
                consent_text = COALESCE(EXCLUDED.consent_text, public.communication_consent.consent_text),
                consented_at = EXCLUDED.consented_at,
                updated_at = now();
END;
$function$;

-- Grants: edge functions call these via the service-role admin client only.
REVOKE ALL ON FUNCTION public.is_suppressed(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_suppressed(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.add_suppression(text, text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_suppression(text, text, text, uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.remove_suppression(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_suppression(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.record_consent(text, text, text, text, text, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consent(text, text, text, text, text, uuid, uuid, text, jsonb) TO service_role;

COMMIT;
