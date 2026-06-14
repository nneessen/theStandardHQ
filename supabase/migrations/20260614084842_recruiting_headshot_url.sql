-- Migration: recruiter headshot/portrait for recruiting landing pages
-- Adds headshot_url (text) to recruiting_page_settings and surfaces it through the
-- public theme RPC so the new layout shells can feature the recruiter's photo.
--
-- headshot_url is a recruiter-uploaded asset (recruiting-assets bucket). It is
-- NEVER authored by the AI design spec — it is rendered via encodeURI on the
-- public page. Nullable/additive; no CHECK constraints (enums enforced in TS).

-- 1. Column (additive, nullable).
ALTER TABLE public.recruiting_page_settings
  ADD COLUMN IF NOT EXISTS headshot_url text;

COMMENT ON COLUMN public.recruiting_page_settings.headshot_url IS
  'Recruiter portrait/headshot (recruiting-assets storage URL). Rendered via encodeURI on the public page. Never AI-authored.';

-- 2. Re-issue get_public_recruiting_theme — body copied verbatim from
--    20260607074904_recruiting_design_spec.sql (ALL sunset gates intact),
--    adding ONE key to the returned JSON: headshot_url. New filename timestamp
--    (20260614...) > 20260607074904 so the runner classifies this as an upgrade.
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
    'headshot_url', v_settings.headshot_url,   -- NEW: recruiter portrait, user-only
    'cta_text', COALESCE(v_settings.cta_text, 'Apply Now'),
    'calendly_url', COALESCE(v_settings.calendly_url, v_calendly_url),
    'support_phone', v_settings.support_phone,
    'social_links', COALESCE(v_settings.social_links, '{}'::jsonb),
    'disclaimer_text', v_settings.disclaimer_text,
    'enabled_features', COALESCE(v_settings.enabled_features, '{"show_stats": true, "collect_phone": true, "show_display_name": true}'::jsonb),
    'default_city', v_settings.default_city,
    'default_state', v_settings.default_state,
    'design_spec', v_settings.design_spec   -- user-only; NULL signals legacy fallback
  );

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_recruiting_theme(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_recruiting_theme(text) TO authenticated;
