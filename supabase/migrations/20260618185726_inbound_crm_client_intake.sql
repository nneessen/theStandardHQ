-- Inbound-Call CRM — rich client intake fields (non-banking).
-- The full-screen intake captures far more than the base `clients` columns: client-info extras
-- (record type, title, wants-more-coverage, writing/last-received agent), initial-call details
-- (current carrier, reason for calling, current coverage amount, Spanish call), health details
-- (conditions, height, weight, nicotine, birth country/state), and shipping address.
-- Rather than ~20 new typed columns (which would force a 34k-line database.types.ts regen), these
-- live in a single `clients.intake` JSONB blob, written via a SECURITY DEFINER RPC scoped to the
-- agent's OWN client. The Banking & Sensitive section (SSN/bank/card) is intentionally NOT here —
-- it needs encrypted storage + access-gating and is deferred.

BEGIN;

-- Constant default -> metadata-only add, no table rewrite.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake jsonb NOT NULL DEFAULT '{}'::jsonb;

-- crm_set_client_intake — replace the intake blob on the caller's OWN client (clients are scoped by
-- clients.user_id -> the agent). Returns the row id, or NO row if the client isn't the caller's.
CREATE OR REPLACE FUNCTION public.crm_set_client_intake(
  p_client_id uuid,
  p_intake    jsonb
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.clients c
     SET intake = COALESCE(p_intake, '{}'::jsonb),
         updated_at = now()
   WHERE c.id = p_client_id
     AND c.user_id = auth.uid()
  RETURNING c.id INTO v_id;
  RETURN QUERY SELECT v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_set_client_intake(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_set_client_intake(uuid, jsonb) TO authenticated;

COMMIT;
