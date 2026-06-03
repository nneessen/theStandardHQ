-- supabase/migrations/20260603121430_assistant_resolve_contact.sql
-- assistant_resolve_contact(name, channel): name -> masked contact candidates, for the
-- resolveContact Jarvis tool ("text Bob" -> which Bob?). Phase 2 PR 2.1.
--
-- SECURITY INVOKER on purpose: the SAME RLS that scopes clients/recruiting_leads/
-- user_profiles defines what the caller can resolve (own clients/downline/policy-linked,
-- own recruiting leads, own hierarchy/agency members) — mirrors assistant_recipient_is_allowed.
-- Returns only a MASKED value (never the raw phone/email) to the model. The recipient is
-- still HUMAN-entered + approved in the modal (draftSmsMessage is unchanged) — this is a
-- read/advisory lookup, so the anti-exfiltration guard from 20260528195232 stays intact.
--
-- Suppression (opt-outs) is NOT surfaced here: is_suppressed() is service_role-only and this
-- function is SECURITY INVOKER; the STOP/suppression gate is enforced at send time in send-sms.

CREATE OR REPLACE FUNCTION public.assistant_resolve_contact(
  p_name TEXT,
  p_channel TEXT
)
RETURNS TABLE (display_name TEXT, contact_kind TEXT, masked_value TEXT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pat TEXT;
BEGIN
  IF coalesce(trim(p_name), '') = '' OR p_channel NOT IN ('sms', 'email') THEN
    RETURN; -- empty set
  END IF;
  -- Strip LIKE wildcards from model input, then substring-match case-insensitively.
  v_pat := '%' || replace(replace(lower(trim(p_name)), '%', ''), '_', '') || '%';

  IF p_channel = 'sms' THEN
    RETURN QUERY
      SELECT c.name,
             'client'::TEXT,
             '***-' || right(regexp_replace(c.phone, '\D', '', 'g'), 4)
      FROM clients c
      WHERE c.phone IS NOT NULL AND c.phone <> '' AND lower(c.name) LIKE v_pat
      UNION ALL
      SELECT btrim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')),
             'recruiting_lead'::TEXT,
             '***-' || right(regexp_replace(r.phone, '\D', '', 'g'), 4)
      FROM recruiting_leads r
      WHERE r.phone IS NOT NULL AND r.phone <> ''
        AND lower(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')) LIKE v_pat
      UNION ALL
      SELECT btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
             'team_member'::TEXT,
             '***-' || right(regexp_replace(u.phone, '\D', '', 'g'), 4)
      FROM user_profiles u
      WHERE u.phone IS NOT NULL AND u.phone <> ''
        AND lower(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) LIKE v_pat
      LIMIT 10;
  ELSE -- email
    RETURN QUERY
      SELECT c.name,
             'client'::TEXT,
             left(c.email, 1) || '***@' || split_part(c.email, '@', 2)
      FROM clients c
      WHERE c.email IS NOT NULL AND c.email <> '' AND lower(c.name) LIKE v_pat
      UNION ALL
      SELECT btrim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')),
             'recruiting_lead'::TEXT,
             left(r.email, 1) || '***@' || split_part(r.email, '@', 2)
      FROM recruiting_leads r
      WHERE r.email IS NOT NULL AND r.email <> ''
        AND lower(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')) LIKE v_pat
      UNION ALL
      SELECT btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
             'team_member'::TEXT,
             left(u.email, 1) || '***@' || split_part(u.email, '@', 2)
      FROM user_profiles u
      WHERE u.email IS NOT NULL AND u.email <> ''
        AND lower(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) LIKE v_pat
      LIMIT 10;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_resolve_contact(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_resolve_contact(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.assistant_resolve_contact(TEXT, TEXT) IS 'Name -> masked contact candidates (display_name, contact_kind, masked_value) for the resolveContact tool. SECURITY INVOKER: RLS scopes the caller''s own clients/recruiting-leads/team. Never returns raw phone/email; recipient stays human-entered.';
