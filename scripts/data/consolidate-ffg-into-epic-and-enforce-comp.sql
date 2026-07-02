-- consolidate-ffg-into-epic-and-enforce-comp.sql
-- ----------------------------------------------------------------------------
-- GOAL (owner, 2026-07-01): Founders Financial Group (FFG) must cease to exist.
-- Every FFG carrier + its products already has an identical twin under Epic Life
-- (a prior session cloned them), so "moving" the carriers is impossible (unique
-- carrier-name-per-IMO) and unnecessary. The faithful end-state — everything
-- under Epic, FFG gone, no duplicates — is achieved by removing the redundant
-- FFG catalog and enforcing comp == contract level on EVERY Epic product.
--
-- Verified before writing (all on PROD):
--   * 0 policies reference any FFG carrier / product / imo
--   * 0 FFG products lack an Epic twin (carrier name + product name)
--   * 0 Epic products / comp rows point at an FFG carrier_id (Epic is self-contained)
--
-- FFG imo shell + its 2 users are intentionally left untouched (never delete auth
-- accounts). Only the carrier/product/comp_guide catalog is removed.
--
-- Transactional + in-DB backup into schema "backup" (recoverable). Idempotent-ish:
-- re-running fails on the CREATE TABLE backup (already exists) which is the desired
-- guard against double-runs.
-- Run: DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f scripts/data/consolidate-ffg-into-epic-and-enforce-comp.sql
-- ----------------------------------------------------------------------------
\set ON_ERROR_STOP on

BEGIN;

-- IDs (Epic Life = live tenant, FFG = dead archive)
-- Epic: 2fd256e9-9abb-445e-b405-62436555648a
-- FFG : ffffffff-ffff-ffff-ffff-ffffffffffff

-- 1) Backup the FFG catalog before deleting (recoverable; not in public -> not type-gen'd)
CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE backup.ffg_carriers_20260701   AS SELECT * FROM public.carriers   WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
CREATE TABLE backup.ffg_products_20260701   AS SELECT * FROM public.products    WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
CREATE TABLE backup.ffg_comp_guide_20260701 AS SELECT * FROM public.comp_guide  WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

-- 2) Remove FFG catalog, child -> parent (Epic keeps its own twin of every row)
DELETE FROM public.comp_guide WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
DELETE FROM public.products   WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
DELETE FROM public.carriers   WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

-- 3) Enforce commission == contract level for EVERY Epic product, all 14 levels
--    (80->0.80 ... 145->1.45; stored as a FRACTION, app x100 for display).
-- 3a) Correct any deviating existing row
UPDATE public.comp_guide g
SET commission_percentage = g.contract_level::numeric / 100.0
WHERE g.imo_id = '2fd256e9-9abb-445e-b405-62436555648a'
  AND g.commission_percentage IS DISTINCT FROM g.contract_level::numeric / 100.0;

-- 3b) Fill any missing (product x level) row
INSERT INTO public.comp_guide (
  carrier_id, product_id, product_type, contract_level,
  commission_percentage, bonus_percentage, effective_date, imo_id
)
SELECT p.carrier_id, p.id, p.product_type, lvl,
       (lvl::numeric / 100.0), 0, CURRENT_DATE, p.imo_id
FROM public.products p
CROSS JOIN generate_series(80, 145, 5) AS lvl
WHERE p.imo_id = '2fd256e9-9abb-445e-b405-62436555648a'
  AND NOT EXISTS (
    SELECT 1 FROM public.comp_guide g
    WHERE g.product_id = p.id AND g.contract_level = lvl AND g.imo_id = p.imo_id
  );

COMMIT;
