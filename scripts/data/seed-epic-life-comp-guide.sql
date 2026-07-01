-- seed-epic-life-comp-guide.sql
-- ----------------------------------------------------------------------------
-- One-off data seed: populate comp_guide for Epic Life (IMO 2fd256e9-...)
--
-- WHY: Epic Life had 8 products but ZERO comp_guide rows, so every product
-- showed no commission ("all zero / no comp"). This seeds a default comp
-- schedule where the commission EQUALS the contract level (street-level
-- pass-through): contract level 80 -> 0.80, 100 -> 1.00, 145 -> 1.45, etc.
-- The owner then manually edits the exceptions in Settings > Commission Rates.
--
-- UNITS: comp_guide.commission_percentage is stored as a FRACTION (0-1+),
-- e.g. 1.00 = 100%. The app multiplies by 100 for display (RateEditDialog,
-- usePolicyCommission). Verified against FFG reference data (level 80 -> 0.70).
--
-- LEVELS: 80..145 step 5 (14 levels) = the app's CONTRACT_LEVELS grid, which
-- covers every Epic Life agent contract level (80,85,90,95,100,105,110,125).
--
-- Idempotent: NOT EXISTS guard skips any (product, level) already present.
-- Run with: DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f scripts/data/seed-epic-life-comp-guide.sql
-- ----------------------------------------------------------------------------

INSERT INTO comp_guide (
  carrier_id, product_id, product_type, contract_level,
  commission_percentage, bonus_percentage, effective_date, imo_id
)
SELECT
  p.carrier_id,
  p.id,
  p.product_type,
  lvl                        AS contract_level,
  (lvl::numeric / 100.0)     AS commission_percentage,  -- comp == contract level
  0                          AS bonus_percentage,
  CURRENT_DATE               AS effective_date,
  p.imo_id
FROM products p
CROSS JOIN generate_series(80, 145, 5) AS lvl
WHERE p.imo_id = '2fd256e9-9abb-445e-b405-62436555648a'
  AND NOT EXISTS (
    SELECT 1
    FROM comp_guide g
    WHERE g.product_id = p.id
      AND g.contract_level = lvl
      AND g.imo_id = p.imo_id
  );
