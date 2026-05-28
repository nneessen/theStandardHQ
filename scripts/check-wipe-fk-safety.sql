-- ============================================================================
-- Wipe FK-safety pre-flight (platform sunset) — raw catalog facts.
-- ============================================================================
-- wipe_user_business_data() deletes user_profiles last and relies on a
-- hand-maintained model of every FK that references it. This script dumps the
-- ground truth so it can be diffed against the wipe migration's arrays before a
-- schema change ships. It is registry-free (no hardcoded list to drift); the
-- authoritative pass/fail check is the gated RUN_DB_TESTS block in
-- src/features/sunset/__tests__/wipe-export-parity.test.ts.
--
-- Run on LOCAL and (before deploy) REMOTE:
--   ./scripts/migrations/run-sql.sh -f scripts/check-wipe-fk-safety.sql
--   DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-sql.sh -f scripts/check-wipe-fk-safety.sql
--
-- HOW TO READ IT:
--   * BLOCKING set (NO ACTION / RESTRICT): every row MUST be handled by the wipe
--     — nulled (ACTOR_REFS_TO_NULL), reassigned (ACTOR_REFS_TO_REASSIGN), or its
--     table explicit-deleted by this owner column BEFORE user_profiles. A new,
--     un-handled row here will roll the entire wipe back.
--   * CASCADE set: auto-removed when user_profiles is deleted. A registry table
--     marked wipe:"cascade" MUST appear here for its owner column, else its rows
--     silently survive the wipe.
-- ============================================================================

\echo '== BLOCKING refs to user_profiles (NO ACTION / RESTRICT) — each MUST be nulled/reassigned/explicit-deleted =='
SELECT (c.conrelid::regclass)::text AS ref_table,
       a.attname AS ref_column,
       CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' END AS on_delete,
       a.attnotnull AS not_null
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'public.user_profiles'::regclass
  AND c.confdeltype IN ('a', 'r')
ORDER BY 1, 2;

\echo '== CASCADE refs to user_profiles (auto-removed) — every registry wipe:"cascade" owner col MUST be here =='
SELECT (c.conrelid::regclass)::text AS ref_table,
       a.attname AS ref_column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'public.user_profiles'::regclass
  AND c.confdeltype = 'c'
ORDER BY 1, 2;
