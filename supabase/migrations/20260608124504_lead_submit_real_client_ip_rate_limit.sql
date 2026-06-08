-- Make the public lead-submit per-IP rate limit actually fire, and loosen the
-- per-recruiter cap so it stops rejecting legitimate prospects.
--
-- WHY: submit_recruiting_lead is called directly from the browser, so p_ip_address
-- is always NULL — the per-IP axis (lead_submit:ip:..., 10/hr) was dead code and the
-- only active throttle was a 30/hr GLOBAL ceiling per recruiter (a popular link would
-- reject real prospects). PostgREST exposes the request headers to the function via
-- current_setting('request.headers'), so we can derive the real client IP server-side
-- (Cloudflare cf-connecting-ip / x-real-ip / first x-forwarded-for) with NO new edge
-- function and NO frontend change. If the header is absent (e.g. called via psql), the
-- derivation is NULL and behavior is unchanged — harmless fallback.
--
-- HOW: CREATE OR REPLACE (signature unchanged → grants preserved). Derive v_ip_text
-- from p_ip_address OR the forwarded headers; raise the per-recruiter cap 30 -> 100/hr
-- now that the per-IP cap (10/hr) provides the real abuse protection.

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
  -- PostgREST request headers (NULL when not called through the REST gateway).
  v_hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  -- Prefer an explicitly-passed IP, else the real client IP from the edge headers.
  v_ip_text text := COALESCE(
    CASE WHEN p_ip_address IS NULL THEN NULL ELSE host(p_ip_address) END,
    nullif(trim(split_part(v_hdr ->> 'cf-connecting-ip', ',', 1)), ''),
    nullif(trim(split_part(v_hdr ->> 'x-real-ip', ',', 1)), ''),
    nullif(trim(split_part(v_hdr ->> 'x-forwarded-for', ',', 1)), '')
  );
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

  -- TCPA consent is REQUIRED.
  IF p_tcpa_consent_text IS NULL OR length(trim(p_tcpa_consent_text)) = 0
     OR p_tcpa_consent_version IS NULL OR length(trim(p_tcpa_consent_version)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Consent is required before submitting.');
  END IF;

  -- Find recruiter by slug (sunset-aware).
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

  IF NOT v_recruiter.imo_active OR NOT v_recruiter.imo_not_revoked OR v_recruiter.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This recruiting link is no longer active');
  END IF;

  -- Rate-limit. Per-IP is now the real abuse guard (the client IP is derived from
  -- the forwarded headers); per-recruiter is a generous backstop.
  IF v_ip_text IS NOT NULL AND NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:ip:' || v_ip_text, 10, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions from your network right now. Please try again later.');
  END IF;

  IF NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:rcr:' || v_recruiter.id::text, 100, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions for this recruiter right now. Please try again later.');
  END IF;

  -- Existing-pending dedup.
  SELECT id INTO v_existing_lead
  FROM recruiting_leads
  WHERE lower(email) = lower(trim(p_email))
    AND recruiter_id = v_recruiter.id
    AND status = 'pending';

  IF v_existing_lead IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending submission with this recruiter');
  END IF;

  INSERT INTO recruiting_leads (
    recruiter_id, imo_id, agency_id, first_name, last_name, email, phone, city, state,
    availability, income_goals, why_interested, insurance_experience, utm_source,
    utm_medium, utm_campaign, referrer_url, ip_address, user_agent, is_licensed,
    current_imo_name, specialties
  ) VALUES (
    v_recruiter.id, v_recruiter.imo_id, v_recruiter.agency_id, trim(p_first_name),
    trim(p_last_name), lower(trim(p_email)), trim(p_phone), trim(p_city), upper(trim(p_state)),
    p_availability, p_income_goals, trim(p_why_interested), p_insurance_experience, p_utm_source,
    p_utm_medium, p_utm_campaign, p_referrer_url, p_ip_address, p_user_agent,
    COALESCE(p_is_licensed, false),
    CASE WHEN p_is_licensed = true THEN trim(p_current_imo_name) ELSE NULL END,
    CASE WHEN p_is_licensed = true THEN p_specialties ELSE NULL END
  )
  RETURNING id INTO v_lead_id;

  -- Record TCPA consent verbatim (now with the derived client IP).
  PERFORM public.record_consent(
    'sms', trim(p_phone), 'opted_in', 'recruiting_lead_form', p_tcpa_consent_text,
    v_recruiter.imo_id, NULL, v_ip_text,
    jsonb_build_object('lead_id', v_lead_id, 'consent_version', p_tcpa_consent_version, 'recruiter_id', v_recruiter.id)
  );
  PERFORM public.record_consent(
    'email', lower(trim(p_email)), 'opted_in', 'recruiting_lead_form', p_tcpa_consent_text,
    v_recruiter.imo_id, NULL, v_ip_text,
    jsonb_build_object('lead_id', v_lead_id, 'consent_version', p_tcpa_consent_version, 'recruiter_id', v_recruiter.id)
  );

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id,
    'message', 'Your interest has been submitted successfully');
END;
$function$;
