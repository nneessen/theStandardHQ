-- Harden submit_recruiting_lead's IP + consent handling (code-review #2/#8/#9/#10).
--
--  #8  Per-IP rate-limit key was built from spoofable forwarded headers. Trust ONLY
--      cf-connecting-ip (set by Cloudflare on the normal path; the x-real-ip /
--      x-forwarded-for fallbacks are client-forgeable). Tighten the per-recruiter
--      backstop 100 -> 50/hr so the net throttle isn't weaker than before.
--  #9  The header-derived IP was stored verbatim as the legal TCPA consent IP. Only
--      use it once validated as a real inet (else NULL) — never an attacker string.
--  #10 The lead row's ip_address stayed NULL (it stored only the always-NULL
--      p_ip_address param). Persist the validated client IP.
--  #2  SMS consent was recorded with the raw phone, inconsistent with the E.164-keyed
--      suppression ledger. Normalize to E.164 (US-centric, matches send-sms) so
--      consent and suppression line up.

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
  v_hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  -- Only cf-connecting-ip is trustworthy (Cloudflare-set, not client-forgeable).
  v_ip_raw text := COALESCE(
    CASE WHEN p_ip_address IS NULL THEN NULL ELSE host(p_ip_address) END,
    nullif(trim(v_hdr ->> 'cf-connecting-ip'), '')
  );
  -- Validated inet (NULL if not a real address) — used for the lead row + consent.
  v_ip inet := CASE
    WHEN v_ip_raw IS NOT NULL AND v_ip_raw ~ '^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]+)$'
      THEN (CASE WHEN v_ip_raw::text <> '' THEN v_ip_raw::inet END)
    ELSE NULL
  END;
  v_ip_text text := CASE WHEN v_ip IS NULL THEN NULL ELSE host(v_ip) END;
  -- E.164-normalized phone (matches the suppression ledger); NULL if not coercible.
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_phone_e164 text := CASE
    WHEN trim(COALESCE(p_phone, '')) ~ '^\+' THEN regexp_replace(p_phone, '[^\d+]', '', 'g')
    WHEN length(v_digits) = 10 THEN '+1' || v_digits
    WHEN length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN '+' || v_digits
    ELSE NULL
  END;
BEGIN
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

  IF p_tcpa_consent_text IS NULL OR length(trim(p_tcpa_consent_text)) = 0
     OR p_tcpa_consent_version IS NULL OR length(trim(p_tcpa_consent_version)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Consent is required before submitting.');
  END IF;

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

  IF v_ip_text IS NOT NULL AND NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:ip:' || v_ip_text, 10, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions from your network right now. Please try again later.');
  END IF;

  IF NOT (SELECT allowed FROM public.check_rate_limit(
            'lead_submit:rcr:' || v_recruiter.id::text, 50, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'rate_limited', true,
      'error', 'Too many submissions for this recruiter right now. Please try again later.');
  END IF;

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
    p_utm_medium, p_utm_campaign, p_referrer_url, COALESCE(p_ip_address, v_ip), p_user_agent,
    COALESCE(p_is_licensed, false),
    CASE WHEN p_is_licensed = true THEN trim(p_current_imo_name) ELSE NULL END,
    CASE WHEN p_is_licensed = true THEN p_specialties ELSE NULL END
  )
  RETURNING id INTO v_lead_id;

  -- TCPA consent — keyed by E.164 phone (matches the suppression ledger) + validated IP.
  PERFORM public.record_consent(
    'sms', COALESCE(v_phone_e164, trim(p_phone)), 'opted_in', 'recruiting_lead_form',
    p_tcpa_consent_text, v_recruiter.imo_id, NULL, v_ip_text,
    jsonb_build_object('lead_id', v_lead_id, 'consent_version', p_tcpa_consent_version, 'recruiter_id', v_recruiter.id)
  );
  PERFORM public.record_consent(
    'email', lower(trim(p_email)), 'opted_in', 'recruiting_lead_form',
    p_tcpa_consent_text, v_recruiter.imo_id, NULL, v_ip_text,
    jsonb_build_object('lead_id', v_lead_id, 'consent_version', p_tcpa_consent_version, 'recruiter_id', v_recruiter.id)
  );

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id,
    'message', 'Your interest has been submitted successfully');
END;
$function$;
