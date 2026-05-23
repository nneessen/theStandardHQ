-- =============================================================================
-- Apply assert_in_acting_scope guards to admin/scheduling SECURITY DEFINER RPCs
-- =============================================================================
--
-- Same defensive pattern as 20260523074917. These RPCs accept a target user
-- parameter and mutate that user's data. When super-admin Nick is acting as
-- Epic, he should not be able to mutate Founders users by crafting a direct
-- API call. RLS-filtered lists already prevent UI access to cross-IMO rows,
-- but direct API calls bypass that. This adds the guard at the RPC layer.
--
-- RPCs patched:
--   admin_set_admin_role(target_user_id, …)         — admin mgmt
--   admin_delete_domain(p_domain_id, p_user_id)     — domain mgmt
--   admin_update_domain_status(p_domain_id, p_user_id, …) — domain mgmt
--   hard_delete_user(p_user_id, …)                  — permanent deletion
--
-- Plus: create_scheduled_report — uses caller's real imo_id for the row's
-- imo_id when inserting. When acting, the report would land in Founders even
-- though Nick intends to create it for Epic. Switch the insert to use
-- effective imo with fallback.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- admin_set_admin_role — target is target_user_id (not p_user_id)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='admin_set_admin_role';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = target_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- admin_delete_domain — target is p_user_id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='admin_delete_domain';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- admin_update_domain_status — target is p_user_id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='admin_update_domain_status';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nDECLARE[\\s\\S]*?\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- hard_delete_user — target is p_user_id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='hard_delete_user';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nDECLARE[\\s\\S]*?\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- create_scheduled_report — write the row using effective imo, not real
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_scheduled_report(
  p_schedule_name text,
  p_report_type text,
  p_frequency report_frequency,
  p_day_of_week smallint DEFAULT NULL::smallint,
  p_day_of_month smallint DEFAULT NULL::smallint,
  p_preferred_time time without time zone DEFAULT '08:00:00'::time without time zone,
  p_recipients jsonb DEFAULT '[]'::jsonb,
  p_export_format text DEFAULT 'pdf'::text,
  p_report_config jsonb DEFAULT '{}'::jsonb,
  p_include_charts boolean DEFAULT true,
  p_include_insights boolean DEFAULT true,
  p_include_summary boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_profile user_profiles%ROWTYPE;
  v_schedule_id uuid;
  v_next_delivery timestamptz;
  v_effective_imo uuid;
  v_target_imo uuid;
BEGIN
  SELECT * INTO v_user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Use effective imo if set (super-admin acting), else fall back to real
  v_effective_imo := public.get_effective_imo_id();
  v_target_imo := COALESCE(v_effective_imo, v_user_profile.imo_id);

  -- Validate recipients are members of the TARGET org (effective imo)
  IF jsonb_array_length(p_recipients) > 0 THEN
    IF NOT validate_schedule_recipients(p_recipients, v_target_imo, v_user_profile.agency_id) THEN
      RAISE EXCEPTION 'Invalid recipients: all recipients must be members of your organization';
    END IF;
  END IF;

  v_next_delivery := calculate_next_delivery(
    p_frequency,
    p_day_of_week,
    p_day_of_month,
    p_preferred_time
  );

  INSERT INTO scheduled_reports (
    owner_id, imo_id, agency_id,
    schedule_name, report_type, report_config,
    frequency, day_of_week, day_of_month, preferred_time,
    recipients, export_format,
    include_charts, include_insights, include_summary,
    next_delivery
  )
  VALUES (
    auth.uid(),
    v_target_imo,                       -- use effective imo, not real
    -- Only carry agency_id when acting matches real imo; otherwise NULL.
    -- An Epic-acting super-admin doesn't have an Epic agency.
    CASE WHEN v_effective_imo IS NULL OR v_effective_imo = v_user_profile.imo_id
      THEN v_user_profile.agency_id
      ELSE NULL
    END,
    p_schedule_name, p_report_type, COALESCE(p_report_config, '{}'::jsonb),
    p_frequency, p_day_of_week, p_day_of_month, p_preferred_time,
    COALESCE(p_recipients, '[]'::jsonb), COALESCE(p_export_format, 'pdf'),
    COALESCE(p_include_charts, true),
    COALESCE(p_include_insights, true),
    COALESCE(p_include_summary, true),
    v_next_delivery
  )
  RETURNING id INTO v_schedule_id;

  RETURN v_schedule_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_scheduled_report(text, text, report_frequency, smallint, smallint, time, jsonb, text, jsonb, boolean, boolean, boolean) TO authenticated;
