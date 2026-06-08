-- Migration: SureLC access links
-- Adds a single table backing the Licensing hub "SureLC" tab. Dual-ownership model:
--   owner_user_id IS NULL      -> COMPANY/SHARED link (super-admin managed, IMO-scoped)
--   owner_user_id = auth.uid() -> PERSONAL link owned by that agent
-- Reads are tenant-scoped: an agent sees shared links in their EFFECTIVE IMO plus
-- their own personal links; super-admins see all. Writes to shared links are
-- super-admin-only; writes to personal links are owner-only.
--
-- RLS helpers are wrapped as (SELECT fn()) so the planner hoists them to a
-- once-per-query InitPlan instead of evaluating per-row (see project memory
-- "user_profiles SELECT RLS — InitPlan-hoist").

-- ============================================================================
-- 1. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.surelc_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id        uuid NOT NULL REFERENCES imos(id) ON DELETE CASCADE,
  -- NULL = company/shared link (super-admin); otherwise the owning agent
  owner_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,

  label         text NOT NULL,
  url           text NOT NULL,
  description   text,

  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,

  created_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.surelc_links IS
  'SureLC portal links shown in the Licensing hub. owner_user_id IS NULL = company/shared (super-admin managed, IMO-scoped); set = personal link owned by that agent.';
COMMENT ON COLUMN public.surelc_links.owner_user_id IS
  'NULL for company/shared links (super-admin managed); otherwise the agent who owns this personal link.';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Shared-link lookups by IMO (the common public read path)
CREATE INDEX IF NOT EXISTS idx_surelc_links_shared_by_imo
  ON public.surelc_links (imo_id) WHERE owner_user_id IS NULL;

-- Personal-link lookups by owner
CREATE INDEX IF NOT EXISTS idx_surelc_links_owner
  ON public.surelc_links (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- ============================================================================
-- 3. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_surelc_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_surelc_links_updated_at ON public.surelc_links;
CREATE TRIGGER trigger_surelc_links_updated_at
  BEFORE UPDATE ON public.surelc_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_surelc_links_updated_at();

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.surelc_links ENABLE ROW LEVEL SECURITY;

-- SELECT: super-admin (all) OR own personal link OR shared link in my effective IMO
DROP POLICY IF EXISTS surelc_links_select ON public.surelc_links;
CREATE POLICY surelc_links_select
  ON public.surelc_links FOR SELECT
  TO authenticated
  USING (
    (SELECT is_super_admin())
    OR owner_user_id = (SELECT auth.uid())
    OR (owner_user_id IS NULL AND imo_id = (SELECT get_effective_imo_id()))
  );

-- INSERT: personal link for myself, OR a shared link in my effective IMO if super-admin
DROP POLICY IF EXISTS surelc_links_insert ON public.surelc_links;
CREATE POLICY surelc_links_insert
  ON public.surelc_links FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = (SELECT auth.uid())
    OR (
      owner_user_id IS NULL
      AND (SELECT is_super_admin())
      AND imo_id = (SELECT get_effective_imo_id())
    )
  );

-- UPDATE: my own personal link, OR a shared link if super-admin
DROP POLICY IF EXISTS surelc_links_update ON public.surelc_links;
CREATE POLICY surelc_links_update
  ON public.surelc_links FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = (SELECT auth.uid())
    OR (owner_user_id IS NULL AND (SELECT is_super_admin()))
  )
  WITH CHECK (
    owner_user_id = (SELECT auth.uid())
    OR (owner_user_id IS NULL AND (SELECT is_super_admin()))
  );

-- DELETE: my own personal link, OR a shared link if super-admin
DROP POLICY IF EXISTS surelc_links_delete ON public.surelc_links;
CREATE POLICY surelc_links_delete
  ON public.surelc_links FOR DELETE
  TO authenticated
  USING (
    owner_user_id = (SELECT auth.uid())
    OR (owner_user_id IS NULL AND (SELECT is_super_admin()))
  );
