-- Social Studio template library: owner-saved card "styles" the Spotlight page can
-- re-apply. A template captures the STYLE config only (view, design, font, background
-- preset, sizes) — NOT per-post content (the uploaded agent photo, a background-image
-- data URL, or the caption), which the app strips before saving. Owner-private,
-- IMO-scoped. RLS mirrors public.prospects (owner-scoped + super-admin + revocation_deny).

CREATE TABLE IF NOT EXISTS public.social_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id      uuid NOT NULL REFERENCES public.imos(id),
  agency_id   uuid REFERENCES public.agencies(id),
  owner_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  -- The full SocialStudioConfig (style only). view + design live inside it; no
  -- separate columns (single source of truth, no denormalization to keep in sync).
  config      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_templates_owner ON public.social_templates (owner_id);
CREATE INDEX IF NOT EXISTS idx_social_templates_imo ON public.social_templates (imo_id);

-- updated_at maintenance (generic project trigger fn)
DROP TRIGGER IF EXISTS trigger_update_social_templates_updated_at ON public.social_templates;
CREATE TRIGGER trigger_update_social_templates_updated_at
  BEFORE UPDATE ON public.social_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.social_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees own (within effective IMO); super admins see all in scope.
CREATE POLICY "Owners can view own social templates" ON public.social_templates
  FOR SELECT USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can view all social templates" ON public.social_templates
  FOR SELECT USING (super_admin_in_scope(imo_id));

-- INSERT: auth user creates own row within their effective IMO.
CREATE POLICY "Owners can insert own social templates" ON public.social_templates
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

-- UPDATE: owner updates own; super admins update all in scope.
CREATE POLICY "Owners can update own social templates" ON public.social_templates
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  ) WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can update all social templates" ON public.social_templates
  FOR UPDATE USING (super_admin_in_scope(imo_id));

-- DELETE: owner deletes own; super admins delete all in scope.
CREATE POLICY "Owners can delete own social templates" ON public.social_templates
  FOR DELETE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can delete all social templates" ON public.social_templates
  FOR DELETE USING (super_admin_in_scope(imo_id));

-- Blanket revocation deny (RESTRICTIVE, all commands) — mirrors sibling tables.
CREATE POLICY "revocation_deny" ON public.social_templates
  AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT is_access_revoked(auth.uid())));

-- Grant hardening (project security lesson): anon gets NOTHING; authenticated keeps
-- only the RLS-gated DML and never TRUNCATE/REFERENCES/TRIGGER (TRUNCATE bypasses RLS).
-- A table created after the db-wide TRUNCATE revoke isn't covered by it, so lock it here.
REVOKE ALL ON public.social_templates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_templates TO authenticated;

COMMENT ON TABLE public.social_templates IS
  'Owner-saved Social Studio card style templates (Spotlight). config jsonb = SocialStudioConfig style only; no per-post photo/background-image content.';
