-- scripts/seed-local-epiclife-config.sql
-- Seed the LOCAL Epic Life IMO with the call types + carriers that exist on PROD, so the inbound
-- intake dropdowns (and Settings) reflect the real configured set when testing against the local
-- dev database. The app reads these from kpi_call_types / carriers via the service layer (they are
-- NOT hardcoded) — local was just sparsely seeded (3 call types / 9 carriers) vs prod (13 / 23).
--
-- Idempotent: dedupes by name, resolves the local Epic Life imo_id dynamically (survives db resets).
-- Run: ./scripts/migrations/run-sql.sh -f scripts/seed-local-epiclife-config.sql

DO $$
DECLARE v_imo uuid;
BEGIN
  SELECT id INTO v_imo FROM imos WHERE name = 'Epic Life' LIMIT 1;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'Epic Life IMO not found in this database';
  END IF;

  -- Call types (mirrors prod Epic Life: kpi_call_types)
  INSERT INTO kpi_call_types (imo_id, name, sort_order, is_active)
  SELECT v_imo, v.name, v.so, true
  FROM (VALUES
    ('Address Change', 0),
    ('Auto Insurance Call In', 0),
    ('Cancellation', 0),
    ('Death Claim', 0),
    ('Extension of Benefits Children''s Policy', 0),
    ('Medical Insurance Call In', 0),
    ('Non-Insurance Extension', 0),
    ('Quote Shopper', 0),
    ('Standard to Preferred', 0),
    ('Work Policy', 0),
    ('Cash Out', 1),
    ('Consolidation', 2),
    ('Term to Perm', 3)
  ) AS v(name, so)
  WHERE NOT EXISTS (
    SELECT 1 FROM kpi_call_types k WHERE k.imo_id = v_imo AND k.name = v.name
  );

  -- Carriers (mirrors prod Epic Life: carriers)
  INSERT INTO carriers (imo_id, name, is_active)
  SELECT v_imo, v.name, true
  FROM (VALUES
    ('Accendo'), ('Aflac'), ('American Amicable'), ('American Home Life'),
    ('Assurity'), ('Baltimore Life'), ('Corebridge'), ('ELCO Mutual'),
    ('Ethos'), ('F&G'), ('Foresters Financial'), ('Gerber Life'),
    ('Illinois Mutual'), ('Kansas City Life'), ('Legal & General'),
    ('Mutual of Omaha'), ('National Life Group'), ('Nationwide'),
    ('North American'), ('Royal Neighbors'), ('SBLI'), ('Transamerica'),
    ('United Home Life')
  ) AS v(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM carriers c WHERE c.imo_id = v_imo AND c.name = v.name
  );

  RAISE NOTICE 'Epic Life now has % call types, % carriers (local)',
    (SELECT count(*) FROM kpi_call_types WHERE imo_id = v_imo),
    (SELECT count(*) FROM carriers WHERE imo_id = v_imo);
END$$;
