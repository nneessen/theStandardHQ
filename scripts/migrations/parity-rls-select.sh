#!/usr/bin/env bash
# ============================================================================
# Generalized RLS visibility parity harness (per table)
# ----------------------------------------------------------------------------
# For EVERY user, fingerprints the exact set of <table> rows that user can SEE
# under RLS (md5 of sorted pk list), before vs after a policy change. Proves a
# policy rewrite is row-set-identical for reads.
#
# Usage (LOCAL default; prefix DATABASE_URL="$REMOTE_DATABASE_URL" for prod):
#   parity-rls-select.sh <table> <pk_col> before
#   ./scripts/migrations/run-migration.sh <migration.sql>
#   parity-rls-select.sh <table> <pk_col> after     # prints PARITY OK or FAIL+diff
#
# Scratch table: public._eqcheck_rls (table, caller, old_hash, new_hash).
# 'after' exits 0 + "PARITY OK" only if every caller's hash matches.
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNSQL="$HERE/run-sql.sh"
TBL="${1:?table required}"; PK="${2:?pk column required}"; MODE="${3:?before|after required}"

snap() {
  local col="$1"
  cat <<SQL
CREATE TABLE IF NOT EXISTS public._eqcheck_rls (
  tbl text, caller uuid, old_hash text, new_hash text, PRIMARY KEY (tbl, caller)
);
DO \$harness\$
DECLARE r record; h text;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', r.id::text, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    EXECUTE format(
      'SELECT md5(coalesce(string_agg(t.%I::text, '','' ORDER BY t.%I), ''(none)'')) FROM public.%I t',
      '$PK', '$PK', '$TBL') INTO h;
    RESET ROLE;
    INSERT INTO public._eqcheck_rls(tbl, caller, $col) VALUES ('$TBL', r.id, h)
      ON CONFLICT (tbl, caller) DO UPDATE SET $col = EXCLUDED.$col;
  END LOOP;
END
\$harness\$;
SQL
}

case "$MODE" in
  before)
    echo "[parity:$TBL] capturing OLD..."
    "$RUNSQL" "DELETE FROM public._eqcheck_rls WHERE tbl='$TBL';" >/dev/null 2>&1 || true
    "$RUNSQL" "$(snap old_hash)"
    "$RUNSQL" "SELECT count(*) AS callers FROM public._eqcheck_rls WHERE tbl='$TBL';"
    echo "[parity:$TBL] apply migration, then: $0 $TBL $PK after"
    ;;
  after)
    echo "[parity:$TBL] capturing NEW + diffing..."
    "$RUNSQL" "$(snap new_hash)"
    "$RUNSQL" "SELECT caller, old_hash, new_hash FROM public._eqcheck_rls WHERE tbl='$TBL' AND old_hash IS DISTINCT FROM new_hash ORDER BY caller;"
    MM=$("$RUNSQL" -t "SELECT count(*) FROM public._eqcheck_rls WHERE tbl='$TBL' AND old_hash IS DISTINCT FROM new_hash;" 2>/dev/null | tr -d '[:space:]')
    TT=$("$RUNSQL" -t "SELECT count(*) FROM public._eqcheck_rls WHERE tbl='$TBL';" 2>/dev/null | tr -d '[:space:]')
    if [ "${MM:-1}" = "0" ]; then
      echo "[parity:$TBL] PARITY OK — all ${TT} callers see byte-identical row sets."
      exit 0
    else
      echo "[parity:$TBL] FAIL — ${MM}/${TT} callers changed. Roll back."
      exit 1
    fi
    ;;
  *) echo "usage: $0 <table> <pk_col> {before|after}"; exit 2 ;;
esac
