-- migrate-ffg-catalog-to-epic-life.sql
-- ----------------------------------------------------------------------------
-- Clone the FFG (dead/archive) carrier+product catalog into the LIVE Epic Life
-- tenant. FFG is left intact (clone, not move) — this matches the 3 prior
-- FFG->Epic clones (roadmaps, quick-quote rates) and is forced anyway: 13 of 14
-- FFG carriers already exist in Epic by name, and carriers are UNIQUE per
-- (imo_id, lower(name)), so a true "move" is impossible.
--
-- Target tenant resolved BY NAME ('Epic Life' = 2fd256e9... on prod, the live
-- tenant: 52 users / 578 policies). FFG = 'Founders Financial Group' (ffff...).
--
-- Scope (verified 2026-06-30 on prod):
--   * Carriers: 1 missing in Epic (Liberty Bankers) -> created. 13 already exist.
--   * Products: all 63 FFG products missing from Epic -> created (59 under
--     existing Epic carriers + 4 under the new Liberty Bankers carrier).
--
-- Constraint dodges (verified against pg_index):
--   * carriers.code  -> NULL  (idx_carriers_code_unique is GLOBAL on upper(code))
--   * products.code  -> NULL  (unique_carrier_code = (carrier_id, code))
--   * products.build_chart_id -> NULL (FFG build charts are IMO-scoped)
--   * commission_percentage -> NULL on products (comp lives in comp_guide;
--     usePolicyCommission ignores the product field for Epic)
--
-- Idempotent: NOT EXISTS guards on (imo, name) / (carrier, name). Atomic:
-- wrapped in BEGIN/COMMIT (psql -f is not transactional by default). Carrier
-- INSERT precedes product INSERT in the same txn, so Liberty Bankers products
-- resolve to the just-created carrier.
--
-- Run: DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f scripts/data/migrate-ffg-catalog-to-epic-life.sql
-- ----------------------------------------------------------------------------

BEGIN;

-- 1) Create any FFG carrier missing from Epic (by name). Today: Liberty Bankers.
INSERT INTO carriers (
  name, imo_id, is_active, code,
  advance_cap, commission_structure, contact_info, contracting_metadata
)
SELECT
  c.name,
  (SELECT id FROM imos WHERE name = 'Epic Life'),
  true,
  NULL,                       -- code dropped (global unique on upper(code))
  c.advance_cap,
  c.commission_structure,
  c.contact_info,
  c.contracting_metadata
FROM carriers c
WHERE c.imo_id = (SELECT id FROM imos WHERE name = 'Founders Financial Group')
  AND NOT EXISTS (
    SELECT 1 FROM carriers ec
    WHERE ec.imo_id = (SELECT id FROM imos WHERE name = 'Epic Life')
      AND lower(trim(ec.name)) = lower(trim(c.name))
  );

-- 2) Clone every FFG product into Epic under the matching Epic carrier (by name).
INSERT INTO products (
  carrier_id, imo_id, name, product_type, code, description, is_active,
  min_age, max_age, min_face_amount, max_face_amount, min_premium, max_premium,
  metadata, build_chart_id, commission_percentage
)
SELECT
  ec.id,                                                  -- Epic carrier (existing or just-created)
  (SELECT id FROM imos WHERE name = 'Epic Life'),
  p.name,
  p.product_type,
  NULL,                                                   -- code dropped
  p.description,
  true,
  p.min_age, p.max_age, p.min_face_amount, p.max_face_amount,
  p.min_premium, p.max_premium,
  p.metadata,
  NULL,                                                   -- build_chart_id dropped (IMO-scoped)
  NULL                                                    -- comp lives in comp_guide
FROM products p
JOIN carriers fc ON fc.id = p.carrier_id                  -- FFG carrier
JOIN carriers ec
  ON ec.imo_id = (SELECT id FROM imos WHERE name = 'Epic Life')
 AND lower(trim(ec.name)) = lower(trim(fc.name))          -- mapped Epic carrier
WHERE p.imo_id = (SELECT id FROM imos WHERE name = 'Founders Financial Group')
  AND NOT EXISTS (
    SELECT 1 FROM products ep
    WHERE ep.carrier_id = ec.id
      AND lower(trim(ep.name)) = lower(trim(p.name))
  );

COMMIT;
