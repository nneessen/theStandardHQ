-- Lockdown for settings tables that haven't received the May 19 imo-scoping
-- migration (20260519090000_harden_imo_scoped_settings.sql).
--
-- Remote production is missing that migration entirely. On remote:
--   * `constants` lacks imo_id and allows any approved user to INSERT/UPDATE/DELETE ALL rows.
--   * `product_commission_overrides` lacks imo_id and allows any authenticated user ALL ops.
--
-- These hold global config (income targets, avg premium, etc.) — never
-- Epic Life data — but the broad write policies mean any FFG user could pollute
-- them with cross-tenant data. Lock writes down to super_admin until the May 19
-- migration is properly synced.
--
-- IDEMPOTENT: only applies the lockdown if imo_id is MISSING (the post-May-19
-- state on local has imo_id and proper scoped policies that we want to keep).

DO $$
BEGIN
  -- constants lockdown (only if imo_id missing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='constants' AND column_name='imo_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Approved users can manage constants" ON public.constants';
    EXECUTE 'DROP POLICY IF EXISTS constants_super_admin_manage ON public.constants';
    EXECUTE 'CREATE POLICY constants_super_admin_manage ON public.constants FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
    -- Keep the existing global SELECT for authenticated; constants is read-only public config.
  END IF;

  -- product_commission_overrides lockdown (only if imo_id missing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='product_commission_overrides' AND column_name='imo_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage commission overrides" ON public.product_commission_overrides';
    EXECUTE 'DROP POLICY IF EXISTS product_commission_overrides_super_admin_manage ON public.product_commission_overrides';
    EXECUTE 'CREATE POLICY product_commission_overrides_super_admin_manage ON public.product_commission_overrides FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;
