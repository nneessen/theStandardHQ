-- Inbound-Call CRM Integration — Phase 0 (RPCs)
-- Plan: ~/.claude/plans/we-already-have-a-serialized-lark.md §3.7, §9, §10
--
-- Three SECURITY DEFINER RPCs called ONLY by the M2M edge functions (service_role).
-- Every query is scoped by `imo_id` (single-tenant correctness invariant). RLS is
-- bypassed by the definer; the edge function passes the token's imo_id, never body.

BEGIN;

-- ============================================================================
-- crm_lookup_aor — PRE-CALL GET. Returns the caller's Agent of Record (pc_id +
-- agent_id) or NO ROWS if not on file. Single round-trip, index-driven.
-- Deterministic tiebreak for shared numbers (households): the client with the
-- most-recent ACTIVE policy, then the most-recently-updated client.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_lookup_aor(p_imo_id uuid, p_ani text)
RETURNS TABLE (pc_id text, agent_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.pc_id, c.user_id AS agent_id
  FROM public.clients c
  JOIN public.imo_agent_external_ids m
    ON m.user_id = c.user_id
   AND m.imo_id = p_imo_id
  -- Mirror crm_upsert_call's resolve-and-validate invariant on the GET path: never
  -- return a pre-call AoR for an out-of-tenant or revoked agent (the POST would drop
  -- it to unassigned -> a silently lost pop). up.id is the PK, so this stays O(1).
  JOIN public.user_profiles up
    ON up.id = c.user_id
   AND up.imo_id = p_imo_id
  LEFT JOIN LATERAL (
    -- In-force policies live in lifecycle_status, NOT status (status was decoupled to
    -- the application outcome {approved,denied,pending,withdrawn} on 2026-02-04).
    SELECT max(p.effective_date) AS last_active_policy
    FROM public.policies p
    WHERE p.client_id = c.id
      AND p.lifecycle_status = 'active'
  ) lp ON true
  WHERE c.phone_e164 IS NOT NULL
    AND c.phone_e164 = public.normalize_phone_e164(p_ani)
    AND NOT public.is_access_revoked(c.user_id)
  ORDER BY lp.last_active_policy DESC NULLS LAST,
           c.updated_at DESC NULLS LAST,
           c.id
  LIMIT 1;
$$;

-- ============================================================================
-- crm_upsert_call — ON-ANSWER POST. Resolve+validate the agent from pc_id within
-- the tenant, find-or-create the client UNDER that agent (so it is visible on the
-- Clients page), and idempotently upsert the call event. The INSERT (status
-- 'ringing', agent_id set) is what the realtime screen-pop subscribes to.
--
-- Returns (id, agent_id, fired_pop). fired_pop is true only when a real,
-- non-revoked, in-tenant agent was resolved on a fresh insert.
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

  -- Resolve the agent from pc_id WITHIN this tenant (NULL if unknown/cross-tenant).
  IF p_pc_id IS NOT NULL THEN
    SELECT m.user_id INTO v_agent_id
    FROM public.imo_agent_external_ids m
    WHERE m.pc_id = p_pc_id
      AND m.imo_id = p_imo_id;
  END IF;

  -- Correctness invariant: a resolved agent must be a real, in-tenant, non-revoked
  -- agent. (imo match is guaranteed by the lookup; re-asserted as defense-in-depth.)
  -- On failure, degrade to unassigned — record the call, fire no pop, create no client.
  -- NOTE: approval_status is intentionally NOT gated here — the spec (§3.7/§10) defines the
  -- invariant as in-tenant + NOT revoked only, and pc_id registration is admin-gated (Phase 1),
  -- so an unapproved agent cannot self-register to receive pops. Revisit if that changes.
  IF v_agent_id IS NOT NULL THEN
    IF NOT EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = v_agent_id AND up.imo_id = p_imo_id
        )
       OR public.is_access_revoked(v_agent_id) THEN
      v_agent_id := NULL;
    END IF;
  END IF;

  -- Find-or-create the client under the AoR agent (only with an agent + usable phone).
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

  -- Pop only when we have a real agent to route to (drives the fired_pop flag;
  -- the actual pop is the realtime INSERT event filtered on agent_id).
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
    -- Fill, don't overwrite, identity that a prior (possibly patch-only) row set.
    agent_id     = COALESCE(inbound_calls.agent_id, EXCLUDED.agent_id),
    client_id    = COALESCE(inbound_calls.client_id, EXCLUDED.client_id),
    ani          = EXCLUDED.ani,
    phone_e164   = EXCLUDED.phone_e164,
    state        = COALESCE(EXCLUDED.state, inbound_calls.state),
    record_type  = COALESCE(EXCLUDED.record_type, inbound_calls.record_type),
    pc_id        = COALESCE(EXCLUDED.pc_id, inbound_calls.pc_id),
    offer_id     = COALESCE(EXCLUDED.offer_id, inbound_calls.offer_id),
    call_program = COALESCE(EXCLUDED.call_program, inbound_calls.call_program),
    sub_id       = COALESCE(EXCLUDED.sub_id, inbound_calls.sub_id),
    call_start   = COALESCE(EXCLUDED.call_start, inbound_calls.call_start),
    duration     = COALESCE(EXCLUDED.duration, inbound_calls.duration),
    billable     = COALESCE(EXCLUDED.billable, inbound_calls.billable),
    -- A real POST clears the patch-only marker. status/fired_pop are deliberately
    -- NOT touched: an already-'ended' (patched) call must not resurrect to 'ringing'
    -- (would phantom-pop on reconnect), and pop firing is an INSERT-time decision.
    patch_only   = false,
    updated_at   = now()
  RETURNING inbound_calls.id, inbound_calls.agent_id, inbound_calls.fired_pop
  INTO v_call_id, v_agent_id, v_fired_pop;

  RETURN QUERY SELECT v_call_id, v_agent_id, v_fired_pop;
END;
$$;

-- ============================================================================
-- crm_patch_billable — ON-CALL-END PATCH. Set billable + status='ended' (dismisses
-- the pop). PATCH-before-POST: insert a minimal patch_only row so billing is never
-- dropped and no phantom pop fires. Tolerant of out-of-order delivery.
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
    billable   = p_billable,
    duration   = COALESCE(p_duration, ic.duration),
    status     = 'ended',
    updated_at = now()
  WHERE ic.imo_id = p_imo_id
    AND ic.request_tag = p_request_tag
  RETURNING ic.id, ic.patch_only INTO v_id, v_patch_only;

  IF v_id IS NULL THEN
    -- PATCH arrived before POST: record billing now; agent_id NULL + patch_only=true
    -- => no pop. The later POST fills identity via crm_upsert_call's ON CONFLICT.
    INSERT INTO public.inbound_calls (
      imo_id, request_tag, ani, phone_e164, billable, duration, status, fired_pop, patch_only
    ) VALUES (
      p_imo_id, p_request_tag, COALESCE(p_ani, ''), public.normalize_phone_e164(p_ani),
      p_billable, p_duration, 'ended', false, true
    )
    ON CONFLICT (imo_id, request_tag) DO UPDATE SET
      billable   = EXCLUDED.billable,
      duration   = COALESCE(EXCLUDED.duration, inbound_calls.duration),
      status     = 'ended',
      updated_at = now()
    RETURNING inbound_calls.id, inbound_calls.patch_only INTO v_id, v_patch_only;
  END IF;

  RETURN QUERY SELECT v_id, v_patch_only;
END;
$$;

-- ============================================================================
-- Grants — M2M only. Nobody but service_role (and the definer-owner) may execute.
-- REVOKE FROM PUBLIC ALONE IS INSUFFICIENT on Supabase: ALTER DEFAULT PRIVILEGES
-- grants EXECUTE on every new public function DIRECTLY to anon + authenticated (not
-- via the PUBLIC pseudo-role), so those explicit grants survive a FROM PUBLIC revoke.
-- These RPCs trust p_imo_id (no auth.uid() binding) by design — they are M2M-only — so
-- a surviving authenticated/anon grant would let any logged-in (or anon) user pass an
-- arbitrary p_imo_id and defeat tenant isolation. We must revoke the roles explicitly
-- (mirrors 20260531162205_security_harden_secdef_rpcs.sql). Goal proacl: {postgres, service_role}.
-- NOTE: normalize_phone_e164 is intentionally left broadly executable — it backs the
-- clients.phone_e164 STORED generated column, so ordinary authenticated writes need it.
-- ============================================================================
REVOKE ALL ON FUNCTION public.crm_lookup_aor(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.crm_lookup_aor(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_upsert_call(uuid, text, text, text, text, text, text, text, text, timestamptz, integer, smallint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_patch_billable(uuid, text, smallint, integer, text) TO service_role;

COMMIT;
