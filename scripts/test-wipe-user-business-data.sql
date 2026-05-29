-- ============================================================================
-- Empirical test for wipe_user_business_data() — Migration E.
-- Seeds a THROWAWAY revoked IMO + victim user + reassign super-admin, exercises
-- every wipe path (cascade delete, explicit delete, commissions self-ref,
-- actor-ref NULL, actor-ref reassign), asserts the outcome, then ROLLS BACK so
-- nothing persists. Safe to run repeatedly on LOCAL. NEVER run on remote.
--   ./scripts/migrations/run-sql.sh -f scripts/test-wipe-user-business-data.sql
-- ============================================================================
BEGIN;

-- Fixed throwaway ids (zz prefix = test sentinel)
\set imo      '''aaaaaaaa-0000-4000-8000-00000000aaaa'''
\set victim   '''bbbbbbbb-0000-4000-8000-00000000bbbb'''
\set admin    '''cccccccc-0000-4000-8000-00000000cccc'''
\set c1       '''dddddddd-0000-4000-8000-00000000d001'''
\set c2       '''dddddddd-0000-4000-8000-00000000d002'''
\set tmod     '''eeeeeeee-0000-4000-8000-00000000e001'''
\set imo2     '''aaaaaaaa-0000-4000-8000-00000000a222'''
\set bystndr  '''ffffffff-0000-4000-8000-00000000f111'''
\set cbys     '''dddddddd-0000-4000-8000-00000000d003'''

-- ---- Seed ------------------------------------------------------------------
INSERT INTO imos (id, name, code, access_revoked_at)
  VALUES (:imo, 'ZZ Test Sunset IMO', 'ZZTEST', now());

INSERT INTO user_profiles (id, email, imo_id, is_super_admin)
  VALUES (:victim, 'zz_victim@test.local', :imo, false),
         (:admin,  'zz_admin@test.local',  :imo, true);

-- cascade table (should be gone after wipe via user_profiles CASCADE)
INSERT INTO notifications (user_id, type, title)
  VALUES (:victim, 'zz_test', 'ZZ notification');

-- NEW owned table from the 2026-05-27 gate-completeness fix (cascade, owner_id).
-- Proves a newly-registered owned table is wiped by the profile CASCADE.
INSERT INTO team_seat_packs (owner_id) VALUES (:victim);

-- explicit owned + commissions self-reference (the only intra-set NO-ACTION FK)
INSERT INTO commissions (id, user_id, imo_id, amount, type)
  VALUES (:c1, :victim, :imo, 100, 'advance');
INSERT INTO commissions (id, user_id, imo_id, amount, type, related_advance_id)
  VALUES (:c2, :victim, :imo, -50, 'chargeback', :c1);

-- explicit owned, simple
INSERT INTO clients (user_id, name) VALUES (:victim, 'ZZ Client');

-- CROSS-USER self-FK: a SURVIVING user (different, non-revoked IMO) whose
-- commission points at the victim's commission via related_advance_id. Without
-- the Step 2.5 defuse, deleting the victim's commissions would FK-violate and
-- roll back the entire wipe. After wipe: this row must SURVIVE with a NULL ptr.
INSERT INTO imos (id, name, code) VALUES (:imo2, 'ZZ Bystander IMO', 'ZZBYS');
INSERT INTO user_profiles (id, email, imo_id, is_super_admin)
  VALUES (:bystndr, 'zz_bystander@test.local', :imo2, false);
INSERT INTO commissions (id, user_id, imo_id, amount, type, related_advance_id)
  VALUES (:cbys, :bystndr, :imo2, 25, 'as_earned', :c1);

-- ACTOR_REFS_TO_NULL: a row OWNED BY THE SYSTEM that points at victim as actor.
INSERT INTO system_audit_log (action, table_name, performed_by)
  VALUES ('zz_test_action', 'zz_table', :victim);

-- ACTOR_REFS_TO_REASSIGN: shared content the victim authored — must SURVIVE,
-- reassigned to the super-admin (NOT deleted).
INSERT INTO training_modules (id, imo_id, title, category, created_by)
  VALUES (:tmod, :imo, 'ZZ Shared Module', 'zz', :victim);

\echo '==== PRE-WIPE COUNTS ===='
SELECT (SELECT count(*) FROM user_profiles WHERE id = :victim)        AS victim_profile,
       (SELECT count(*) FROM commissions   WHERE user_id = :victim)   AS commissions,
       (SELECT count(*) FROM clients       WHERE user_id = :victim)   AS clients,
       (SELECT count(*) FROM notifications WHERE user_id = :victim)   AS notifications,
       (SELECT count(*) FROM training_modules WHERE id = :tmod)       AS shared_module;

\echo '==== RUN WIPE (manifest) ===='
SELECT jsonb_pretty(public.wipe_user_business_data(:victim, :admin)) AS manifest;

\echo '==== POST-WIPE ASSERTIONS (all _0 must be 0, survivors must persist) ===='
SELECT (SELECT count(*) FROM user_profiles WHERE id = :victim)        AS victim_profile_0,
       (SELECT count(*) FROM commissions   WHERE user_id = :victim)   AS commissions_0,
       (SELECT count(*) FROM clients       WHERE user_id = :victim)   AS clients_0,
       (SELECT count(*) FROM notifications WHERE user_id = :victim)   AS notifications_0,
       (SELECT count(*) FROM system_audit_log WHERE action='zz_test_action') AS audit_row_survives_1,
       (SELECT performed_by FROM system_audit_log WHERE action='zz_test_action') AS audit_performed_by_null,
       (SELECT count(*) FROM training_modules WHERE id = :tmod)       AS module_survives_1,
       (SELECT created_by = :admin FROM training_modules WHERE id = :tmod) AS module_reassigned_to_admin,
       (SELECT count(*) FROM commissions WHERE id = :cbys)            AS bystander_comm_survives_1,
       (SELECT related_advance_id FROM commissions WHERE id = :cbys)  AS bystander_ptr_null,
       (SELECT count(*) FROM team_seat_packs WHERE owner_id = :victim) AS seat_packs_0;

\echo '==== IDEMPOTENCY (second call must be noop) ===='
SELECT public.wipe_user_business_data(:victim, :admin) AS second_call_noop;

ROLLBACK;
\echo '==== ROLLED BACK — nothing persisted ===='
