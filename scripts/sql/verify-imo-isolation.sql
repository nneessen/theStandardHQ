-- verify-imo-isolation.sql
-- ---------------------------------------------------------------------------
-- Re-runnable RLS isolation test. Uses Postgres JWT-claim impersonation so it
-- can be invoked without minting a real JWT. This is the same mechanism
-- PostgREST uses to apply RLS, so a passing result here is equivalent (at the
-- DB layer) to passing /rest/v1 queries with that user's JWT.
--
-- USAGE
--   1. Edit the three :variables below (or pass via psql -v ON_ERROR_STOP=1
--      -v as_user='...' -v excluded_imo='...' -v own_imo='...').
--   2. Run via:
--        ./scripts/migrations/run-sql.sh -f scripts/sql/verify-imo-isolation.sql
--      For remote:
--        source .env && DATABASE_URL=$REMOTE_DATABASE_URL \
--          ./scripts/migrations/run-sql.sh -f scripts/sql/verify-imo-isolation.sql
--
-- INTERPRETATION
--   - excluded_* columns must all be 0 (no Epic Life rows visible)
--   - own_user_profiles must be > 0 (positive control — proves RLS isn't broken)
--   - own_imo_visible must be 1 (impersonated user can see their own IMO row)

-- FFG agent astowe.insurance@gmail.com (representative non-super-admin user on remote)
\set as_user        '3889a835-ebe8-44ca-bfc8-73a5268b2105'
-- Epic Life on remote
\set excluded_imo   '89514211-f2bd-4440-9527-90a472c5e622'
-- Founders sentinel UUID (the impersonated user's own IMO)
\set own_imo        'ffffffff-ffff-ffff-ffff-ffffffffffff'

BEGIN;
SET LOCAL role authenticated;
-- SET LOCAL requires a string literal — interpolate :as_user into a JSON string.
\set claims '{"sub":"' :as_user '","role":"authenticated"}'
SET LOCAL "request.jwt.claims" = :'claims';

SELECT
  (SELECT count(*) FROM user_profiles WHERE imo_id = :'excluded_imo'::uuid) AS excluded_user_profiles,
  (SELECT count(*) FROM policies      WHERE imo_id = :'excluded_imo'::uuid) AS excluded_policies,
  (SELECT count(*) FROM commissions   WHERE imo_id = :'excluded_imo'::uuid) AS excluded_commissions,
  (SELECT count(*) FROM imos          WHERE id     = :'excluded_imo'::uuid) AS excluded_imos_table,
  (SELECT count(*) FROM get_available_imos_for_join()
     WHERE id = :'excluded_imo'::uuid)                                       AS excluded_in_discovery_rpc,
  (SELECT count(*) FROM user_profiles WHERE imo_id = :'own_imo'::uuid)      AS own_user_profiles,
  (SELECT count(*) FROM imos          WHERE id     = :'own_imo'::uuid)      AS own_imo_visible;

ROLLBACK;
