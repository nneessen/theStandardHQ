-- ============================================================================
-- Harden public IMO visibility for unlisted IMOs
-- ============================================================================
--
-- Goal:
--   `imos.is_listed = false` must mean the IMO is not discoverable through any
--   public or anonymous production surface.
--
-- Live prod leaks found during audit:
--   1. get_agencies_for_join(EpicId) returns Epic's agency name to anon/public.
--   2. get_public_recruiter_info(slug) and get_public_recruiting_theme(slug)
--      do not require the recruiter's IMO to be listed.
--   3. get_public_landing_page_settings(EpicId) accepts arbitrary IMO ids and
--      does not require active/listed IMOs.
--   4. landing_page_settings itself is publicly selectable via anon + a
--      USING (true) policy, which would expose any future Epic landing row.
--
-- Fix strategy:
--   - Public join/public branding RPCs require imo.is_active = true AND
--     imo.is_listed = true.
--   - Public landing defaults choose the first active+listed IMO only.
--   - Direct public table reads on landing_page_settings are removed; public
--     access must flow through the sanitized RPC only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- landing_page_settings table must not be directly public-readable
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "landing_page_settings_public_read"
  ON public.landing_page_settings;

REVOKE ALL ON TABLE public.landing_page_settings FROM anon;

-- ----------------------------------------------------------------------------
-- get_public_landing_page_settings(UUID)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_landing_page_settings(
  p_imo_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    ORDER BY created_at ASC
    LIMIT 1;
  ELSE
    -- Only allow public settings for active + listed IMOs.
    SELECT id
    INTO v_target_imo_id
    FROM public.imos
    WHERE id = p_imo_id
      AND is_active = true
      AND is_listed = true
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

GRANT EXECUTE ON FUNCTION public.get_public_landing_page_settings(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_landing_page_settings(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_agencies_for_join(UUID)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agencies_for_join(p_imo_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  ORDER BY a.name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_agencies_for_join(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_agencies_for_join(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_public_recruiter_info(TEXT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_recruiter_info(p_slug TEXT)
RETURNS TABLE(
  recruiter_id UUID,
  recruiter_first_name TEXT,
  recruiter_last_name TEXT,
  imo_name TEXT,
  imo_logo_url TEXT,
  imo_primary_color TEXT,
  imo_description TEXT,
  calendly_url TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    AND i.is_listed = true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_recruiter_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_recruiter_info(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_public_recruiting_theme(TEXT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_recruiting_theme(p_slug TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    is_listed
  INTO v_imo
  FROM public.imos
  WHERE id = v_imo_id;

  IF v_imo IS NULL OR NOT v_imo.is_active OR NOT v_imo.is_listed THEN
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

GRANT EXECUTE ON FUNCTION public.get_public_recruiting_theme(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_recruiting_theme(TEXT) TO authenticated;
