-- Harden the public recruiting-lead submission RPC: (1) rate-limit submissions
-- to blunt automated flooding of a recruiting link, and (2) REQUIRE TCPA consent
-- proof instead of silently inserting a lead without it.
--
-- WHY:
--  * submit_recruiting_lead is anon-callable from the public join page. Today the
--    only throttle is a unique index on (email, recruiter_id, pending), which does
--    not stop a flood of distinct emails against one recruiter. We add a
--    per-recruiter (and, when available, per-IP) rate limit via the existing
--    check_rate_limit() bucket (migration 20260531161319).
--  * The consent recording block was conditional on a non-empty consent text, so a
--    stale/forged client could create a lead with NO TCPA proof. We now reject such
--    submissions up front — the legitimate form always sends the consent constants.
--
-- HOW: signature is UNCHANGED (same 22 params), so CREATE OR REPLACE preserves the
-- existing anon/authenticated/service_role grants. check_rate_limit is service_role
-- only, but this function is SECURITY DEFINER owned by postgres (a superuser), so the
-- inner call needs no extra grant (verified pg_proc.proowner = postgres).

CREATE OR REPLACE FUNCTION public.submit_recruiting_lead(
  p_recruiter_slug text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_state text,
  p_availability text,
  p_income_goals text DEFAULT NULL::text,
  p_why_interested text DEFAULT ''::text,
  p_insurance_experience text DEFAULT 'none'::text,
  p_utm_source text DEFAULT NULL::text,
  p_utm_medium text DEFAULT NULL::text,
  p_utm_campaign text DEFAULT NULL::text,
  p_referrer_url text DEFAULT NULL::text,
  p_ip_address inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text,
  p_is_licensed boolean DEFAULT false,
  p_current_imo_name text DEFAULT NULL::text,
  p_specialties text[] DEFAULT NULL::text[],
  p_tcpa_consent_text text DEFAULT NULL::text,
  p_tcpa_consent_version text DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_recruiter RECORD;
  v_lead_id UUID;
  v_existing_lead UUID;
  v_ip_text text := CASE WHEN p_ip_address IS NULL THEN NULL ELSE host(p_ip_address) END;
BEGIN
  -- Validate required fields
  IF p_first_name IS NULL OR trim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'First name is required');
  END IF;

  IF p_last_name IS NULL OR trim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Last name is required');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone is required');
  END IF;

  IF p_city IS NULL OR trim(p_city) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'City is required');
  END IF;

  IF p_state IS NULL OR trim(p_state) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'State is required');
  END IF;

  IF p_availability NOT IN ('full_time', 'part_time', 'exploring') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid availability value');
  END IF;

  IF p_insurance_experience NOT IN ('none', 'less_than_1_year', '1_to_3_years', '3_plus_years') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid insurance experience value');
  END IF;

  -- TCPA consent is now REQUIRED. Without verbatim text + a version we have no
  -- defensible proof, so we reject rather than store a consent-less lead.
  IF p_tcpa_consent_text IS NULL OR length(trim(p_tcpa_consent_text)) = 0
     OR p_tcpa_consent_version IS NULL OR length(trim(p_tcpa_consent_version)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Consent is required before submitting.');
  END IF;

  -- Find recruiter by slug. sunset: pull access_revoked_at so a revoked IMO's
  -- link reports "no longer active" (the existing neutral copy below).
  SELECT up.id, up.imo_id, up.agency_id, i.is_active AS imo_active, up.approval_status,
         (i.access_revoked_at IS NULL) AS imo_not_revoked
  INTO v_recruiter
  FROM user_profiles up
  JOIN imos i ON i.id = up.imo_id
  WHERE up.recruiter_slug = p_recruiter_slug
    AND up.recruiter_slug IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid recruiter link');
  END IF;

  -- Check if recruiter/IMO is active (and not sunset-revoked)
  IF NOT v_recruiter.imo_active OR NOT v_recruiter.imo_not_revoked OR v_recruiter.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This recruiting link is no longer active');
  END IF;

  -- Rate-limit valid submissions. Per-recruiter is the primary axis (the browser
  -- calls this RPC directly so p_ip_address is usually NULL); per-IP is a secondary
  -- guard when an IP is supplied. A blocked attempt returns a distinct flag so the
  -- client can show a "slow down" message rather than a generic error.
  IF NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:rcr:' || v_recruiter.id::text, 30, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions for this recruiter right now. Please try again later.');
  END IF;

  IF v_ip_text IS NOT NULL AND NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:ip:' || v_ip_text, 10, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions from your network right now. Please try again later.');
  END IF;

  -- Check for existing pending lead with same email for this recruiter
  SELECT id INTO v_existing_lead
  FROM recruiting_leads
  WHERE lower(email) = lower(trim(p_email))
    AND recruiter_id = v_recruiter.id
    AND status = 'pending';

  IF v_existing_lead IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending submission with this recruiter');
  END IF;

  -- Insert lead with new licensing fields
  INSERT INTO recruiting_leads (
    recruiter_id,
    imo_id,
    agency_id,
    first_name,
    last_name,
    email,
    phone,
    city,
    state,
    availability,
    income_goals,
    why_interested,
    insurance_experience,
    utm_source,
    utm_medium,
    utm_campaign,
    referrer_url,
    ip_address,
    user_agent,
    is_licensed,
    current_imo_name,
    specialties
  ) VALUES (
    v_recruiter.id,
    v_recruiter.imo_id,
    v_recruiter.agency_id,
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_phone),
    trim(p_city),
    upper(trim(p_state)),
    p_availability,
    p_income_goals,
    trim(p_why_interested),
    p_insurance_experience,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_referrer_url,
    p_ip_address,
    p_user_agent,
    COALESCE(p_is_licensed, false),
    CASE WHEN p_is_licensed = true THEN trim(p_current_imo_name) ELSE NULL END,
    CASE WHEN p_is_licensed = true THEN p_specialties ELSE NULL END
  )
  RETURNING id INTO v_lead_id;

  -- Record TCPA consent (verbatim, timestamped) for both phone (sms) and email
  -- channels, atomically with the lead. Consent presence is guaranteed by the
  -- required-field check above.
  PERFORM public.record_consent(
    'sms',
    trim(p_phone),
    'opted_in',
    'recruiting_lead_form',
    p_tcpa_consent_text,
    v_recruiter.imo_id,
    NULL,
    v_ip_text,
    jsonb_build_object(
      'lead_id', v_lead_id,
      'consent_version', p_tcpa_consent_version,
      'recruiter_id', v_recruiter.id
    )
  );

  PERFORM public.record_consent(
    'email',
    lower(trim(p_email)),
    'opted_in',
    'recruiting_lead_form',
    p_tcpa_consent_text,
    v_recruiter.imo_id,
    NULL,
    v_ip_text,
    jsonb_build_object(
      'lead_id', v_lead_id,
      'consent_version', p_tcpa_consent_version,
      'recruiter_id', v_recruiter.id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'message', 'Your interest has been submitted successfully'
  );
END;
$function$;
