-- ============================================================================
-- Part 4 — Revocation gate on PUBLIC / UNAUTHENTICATED surfaces (DORMANT)
-- ============================================================================
-- The deny-by-default RLS gate (Migration B) only binds the `authenticated`
-- role. Every public recruiting/registration surface resolves its IMO through
-- `anon`-callable SECURITY DEFINER RPCs (and two edge functions) that run as the
-- function owner and bypass RLS entirely — so a revoked IMO's funnel would stay
-- live to the outside world. `anon` has no direct read on `imos`, so the fix is
-- to add the `access_revoked_at IS NULL` predicate INSIDE each definer RPC,
-- where it already reads `imos` with elevated privileges.
--
-- Each function below is a FAITHFUL CREATE OR REPLACE of the live definition
-- (pulled via pg_get_functiondef) with ONE change: the revoked-IMO predicate.
-- A revoked IMO then behaves exactly like a non-existent / unlisted one — the
-- existing "Link Not Found" / generic-landing paths render, so there is NO new
-- copy and NO tell that the platform continues for anyone else.
--
-- Grants: CREATE OR REPLACE preserves existing grants, but each function re-issues
-- an idempotent GRANT EXECUTE ... TO anon as a guard against a future DROP+CREATE
-- silently dropping `anon` access (the runner tracks bodies, not grants).
--
-- SCOPE:
--   * Specific-IMO surfaces (real closure): get_public_recruiter_info,
--     get_public_recruiting_theme, submit_recruiting_lead,
--     get_public_invitation_by_token.
--   * Discovery surfaces (DEFENCE-IN-DEPTH only — FFG is is_listed=false so it
--     is already excluded): get_available_imos_for_join, get_agencies_for_join,
--     get_public_landing_page_settings.
-- The two edge functions (resolve-custom-domain, complete-recruit-registration)
-- are handled in their own files; complete-recruit-registration checks the
-- inviter's IMO BEFORE creating any auth user.
--
-- DORMANT: every predicate is `access_revoked_at IS NULL`, true for every IMO
-- until one is revoked -> zero behavior change.
-- ============================================================================

BEGIN;

-- ── 1. get_public_recruiter_info ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_recruiter_info(p_slug text)
  RETURNS TABLE(recruiter_id uuid, recruiter_first_name text, recruiter_last_name text, imo_name text, imo_logo_url text, imo_primary_color text, imo_description text, calendly_url text, is_active boolean)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS recruiter_id,
    up.first_name AS recruiter_first_name,
    up.last_name AS recruiter_last_name,
    i.name AS imo_name,
    i.logo_url AS imo_logo_url,
    i.primary_color AS imo_primary_color,
    i.description AS imo_description,
    (up.custom_permissions->>'calendly_url')::TEXT AS calendly_url,
    (i.is_active AND i.is_listed AND up.approval_status = 'approved') AS is_active
  FROM public.user_profiles up
  JOIN public.imos i ON i.id = up.imo_id
  WHERE up.recruiter_slug = p_slug
    AND up.recruiter_slug IS NOT NULL
    AND i.is_active = true
    AND i.is_listed = true
    AND i.access_revoked_at IS NULL;  -- sunset: hide revoked IMO's recruiter
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_recruiter_info(text) TO anon;

-- ── 2. get_public_recruiting_theme ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_recruiting_theme(p_slug text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_imo_id UUID;
  v_settings RECORD;
  v_imo RECORD;
  v_profile RECORD;
  v_calendly_url TEXT;
  v_result JSON;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RETURN NULL;
  END IF;

  SELECT id, imo_id, first_name, last_name, custom_permissions
  INTO v_profile
  FROM public.user_profiles
  WHERE recruiter_slug = lower(trim(p_slug))
    AND approval_status = 'approved';

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  v_user_id := v_profile.id;
  v_imo_id := v_profile.imo_id;
  v_calendly_url := v_profile.custom_permissions->>'calendly_url';

  SELECT * INTO v_settings
  FROM public.recruiting_page_settings
  WHERE user_id = v_user_id;

  SELECT
    name,
    logo_url,
    primary_color,
    secondary_color,
    description,
    is_active,
    is_listed,
    access_revoked_at          -- sunset: pull the revocation flag
  INTO v_imo
  FROM public.imos
  WHERE id = v_imo_id;

  -- sunset: a revoked IMO is treated exactly like an inactive/unlisted one.
  IF v_imo IS NULL OR NOT v_imo.is_active OR NOT v_imo.is_listed OR v_imo.access_revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  v_result := json_build_object(
    'recruiter_first_name', COALESCE(v_profile.first_name, ''),
    'recruiter_last_name', COALESCE(v_profile.last_name, ''),
    'layout_variant', COALESCE(v_settings.layout_variant, 'split-panel'),
    'logo_size', COALESCE(v_settings.logo_size, 'medium'),
    'display_name', COALESCE(v_settings.display_name, v_imo.name, 'Insurance Agency'),
    'headline', COALESCE(v_settings.headline, 'Join Our Team'),
    'subheadline', COALESCE(v_settings.subheadline, 'Build your career in insurance'),
    'about_text', v_settings.about_text,
    'primary_color', COALESCE(v_settings.primary_color, v_imo.primary_color, '#0ea5e9'),
    'accent_color', COALESCE(v_settings.accent_color, v_imo.secondary_color, '#22c55e'),
    'logo_light_url', COALESCE(v_settings.logo_light_url, v_imo.logo_url),
    'logo_dark_url', COALESCE(v_settings.logo_dark_url, v_imo.logo_url),
    'hero_image_url', v_settings.hero_image_url,
    'cta_text', COALESCE(v_settings.cta_text, 'Apply Now'),
    'calendly_url', COALESCE(v_settings.calendly_url, v_calendly_url),
    'support_phone', v_settings.support_phone,
    'social_links', COALESCE(v_settings.social_links, '{}'::jsonb),
    'disclaimer_text', v_settings.disclaimer_text,
    'enabled_features', COALESCE(v_settings.enabled_features, '{"show_stats": true, "collect_phone": true, "show_display_name": true}'::jsonb),
    'default_city', v_settings.default_city,
    'default_state', v_settings.default_state
  );

  RETURN v_result;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_recruiting_theme(text) TO anon;

-- ── 3. submit_recruiting_lead ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_recruiting_lead(p_recruiter_slug text, p_first_name text, p_last_name text, p_email text, p_phone text, p_city text, p_state text, p_availability text, p_income_goals text DEFAULT NULL::text, p_why_interested text DEFAULT ''::text, p_insurance_experience text DEFAULT 'none'::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_referrer_url text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_is_licensed boolean DEFAULT false, p_current_imo_name text DEFAULT NULL::text, p_specialties text[] DEFAULT NULL::text[])
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_recruiter RECORD;
  v_lead_id UUID;
  v_existing_lead UUID;
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

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'message', 'Your interest has been submitted successfully'
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.submit_recruiting_lead(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,inet,text,boolean,text,text[]) TO anon;

-- ── 4. get_public_invitation_by_token ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_invitation_by_token(p_token uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation recruit_invitations%ROWTYPE;
  v_inviter user_profiles%ROWTYPE;
  v_recruit user_profiles%ROWTYPE;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM recruit_invitations
  WHERE invite_token = p_token;

  IF v_invitation.id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'invitation_not_found', 'message', 'This invitation link is invalid or has been removed.');
  END IF;

  -- Check status
  IF v_invitation.status = 'cancelled' THEN
    RETURN json_build_object('valid', false, 'error', 'invitation_cancelled', 'message', 'This invitation has been cancelled.');
  END IF;

  IF v_invitation.status = 'completed' THEN
    RETURN json_build_object('valid', false, 'error', 'invitation_completed', 'message', 'This invitation has already been used.');
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    -- Update status to expired
    UPDATE recruit_invitations SET status = 'expired', updated_at = NOW() WHERE id = v_invitation.id;
    RETURN json_build_object('valid', false, 'error', 'invitation_expired', 'message', 'This invitation has expired. Please contact your recruiter for a new invitation.');
  END IF;

  -- Get inviter info
  SELECT * INTO v_inviter
  FROM user_profiles
  WHERE id = v_invitation.inviter_id;

  -- sunset: if the inviter's IMO is revoked, the link is dead. Return the same
  -- neutral "not found" as an invalid token (no tell). NULL imo_id (e.g. a
  -- super-admin inviter) is never revoked, so it falls through unaffected.
  IF v_inviter.imo_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM imos WHERE id = v_inviter.imo_id AND access_revoked_at IS NOT NULL
  ) THEN
    RETURN json_build_object('valid', false, 'error', 'invitation_not_found', 'message', 'This invitation link is invalid or has been removed.');
  END IF;

  -- Mark as viewed if not already
  IF v_invitation.viewed_at IS NULL THEN
    UPDATE recruit_invitations SET viewed_at = NOW(), status = 'viewed', updated_at = NOW() WHERE id = v_invitation.id;
  END IF;

  -- Get prefilled data (either from invite or from recruit if already created)
  IF v_invitation.recruit_id IS NOT NULL THEN
    -- Recruit already exists, use their data
    SELECT * INTO v_recruit
    FROM user_profiles
    WHERE id = v_invitation.recruit_id;

    RETURN json_build_object(
      'valid', true,
      'invitation_id', v_invitation.id,
      'recruit_id', v_invitation.recruit_id,
      'email', v_invitation.email,
      'message', v_invitation.message,
      'expires_at', v_invitation.expires_at,
      'inviter', json_build_object(
        'name', TRIM(COALESCE(v_inviter.first_name, '') || ' ' || COALESCE(v_inviter.last_name, '')),
        'email', v_inviter.email,
        'phone', v_inviter.phone
      ),
      'prefilled', json_build_object(
        'first_name', v_recruit.first_name,
        'last_name', v_recruit.last_name,
        'phone', v_recruit.phone,
        'city', v_recruit.city,
        'state', v_recruit.state
      )
    );
  ELSE
    -- Recruit not created yet, use invitation data
    RETURN json_build_object(
      'valid', true,
      'invitation_id', v_invitation.id,
      'recruit_id', NULL,
      'email', v_invitation.email,
      'message', v_invitation.message,
      'expires_at', v_invitation.expires_at,
      'inviter', json_build_object(
        'name', TRIM(COALESCE(v_inviter.first_name, '') || ' ' || COALESCE(v_inviter.last_name, '')),
        'email', v_inviter.email,
        'phone', v_inviter.phone
      ),
      'prefilled', json_build_object(
        'first_name', v_invitation.first_name,
        'last_name', v_invitation.last_name,
        'phone', v_invitation.phone,
        'city', v_invitation.city,
        'state', v_invitation.state
      )
    );
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_invitation_by_token(uuid) TO anon;

-- ── 5. get_available_imos_for_join (defence-in-depth) ───────────────────────
CREATE OR REPLACE FUNCTION public.get_available_imos_for_join()
  RETURNS TABLE(id uuid, name text, code text, description text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.code, i.description
  FROM public.imos i
  WHERE i.is_active = true
    AND i.is_listed = true
    AND i.access_revoked_at IS NULL  -- sunset (defence-in-depth; FFG is unlisted)
  ORDER BY i.name;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_available_imos_for_join() TO anon;

-- ── 6. get_agencies_for_join (defence-in-depth) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_agencies_for_join(p_imo_id uuid)
  RETURNS TABLE(id uuid, name text, code text, description text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT a.id, a.name, a.code, a.description
  FROM public.agencies a
  JOIN public.imos i
    ON i.id = a.imo_id
  WHERE a.imo_id = p_imo_id
    AND a.is_active = true
    AND i.is_active = true
    AND i.is_listed = true
    AND i.access_revoked_at IS NULL  -- sunset (defence-in-depth)
  ORDER BY a.name;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_agencies_for_join(uuid) TO anon;

-- ── 7. get_public_landing_page_settings (defence-in-depth) ──────────────────
CREATE OR REPLACE FUNCTION public.get_public_landing_page_settings(p_imo_id uuid DEFAULT NULL::uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_settings JSON;
  v_target_imo_id UUID;
BEGIN
  -- If no IMO ID provided, use the first active + listed IMO only.
  IF p_imo_id IS NULL THEN
    SELECT id
    INTO v_target_imo_id
    FROM public.imos
    WHERE is_active = true
      AND is_listed = true
      AND access_revoked_at IS NULL  -- sunset (defence-in-depth)
    ORDER BY created_at ASC
    LIMIT 1;
  ELSE
    -- Only allow public settings for active + listed (+ non-revoked) IMOs.
    SELECT id
    INTO v_target_imo_id
    FROM public.imos
    WHERE id = p_imo_id
      AND is_active = true
      AND is_listed = true
      AND access_revoked_at IS NULL  -- sunset (defence-in-depth)
    LIMIT 1;
  END IF;

  -- If the target IMO is not public, fall back to generic defaults.
  IF v_target_imo_id IS NOT NULL THEN
    SELECT row_to_json(lps.*)
    INTO v_settings
    FROM public.landing_page_settings lps
    WHERE lps.imo_id = v_target_imo_id;
  END IF;

  IF v_settings IS NULL THEN
    SELECT json_build_object(
      'hero_headline', 'Build Your Future',
      'hero_subheadline', 'Remote sales careers for the ambitious',
      'hero_cta_text', 'Start Your Journey',
      'hero_cta_link', '/join-the-standard',
      'stats_enabled', true,
      'stats_data', '[
        {"label": "Average First Year", "value": "75000", "prefix": "$", "suffix": "+"},
        {"label": "Team Members", "value": "150", "prefix": "", "suffix": "+"},
        {"label": "States Licensed", "value": "48", "prefix": "", "suffix": ""},
        {"label": "Remote Work", "value": "100", "prefix": "", "suffix": "%"}
      ]'::jsonb,
      'about_enabled', true,
      'about_headline', 'Who We Are',
      'gallery_enabled', true,
      'gallery_headline', 'Our People',
      'opportunity_enabled', true,
      'opportunity_headline', 'Your Path',
      'requirements_enabled', true,
      'requirements_headline', 'What It Takes',
      'tech_enabled', true,
      'tech_headline', 'Your Tools',
      'testimonials_enabled', true,
      'testimonials_headline', 'Real Stories',
      'faq_enabled', true,
      'faq_headline', 'Quick Answers',
      'final_cta_enabled', true,
      'final_cta_headline', 'Ready to Start?',
      'final_cta_text', 'Apply Now',
      'final_cta_link', '/join-the-standard',
      'primary_color', '#f59e0b',
      'secondary_color', '#18181b',
      'accent_color', '#6366f1',
      'login_access_type', 'easter_egg',
      'meta_title', 'The Standard - Remote Insurance Sales Careers',
      'section_order', '["hero", "stats", "about", "gallery", "opportunity", "requirements", "tech", "testimonials", "faq", "final_cta"]'::jsonb
    ) INTO v_settings;
  END IF;

  RETURN v_settings;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_landing_page_settings(uuid) TO anon;

COMMIT;
