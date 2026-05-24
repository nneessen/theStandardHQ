-- ============================================================================
-- IMO-level "all features free" entitlement
-- ============================================================================
--
-- The Standard HQ is an internal platform; agents are not meant to pay. Feature
-- gating (useFeatureAccess) checks per-user subscription plans, so Epic Life users
-- (owner + agents, all on the free plan) hit "upgrade" walls on Team/recruiting/
-- analytics/etc. Per Nick (2026-05-24): every Epic Life user gets ALL subscription
-- features free, automatically, including future agents.
--
-- Mechanism: an IMO-level flag, read by a SECURITY DEFINER helper keyed off the
-- caller's OWN imo (not acting imo). The frontend treats it as a full
-- subscription-feature bypass — parallel to the super-admin bypass, but it grants
-- ONLY subscription features. Admin pages, system settings, and carrier/product
-- management remain gated by ROLES/permissions (is_admin / can() / is_super_admin),
-- so agents still cannot reach them; the IMO owner reaches IMO-admin via their
-- admin role as before.
-- ============================================================================

BEGIN;

ALTER TABLE public.imos
  ADD COLUMN IF NOT EXISTS free_all_features boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.imos.free_all_features IS
  'When true, every user in this IMO gets all subscription features free (full feature-gate bypass). Admin/system access stays role-gated. Set for internal/comp IMOs.';

-- Epic Life: internal IMO, no one pays.
UPDATE public.imos
  SET free_all_features = true
  WHERE name = 'Epic Life';

-- Helper: does the CURRENT user's own IMO grant all features?
-- SECURITY DEFINER so a normal user can read their own IMO's flag regardless of
-- imos RLS. Uses the user's profile imo_id (not acting imo) — feature entitlement
-- follows real membership, and super-admins bypass gating separately anyway.
CREATE OR REPLACE FUNCTION public.current_user_imo_grants_all_features()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT i.free_all_features
    FROM public.user_profiles up
    JOIN public.imos i ON i.id = up.imo_id
    WHERE up.id = auth.uid()
  ), false);
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_imo_grants_all_features() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_imo_grants_all_features() TO authenticated, service_role;

COMMIT;
