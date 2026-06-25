-- Social Studio carousel decks: remove the permanently-dead `(imo_id IS NULL)` disjunct from
-- the four owner RLS policies (review #9).
--
-- social_carousel_decks.imo_id is declared NOT NULL, so `(imo_id IS NULL)` can never be true —
-- it was copy-pasted from social_templates (whose imo_id is also NOT NULL, so the same dead
-- predicate exists there). Harmless today, but a latent footgun: it reads as if it scopes by
-- IMO when one branch is inert. Recreate each owner policy with the real scope only:
--   owner_id = auth.uid()  AND  (no IMO override  OR  row's IMO = the effective IMO).
-- The `get_effective_imo_id() IS NULL` branch is intentional (a super-admin with no acting
-- scope sees their own rows across IMOs) and is kept. Super-admin-all access is unchanged
-- (separate super_admin_in_scope policies). The revocation_deny RESTRICTIVE policy is untouched.

DROP POLICY IF EXISTS "Owners can view own carousel decks"   ON public.social_carousel_decks;
DROP POLICY IF EXISTS "Owners can insert own carousel decks" ON public.social_carousel_decks;
DROP POLICY IF EXISTS "Owners can update own carousel decks" ON public.social_carousel_decks;
DROP POLICY IF EXISTS "Owners can delete own carousel decks" ON public.social_carousel_decks;

CREATE POLICY "Owners can view own carousel decks" ON public.social_carousel_decks
  FOR SELECT USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Owners can insert own carousel decks" ON public.social_carousel_decks
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Owners can update own carousel decks" ON public.social_carousel_decks
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
  ) WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Owners can delete own carousel decks" ON public.social_carousel_decks
  FOR DELETE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
  );
