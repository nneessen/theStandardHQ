-- ════════════════════════════════════════════════════════════════════════════
-- kpi_call_listens — per-user "I've listened to this call" marker (training lib).
--
-- Records that a given user has played a recording at least once, so the library
-- can show each agent which calls they've already worked through (a read/unread
-- affordance). One row per (recording, user); created the first time the user
-- presses play. There is no counter and no edit — presence of the row IS the flag.
--
-- Deliberately SELF-SCOPED (unlike kpi_call_likes, which is IMO-wide and counted):
-- the UI only ever needs the CURRENT user's own listened set, so RLS restricts
-- both read and write to the owner. That is the tightest possible policy and needs
-- no imo_id denormalization / trigger. If a future feature wants IMO-wide "who has
-- listened", widen the SELECT policy then (and add imo_id) — not before.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.kpi_call_listens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id  UUID NOT NULL REFERENCES public.kpi_call_recordings(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recording_id, user_id)                                          -- one marker per user per call
);

CREATE INDEX IF NOT EXISTS idx_kpi_listen_user      ON public.kpi_call_listens (user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_listen_recording ON public.kpi_call_listens (recording_id);

ALTER TABLE public.kpi_call_listens ENABLE ROW LEVEL SECURITY;

-- Read: only your own listen markers (the library fills only the current user's
-- read/unread state).
DROP POLICY IF EXISTS kpi_call_listens_select ON public.kpi_call_listens;
CREATE POLICY kpi_call_listens_select ON public.kpi_call_listens
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Insert: mark a call as listened, attributing the marker to yourself only.
DROP POLICY IF EXISTS kpi_call_listens_insert ON public.kpi_call_listens;
CREATE POLICY kpi_call_listens_insert ON public.kpi_call_listens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Delete: a user may clear their own marker (e.g. to re-flag a call as unlistened).
-- No admin override — the marker is personal.
DROP POLICY IF EXISTS kpi_call_listens_delete ON public.kpi_call_listens;
CREATE POLICY kpi_call_listens_delete ON public.kpi_call_listens
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
