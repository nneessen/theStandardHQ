-- Inbound-Call CRM — Phase 3 in-call disposition capture.
-- Lets an agent record, DURING the call, the call type, the carrier the client is calling in
-- from, and free-text notes — saved onto their own inbound_calls row from the screen-pop.
-- Additive + nullable (metadata-only ALTER, no table rewrite). The agent writes via a SECURITY
-- DEFINER RPC (not a broad UPDATE RLS policy — Postgres RLS can't column-restrict, so the RPC is
-- the controlled, column-scoped, own-call-only write path).

BEGIN;

ALTER TABLE public.inbound_calls
  ADD COLUMN IF NOT EXISTS call_type_id       uuid REFERENCES public.kpi_call_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_carrier_id uuid REFERENCES public.carriers(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes              text;

-- crm_set_call_disposition — the agent's disposition write. REPLACE semantics (the pop form holds
-- the full current state). Updates ONLY the 3 disposition columns, ONLY on the caller's OWN call
-- (agent_id = auth.uid() AND imo_id = the caller's imo). call_type_id / inquiry_carrier_id are
-- re-resolved within the caller's own imo so a cross-tenant id can never be stamped on a row.
-- Returns the row id, or NO row when nothing matched (caller treats as failure).
CREATE OR REPLACE FUNCTION public.crm_set_call_disposition(
  p_request_tag        text,
  p_call_type_id       uuid DEFAULT NULL,
  p_inquiry_carrier_id uuid DEFAULT NULL,
  p_notes              text DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo        uuid := public.get_my_imo_id();
  v_call_type  uuid;
  v_carrier    uuid;
  v_id         uuid;
BEGIN
  IF v_imo IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Tenant-scope the foreign keys: ignore any id that is not this imo's call type / carrier.
  v_call_type := (SELECT ct.id FROM public.kpi_call_types ct
                  WHERE ct.id = p_call_type_id AND ct.imo_id = v_imo);
  v_carrier   := (SELECT c.id  FROM public.carriers c
                  WHERE c.id = p_inquiry_carrier_id AND c.imo_id = v_imo);

  UPDATE public.inbound_calls ic SET
    call_type_id       = v_call_type,
    inquiry_carrier_id = v_carrier,
    notes              = left(p_notes, 4000),
    updated_at         = now()
  WHERE ic.request_tag = p_request_tag
    AND ic.agent_id    = auth.uid()
    AND ic.imo_id      = v_imo
  RETURNING ic.id INTO v_id;

  RETURN QUERY SELECT v_id;
END;
$$;

-- Agent-callable (gated internally to the caller's own call); never anon/public.
REVOKE ALL ON FUNCTION public.crm_set_call_disposition(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_set_call_disposition(text, uuid, uuid, text) TO authenticated;

COMMIT;
