-- 20260520094801_enroll_recruit_on_invite_completion.sql
--
-- Bug: recruits who completed a Send Invite registration ended up with a
-- user_profiles row (full ownership + pipeline_template_id set) but no rows
-- in recruit_phase_progress, so they appeared in the team list with no
-- pipeline progress.
--
-- Fix: after submit_recruit_registration resolves v_recruit_id and
-- v_default_template_id, call initialize_recruit_progress(...) so phase
-- rows are created in the same transaction as the user_profiles upsert.
-- initialize_recruit_progress is idempotent (returns early if rows exist),
-- so this is safe across all three branches (NEW/LEGACY/OLD).

CREATE OR REPLACE FUNCTION public.submit_recruit_registration(
  p_token uuid,
  p_data jsonb,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation recruit_invitations%ROWTYPE;
  v_inviter user_profiles%ROWTYPE;
  v_recruit_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_default_template_id UUID;
  v_date_of_birth DATE;
BEGIN
  -- Get invitation with lock
  SELECT * INTO v_invitation
  FROM recruit_invitations
  WHERE invite_token = p_token
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invitation_not_found', 'message', 'This invitation link is invalid or has been removed.');
  END IF;

  IF v_invitation.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'already_completed', 'message', 'This registration has already been completed.');
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    UPDATE recruit_invitations SET status = 'expired', updated_at = NOW() WHERE id = v_invitation.id;
    RETURN json_build_object('success', false, 'error', 'invitation_expired', 'message', 'This invitation has expired.');
  END IF;

  IF v_invitation.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'invitation_cancelled', 'message', 'This invitation has been cancelled.');
  END IF;

  SELECT * INTO v_inviter
  FROM user_profiles
  WHERE id = v_invitation.inviter_id;

  IF v_inviter.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'inviter_not_found', 'message', 'Inviter profile not found.');
  END IF;

  v_first_name := COALESCE(NULLIF(TRIM(p_data->>'first_name'), ''), v_invitation.first_name);
  v_last_name  := COALESCE(NULLIF(TRIM(p_data->>'last_name'),  ''), v_invitation.last_name);

  v_date_of_birth := NULL;
  IF p_data->>'date_of_birth' IS NOT NULL AND TRIM(p_data->>'date_of_birth') != '' THEN
    BEGIN
      v_date_of_birth := (p_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_date_of_birth := NULL;
    END;
  END IF;

  -- Get default pipeline template for the inviter's IMO
  SELECT id INTO v_default_template_id
  FROM pipeline_templates
  WHERE imo_id = v_inviter.imo_id
    AND is_default = true
    AND is_active = true
  LIMIT 1;

  IF v_default_template_id IS NULL THEN
    SELECT id INTO v_default_template_id
    FROM pipeline_templates
    WHERE imo_id = v_inviter.imo_id
      AND is_active = true
    LIMIT 1;
  END IF;

  IF p_auth_user_id IS NOT NULL THEN
    -- NEW FLOW: Auth user already created via signUp, update their profile
    v_recruit_id := p_auth_user_id;

    UPDATE user_profiles SET
      email                = v_invitation.email,
      first_name           = v_first_name,
      last_name            = v_last_name,
      phone                = COALESCE(NULLIF(TRIM(p_data->>'phone'), ''), v_invitation.phone),
      date_of_birth        = v_date_of_birth,
      street_address       = NULLIF(TRIM(p_data->>'street_address'), ''),
      city                 = COALESCE(NULLIF(TRIM(p_data->>'city'), ''), v_invitation.city),
      state                = COALESCE(NULLIF(TRIM(p_data->>'state'), ''), v_invitation.state),
      zip                  = NULLIF(TRIM(p_data->>'zip'), ''),
      instagram_username   = NULLIF(TRIM(p_data->>'instagram_username'), ''),
      facebook_handle      = NULLIF(TRIM(p_data->>'facebook_handle'), ''),
      personal_website     = NULLIF(TRIM(p_data->>'personal_website'), ''),
      referral_source      = NULLIF(TRIM(p_data->>'referral_source'), ''),
      recruiter_id         = v_invitation.inviter_id,
      upline_id            = COALESCE(v_invitation.upline_id, v_invitation.inviter_id),
      imo_id               = v_inviter.imo_id,
      agency_id            = v_inviter.agency_id,
      roles                = ARRAY['recruit']::TEXT[],
      agent_status         = 'unlicensed',
      approval_status      = 'approved',
      onboarding_status    = 'prospect',
      onboarding_started_at = NOW(),
      pipeline_template_id = v_default_template_id,
      updated_at           = NOW()
    WHERE id = p_auth_user_id;

  ELSIF v_invitation.recruit_id IS NOT NULL THEN
    -- LEGACY FLOW: Recruit already exists, update their info
    v_recruit_id := v_invitation.recruit_id;

    UPDATE user_profiles SET
      first_name           = v_first_name,
      last_name            = v_last_name,
      phone                = COALESCE(NULLIF(TRIM(p_data->>'phone'), ''), phone),
      date_of_birth        = COALESCE(v_date_of_birth, date_of_birth),
      street_address       = COALESCE(NULLIF(TRIM(p_data->>'street_address'), ''), street_address),
      city                 = COALESCE(NULLIF(TRIM(p_data->>'city'), ''), city),
      state                = COALESCE(NULLIF(TRIM(p_data->>'state'), ''), state),
      zip                  = COALESCE(NULLIF(TRIM(p_data->>'zip'), ''), zip),
      instagram_username   = COALESCE(NULLIF(TRIM(p_data->>'instagram_username'), ''), instagram_username),
      facebook_handle      = COALESCE(NULLIF(TRIM(p_data->>'facebook_handle'), ''), facebook_handle),
      personal_website     = COALESCE(NULLIF(TRIM(p_data->>'personal_website'), ''), personal_website),
      referral_source      = COALESCE(NULLIF(TRIM(p_data->>'referral_source'), ''), referral_source),
      onboarding_status    = 'prospect',
      onboarding_started_at = COALESCE(onboarding_started_at, NOW()),
      updated_at           = NOW()
    WHERE id = v_recruit_id;

  ELSE
    -- OLD FLOW: Create new recruit (no auth user, no existing recruit)
    INSERT INTO user_profiles (
      email, first_name, last_name, phone, date_of_birth,
      street_address, city, state, zip,
      instagram_username, facebook_handle, personal_website, referral_source,
      recruiter_id, upline_id, imo_id, agency_id,
      roles, agent_status, approval_status,
      onboarding_status, onboarding_started_at,
      pipeline_template_id, hierarchy_path, hierarchy_depth
    ) VALUES (
      v_invitation.email, v_first_name, v_last_name,
      COALESCE(NULLIF(TRIM(p_data->>'phone'), ''), v_invitation.phone),
      v_date_of_birth,
      NULLIF(TRIM(p_data->>'street_address'), ''),
      COALESCE(NULLIF(TRIM(p_data->>'city'), ''), v_invitation.city),
      COALESCE(NULLIF(TRIM(p_data->>'state'), ''), v_invitation.state),
      NULLIF(TRIM(p_data->>'zip'), ''),
      NULLIF(TRIM(p_data->>'instagram_username'), ''),
      NULLIF(TRIM(p_data->>'facebook_handle'), ''),
      NULLIF(TRIM(p_data->>'personal_website'), ''),
      NULLIF(TRIM(p_data->>'referral_source'), ''),
      v_invitation.inviter_id,
      COALESCE(v_invitation.upline_id, v_invitation.inviter_id),
      v_inviter.imo_id, v_inviter.agency_id,
      ARRAY['recruit']::TEXT[], 'unlicensed', 'pending',
      'prospect', NOW(),
      v_default_template_id, '', 0
    )
    RETURNING id INTO v_recruit_id;
  END IF;

  -- Enroll the recruit in the pipeline. Idempotent across re-runs and across
  -- all three branches above. Skips silently if no active template exists for
  -- the inviter's IMO so the registration itself still succeeds.
  IF v_default_template_id IS NOT NULL THEN
    BEGIN
      PERFORM initialize_recruit_progress(v_recruit_id, v_default_template_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'initialize_recruit_progress failed for recruit %: %', v_recruit_id, SQLERRM;
    END;
  END IF;

  -- Link invitation to recruit and mark as completed
  UPDATE recruit_invitations SET
    recruit_id   = v_recruit_id,
    status       = 'completed',
    completed_at = NOW(),
    updated_at   = NOW()
  WHERE id = v_invitation.id;

  RETURN json_build_object(
    'success', true,
    'recruit_id', v_recruit_id,
    'message', 'Registration completed successfully.',
    'inviter', json_build_object(
      'name',  TRIM(COALESCE(v_inviter.first_name, '') || ' ' || COALESCE(v_inviter.last_name, '')),
      'email', v_inviter.email,
      'phone', v_inviter.phone
    )
  );
END;
$function$;
