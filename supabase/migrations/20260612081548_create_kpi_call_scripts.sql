-- ============================================================================
-- kpi_call_scripts — AI-generated MASTER SALES SCRIPT, one per (imo_id, call_type).
-- ============================================================================
-- Synthesized by the `generate-call-script` edge fn from the most recent SOLD +
-- analyzed calls of a call type. Admins/super-admins generate + regenerate; all
-- approved IMO agents VIEW once a body exists. Mirrors the kpi_* tenancy +
-- RESTRICTIVE revocation_deny pattern (20260606135121). Regenerate UPSERTs via
-- kpi_claim_call_script and NEVER blanks a live script_body.
-- ============================================================================

BEGIN;

-- ── Cross-tenant guard: a script's call_type_id must belong to its imo_id ────
-- (mirror of public.kpi_assert_agent_imo, keyed on the call type instead of agent)
CREATE OR REPLACE FUNCTION public.kpi_assert_call_type_imo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.call_type_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.kpi_call_types ct
       WHERE ct.id = NEW.call_type_id AND ct.imo_id = NEW.imo_id
     ) THEN
    RAISE EXCEPTION 'call_type_id % does not belong to imo_id % (cross-tenant blocked)',
      NEW.call_type_id, NEW.imo_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_call_scripts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id               UUID NOT NULL REFERENCES public.imos(id),
  call_type_id         UUID NOT NULL REFERENCES public.kpi_call_types(id) ON DELETE CASCADE,

  -- generation run state. ENUM (TS): pending | processing | completed | failed (no DB CHECK)
  status               TEXT NOT NULL DEFAULT 'processing',
  script_body          JSONB,            -- annotated phases/steps; NULL until first success; never blanked
  generation_error     TEXT,             -- set on failure, cleared on (re)claim/success

  -- provenance (lives in columns, never inside script_body)
  model                TEXT,
  source_recording_ids UUID[],           -- snapshot of the calls synthesized from
  source_call_count    INTEGER,
  tokens_used          INTEGER,
  last_run_id          UUID,             -- correlates the two-phase claim->complete writes
  generated_at         TIMESTAMPTZ,
  generated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kpi_call_scripts_imo_type_uniq UNIQUE (imo_id, call_type_id)
);

-- UNIQUE(imo_id, call_type_id) already indexes the IMO-list query (WHERE imo_id = ?).
CREATE INDEX IF NOT EXISTS idx_kpi_scripts_generation_queue
  ON public.kpi_call_scripts (status) WHERE status IN ('pending','processing');

ALTER TABLE public.kpi_call_scripts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_kpi_call_scripts_updated_at
  BEFORE UPDATE ON public.kpi_call_scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kpi_call_scripts_assert_call_type_imo
  BEFORE INSERT OR UPDATE ON public.kpi_call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.kpi_assert_call_type_imo();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- RESTRICTIVE kill-switch (mandatory on every kpi_* table; gate-completeness check enforces it)
CREATE POLICY revocation_deny ON public.kpi_call_scripts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

-- SELECT: agents see scripts in their IMO that HAVE A BODY; admins/super-admins
-- see all rows in scope (in-flight/failed too). Gate on script_body presence
-- (NOT a publish flag, NOT status='completed') so a regen that flips status->
-- processing keeps the prior good body visible — no blank window, no publish step.
CREATE POLICY kpi_call_scripts_select ON public.kpi_call_scripts
  FOR SELECT TO authenticated
  USING (
    (imo_id = (SELECT get_my_imo_id())
      AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
      AND (script_body IS NOT NULL OR (SELECT is_imo_admin())))
    OR super_admin_in_scope(imo_id)
  );

-- Writes (client path): IMO admin within their IMO, or super-admin in scope —
-- mirrors kpi_word_tracks_write. In v1 the edge fn does all writes via
-- service_role (RLS-bypassing) and there is no client edit/delete UI, so these
-- are defense-in-depth. (The is_imo_admin()-vs-imo_owner role divergence is
-- deferred to the editing v2; it does NOT affect generation.)
CREATE POLICY kpi_call_scripts_write ON public.kpi_call_scripts
  FOR ALL TO authenticated
  USING (
    ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
      AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
    OR super_admin_in_scope(imo_id)
  );

-- ── Atomic claim + stale-reclaim RPC ────────────────────────────────────────
-- PostgREST .upsert() cannot express a conditional WHERE; this RPC is the only
-- way to claim a generation slot without stomping a running one. SECURITY
-- DEFINER + service_role-only EXECUTE (the edge fn calls it with the admin client).
CREATE OR REPLACE FUNCTION public.kpi_claim_call_script(
  p_imo_id uuid, p_call_type_id uuid, p_user uuid, p_run_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.kpi_call_scripts (imo_id, call_type_id, status, generated_by, last_run_id, updated_by)
  VALUES (p_imo_id, p_call_type_id, 'processing', p_user, p_run_id, p_user)
  ON CONFLICT (imo_id, call_type_id) DO UPDATE
    SET status = 'processing', generated_by = p_user, last_run_id = p_run_id,
        generation_error = NULL, updated_by = p_user, updated_at = now()
    -- claim only if not already running, OR running but stale (dead run > 10 min).
    -- NOTE: never touches script_body — a prior good script stays live during regen.
    WHERE kpi_call_scripts.status <> 'processing'
       OR kpi_call_scripts.updated_at < now() - interval '10 minutes'
  RETURNING id INTO v_id;
  RETURN v_id; -- NULL => a fresh generation is already in flight => caller returns 409
END;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_claim_call_script(uuid,uuid,uuid,uuid) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_call_scripts TO authenticated;
GRANT ALL ON public.kpi_call_scripts TO service_role;

COMMENT ON TABLE public.kpi_call_scripts IS
  'One AI master coaching script per call type per IMO. Admin-generated, agent-viewable when script_body is non-null. Regenerate UPSERTs via kpi_claim_call_script.';

NOTIFY pgrst, 'reload schema';

COMMIT;
