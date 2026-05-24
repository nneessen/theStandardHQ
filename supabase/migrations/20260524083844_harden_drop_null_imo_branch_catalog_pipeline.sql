-- ============================================================================
-- Defensive hardening: drop the latent `OR imo_id IS NULL` read escape
-- ============================================================================
--
-- Epic Life isolation audit part 4 (2026-05-24). SELECT policies on the shared
-- reference tables used `(imo_id = get_my_imo_id() OR imo_id IS NULL)`. Today the
-- `OR imo_id IS NULL` branch is dormant — every row is owned by the FFG IMO
-- (ffffffff-...) and zero null-imo rows exist (verified) — so it changes nothing
-- now. But the BEFORE-INSERT trigger set_imo_id_from_user() leaves imo_id NULL on
-- any service_role insert (auth.uid() NULL → derived imo NULL), so a future bulk
-- import could create a null-imo row that this branch would expose to EVERY
-- tenant (including a normal Epic Life user). Per product decision (2026-05-24),
-- Epic Life starts with its OWN empty catalog/pipelines and shares nothing from
-- FFG, so the null escape is removed entirely.
--
-- Scope: only the 4 base tables (carriers, products, comp_guide, pipeline_templates).
-- Child policies on pipeline_phases / phase_checklist_items / pipeline_automations
-- reference pipeline_templates via EXISTS subqueries, which themselves honor
-- pipeline_templates RLS — once the parent hides null-imo rows, the children's
-- `pt.imo_id IS NULL` branches are unreachable, so they are intentionally left
-- untouched (minimal surface on the live tenant).
--
-- Method: ALTER POLICY ... USING (...) swaps only the USING expression and
-- preserves cmd/roles/permissive (carriers/products/comp_guide/imo_select are
-- {authenticated}; default_select/upline_select are {public}). Both the normal-
-- user branch (Part A) and the super-admin acting clause's null disjunct (Part B)
-- have their `OR (imo_id IS NULL)` removed; Part B stays correct
-- (super-admin not acting → get_effective_imo_id() IS NULL → see-all; acting → own).
--
-- NOTE: pipeline_templates_default_select keys off name ILIKE '%DEFAULT%' — the
-- cross-IMO "shared DEFAULT template" mechanism. Nick chose "start empty" (not
-- "share DEFAULT"), so dropping the null branch deliberately ends DEFAULT-template
-- sharing via null imo_id. FFG-owned DEFAULT templates remain visible to FFG users
-- via imo_id = get_my_imo_id().
--
-- Reproduces FFG-user read parity (14 carriers / 65 products / 910 comp_guide /
-- 4 pipeline_templates) and keeps Epic at zero — verified behaviorally.
-- ============================================================================

BEGIN;

-- carriers
ALTER POLICY "Users can view carriers in own IMO" ON public.carriers
USING (
  (imo_id = get_my_imo_id())
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

-- products
ALTER POLICY "Users can view products in own IMO" ON public.products
USING (
  (imo_id = get_my_imo_id())
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

-- comp_guide
ALTER POLICY "Users can view comp_guide in own IMO" ON public.comp_guide
USING (
  (imo_id = get_my_imo_id())
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

-- pipeline_templates: default templates (name ILIKE '%DEFAULT%') — {public}
ALTER POLICY pipeline_templates_default_select ON public.pipeline_templates
USING (
  (name ~~* '%DEFAULT%'::text)
  AND (is_active = true)
  AND (imo_id = get_my_imo_id())
);

-- pipeline_templates: imo admins / staff — {authenticated}
ALTER POLICY pipeline_templates_imo_select ON public.pipeline_templates
USING (
  (is_imo_admin() OR is_imo_staff_role())
  AND (imo_id = get_my_imo_id())
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

-- pipeline_templates: upline/recruiter of an assigned recruit — {public}
ALTER POLICY pipeline_templates_upline_select ON public.pipeline_templates
USING (
  (imo_id = get_my_imo_id())
  AND (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE (((up.recruiter_id = auth.uid()) OR (up.upline_id = auth.uid()))
      AND (up.pipeline_template_id = pipeline_templates.id))
  ))
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

-- pipeline_templates: agency owner (keeps the created_by ownership escape) — {authenticated}
ALTER POLICY pipeline_templates_agency_owner_select ON public.pipeline_templates
USING (
  is_agency_owner(NULL::uuid)
  AND ((imo_id = get_my_imo_id()) OR (created_by = (SELECT auth.uid() AS uid)))
  AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))
);

COMMIT;
