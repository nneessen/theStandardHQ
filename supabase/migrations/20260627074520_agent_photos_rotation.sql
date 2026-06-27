-- Agent photo manager + multi-photo rotation (Social Studio Phase C-B).
-- A super-admin / IMO admin can upload MULTIPLE photos on behalf of an agent (in the
-- "New Agents" studio section); welcome graphics auto-rotate through them so posts vary.
--
-- Design:
--   • agent_photos      — N photos per agent. sort_order = rotation order; is_primary =
--                         the avatar (DECOUPLED from sort_order). imo-scoped, admin-managed.
--   • photo_rotation_idx — per-agent rotation cursor on user_profiles (bumped after a post).
--   • sync trigger      — keeps user_profiles.profile_photo_url (the stable avatar consumed
--                         by leaderboard/org-chart/KPI/recruiting) in lockstep with the
--                         primary agent_photos photo. Exception-safe — never aborts a photo
--                         write. Because it moves profile_photo_url NULL→non-NULL on the
--                         FIRST photo, the existing welcome trigger still queues a draft.
--   • storage policies  — admin INSERT/UPDATE/DELETE on recruiting-assets, TENANT-SCOPED to
--                         an agent in the caller's IMO (storage.objects has no imo_id).
--   • bump RPC          — increments the rotation cursor, scoped to the caller's IMO.

-- ── 1. Rotation cursor ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS photo_rotation_idx integer NOT NULL DEFAULT 0;

-- ── 2. agent_photos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id      uuid NOT NULL REFERENCES public.imos(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url   text NOT NULL,
  -- Rotation order (which photo the next post cycles to). DECOUPLED from is_primary.
  sort_order  integer NOT NULL DEFAULT 0,
  -- The avatar shown everywhere (synced to user_profiles.profile_photo_url). At most one
  -- per agent (partial unique index below).
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS agent_photos_agent_order_idx
  ON public.agent_photos (agent_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS agent_photos_imo_idx
  ON public.agent_photos (imo_id);
-- At most ONE primary photo per agent.
CREATE UNIQUE INDEX IF NOT EXISTS agent_photos_one_primary_per_agent
  ON public.agent_photos (agent_id)
  WHERE is_primary;

ALTER TABLE public.agent_photos ENABLE ROW LEVEL SECURITY;

-- RLS: an IMO admin manages photos for agents in their OWN imo. SELECT/UPDATE/DELETE key
-- off the (trigger-guaranteed-correct) imo_id column; INSERT additionally requires the
-- target agent to live in the caller's imo — so a row can never be attached to (and thus
-- the SECURITY DEFINER sync trigger can never mutate) an agent in another tenant.
DROP POLICY IF EXISTS agent_photos_admin_select ON public.agent_photos;
CREATE POLICY agent_photos_admin_select ON public.agent_photos
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS agent_photos_admin_insert ON public.agent_photos;
CREATE POLICY agent_photos_admin_insert ON public.agent_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = agent_id AND up.imo_id = public.get_my_imo_id()
    )
  );

DROP POLICY IF EXISTS agent_photos_admin_update ON public.agent_photos;
CREATE POLICY agent_photos_admin_update ON public.agent_photos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  )
  WITH CHECK (
    public.is_admin()
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS agent_photos_admin_delete ON public.agent_photos;
CREATE POLICY agent_photos_admin_delete ON public.agent_photos
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

-- ── 3. Sync trigger: agent_photos → user_profiles.profile_photo_url ────────────────
-- AFTER INSERT/UPDATE/DELETE. Exception-safe (a photo write must never fail because of
-- this). The agent is COALESCE(NEW, OLD).agent_id so it resolves on the DELETE path too.
CREATE OR REPLACE FUNCTION public.sync_agent_primary_photo()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent uuid := COALESCE(NEW.agent_id, OLD.agent_id);
  v_url   text;
BEGIN
  BEGIN
    -- The resolved avatar = the primary photo, else the lowest sort_order, else none.
    SELECT ap.photo_url INTO v_url
    FROM public.agent_photos ap
    WHERE ap.agent_id = v_agent
    ORDER BY ap.is_primary DESC, ap.sort_order ASC, ap.created_at ASC
    LIMIT 1;

    IF v_url IS NOT NULL THEN
      -- Promote the resolved agent_photos photo to the stable avatar (NULL→url on the
      -- first photo fires the welcome trigger, exactly as a self-upload would).
      UPDATE public.user_profiles
      SET profile_photo_url = v_url
      WHERE id = v_agent
        AND profile_photo_url IS DISTINCT FROM v_url;
    ELSIF TG_OP <> 'INSERT' THEN
      -- No agent_photos remain (only reachable via DELETE). Clear the avatar ONLY if it
      -- was the photo just removed — never clobber an avatar the agent set elsewhere
      -- (e.g. a self-upload via their profile that was never in agent_photos).
      UPDATE public.user_profiles
      SET profile_photo_url = NULL
      WHERE id = v_agent
        AND profile_photo_url = OLD.photo_url;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'sync_agent_primary_photo failed for %: %', v_agent, SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agent_primary_photo ON public.agent_photos;
CREATE TRIGGER trg_sync_agent_primary_photo
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agent_primary_photo();

-- ── 4. Rotation cursor bump (called client-side after a successful post/schedule) ──
-- Scoped to the TARGET agent's imo (an admin can't bump an agent in another tenant).
-- Touches ONLY photo_rotation_idx, so it never fires the welcome trigger.
CREATE OR REPLACE FUNCTION public.bump_agent_photo_rotation(p_agent_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.user_profiles
  SET photo_rotation_idx = photo_rotation_idx + 1
  WHERE id = p_agent_id
    AND imo_id = public.get_my_imo_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_agent_photo_rotation(uuid) TO authenticated;

-- ── 5. Storage: admin write policies on recruiting-assets (tenant-scoped) ───────────
-- storage.objects has no imo_id, so scope by the folder (= an agent id) belonging to an
-- agent in the caller's IMO. Compare the folder TEXT to id::text (no uuid cast). The
-- existing self-serve auth.uid() policies stay untouched.
DROP POLICY IF EXISTS "recruiting_assets_admin_insert" ON storage.objects;
CREATE POLICY "recruiting_assets_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recruiting-assets'
    AND public.is_admin()
    AND (storage.foldername(name))[1] IN (
      SELECT up.id::text FROM public.user_profiles up
      WHERE up.imo_id = public.get_my_imo_id()
    )
  );

DROP POLICY IF EXISTS "recruiting_assets_admin_update" ON storage.objects;
CREATE POLICY "recruiting_assets_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recruiting-assets'
    AND public.is_admin()
    AND (storage.foldername(name))[1] IN (
      SELECT up.id::text FROM public.user_profiles up
      WHERE up.imo_id = public.get_my_imo_id()
    )
  )
  WITH CHECK (
    bucket_id = 'recruiting-assets'
    AND public.is_admin()
    AND (storage.foldername(name))[1] IN (
      SELECT up.id::text FROM public.user_profiles up
      WHERE up.imo_id = public.get_my_imo_id()
    )
  );

DROP POLICY IF EXISTS "recruiting_assets_admin_delete" ON storage.objects;
CREATE POLICY "recruiting_assets_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recruiting-assets'
    AND public.is_admin()
    AND (storage.foldername(name))[1] IN (
      SELECT up.id::text FROM public.user_profiles up
      WHERE up.imo_id = public.get_my_imo_id()
    )
  );
