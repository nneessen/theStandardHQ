#!/usr/bin/env bash
# ============================================================================
# RLS visibility parity harness for user_profiles SELECT
# ----------------------------------------------------------------------------
# Proves a policy change is row-set-identical: for EVERY user, fingerprints the
# exact set of user_profiles rows they can SEE under RLS, before vs after.
#
# Usage (LOCAL by default; prefix DATABASE_URL=... for prod, per CLAUDE.md):
#   scripts/migrations/parity-user-profiles-select.sh before   # snapshot old_hash
#   ./scripts/migrations/run-migration.sh supabase/migrations/<the_migration>.sql
#   scripts/migrations/parity-user-profiles-select.sh after    # snapshot new_hash + diff
#
#   DATABASE_URL="$REMOTE_DATABASE_URL" scripts/migrations/parity-user-profiles-select.sh before   # prod
#
# 'after' exits 0 and prints "PARITY OK" only if every caller's hash matches.
# Non-zero + a diff table if any caller's visibility changed.
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNSQL="$HERE/run-sql.sh"
MODE="${1:-}"

snapshot_sql() {
  local col="$1"
  cat <<SQL
CREATE TABLE IF NOT EXISTS public._eqcheck_up_select (
  caller uuid PRIMARY KEY,
  old_hash text,
  new_hash text
);
DO \$harness\$
DECLARE r record; h text;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', r.id::text, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT md5(coalesce(string_agg(up.id::text, ',' ORDER BY up.id), '(none)')) INTO h
      FROM public.user_profiles up;
    RESET ROLE;
    INSERT INTO public._eqcheck_up_select(caller, $col) VALUES (r.id, h)
      ON CONFLICT (caller) DO UPDATE SET $col = EXCLUDED.$col;
  END LOOP;
END
\$harness\$;
SQL
}

case "$MODE" in
  before)
    echo "[parity] capturing OLD visibility hashes..."
    "$RUNSQL" "TRUNCATE public._eqcheck_up_select;" >/dev/null 2>&1 || true
    "$RUNSQL" "$(snapshot_sql old_hash)"
    "$RUNSQL" "SELECT count(*) AS callers_snapshotted FROM public._eqcheck_up_select;"
    echo "[parity] OLD snapshot done. Now apply the migration, then run: $0 after"
    ;;
  after)
    echo "[parity] capturing NEW visibility hashes..."
    "$RUNSQL" "$(snapshot_sql new_hash)"
    echo "[parity] diffing old vs new..."
    "$RUNSQL" "
      SELECT caller, old_hash, new_hash
      FROM public._eqcheck_up_select
      WHERE old_hash IS DISTINCT FROM new_hash
      ORDER BY caller;"
    MISMATCH=$("$RUNSQL" -t "SELECT count(*) FROM public._eqcheck_up_select WHERE old_hash IS DISTINCT FROM new_hash;" 2>/dev/null | tr -d '[:space:]')
    TOTAL=$("$RUNSQL" -t "SELECT count(*) FROM public._eqcheck_up_select;" 2>/dev/null | tr -d '[:space:]')
    if [ "${MISMATCH:-1}" = "0" ]; then
      echo "[parity] PARITY OK — all ${TOTAL} callers see byte-identical row sets. Visibility unchanged."
      echo "[parity] cleanup: DROP TABLE public._eqcheck_up_select;  (run when satisfied)"
      exit 0
    else
      echo "[parity] FAIL — ${MISMATCH}/${TOTAL} callers' visibility CHANGED (see table above). Roll back."
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 {before|after}   (prefix DATABASE_URL=\"\$REMOTE_DATABASE_URL\" for prod)"
    exit 2
    ;;
esac
