-- Social Studio carousel deck library (#8 Phase 3A): owner-saved ordered decks the
-- Carousel builder can reload and re-post. A deck stores the ORDERED slide specs +
-- the deck-level theme/format — NOT the rendered leaderboard numbers. Data slides are
-- re-derived from LIVE metrics on load (the spec keeps only the view); marketing slides
-- are static copy, so their content (incl. a user-supplied image data URL) is snapshotted.
-- Owner-private, IMO-scoped. RLS mirrors public.social_templates (the sibling owner-saved
-- Social Studio table): owner-scoped + super-admin + revocation_deny, direct RLS DML.

CREATE TABLE IF NOT EXISTS public.social_carousel_decks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id      uuid NOT NULL REFERENCES public.imos(id),
  owner_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  -- Versioned deck spec: { v: 1, slides: [ {t:"data",view} | {t:"marketing",variant,...} ] }.
  -- jsonb (not separate columns) so the persisted format can evolve without a migration.
  slides      jsonb NOT NULL,
  format      text NOT NULL,   -- portrait | square | story (SocialFormat)
  card_theme  text NOT NULL,   -- spotlight | editorial | lift (CardTheme)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_carousel_decks_owner ON public.social_carousel_decks (owner_id);
CREATE INDEX IF NOT EXISTS idx_social_carousel_decks_imo ON public.social_carousel_decks (imo_id);

-- updated_at maintenance (generic project trigger fn)
DROP TRIGGER IF EXISTS trigger_update_social_carousel_decks_updated_at ON public.social_carousel_decks;
CREATE TRIGGER trigger_update_social_carousel_decks_updated_at
  BEFORE UPDATE ON public.social_carousel_decks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.social_carousel_decks ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees own (within effective IMO); super admins see all in scope.
CREATE POLICY "Owners can view own carousel decks" ON public.social_carousel_decks
  FOR SELECT USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can view all carousel decks" ON public.social_carousel_decks
  FOR SELECT USING (super_admin_in_scope(imo_id));

-- INSERT: auth user creates own row within their effective IMO.
CREATE POLICY "Owners can insert own carousel decks" ON public.social_carousel_decks
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

-- UPDATE: owner updates own; super admins update all in scope.
CREATE POLICY "Owners can update own carousel decks" ON public.social_carousel_decks
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  ) WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can update all carousel decks" ON public.social_carousel_decks
  FOR UPDATE USING (super_admin_in_scope(imo_id));

-- DELETE: owner deletes own; super admins delete all in scope.
CREATE POLICY "Owners can delete own carousel decks" ON public.social_carousel_decks
  FOR DELETE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can delete all carousel decks" ON public.social_carousel_decks
  FOR DELETE USING (super_admin_in_scope(imo_id));

-- Blanket revocation deny (RESTRICTIVE, all commands) — mirrors sibling tables.
CREATE POLICY "revocation_deny" ON public.social_carousel_decks
  AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT is_access_revoked(auth.uid())));

-- Grant hardening (project security lesson): anon gets NOTHING; authenticated keeps only
-- the RLS-gated DML and never TRUNCATE/REFERENCES/TRIGGER (TRUNCATE bypasses RLS). A table
-- created after the db-wide TRUNCATE revoke isn't covered by it, so lock it here.
REVOKE ALL ON public.social_carousel_decks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_carousel_decks TO authenticated;

COMMENT ON TABLE public.social_carousel_decks IS
  'Owner-saved Social Studio carousel decks (#8). slides jsonb = versioned ordered slide specs; data slides re-derived from live metrics on load, marketing slides snapshotted.';
