-- ============================================================================
-- Carrier/Product catalog writes never land on a revoked (sunset) IMO
-- ============================================================================
-- Owner directive (Jun 11 2026): "FFG is done. Anything we add from here on out
-- goes to Epic Life." Carriers/products inherit the creator's ACTING imo_id, so
-- adding a carrier while signed into the FFG-homed super-admin (or with the IMO
-- selector on FFG) silently tagged it to the revoked Founders IMO — invisible to
-- Epic Life agents while the see-all super-admin still saw it.
--
-- This BEFORE INSERT OR UPDATE OF imo_id guard catches EVERY write path
-- (frontend, edge functions, scripts, manual SQL): if a carrier/product would
-- land on a revoked IMO (access_revoked_at IS NOT NULL — i.e. FFG on prod) or on
-- no IMO at all, it is redirected to the active tenant (Epic Life, resolved BY
-- NAME so it is portable across LOCAL/PROD whose ids differ). It does NOT touch
-- existing rows or non-revoked tenants, so a legitimate second live IMO is
-- unaffected.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_active_tenant_on_catalog()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_epic_id uuid;
  v_revoked boolean;
BEGIN
  SELECT id INTO v_epic_id FROM public.imos WHERE name = 'Epic Life' LIMIT 1;

  -- Defensive: if the active tenant can't be resolved (bare test DB), do not
  -- force imo_id to NULL — leave the row untouched and let normal constraints
  -- run. Never weaken to NULL.
  IF v_epic_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- No IMO supplied -> active tenant.
  IF NEW.imo_id IS NULL THEN
    NEW.imo_id := v_epic_id;
    RETURN NEW;
  END IF;

  -- Target IMO is revoked (sunset FFG) -> redirect to the active tenant.
  SELECT (access_revoked_at IS NOT NULL) INTO v_revoked
    FROM public.imos WHERE id = NEW.imo_id;
  IF COALESCE(v_revoked, false) THEN
    NEW.imo_id := v_epic_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_active_tenant_on_carriers ON public.carriers;
CREATE TRIGGER enforce_active_tenant_on_carriers
  BEFORE INSERT OR UPDATE OF imo_id ON public.carriers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_tenant_on_catalog();

DROP TRIGGER IF EXISTS enforce_active_tenant_on_products ON public.products;
CREATE TRIGGER enforce_active_tenant_on_products
  BEFORE INSERT OR UPDATE OF imo_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_tenant_on_catalog();
