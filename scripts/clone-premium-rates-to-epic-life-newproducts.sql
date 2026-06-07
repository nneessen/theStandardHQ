-- Clone the REMAINING FFG rate products into Epic Life by CREATING new catalog
-- entries (Part 2 of the Quick Quote rate migration).
--
-- Part 1 (clone-premium-rates-to-epic-life.sql) seeded the 19 products that
-- already existed under Epic. This handles the other 16 rate-bearing FFG
-- products that have NO Epic equivalent:
--   * 13 "carrier-match"  : carrier already exists in Epic -> create new PRODUCT
--                           under the existing Epic carrier        (13,400 rows)
--   * 3  "no-carrier-match": carrier absent in Epic (SBLI) -> create new CARRIER
--                            + new products                         ( 1,224 rows)
-- Total: 16 products / 14,624 rates.
--
-- New carrier/product rows copy the FFG attributes EXCEPT:
--   * imo_id      -> Epic Life (explicit; the set_imo_id_from_user trigger only
--                    fills when NULL, so an explicit value is preserved)
--   * is_active   -> true (RPC get_premium_matrices_for_imo INNER-JOINs is_active)
--   * code        -> NULL (avoids ux_carriers_imo_lower_code / unique_carrier_code
--                    collisions; the Quick Quote RPC returns name, never code)
--   * build_chart_id -> NULL (FFG build charts are IMO-scoped; don't leak them)
-- Cloned rates set created_by NULL (system clone, not user-entered).
--
-- Fully idempotent: every insert is guarded by NOT EXISTS / ON CONFLICT, so a
-- re-run is a no-op. Matching is by (carrier name, product name), case/space-
-- insensitive — the same key Part 1 used.
--
-- Run with:
--   source .env && DATABASE_URL="$REMOTE_DATABASE_URL" \
--     ./scripts/migrations/run-sql.sh -f scripts/clone-premium-rates-to-epic-life-newproducts.sql

DO $$
DECLARE
  v_src_imo uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'; -- FFG (retired)
  v_dst_imo uuid := '89514211-f2bd-4440-9527-90a472c5e622'; -- Epic Life
  v_carriers int; v_products int; v_rates int; v_srcn int; v_dupes int;
BEGIN
  -- The FFG products to clone: rate-bearing AND not already present in Epic by
  -- (carrier name, product name).
  CREATE TEMP TABLE _src ON COMMIT DROP AS
    SELECT p.id AS ffg_pid, p.carrier_id AS ffg_cid,
           p.name, p.product_type, p.description, p.commission_percentage,
           p.min_age, p.max_age, p.min_face_amount, p.max_face_amount,
           p.min_premium, p.max_premium, p.metadata,
           lower(trim(c.name)) AS ck, lower(trim(p.name)) AS pk
    FROM products p
    JOIN carriers c ON c.id = p.carrier_id
    WHERE p.imo_id = v_src_imo
      AND EXISTS (SELECT 1 FROM premium_matrix pm WHERE pm.product_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM products ep
        JOIN carriers ec ON ec.id = ep.carrier_id
        WHERE ep.imo_id = v_dst_imo
          AND lower(trim(ec.name)) = lower(trim(c.name))
          AND lower(trim(ep.name)) = lower(trim(p.name)));

  SELECT count(*) INTO v_srcn FROM _src;
  -- 16 on the first run; 0 on any re-run (all already present in Epic).
  RAISE NOTICE 'FFG products to clone: %.', v_srcn;

  -- Safety: the (carrier name, product name) key MUST be unique within _src.
  -- Unlike the exact-match script, this one CREATES new Epic products, and the
  -- per-statement NOT EXISTS guards below cannot dedup within a single INSERT
  -- (NOT EXISTS sees the pre-insert state). So two FFG rows sharing (ck,pk) would
  -- create two identically-named Epic products and clone rates into each distinct
  -- product_id (ON CONFLICT can't catch cross-product_id dupes) -> duplicated
  -- products + doubled quote rows, silently. Abort instead.
  SELECT count(*) INTO v_dupes
  FROM (SELECT ck, pk FROM _src GROUP BY ck, pk HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Ambiguous source: % (carrier,product) name-pair(s) are duplicated in FFG. Aborting to avoid duplicate Epic products.', v_dupes;
  END IF;

  -- Also abort if Epic already holds duplicate-named carriers (would make the
  -- lower(name) carrier join below fan out and multiply product/rate inserts).
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT lower(trim(name)) AS ck FROM public.carriers
    WHERE imo_id = v_dst_imo GROUP BY lower(trim(name)) HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Epic Life has % duplicate-named carrier(s); carrier-name join would multiply rows. Aborting.', v_dupes;
  END IF;

  -- 1) Create any Epic carriers that don't yet exist (matched by lower(name)).
  INSERT INTO public.carriers
    (id, imo_id, name, code, advance_cap, commission_structure,
     contact_info, contracting_metadata, is_active)
  SELECT gen_random_uuid(), v_dst_imo, fc.name, NULL, fc.advance_cap,
         fc.commission_structure, fc.contact_info, fc.contracting_metadata, true
  FROM (SELECT DISTINCT ffg_cid FROM _src) d
  JOIN public.carriers fc ON fc.id = d.ffg_cid
  WHERE NOT EXISTS (
    SELECT 1 FROM public.carriers ec
    WHERE ec.imo_id = v_dst_imo
      AND lower(trim(ec.name)) = lower(trim(fc.name)));
  GET DIAGNOSTICS v_carriers = ROW_COUNT;
  -- 1 on the first run (SBLI); 0 on any re-run.
  RAISE NOTICE 'New Epic carriers created: %.', v_carriers;

  -- 2) Create the new Epic products under the matching Epic carrier.
  INSERT INTO public.products
    (id, imo_id, carrier_id, name, product_type, description,
     commission_percentage, min_age, max_age, min_face_amount, max_face_amount,
     min_premium, max_premium, metadata, code, build_chart_id, is_active)
  SELECT gen_random_uuid(), v_dst_imo, ec.id, s.name, s.product_type, s.description,
         s.commission_percentage, s.min_age, s.max_age, s.min_face_amount,
         s.max_face_amount, s.min_premium, s.max_premium, s.metadata,
         NULL, NULL, true
  FROM _src s
  JOIN public.carriers ec ON ec.imo_id = v_dst_imo
                         AND lower(trim(ec.name)) = s.ck
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products ep
    WHERE ep.carrier_id = ec.id AND lower(trim(ep.name)) = s.pk);
  GET DIAGNOSTICS v_products = ROW_COUNT;
  -- 16 on the first run; 0 on any re-run.
  RAISE NOTICE 'New Epic products created: %.', v_products;

  -- 3) Clone the rates onto the new Epic products (join FFG rate -> FFG product
  --    -> Epic carrier by name -> Epic product by carrier+name).
  INSERT INTO public.premium_matrix
    (id, imo_id, product_id, age, face_amount, gender, tobacco_class,
     health_class, term_years, monthly_premium, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), v_dst_imo, ep.id, pm.age, pm.face_amount,
         pm.gender, pm.tobacco_class, pm.health_class, pm.term_years,
         pm.monthly_premium, NULL, now(), now()
  FROM _src s
  JOIN public.premium_matrix pm ON pm.product_id = s.ffg_pid
                               AND pm.imo_id = v_src_imo
  JOIN public.carriers ec ON ec.imo_id = v_dst_imo AND lower(trim(ec.name)) = s.ck
  JOIN public.products ep ON ep.carrier_id = ec.id AND lower(trim(ep.name)) = s.pk
  ON CONFLICT (product_id, age, face_amount, gender, tobacco_class,
               health_class, imo_id, COALESCE(term_years, 0)) DO NOTHING;
  GET DIAGNOSTICS v_rates = ROW_COUNT;
  -- 14,624 on the first run; 0 on any re-run.
  RAISE NOTICE 'Cloned Epic rates: %.', v_rates;
END $$;
