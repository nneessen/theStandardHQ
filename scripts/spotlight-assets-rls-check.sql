-- Empirical RLS check for the spotlight-assets bucket policies.
-- Simulates an authenticated user via request.jwt.claims (sub = auth.uid()) and
-- the anon role, exercising each policy. Run:
--   ./scripts/migrations/run-sql.sh -f scripts/spotlight-assets-rls-check.sql
-- Expect: three PASS lines.

\set uidA '11111111-1111-1111-1111-111111111111'
\set uidB '22222222-2222-2222-2222-222222222222'

-- ── (1) authenticated user may write to their OWN {uid}/ folder ───────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  DO $$
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (gen_random_uuid(), 'spotlight-assets',
            '11111111-1111-1111-1111-111111111111/aotw-photo.png',
            '11111111-1111-1111-1111-111111111111');
    RAISE NOTICE '(1) own-folder INSERT: PASS (allowed)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '(1) own-folder INSERT: FAIL (RLS wrongly denied: %)', SQLERRM;
  END $$;
ROLLBACK;

-- ── (2) authenticated user may NOT write to ANOTHER uid's folder ──────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  DO $$
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (gen_random_uuid(), 'spotlight-assets',
            '22222222-2222-2222-2222-222222222222/evil.png',
            '11111111-1111-1111-1111-111111111111');
    RAISE NOTICE '(2) cross-folder INSERT: FAIL (should have been denied!)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '(2) cross-folder INSERT: PASS (denied by RLS)';
  END $$;
ROLLBACK;

-- ── (3) AUTHENTICATED user can read/enumerate via the table ──────────────────
BEGIN;
  -- Seed one object as the table owner (bypasses RLS), then read it as authenticated.
  INSERT INTO storage.objects (id, bucket_id, name, owner)
  VALUES (gen_random_uuid(), 'spotlight-assets',
          '11111111-1111-1111-1111-111111111111/seed.png',
          '11111111-1111-1111-1111-111111111111');
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM storage.objects
     WHERE bucket_id = 'spotlight-assets'
       AND name = '11111111-1111-1111-1111-111111111111/seed.png';
    IF n = 1 THEN
      RAISE NOTICE '(3) authenticated READ: PASS (object visible)';
    ELSE
      RAISE NOTICE '(3) authenticated READ: FAIL (object not visible, n=%)', n;
    END IF;
  END $$;
ROLLBACK;

-- ── (4) ANON cannot ENUMERATE the bucket via the table (hardened) ────────────
--   (Public image DELIVERY is unaffected: public=true serves /object/public/<path>
--    WITHOUT RLS — verified separately by curling a public URL.)
BEGIN;
  INSERT INTO storage.objects (id, bucket_id, name, owner)
  VALUES (gen_random_uuid(), 'spotlight-assets',
          '11111111-1111-1111-1111-111111111111/seed.png',
          '11111111-1111-1111-1111-111111111111');
  SET LOCAL ROLE anon;
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'spotlight-assets';
    IF n = 0 THEN
      RAISE NOTICE '(4) anon ENUMERATION: PASS (denied — bucket not listable by anon)';
    ELSE
      RAISE NOTICE '(4) anon ENUMERATION: FAIL (anon saw % row(s)!)', n;
    END IF;
  END $$;
ROLLBACK;
