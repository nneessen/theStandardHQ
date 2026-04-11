-- Agent Roadmap: RLS policies + storage bucket
-- Follows: 20260411150237_agent_roadmap_schema.sql
--
-- Authorization model:
--   - Super-admin: full CRUD on all roadmap content + read all progress rows
--   - Same-agency agent: read published content, write own progress rows only
--   - Cross-agency: blocked
--   - Progress rows: users never DELETE (audit trail); super-admin can clean up

-- ============================================================================
-- 1. ENABLE RLS
-- ============================================================================

ALTER TABLE public.roadmap_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_sections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_item_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. roadmap_templates POLICIES
-- ============================================================================

DROP POLICY IF EXISTS rt_select ON public.roadmap_templates;
CREATE POLICY rt_select ON public.roadmap_templates
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      is_published = true
      AND agency_id IN (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS rt_insert ON public.roadmap_templates;
CREATE POLICY rt_insert ON public.roadmap_templates
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS rt_update ON public.roadmap_templates;
CREATE POLICY rt_update ON public.roadmap_templates
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS rt_delete ON public.roadmap_templates;
CREATE POLICY rt_delete ON public.roadmap_templates
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- 3. roadmap_sections POLICIES
-- Agents must see sections ONLY when parent template is published in their agency
-- ============================================================================

DROP POLICY IF EXISTS rs_select ON public.roadmap_sections;
CREATE POLICY rs_select ON public.roadmap_sections
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.roadmap_templates t
      WHERE t.id = roadmap_sections.roadmap_id
        AND t.is_published = true
        AND t.agency_id IN (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS rs_write ON public.roadmap_sections;
CREATE POLICY rs_write ON public.roadmap_sections
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================================
-- 4. roadmap_items POLICIES
-- Agents see items only if BOTH item.is_published AND template.is_published,
-- and template belongs to their agency
-- ============================================================================

DROP POLICY IF EXISTS ri_select ON public.roadmap_items;
CREATE POLICY ri_select ON public.roadmap_items
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1 FROM public.roadmap_templates t
        WHERE t.id = roadmap_items.roadmap_id
          AND t.is_published = true
          AND t.agency_id IN (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS ri_write ON public.roadmap_items;
CREATE POLICY ri_write ON public.roadmap_items
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================================
-- 5. roadmap_item_progress POLICIES
-- Users read their own; super-admin reads all. Users never DELETE.
-- ============================================================================

DROP POLICY IF EXISTS rp_select ON public.roadmap_item_progress;
CREATE POLICY rp_select ON public.roadmap_item_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS rp_insert ON public.roadmap_item_progress;
CREATE POLICY rp_insert ON public.roadmap_item_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND agency_id IN (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS rp_update ON public.roadmap_item_progress;
CREATE POLICY rp_update ON public.roadmap_item_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rp_delete_super ON public.roadmap_item_progress;
CREATE POLICY rp_delete_super ON public.roadmap_item_progress
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- 6. STORAGE BUCKET — roadmap-content
-- Path pattern: {agencyId}/{roadmapId}/{itemId}/{uuid}-{filename}
-- Public read (authenticated); super-admin writes
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'roadmap-content',
  'roadmap-content',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Read: any authenticated user whose agency_id matches the first folder in the path
DROP POLICY IF EXISTS "Roadmap content readable by same agency" ON storage.objects;
CREATE POLICY "Roadmap content readable by same agency"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'roadmap-content'
    AND (
      is_super_admin()
      OR (
        (storage.foldername(name))[1] IN (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Insert / Update / Delete: super-admin only
DROP POLICY IF EXISTS "Roadmap content insert super admin" ON storage.objects;
CREATE POLICY "Roadmap content insert super admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'roadmap-content' AND is_super_admin()
  );

DROP POLICY IF EXISTS "Roadmap content update super admin" ON storage.objects;
CREATE POLICY "Roadmap content update super admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'roadmap-content' AND is_super_admin())
  WITH CHECK (bucket_id = 'roadmap-content' AND is_super_admin());

DROP POLICY IF EXISTS "Roadmap content delete super admin" ON storage.objects;
CREATE POLICY "Roadmap content delete super admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'roadmap-content' AND is_super_admin());

NOTIFY pgrst, 'reload schema';
