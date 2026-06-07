-- Clone premium_matrix rates from FFG into Epic Life (EXACT product matches only).
--
-- All 142,213 premium_matrix rows currently live under the retired FFG IMO
-- (ffffffff…). Epic Life is the active IMO and has 0 rates, so the restored
-- Quick Quote shows nothing for Epic agents. This seeds the rates onto the
-- Epic Life products that ALREADY exist, matched 1:1 to their FFG counterpart
-- by (carrier name, product name), case/space-insensitive.
--
-- Scope = "exact matches only" (owner decision): 19 products / 127,589 rows.
-- The 13 carrier-match-only and 3 no-carrier-match FFG products are NOT cloned
-- (they'd require creating new Epic products/carriers — deliberately excluded).
--
-- Each cloned row keeps age/face/gender/tobacco/health/term/premium verbatim,
-- is re-tenanted (imo_id -> Epic) and re-pointed (product_id -> Epic product).
-- created_by is set NULL: these are a system clone, not user-entered rows
-- (the column is a nullable FK to auth.users and is not used for rating).
--
-- Idempotent: guarded so re-running does nothing once Epic Life has any rates.
-- A belt-and-suspenders ON CONFLICT DO NOTHING matches premium_matrix_unique_idx.
--
-- Run with:
--   source .env && DATABASE_URL="$REMOTE_DATABASE_URL" \
--     ./scripts/migrations/run-sql.sh -f scripts/clone-premium-rates-to-epic-life.sql

DO $$
DECLARE
  v_src_imo uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'; -- FFG (retired)
  v_dst_imo uuid := '89514211-f2bd-4440-9527-90a472c5e622'; -- Epic Life
  v_pairs   int;
  v_dupes   int;
  v_inserted int;
BEGIN
  -- Idempotency is row-level via the ON CONFLICT below (premium_matrix_unique_idx),
  -- NOT a coarse "Epic already has rates" early-return. The coarse guard was
  -- order-coupled to the new-products script (which also seeds Epic rates): if
  -- that ran first, or this re-ran afterwards, the early-return silently skipped
  -- these 19 products forever. Per-row ON CONFLICT is safe to re-run in any order.

  -- Build the FFG-product -> Epic-product map for EXACT (carrier, product) matches.
  -- Only FFG products that actually carry rates are considered.
  CREATE TEMP TABLE _prod_map ON COMMIT DROP AS
    SELECT fp.id AS ffg_pid, ep.id AS epic_pid
    FROM products fp
    JOIN carriers fc ON fc.id = fp.carrier_id
    JOIN products ep ON ep.imo_id = v_dst_imo
                    AND ep.is_active = true                    -- RPC INNER-JOINs is_active=true
    JOIN carriers ec ON ec.id = ep.carrier_id
    WHERE fp.imo_id = v_src_imo
      AND lower(trim(fc.name)) = lower(trim(ec.name))
      AND lower(trim(fp.name)) = lower(trim(ep.name))
      AND EXISTS (SELECT 1 FROM premium_matrix pm WHERE pm.product_id = fp.id);

  SELECT count(*) INTO v_pairs FROM _prod_map;

  -- Safety: the map MUST be strictly 1:1 in BOTH directions, else the rate
  -- INSERT multiplies or merges rows. Abort on either:
  --   (a) one FFG product -> many Epic products (duplicate Epic catalog rows), or
  --   (b) many FFG products -> one Epic product (would union both FFG rate sets
  --       into one Epic product; overlapping keys then resolve nondeterministically
  --       via ON CONFLICT, so an arbitrary premium "wins" with no error).
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT ffg_pid FROM _prod_map GROUP BY ffg_pid HAVING count(*) > 1
    UNION ALL
    SELECT epic_pid FROM _prod_map GROUP BY epic_pid HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Ambiguous mapping: % product(s) match many-to-one or one-to-many between FFG and Epic. Aborting.', v_dupes;
  END IF;

  -- 19 on the very first run; grows to 35 after the new-products script runs
  -- (those 16 products then also exist in Epic and match exactly).
  RAISE NOTICE 'Mapped % FFG product(s) -> Epic product(s).', v_pairs;

  -- Clone the rates, re-tenanted and re-pointed at the Epic product.
  INSERT INTO public.premium_matrix
    (id, imo_id, product_id, age, face_amount, gender, tobacco_class,
     health_class, term_years, monthly_premium, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), v_dst_imo, m.epic_pid, pm.age, pm.face_amount,
         pm.gender, pm.tobacco_class, pm.health_class, pm.term_years,
         pm.monthly_premium, NULL, now(), now()
  FROM public.premium_matrix pm
  JOIN _prod_map m ON m.ffg_pid = pm.product_id
  WHERE pm.imo_id = v_src_imo
  ON CONFLICT (product_id, age, face_amount, gender, tobacco_class,
               health_class, imo_id, COALESCE(term_years, 0)) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  -- 127,589 on the first run; 0 on any re-run (all rows already present).
  RAISE NOTICE 'Inserted % Epic Life premium_matrix row(s).', v_inserted;
END $$;
