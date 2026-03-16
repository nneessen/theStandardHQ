BEGIN;

CREATE OR REPLACE FUNCTION public.recruiting_actor_can_access_pipeline(
  p_actor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles TEXT[];
  v_is_admin BOOLEAN;
BEGIN
  IF p_actor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  SELECT roles, is_admin
  INTO v_roles, v_is_admin
  FROM public.user_profiles
  WHERE id = p_actor_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_is_admin = TRUE THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(v_roles, ARRAY[]::TEXT[]) && ARRAY[
    'admin',
    'agent',
    'active_agent',
    'trainer',
    'contracting_manager',
    'recruiter',
    'upline_manager',
    'office_staff'
  ]::TEXT[] THEN
    RETURN TRUE;
  END IF;

  IF public.has_permission(p_actor_id, 'nav.recruiting_pipeline') THEN
    RETURN TRUE;
  END IF;

  IF public.has_permission(p_actor_id, 'nav.user_management') THEN
    RETURN TRUE;
  END IF;

  IF public.has_permission(p_actor_id, 'users.manage') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recruiting_actor_can_access_pipeline(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recruiting_actor_can_access_pipeline(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_recruit_invitation(
  p_email TEXT,
  p_message TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_upline_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_id UUID;
  v_invitation_id UUID;
  v_token UUID;
  v_upline UUID;
  v_inviter_profile public.user_profiles%ROWTYPE;
  v_cancelled_count INT;
  v_upline_roles TEXT[];
  v_upline_is_admin BOOLEAN;
  v_upline_imo_id UUID;
BEGIN
  v_inviter_id := auth.uid();

  IF v_inviter_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized', 'message', 'You must be logged in to send invitations.');
  END IF;

  IF NOT public.recruiting_actor_can_access_pipeline(v_inviter_id) THEN
    RETURN json_build_object('success', false, 'error', 'forbidden', 'message', 'You do not have permission to create recruiting invitations.');
  END IF;

  SELECT *
  INTO v_inviter_profile
  FROM public.user_profiles
  WHERE id = v_inviter_id;

  IF v_inviter_profile.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found', 'message', 'User profile not found.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE LOWER(up.email) = LOWER(TRIM(p_email))
      AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = up.id)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'email_exists', 'message', 'A user with this email already exists.');
  END IF;

  UPDATE public.recruit_invitations
  SET status = 'cancelled', updated_at = NOW()
  WHERE LOWER(email) = LOWER(TRIM(p_email))
    AND status IN ('pending', 'sent', 'viewed')
  RETURNING 1 INTO v_cancelled_count;

  IF p_upline_id IS NOT NULL THEN
    SELECT roles, is_admin, imo_id
    INTO v_upline_roles, v_upline_is_admin, v_upline_imo_id
    FROM public.user_profiles
    WHERE id = p_upline_id;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'invalid_upline', 'message', 'Assigned upline could not be found.');
    END IF;

    IF v_inviter_profile.imo_id IS DISTINCT FROM v_upline_imo_id THEN
      RETURN json_build_object('success', false, 'error', 'invalid_upline', 'message', 'Assigned upline must belong to the same IMO.');
    END IF;

    IF v_upline_is_admin IS DISTINCT FROM TRUE
      AND NOT (
        COALESCE(v_upline_roles, ARRAY[]::TEXT[]) && ARRAY[
          'admin',
          'agent',
          'active_agent',
          'trainer',
          'contracting_manager',
          'upline_manager'
        ]::TEXT[]
      ) THEN
      RETURN json_build_object('success', false, 'error', 'invalid_upline', 'message', 'Assigned upline must be an approved recruiting manager.');
    END IF;

    v_upline := p_upline_id;
  ELSE
    v_upline := v_inviter_id;
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO public.recruit_invitations (
    recruit_id,
    inviter_id,
    invite_token,
    email,
    message,
    first_name,
    last_name,
    phone,
    city,
    state,
    upline_id,
    status
  )
  VALUES (
    NULL,
    v_inviter_id,
    v_token,
    LOWER(TRIM(p_email)),
    p_message,
    p_first_name,
    p_last_name,
    p_phone,
    p_city,
    p_state,
    v_upline,
    'pending'
  )
  RETURNING id INTO v_invitation_id;

  RETURN json_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token,
    'message', 'Invitation created successfully.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_recruit_invitation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_recruit_invitation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.submit_recruit_registration(UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_recruit_registration(UUID, JSONB, UUID) TO service_role;

COMMIT;
