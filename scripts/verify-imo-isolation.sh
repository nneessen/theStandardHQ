#!/usr/bin/env bash
#
# verify-imo-isolation.sh
# -----------------------
# Repeatable harness that asserts a non-super-admin JWT cannot SELECT rows from
# a target IMO via PostgREST. Layer 1 of the Epic Life isolation work relies on
# RLS to hide cross-IMO rows; this script is the proof that it works.
#
# USAGE
#   ./scripts/verify-imo-isolation.sh \
#       --jwt    <USER_JWT_TOKEN>           # JWT from a non-super-admin login
#       --excluded-imo <UUID>               # IMO the JWT must NOT see (e.g. Epic Life)
#       --own-imo  <UUID>                   # JWT owner's own IMO (positive control)
#       [--url   <SUPABASE_URL>]            # defaults to $REMOTE_SUPABASE_URL or $VITE_SUPABASE_URL
#       [--anon  <SUPABASE_ANON_KEY>]       # defaults to $VITE_SUPABASE_ANON_KEY
#
# EXIT CODES
#   0 — all assertions passed
#   1 — leak detected OR positive control failed
#   2 — usage / config error
#
# CHECKS
#   - GET /rest/v1/user_profiles?imo_id=eq.<EXCLUDED> → must return []
#   - GET /rest/v1/policies?imo_id=eq.<EXCLUDED>       → must return []
#   - GET /rest/v1/commissions?imo_id=eq.<EXCLUDED>    → must return []
#   - GET /rest/v1/user_profiles?imo_id=eq.<OWN>       → must return >0 rows
#   - GET /rest/v1/policies?imo_id=eq.<OWN>            → must return >0 rows
#       (commissions own-IMO positive control is optional — some roles can't see
#        any commissions in their own IMO; we skip it if it returns empty.)
#
# NOTE: positive control proves "empty result != broken query." Without it,
# an RLS policy that silently returns nothing for every imo_id would appear to
# pass.

set -euo pipefail

JWT=""
EXCLUDED_IMO=""
OWN_IMO=""
URL="${REMOTE_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
ANON="${VITE_SUPABASE_ANON_KEY:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --jwt)           JWT="$2"; shift 2 ;;
    --excluded-imo)  EXCLUDED_IMO="$2"; shift 2 ;;
    --own-imo)       OWN_IMO="$2"; shift 2 ;;
    --url)           URL="$2"; shift 2 ;;
    --anon)          ANON="$2"; shift 2 ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$JWT" || -z "$EXCLUDED_IMO" || -z "$OWN_IMO" || -z "$URL" || -z "$ANON" ]]; then
  echo "ERROR: missing required args. Run with --help for usage." >&2
  exit 2
fi

UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
if [[ ! "$EXCLUDED_IMO" =~ $UUID_RE ]]; then
  echo "ERROR: --excluded-imo must be a UUID, got: $EXCLUDED_IMO" >&2
  exit 2
fi
if [[ ! "$OWN_IMO" =~ $UUID_RE ]]; then
  echo "ERROR: --own-imo must be a UUID, got: $OWN_IMO" >&2
  exit 2
fi
if [[ "$EXCLUDED_IMO" == "$OWN_IMO" ]]; then
  echo "ERROR: --excluded-imo and --own-imo must differ (positive control needs a different IMO)" >&2
  exit 2
fi

LEAKS=0
CHECKS=0

# --- Negative controls: excluded IMO must return [] -------------------------
for table in user_profiles policies commissions; do
  CHECKS=$((CHECKS+1))
  body=$(curl -sS \
    -H "apikey: ${ANON}" \
    -H "Authorization: Bearer ${JWT}" \
    "${URL%/}/rest/v1/${table}?select=id,imo_id&imo_id=eq.${EXCLUDED_IMO}&limit=10")
  count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 'ERR')")
  if [[ "$count" == "0" ]]; then
    echo "  ✓ ${table}: 0 rows for excluded IMO ${EXCLUDED_IMO}"
  elif [[ "$count" == "ERR" ]]; then
    echo "  ! ${table}: non-array response (likely auth error): $body" >&2
    LEAKS=$((LEAKS+1))
  else
    echo "  ✗ ${table}: LEAK — ${count} rows visible for excluded IMO ${EXCLUDED_IMO}" >&2
    echo "    sample: $(echo "$body" | head -c 400)" >&2
    LEAKS=$((LEAKS+1))
  fi
done

# --- Positive controls: own IMO must return >0 rows -------------------------
for table in user_profiles policies; do
  CHECKS=$((CHECKS+1))
  body=$(curl -sS \
    -H "apikey: ${ANON}" \
    -H "Authorization: Bearer ${JWT}" \
    "${URL%/}/rest/v1/${table}?select=id,imo_id&imo_id=eq.${OWN_IMO}&limit=10")
  count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 'ERR')")
  if [[ "$count" == "0" ]]; then
    echo "  ✗ ${table}: positive control FAILED — 0 rows for own IMO ${OWN_IMO}" >&2
    echo "    (means RLS may be wrong, or this role legitimately can't see own-IMO ${table})" >&2
    LEAKS=$((LEAKS+1))
  elif [[ "$count" == "ERR" ]]; then
    echo "  ! ${table}: positive control got non-array response: $body" >&2
    LEAKS=$((LEAKS+1))
  else
    echo "  ✓ ${table}: positive control OK (${count} rows in own IMO)"
  fi
done

# commissions positive control is informational — some roles can't see them
body=$(curl -sS \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${JWT}" \
  "${URL%/}/rest/v1/commissions?select=id,imo_id&imo_id=eq.${OWN_IMO}&limit=10")
count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 'ERR')" 2>/dev/null || echo "ERR")
echo "  · commissions: ${count} rows in own IMO (informational; some roles can't read commissions)"

echo ""
if [[ $LEAKS -eq 0 ]]; then
  echo "✅ PASS — ${CHECKS} checks, 0 leaks. RLS isolation holds for this JWT."
  exit 0
else
  echo "❌ FAIL — ${CHECKS} checks, ${LEAKS} failures." >&2
  exit 1
fi
