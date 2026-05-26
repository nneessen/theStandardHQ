-- Behavioral verification of cascade_agency_assignment authz gate.
-- 100% mutation-free: every test runs in BEGIN..ROLLBACK with non-existent
-- owner/agency UUIDs, so no real user_profiles row can be reassigned.
\set RAND_OWNER '11111111-1111-1111-1111-111111111111'
\set RAND_AGENCY '22222222-2222-2222-2222-222222222222'
\set EPIC_IMO '89514211-f2bd-4440-9527-90a472c5e622'
\set FFG_IMO 'ffffffff-ffff-ffff-ffff-ffffffffffff'
\set NORMAL_USER 'f871da16-a6a9-4d73-8b5a-3f8b09878d51'
\set SUPER_USER 'd0d3edea-af6d-4990-80b8-1765ba829896'

\echo '=== TEST A: normal FFG user -> Epic IMO target (expect: target IMO outside scope) ==='
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'NORMAL_USER', 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.cascade_agency_assignment(:'RAND_AGENCY', :'RAND_OWNER', :'EPIC_IMO') ->> 'error' AS test_a_error;
ROLLBACK;

\echo '=== TEST B: normal FFG user -> own FFG IMO, random owner (expect: passes IMO gate, owner outside scope) ==='
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'NORMAL_USER', 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.cascade_agency_assignment(:'RAND_AGENCY', :'RAND_OWNER', :'FFG_IMO') ->> 'error' AS test_b_error;
ROLLBACK;

\echo '=== TEST C: super-admin -> any IMO, random owner (expect: gate skipped, Owner not found) ==='
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'SUPER_USER', 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.cascade_agency_assignment(:'RAND_AGENCY', :'RAND_OWNER', :'EPIC_IMO') ->> 'error' AS test_c_error;
ROLLBACK;
