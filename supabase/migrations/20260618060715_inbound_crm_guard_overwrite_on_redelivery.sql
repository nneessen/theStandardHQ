-- Inbound-Call CRM — guard against overwrite-on-omit on re-delivery (Phase 2 review fixes #3/#4).
--
-- The platform delivers POST/PATCH at-least-once and tolerates out-of-order. Two columns were
-- overwritten UNCONDITIONALLY on the ON CONFLICT / UPDATE path, so a re-delivery that omits a field
-- could wipe a previously-correct value:
--   #4 crm_upsert_call: ani/phone_e164 = EXCLUDED.* — a re-POST without ani (edge sends '') clobbered
--      a good number to ''/NULL.
--   #3 crm_patch_billable: billable = p_billable — a PATCH without billable wiped a prior billable to NULL
--      (while duration was already COALESCE-guarded — an inconsistency in a "tolerant of out-of-order" fn).
-- Fix: COALESCE-guard both so an omitted/empty value keeps the existing one; a real new value still updates.
-- CREATE OR REPLACE preserves grants; the REVOKE/GRANT at the end is re-asserted for safety.

BEGIN;

-- ============================================================================
-- crm_upsert_call — ani/phone_e164 now keep the existing value when the new one
-- is empty/NULL (only change: the two ON CONFLICT lines).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_upsert_call(
  p_imo_id       uuid,
  p_request_tag  text,
  p_pc_id        text,
  p_ani          text,
  p_state        text        DEFAULT NULL,
  p_record_type  text        DEFAULT NULL,
  p_offer_id     text        DEFAULT NULL,
  p_call_program text        DEFAULT NULL,
  p_sub_id       text        DEFAULT NULL,
  p_call_start   timestamptz DEFAULT NULL,
  p_duration     integer     DEFAULT NULL,
  p_billable     smallint    DEFAULT NULL,
  p_caller_name  text        DEFAULT NULL
)
RETURNS TABLE (id uuid, agent_id uuid, fired_pop boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_e164 text;
  v_agent_id   uuid;
  v_client_id  uuid;
  v_fired_pop  boolean := false;
  v_call_id    uuid;
BEGIN
  v_phone_e164 := public.normalize_phone_e164(p_ani);

  IF p_pc_id IS NOT NULL THEN
    SELECT m.user_id INTO v_agent_id
    FROM public.imo_agent_external_ids m
    WHERE m.pc_id = p_pc_id
      AND m.imo_id = p_imo_id;
  END IF;

  -- Resolve-and-validate (in-tenant + not revoked); else degrade to unassigned.
  IF v_agent_id IS NOT NULL THEN
    IF NOT EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = v_agent_id AND up.imo_id = p_imo_id
        )
       OR public.is_access_revoked(v_agent_id) THEN
      v_agent_id := NULL;
    END IF;
  END IF;

  IF v_agent_id IS NOT NULL AND v_phone_e164 IS NOT NULL THEN
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE c.user_id = v_agent_id
      AND c.phone_e164 = v_phone_e164
    ORDER BY c.updated_at DESC NULLS LAST, c.id
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (user_id, name, phone, state, status)
      VALUES (
        v_agent_id,
        COALESCE(NULLIF(btrim(p_caller_name), ''), v_phone_e164, p_ani),
        p_ani,
        p_state,
        'active'
      )
      RETURNING clients.id INTO v_client_id;
    END IF;
  END IF;

  v_fired_pop := (v_agent_id IS NOT NULL);

  INSERT INTO public.inbound_calls (
    imo_id, request_tag, agent_id, client_id, ani, phone_e164, state, record_type,
    pc_id, offer_id, call_program, sub_id, call_start, duration, billable,
    status, fired_pop, patch_only
  ) VALUES (
    p_imo_id, p_request_tag, v_agent_id, v_client_id, p_ani, v_phone_e164, p_state, p_record_type,
    p_pc_id, p_offer_id, p_call_program, p_sub_id, p_call_start, p_duration, p_billable,
    'ringing', v_fired_pop, false
  )
  ON CONFLICT (imo_id, request_tag) DO UPDATE SET
    agent_id     = COALESCE(inbound_calls.agent_id, EXCLUDED.agent_id),
    client_id    = COALESCE(inbound_calls.client_id, EXCLUDED.client_id),
    -- Guard: a re-POST that omits ani (edge sends '') must NOT clobber a good number.
    ani          = COALESCE(NULLIF(EXCLUDED.ani, ''), inbound_calls.ani),
    phone_e164   = COALESCE(EXCLUDED.phone_e164, inbound_calls.phone_e164),
    state        = COALESCE(EXCLUDED.state, inbound_calls.state),
    record_type  = COALESCE(EXCLUDED.record_type, inbound_calls.record_type),
    pc_id        = COALESCE(EXCLUDED.pc_id, inbound_calls.pc_id),
    offer_id     = COALESCE(EXCLUDED.offer_id, inbound_calls.offer_id),
    call_program = COALESCE(EXCLUDED.call_program, inbound_calls.call_program),
    sub_id       = COALESCE(EXCLUDED.sub_id, inbound_calls.sub_id),
    call_start   = COALESCE(EXCLUDED.call_start, inbound_calls.call_start),
    duration     = COALESCE(EXCLUDED.duration, inbound_calls.duration),
    billable     = COALESCE(EXCLUDED.billable, inbound_calls.billable),
    patch_only   = false,
    updated_at   = now()
  RETURNING inbound_calls.id, inbound_calls.agent_id, inbound_calls.fired_pop
  INTO v_call_id, v_agent_id, v_fired_pop;

  RETURN QUERY SELECT v_call_id, v_agent_id, v_fired_pop;
END;
$$;

-- ============================================================================
-- crm_patch_billable — billable now COALESCE-guarded like duration (only change:
-- the two `billable = ` assignments).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_patch_billable(
  p_imo_id      uuid,
  p_request_tag text,
  p_billable    smallint,
  p_duration    integer DEFAULT NULL,
  p_ani         text    DEFAULT NULL
)
RETURNS TABLE (id uuid, patch_only boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_patch_only boolean := false;
BEGIN
  UPDATE public.inbound_calls AS ic SET
    -- Guard: a PATCH that omits billable must NOT wipe a prior billable to NULL.
    billable   = COALESCE(p_billable, ic.billable),
    duration   = COALESCE(p_duration, ic.duration),
    status     = 'ended',
    updated_at = now()
  WHERE ic.imo_id = p_imo_id
    AND ic.request_tag = p_request_tag
  RETURNING ic.id, ic.patch_only INTO v_id, v_patch_only;

  IF v_id IS NULL THEN
    INSERT INTO public.inbound_calls (
      imo_id, request_tag, ani, phone_e164, billable, duration, status, fired_pop, patch_only
    ) VALUES (
      p_imo_id, p_request_tag, COALESCE(p_ani, ''), public.normalize_phone_e164(p_ani),
      p_billable, p_duration, 'ended', false, true
    )
    ON CONFLICT (imo_id, request_tag) DO UPDATE SET
      billable   = COALESCE(EXCLUDED.billable, inbound_calls.billable),
      duration   = COALESCE(EXCLUDED.duration, inbound_calls.duration),
      status     = 'ended',
      updated_at = now()
    RETURNING inbound_calls.id, inbound_calls.patch_only INTO v_id, v_patch_only;
  END IF;

  RETURN QUERY SELECT v_id, v_patch_only;
END;
$$;

-- Grants are preserved by CREATE OR REPLACE; re-assert for safety (M2M / service_role only).
REVOKE ALL ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) TO service_role;

COMMIT;
