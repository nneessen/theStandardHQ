-- Agent Roadmap review fixes: B-2 (public bucket) + B-3 (notes visibility gate)
--
-- B-2: The roadmap-content storage bucket was created with public=true,
-- which means objects are served via the /public/ endpoint WITHOUT any
-- JWT or RLS check. Roadmap content (screenshots, process diagrams) should
-- not be accessible to unauthenticated users. Fix: set public=false.
--
-- B-3: roadmap_update_progress_notes was not given the same visibility
-- gate that roadmap_upsert_progress received in the RPC hardening migration.
-- An agent can call it with an arbitrary item_id to enumerate draft items
-- in their own agency. Fix: add the same EXISTS check.

-- ============================================================================
-- B-2: REVERTED — bucket stays public.
--
-- The review flagged public=true as a risk (unauthenticated image access).
-- However, the stored image URLs use the /object/public/ path, and making
-- the bucket private breaks ALL existing image blocks (they render as broken
-- img icons). The images are instructional content (screenshots, diagrams)
-- that Nick uploads for agent onboarding — not confidential data. The
-- agency UUID in the path is unguessable, and the storage RLS policies
-- still enforce super-admin-only writes. Keeping public=true is the correct
-- trade-off: agents can see images without signed URLs, and the write
-- surface is still locked down.
-- ============================================================================
-- (no-op — bucket remains public as created in 20260411150238)

-- ============================================================================
-- B-3: Add visibility gate to roadmap_update_progress_notes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roadmap_update_progress_notes(
  p_item_id uuid,
  p_notes   text
)
RETURNS public.roadmap_item_progress
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row     public.roadmap_item_progress;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_update_progress_notes: no authenticated user';
  END IF;

  -- B-3 parity: same visibility gate as roadmap_upsert_progress.
  -- The caller must be able to SEE the item (published item in a
  -- published roadmap in the caller's agency). Super-admins bypass
  -- for draft testing.
  IF NOT EXISTS (
    SELECT 1
    FROM public.roadmap_items i
    JOIN public.roadmap_templates t ON t.id = i.roadmap_id
    WHERE i.id = p_item_id
      AND (
        public.is_super_admin()
        OR (
          i.is_published = true
          AND t.is_published = true
          AND t.agency_id IN (
            SELECT agency_id FROM public.user_profiles WHERE id = v_user_id
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'roadmap_update_progress_notes: item % is not accessible', p_item_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.roadmap_item_progress
    (user_id, item_id, status, notes)
  VALUES (v_user_id, p_item_id, 'not_started', p_notes)
  ON CONFLICT (user_id, item_id) DO UPDATE
  SET
    notes      = EXCLUDED.notes,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION public.roadmap_update_progress_notes IS
  'Update agent private notes on an item without touching status or timestamps. '
  'B-3 parity: verifies item is visible to the caller before allowing the write.';

GRANT EXECUTE ON FUNCTION public.roadmap_update_progress_notes(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
