-- ════════════════════════════════════════════════════════════════════════════
-- kpi_call_likes — per-user "heart/like" on a call recording (training library).
--
-- Any agent in the IMO can like any recording in their IMO; one like per user per
-- recording (UNIQUE). A like is a public, counted reaction — there is no edit, only
-- toggle (insert to like, delete to unlike). A denormalized `like_count` on the
-- parent recording (maintained by a SECURITY DEFINER trigger) lets the server-side
-- paginated library sort by "most liked" without re-aggregating every page.
--
-- Mirrors kpi_call_markers: imo_id is denormalized from the parent recording by a
-- BEFORE-INSERT trigger (never trusted from the client), and reads are IMO-wide.
-- ════════════════════════════════════════════════════════════════════════════

-- A. Denormalized counter on the recording (sortable under offset pagination).
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- B. The likes table.
CREATE TABLE IF NOT EXISTS public.kpi_call_likes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id        UUID NOT NULL REFERENCES public.imos(id),                 -- denorm (= recording.imo_id); set by trigger
  recording_id  UUID NOT NULL REFERENCES public.kpi_call_recordings(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recording_id, user_id)                                          -- one like per user per call
);

CREATE INDEX IF NOT EXISTS idx_kpi_like_recording ON public.kpi_call_likes (recording_id);
CREATE INDEX IF NOT EXISTS idx_kpi_like_user      ON public.kpi_call_likes (user_id);

ALTER TABLE public.kpi_call_likes ENABLE ROW LEVEL SECURITY;

-- C. Derive imo_id from the parent recording (never trust the client). Mirrors
--    kpi_marker_set_denorm; the recording_id FK checks existence only, not tenancy.
CREATE OR REPLACE FUNCTION public.kpi_like_set_denorm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo uuid;
BEGIN
  SELECT r.imo_id INTO v_imo
  FROM public.kpi_call_recordings r
  WHERE r.id = NEW.recording_id;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'kpi_call_likes: parent recording % not found', NEW.recording_id;
  END IF;
  NEW.imo_id := v_imo;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kpi_like_set_denorm
  BEFORE INSERT ON public.kpi_call_likes
  FOR EACH ROW EXECUTE FUNCTION public.kpi_like_set_denorm();

-- D. Keep kpi_call_recordings.like_count in sync. SECURITY DEFINER so a plain agent
--    liking a call can bump the counter even though they have no write grant on the
--    recording row itself. Touches only like_count.
--    Note: deleting a recording cascades its like rows, firing this AFTER DELETE on a
--    parent that is itself being deleted — the UPDATE is a harmless no-op in that case.
CREATE OR REPLACE FUNCTION public.kpi_like_count_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.kpi_call_recordings
       SET like_count = like_count + 1
     WHERE id = NEW.recording_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.kpi_call_recordings
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.recording_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_kpi_like_count_sync
  AFTER INSERT OR DELETE ON public.kpi_call_likes
  FOR EACH ROW EXECUTE FUNCTION public.kpi_like_count_sync();

-- E. RLS.
-- Read: IMO-wide (likes on shared training calls are visible to the whole IMO, so
-- the count and "who liked" can be shown). Mirrors kpi_call_markers_select.
DROP POLICY IF EXISTS kpi_call_likes_select ON public.kpi_call_likes;
CREATE POLICY kpi_call_likes_select ON public.kpi_call_likes
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

-- Insert: any agent in the IMO, attributing the like to themselves.
DROP POLICY IF EXISTS kpi_call_likes_insert ON public.kpi_call_likes;
CREATE POLICY kpi_call_likes_insert ON public.kpi_call_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND imo_id = (SELECT get_my_imo_id())
  );

-- Delete: only the author can remove their own like (unlike). No admin override —
-- a like is personal; archiving/deleting the recording is the moderation lever.
DROP POLICY IF EXISTS kpi_call_likes_delete ON public.kpi_call_likes;
CREATE POLICY kpi_call_likes_delete ON public.kpi_call_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
