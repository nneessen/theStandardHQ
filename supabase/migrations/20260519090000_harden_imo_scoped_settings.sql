-- Harden IMO-scoped settings/reference data.
--
-- Tenant-owned settings must not have shared NULL/global rows. Super admins can
-- still manage multiple IMOs, but ordinary reads/writes are scoped to the
-- caller's IMO and cross-IMO references are rejected at the database boundary.

-- ---------------------------------------------------------------------------
-- 1. Lock the insert helper to public schema and require an IMO.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_imo_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_imo_id uuid;
BEGIN
  IF NEW.imo_id IS NULL THEN
    SELECT imo_id
    INTO v_user_imo_id
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF v_user_imo_id IS NULL THEN
      RAISE EXCEPTION 'Cannot infer IMO for authenticated user'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.imo_id := v_user_imo_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Backfill and require tenant IDs on settings tables.
-- ---------------------------------------------------------------------------
UPDATE public.comp_guide cg
SET imo_id = p.imo_id
FROM public.products p
WHERE cg.imo_id IS NULL
  AND cg.product_id = p.id
  AND p.imo_id IS NOT NULL;

UPDATE public.comp_guide cg
SET imo_id = c.imo_id
FROM public.carriers c
WHERE cg.imo_id IS NULL
  AND cg.carrier_id = c.id
  AND c.imo_id IS NOT NULL;

ALTER TABLE public.carriers
  ALTER COLUMN imo_id SET NOT NULL;

ALTER TABLE public.products
  ALTER COLUMN imo_id SET NOT NULL;

ALTER TABLE public.comp_guide
  ALTER COLUMN imo_id SET NOT NULL;

-- Convert constants from global key/value rows to per-IMO rows.
ALTER TABLE public.constants
  ADD COLUMN IF NOT EXISTS imo_id uuid REFERENCES public.imos(id) ON DELETE CASCADE;

ALTER TABLE public.constants
  DROP CONSTRAINT IF EXISTS constants_key_key;

CREATE TEMP TABLE tmp_global_constants_to_scope AS
SELECT key, value, category, description, created_at, updated_at
FROM public.constants
WHERE imo_id IS NULL;

DELETE FROM public.constants
WHERE imo_id IS NULL;

INSERT INTO public.constants (
  key,
  value,
  category,
  description,
  created_at,
  updated_at,
  imo_id
)
SELECT
  t.key,
  t.value,
  t.category,
  t.description,
  COALESCE(t.created_at, now()),
  COALESCE(t.updated_at, now()),
  i.id
FROM tmp_global_constants_to_scope t
CROSS JOIN public.imos i
WHERE NOT EXISTS (
  SELECT 1
  FROM public.constants existing
  WHERE existing.imo_id = i.id
    AND existing.key = t.key
);

DROP TABLE tmp_global_constants_to_scope;

ALTER TABLE public.constants
  ALTER COLUMN imo_id SET NOT NULL;

-- product_commission_overrides is compensation settings data and must be IMO
-- scoped through its product.
ALTER TABLE public.product_commission_overrides
  ADD COLUMN IF NOT EXISTS imo_id uuid REFERENCES public.imos(id) ON DELETE CASCADE;

UPDATE public.product_commission_overrides pco
SET imo_id = p.imo_id
FROM public.products p
WHERE pco.product_id = p.id
  AND pco.imo_id IS NULL;

ALTER TABLE public.product_commission_overrides
  ALTER COLUMN imo_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Per-IMO uniqueness. Same carrier/product names can exist in different IMOs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.carriers
  DROP CONSTRAINT IF EXISTS carriers_name_key,
  DROP CONSTRAINT IF EXISTS carriers_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_carriers_imo_lower_name
  ON public.carriers (imo_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS ux_carriers_imo_lower_code
  ON public.carriers (imo_id, lower(code))
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_constants_imo_key
  ON public.constants (imo_id, key);

ALTER TABLE public.comp_guide
  DROP CONSTRAINT IF EXISTS comp_guide_product_contract_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ux_comp_guide_imo_product_contract_effective
  ON public.comp_guide (imo_id, product_id, contract_level, effective_date)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_comp_guide_imo_carrier_type_contract_effective
  ON public.comp_guide (imo_id, carrier_id, product_type, contract_level, effective_date)
  WHERE product_id IS NULL AND carrier_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_commission_overrides_imo_product_level_effective
  ON public.product_commission_overrides (imo_id, product_id, comp_level, effective_date);

-- ---------------------------------------------------------------------------
-- 4. Cross-IMO reference guards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_product_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carrier_imo_id uuid;
BEGIN
  SELECT imo_id
  INTO v_carrier_imo_id
  FROM public.carriers
  WHERE id = NEW.carrier_id;

  IF v_carrier_imo_id IS NULL THEN
    RAISE EXCEPTION 'Carrier not found for product'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.imo_id := COALESCE(NEW.imo_id, v_carrier_imo_id);

  IF NEW.imo_id IS DISTINCT FROM v_carrier_imo_id THEN
    RAISE EXCEPTION 'Product IMO must match carrier IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_imo_consistency ON public.products;
CREATE TRIGGER enforce_product_imo_consistency
  BEFORE INSERT OR UPDATE OF carrier_id, imo_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_imo_consistency();

CREATE OR REPLACE FUNCTION public.enforce_comp_guide_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_imo_id uuid;
  v_product_carrier_id uuid;
  v_carrier_imo_id uuid;
  v_expected_imo_id uuid;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT imo_id, carrier_id
    INTO v_product_imo_id, v_product_carrier_id
    FROM public.products
    WHERE id = NEW.product_id;

    IF v_product_imo_id IS NULL THEN
      RAISE EXCEPTION 'Product not found for comp guide entry'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    v_expected_imo_id := v_product_imo_id;

    IF NEW.carrier_id IS NOT NULL AND NEW.carrier_id IS DISTINCT FROM v_product_carrier_id THEN
      RAISE EXCEPTION 'Comp guide carrier must match product carrier'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.carrier_id := COALESCE(NEW.carrier_id, v_product_carrier_id);
  END IF;

  IF NEW.carrier_id IS NOT NULL THEN
    SELECT imo_id
    INTO v_carrier_imo_id
    FROM public.carriers
    WHERE id = NEW.carrier_id;

    IF v_carrier_imo_id IS NULL THEN
      RAISE EXCEPTION 'Carrier not found for comp guide entry'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    v_expected_imo_id := COALESCE(v_expected_imo_id, v_carrier_imo_id);

    IF v_expected_imo_id IS DISTINCT FROM v_carrier_imo_id THEN
      RAISE EXCEPTION 'Comp guide IMO must match referenced carrier/product IMO'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.imo_id := COALESCE(NEW.imo_id, v_expected_imo_id, public.get_my_imo_id());

  IF NEW.imo_id IS NULL THEN
    RAISE EXCEPTION 'Comp guide entry requires an IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_expected_imo_id IS NOT NULL AND NEW.imo_id IS DISTINCT FROM v_expected_imo_id THEN
    RAISE EXCEPTION 'Comp guide IMO must match referenced carrier/product IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comp_guide_imo_consistency ON public.comp_guide;
CREATE TRIGGER enforce_comp_guide_imo_consistency
  BEFORE INSERT OR UPDATE OF carrier_id, product_id, imo_id ON public.comp_guide
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comp_guide_imo_consistency();

CREATE OR REPLACE FUNCTION public.enforce_product_commission_override_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_imo_id uuid;
BEGIN
  SELECT imo_id
  INTO v_product_imo_id
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_product_imo_id IS NULL THEN
    RAISE EXCEPTION 'Product not found for commission override'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.imo_id := COALESCE(NEW.imo_id, v_product_imo_id);

  IF NEW.imo_id IS DISTINCT FROM v_product_imo_id THEN
    RAISE EXCEPTION 'Commission override IMO must match product IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_commission_override_imo_consistency
  ON public.product_commission_overrides;
CREATE TRIGGER enforce_product_commission_override_imo_consistency
  BEFORE INSERT OR UPDATE OF product_id, imo_id ON public.product_commission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_commission_override_imo_consistency();

CREATE OR REPLACE FUNCTION public.enforce_policy_reference_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_imo_id uuid;
  v_user_imo_id uuid;
  v_carrier_imo_id uuid;
  v_product_imo_id uuid;
  v_product_carrier_id uuid;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT imo_id
    INTO v_user_imo_id
    FROM public.user_profiles
    WHERE id = NEW.user_id;
  END IF;

  v_policy_imo_id := COALESCE(NEW.imo_id, v_user_imo_id, public.get_my_imo_id());

  IF v_policy_imo_id IS NULL THEN
    RAISE EXCEPTION 'Policy requires an IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_user_imo_id IS NOT NULL AND v_user_imo_id IS DISTINCT FROM v_policy_imo_id THEN
    RAISE EXCEPTION 'Policy user must belong to policy IMO'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.carrier_id IS NOT NULL THEN
    SELECT imo_id
    INTO v_carrier_imo_id
    FROM public.carriers
    WHERE id = NEW.carrier_id;

    IF v_carrier_imo_id IS NULL THEN
      RAISE EXCEPTION 'Carrier not found for policy'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_carrier_imo_id IS DISTINCT FROM v_policy_imo_id THEN
      RAISE EXCEPTION 'Policy carrier must belong to policy IMO'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT imo_id, carrier_id
    INTO v_product_imo_id, v_product_carrier_id
    FROM public.products
    WHERE id = NEW.product_id;

    IF v_product_imo_id IS NULL THEN
      RAISE EXCEPTION 'Product not found for policy'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_product_imo_id IS DISTINCT FROM v_policy_imo_id THEN
      RAISE EXCEPTION 'Policy product must belong to policy IMO'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.carrier_id IS NOT NULL AND v_product_carrier_id IS DISTINCT FROM NEW.carrier_id THEN
      RAISE EXCEPTION 'Policy product must belong to selected carrier'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.imo_id := v_policy_imo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_policy_reference_imo_consistency ON public.policies;
CREATE TRIGGER enforce_policy_reference_imo_consistency
  BEFORE INSERT OR UPDATE OF user_id, imo_id, carrier_id, product_id ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_reference_imo_consistency();

-- ---------------------------------------------------------------------------
-- 5. RLS: no shared NULL settings rows.
-- ---------------------------------------------------------------------------
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_guide ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_commission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view carriers in own IMO" ON public.carriers;
DROP POLICY IF EXISTS "IMO admins can manage carriers in own IMO" ON public.carriers;
DROP POLICY IF EXISTS "Super admins can manage all carriers" ON public.carriers;
DROP POLICY IF EXISTS "IMO admins can insert carriers in own IMO" ON public.carriers;
DROP POLICY IF EXISTS "IMO admins can update carriers in own IMO" ON public.carriers;
DROP POLICY IF EXISTS "IMO admins can delete carriers in own IMO" ON public.carriers;
CREATE POLICY "Users can view carriers in own IMO"
  ON public.carriers FOR SELECT TO authenticated
  USING (imo_id = public.get_my_imo_id() OR public.is_super_admin());
CREATE POLICY "IMO admins can insert carriers in own IMO"
  ON public.carriers FOR INSERT TO authenticated
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can update carriers in own IMO"
  ON public.carriers FOR UPDATE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin())
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can delete carriers in own IMO"
  ON public.carriers FOR DELETE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can view products in own IMO" ON public.products;
DROP POLICY IF EXISTS "IMO admins can manage products in own IMO" ON public.products;
DROP POLICY IF EXISTS "Super admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "IMO admins can insert products in own IMO" ON public.products;
DROP POLICY IF EXISTS "IMO admins can update products in own IMO" ON public.products;
DROP POLICY IF EXISTS "IMO admins can delete products in own IMO" ON public.products;
CREATE POLICY "Users can view products in own IMO"
  ON public.products FOR SELECT TO authenticated
  USING (imo_id = public.get_my_imo_id() OR public.is_super_admin());
CREATE POLICY "IMO admins can insert products in own IMO"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can update products in own IMO"
  ON public.products FOR UPDATE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin())
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can delete products in own IMO"
  ON public.products FOR DELETE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can view comp_guide in own IMO" ON public.comp_guide;
DROP POLICY IF EXISTS "IMO admins can manage comp_guide in own IMO" ON public.comp_guide;
DROP POLICY IF EXISTS "Super admins can manage all comp_guide" ON public.comp_guide;
DROP POLICY IF EXISTS "IMO admins can insert comp_guide in own IMO" ON public.comp_guide;
DROP POLICY IF EXISTS "IMO admins can update comp_guide in own IMO" ON public.comp_guide;
DROP POLICY IF EXISTS "IMO admins can delete comp_guide in own IMO" ON public.comp_guide;
CREATE POLICY "Users can view comp_guide in own IMO"
  ON public.comp_guide FOR SELECT TO authenticated
  USING (imo_id = public.get_my_imo_id() OR public.is_super_admin());
CREATE POLICY "IMO admins can insert comp_guide in own IMO"
  ON public.comp_guide FOR INSERT TO authenticated
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can update comp_guide in own IMO"
  ON public.comp_guide FOR UPDATE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin())
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can delete comp_guide in own IMO"
  ON public.comp_guide FOR DELETE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Enable read access for all users" ON public.constants;
DROP POLICY IF EXISTS "Approved users can read constants" ON public.constants;
DROP POLICY IF EXISTS "Approved users can manage constants" ON public.constants;
DROP POLICY IF EXISTS "Users can view constants in own IMO" ON public.constants;
DROP POLICY IF EXISTS "IMO admins can upsert constants in own IMO" ON public.constants;
DROP POLICY IF EXISTS "IMO admins can update constants in own IMO" ON public.constants;
DROP POLICY IF EXISTS "IMO admins can delete constants in own IMO" ON public.constants;
CREATE POLICY "Users can view constants in own IMO"
  ON public.constants FOR SELECT TO authenticated
  USING (imo_id = public.get_my_imo_id() OR public.is_super_admin());
CREATE POLICY "IMO admins can upsert constants in own IMO"
  ON public.constants FOR INSERT TO authenticated
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can update constants in own IMO"
  ON public.constants FOR UPDATE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin())
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can delete constants in own IMO"
  ON public.constants FOR DELETE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins can manage commission overrides" ON public.product_commission_overrides;
DROP POLICY IF EXISTS "Authenticated users can view commission overrides" ON public.product_commission_overrides;
DROP POLICY IF EXISTS "Users can view commission overrides in own IMO" ON public.product_commission_overrides;
DROP POLICY IF EXISTS "IMO admins can insert commission overrides in own IMO" ON public.product_commission_overrides;
DROP POLICY IF EXISTS "IMO admins can update commission overrides in own IMO" ON public.product_commission_overrides;
DROP POLICY IF EXISTS "IMO admins can delete commission overrides in own IMO" ON public.product_commission_overrides;
CREATE POLICY "Users can view commission overrides in own IMO"
  ON public.product_commission_overrides FOR SELECT TO authenticated
  USING (imo_id = public.get_my_imo_id() OR public.is_super_admin());
CREATE POLICY "IMO admins can insert commission overrides in own IMO"
  ON public.product_commission_overrides FOR INSERT TO authenticated
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can update commission overrides in own IMO"
  ON public.product_commission_overrides FOR UPDATE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin())
  WITH CHECK ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());
CREATE POLICY "IMO admins can delete commission overrides in own IMO"
  ON public.product_commission_overrides FOR DELETE TO authenticated
  USING ((imo_id = public.get_my_imo_id() AND public.is_imo_admin()) OR public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 6. Harden SECURITY DEFINER lookup RPCs that accepted caller-supplied IMO IDs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_rate(
  p_product_id uuid,
  p_age int,
  p_gender text,
  p_tobacco_class text,
  p_health_class text,
  p_imo_id uuid DEFAULT NULL
) RETURNS decimal
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate decimal;
  v_imo_id uuid := COALESCE(p_imo_id, public.get_my_imo_id());
BEGIN
  IF v_imo_id IS NULL OR (NOT public.is_super_admin() AND v_imo_id IS DISTINCT FROM public.get_my_imo_id()) THEN
    RAISE EXCEPTION 'Unauthorized IMO access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT rate_per_thousand INTO v_rate
  FROM public.product_rate_table
  WHERE product_id = p_product_id
    AND p_age >= age_band_start
    AND p_age <= age_band_end
    AND gender = p_gender
    AND tobacco_class = p_tobacco_class
    AND health_class = p_health_class
    AND imo_id = v_imo_id
    AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ORDER BY effective_date DESC
  LIMIT 1;

  RETURN v_rate;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_carrier_acceptance(
  p_carrier_id uuid,
  p_condition_code text,
  p_product_type text,
  p_imo_id uuid DEFAULT NULL
) RETURNS TABLE (
  acceptance text,
  health_class_result text,
  approval_likelihood decimal,
  requires_conditions jsonb,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo_id uuid := COALESCE(p_imo_id, public.get_my_imo_id());
BEGIN
  IF v_imo_id IS NULL OR (NOT public.is_super_admin() AND v_imo_id IS DISTINCT FROM public.get_my_imo_id()) THEN
    RAISE EXCEPTION 'Unauthorized IMO access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    ca.acceptance,
    ca.health_class_result,
    ca.approval_likelihood,
    ca.requires_conditions,
    ca.notes
  FROM public.carrier_condition_acceptance ca
  WHERE ca.carrier_id = p_carrier_id
    AND ca.condition_code = p_condition_code
    AND ca.imo_id = v_imo_id
    AND (ca.product_type IS NULL OR ca.product_type = p_product_type)
  ORDER BY CASE WHEN ca.product_type IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_decision_tree(p_imo_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_imo_id uuid := COALESCE(p_imo_id, public.get_my_imo_id());
BEGIN
  IF v_imo_id IS NULL OR (NOT public.is_super_admin() AND v_imo_id IS DISTINCT FROM public.get_my_imo_id()) THEN
    RAISE EXCEPTION 'Unauthorized IMO access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT rules INTO v_result
  FROM public.underwriting_decision_trees
  WHERE imo_id = v_imo_id
    AND is_active = true
  ORDER BY is_default DESC, updated_at DESC
  LIMIT 1;

  RETURN COALESCE(v_result, '{"rules": []}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_rate(uuid, int, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_carrier_acceptance(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_decision_tree(uuid) TO authenticated;
