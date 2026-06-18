-- Inbound-Call CRM — go-live hardening (review findings #2 / #5 / #6).
-- Recreates crm_upsert_call and crm_patch_billable with three defensive changes; NO behavior
-- change for well-formed traffic. Bundled to apply at go-live alongside the edge-fn deploy.
--
--   #2 (MEDIUM) Concurrent same-phone POSTs for a brand-new caller could each find-nothing then
--      INSERT a duplicate client row (the inbound_calls ON CONFLICT serializes the CALL row, but the
--      find-or-create-client block runs before it and clients has no UNIQUE(user_id, phone_e164) —
--      intentionally, households share a phone). Fix: a per-(tenant, phone) transaction advisory lock
--      that serializes the find-or-create window only. NOT a unique constraint.
--   #5 (LOW) billable is documented {0,1} but nothing enforced it (a stray 2/-1 reached the column);
--      duration accepted negatives. Normalize: non-zero billable -> 1, negative duration -> NULL.
--      Stays coercive (never raises) per the "lifecycle writes never 4xx" design.
--   #6 (LOW) Unbounded free-text could store arbitrarily large rows from a misbehaving platform.
--      Bound the stored text fields with left(...). Generous caps; real values are far shorter.
--
-- Tenant isolation, idempotency, the COALESCE redelivery guards, the resolve-and-validate /
-- not-revoked invariant, and the no-resurrection behavior are all preserved verbatim.

BEGIN;

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
  -- #6 length caps + #5 numeric normalization (defensive; platform is semi-trusted).
  v_ani          text     := left(p_ani, 64);
  v_caller_name  text     := left(p_caller_name, 200);
  v_state        text     := left(p_state, 16);
  v_record_type  text     := left(p_record_type, 64);
  v_offer_id     text     := left(p_offer_id, 128);
  v_call_program text     := left(p_call_program, 128);
  v_sub_id       text     := left(p_sub_id, 128);
  v_billable     smallint := CASE WHEN p_billable IS NULL THEN NULL
                                  WHEN p_billable = 0    THEN 0::smallint ELSE 1::smallint END;
  v_duration     integer  := CASE WHEN p_duration < 0 THEN NULL ELSE p_duration END;
BEGIN
  v_phone_e164 := public.normalize_phone_e164(v_ani);

  -- #2: serialize the find-or-create-client window per (tenant, phone) so concurrent redeliveries
  -- of a brand-new caller can't each insert a duplicate client. Released at txn end. NULL phones
  -- share one key per tenant but never create a client (gated below), so contention is harmless.
  PERFORM pg_advisory_xact_lock(hashtext(p_imo_id::text || COALESCE(v_phone_e164, '')));

  -- Resolve the agent from pc_id WITHIN this tenant (NULL if unknown/cross-tenant).
  IF p_pc_id IS NOT NULL THEN
    SELECT m.user_id INTO v_agent_id
    FROM public.imo_agent_external_ids m
    WHERE m.pc_id = p_pc_id
      AND m.imo_id = p_imo_id;
  END IF;

  -- A resolved agent must be a real, in-tenant, non-revoked agent; else degrade to unassigned.
  IF v_agent_id IS NOT NULL THEN
    IF NOT EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = v_agent_id AND up.imo_id = p_imo_id
        )
       OR public.is_access_revoked(v_agent_id) THEN
      v_agent_id := NULL;
    END IF;
  END IF;

  -- Find-or-create the client UNDER the AoR agent (households legitimately share a phone, so this
  -- collapses to the most-recently-updated match rather than enforcing uniqueness).
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
        COALESCE(NULLIF(btrim(v_caller_name), ''), v_phone_e164, v_ani),
        v_ani,
        v_state,
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
    p_imo_id, p_request_tag, v_agent_id, v_client_id, v_ani, v_phone_e164, v_state, v_record_type,
    p_pc_id, v_offer_id, v_call_program, v_sub_id, p_call_start, v_duration, v_billable,
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
  v_ani        text     := left(p_ani, 64);                                    -- #6
  v_billable   smallint := CASE WHEN p_billable IS NULL THEN NULL              -- #5
                                WHEN p_billable = 0    THEN 0::smallint ELSE 1::smallint END;
  v_duration   integer  := CASE WHEN p_duration < 0 THEN NULL ELSE p_duration END;  -- #5
BEGIN
  UPDATE public.inbound_calls AS ic SET
    -- Guard: a PATCH that omits billable must NOT wipe a prior billable to NULL.
    billable   = COALESCE(v_billable, ic.billable),
    duration   = COALESCE(v_duration, ic.duration),
    status     = 'ended',
    updated_at = now()
  WHERE ic.imo_id = p_imo_id
    AND ic.request_tag = p_request_tag
  RETURNING ic.id, ic.patch_only INTO v_id, v_patch_only;

  IF v_id IS NULL THEN
    INSERT INTO public.inbound_calls (
      imo_id, request_tag, ani, phone_e164, billable, duration, status, fired_pop, patch_only
    ) VALUES (
      p_imo_id, p_request_tag, COALESCE(v_ani, ''), public.normalize_phone_e164(v_ani),
      v_billable, v_duration, 'ended', false, true
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

-- Grants preserved by CREATE OR REPLACE; re-assert (M2M / service_role only).
REVOKE ALL ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) TO service_role;

COMMIT;
