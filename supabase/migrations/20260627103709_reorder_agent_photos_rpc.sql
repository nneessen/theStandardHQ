-- Atomic reorder for agent_photos (Social Studio photo manager). Replaces the client's
-- N separate UPDATEs (one per photo) — which left sort_order half-applied if a mid-batch
-- request failed — with ONE statement. sort_order = the photo's position in p_ids (0-based).
-- Scoped to the caller's IMO (is_admin + get_my_imo_id), so it can't reorder another tenant's
-- rows even if ids are forged.
CREATE OR REPLACE FUNCTION public.reorder_agent_photos(p_ids uuid[])
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.agent_photos ap
  SET sort_order = ord.pos - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ord(id, pos)
  WHERE ap.id = ord.id
    AND ap.imo_id = public.get_my_imo_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_agent_photos(uuid[]) TO authenticated;
