-- seed-epic-prod-comp-levels.sql
-- ----------------------------------------------------------------------------
-- Enforce commission == contract level (80=80, 85=85 ... 145=145) for EVERY
-- Epic Life product on PROD. Epic Life prod had 64 products but only ~84 comp
-- rows (58 products with NO rates -> "0/14" in Settings > Commission Rates).
--
-- SAFE / additive: no deletes, no policy impact. Backs up existing Epic comp
-- rows first. Resolves Epic Life BY NAME (prod id 89514211 != local 2fd256e9 —
-- never hardcode; see memory epiclife_imo_enforcement_and_prod_db_gotcha).
--
-- comp_guide.commission_percentage is a FRACTION (0.80 = 80%); app x100 to show.
-- Run: set -a; source .env; set +a; DATABASE_URL="$REMOTE_DATABASE_URL" \
--        ./scripts/migrations/run-sql.sh -f scripts/data/seed-epic-prod-comp-levels.sql
-- ----------------------------------------------------------------------------
\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.epic_comp_guide_pre_seed_20260701 AS
  SELECT * FROM public.comp_guide
  WHERE imo_id = (SELECT id FROM public.imos WHERE name = 'Epic Life');

-- 1) Force any existing Epic comp row to comp == contract level
UPDATE public.comp_guide g
SET commission_percentage = g.contract_level::numeric / 100.0
WHERE g.imo_id = (SELECT id FROM public.imos WHERE name = 'Epic Life')
  AND g.commission_percentage IS DISTINCT FROM g.contract_level::numeric / 100.0;

-- 2) Insert any missing (product x 14 levels) row at comp == contract level
INSERT INTO public.comp_guide (
  carrier_id, product_id, product_type, contract_level,
  commission_percentage, bonus_percentage, effective_date, imo_id
)
SELECT p.carrier_id, p.id, p.product_type, lvl,
       (lvl::numeric / 100.0), 0, CURRENT_DATE, p.imo_id
FROM public.products p
CROSS JOIN generate_series(80, 145, 5) AS lvl
WHERE p.imo_id = (SELECT id FROM public.imos WHERE name = 'Epic Life')
  AND NOT EXISTS (
    SELECT 1 FROM public.comp_guide g
    WHERE g.product_id = p.id AND g.contract_level = lvl AND g.imo_id = p.imo_id
  );

COMMIT;
