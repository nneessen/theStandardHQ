#!/bin/bash
# scripts/migrations/run-migration.sh
# ============================================================================
# THE ONLY WAY TO RUN MIGRATIONS - DO NOT USE psql DIRECTLY FOR MIGRATIONS
# ============================================================================
#
# This script:
# 1. Validates migration file format
# 2. Checks if migration is already applied (skips if yes)
# 3. Detects functions in the migration
# 4. Prevents downgrading functions to older versions
# 5. Applies the migration
# 6. Tracks in schema_migrations
# 7. Updates function_versions registry
#
# Usage: ./scripts/migrations/run-migration.sh <migration_file> [--force]
#
# Options:
#   --force    Skip downgrade protection (USE WITH EXTREME CAUTION)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set. Check your .env file.${NC}"
    exit 1
fi

# Skip SSL for local Supabase (127.0.0.1 / localhost)
if echo "$DATABASE_URL" | grep -qE '(127\.0\.0\.1|localhost)'; then
    CONN_STR="$DATABASE_URL"
else
    CONN_STR="${DATABASE_URL}?sslmode=require"
fi

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

MIGRATION_FILE=""
FORCE_MODE=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE_MODE=true
            ;;
        *)
            if [ -z "$MIGRATION_FILE" ]; then
                MIGRATION_FILE="$arg"
            fi
            ;;
    esac
done

if [ -z "$MIGRATION_FILE" ]; then
    echo -e "${RED}ERROR: No migration file specified${NC}"
    echo ""
    echo "Usage: $0 <migration_file> [--force]"
    echo ""
    echo "Examples:"
    echo "  $0 supabase/migrations/20260203143022_my_migration.sql"
    echo "  $0 supabase/migrations/20260203143022_my_migration.sql --force"
    exit 1
fi

# Convert to absolute path if relative
if [[ ! "$MIGRATION_FILE" = /* ]]; then
    MIGRATION_FILE="$PROJECT_ROOT/$MIGRATION_FILE"
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}ERROR: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# ============================================================================
# EXTRACT MIGRATION INFO
# ============================================================================

FILENAME=$(basename "$MIGRATION_FILE" .sql)

# Validate and parse filename
if [[ "$FILENAME" =~ ^([0-9]{14})_(.+)$ ]]; then
    VERSION="${BASH_REMATCH[1]}"
    NAME="${BASH_REMATCH[2]}"
    FORMAT="new"
elif [[ "$FILENAME" =~ ^([0-9]{8})_([0-9]{3})_(.+)$ ]]; then
    VERSION="${BASH_REMATCH[1]}"
    NAME="${BASH_REMATCH[2]}_${BASH_REMATCH[3]}"
    FORMAT="old"
    echo -e "${YELLOW}WARNING: Old migration format detected. Use YYYYMMDDHHMMSS_name.sql for new migrations.${NC}"
    echo -e "${YELLOW}Generate timestamp with: date +%Y%m%d%H%M%S${NC}"
else
    echo -e "${RED}ERROR: Invalid migration filename format${NC}"
    echo ""
    echo "Expected formats:"
    echo "  New (preferred): YYYYMMDDHHMMSS_description.sql"
    echo "  Old (legacy):    YYYYMMDD_NNN_description.sql"
    echo ""
    echo "Generate timestamp with: date +%Y%m%d%H%M%S"
    exit 1
fi

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  Migration Runner${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${BOLD}File:${NC}    $FILENAME.sql"
echo -e "${BOLD}Version:${NC} $VERSION"
echo -e "${BOLD}Name:${NC}    $NAME"
echo ""

# ============================================================================
# CHECK IF ALREADY APPLIED
# ============================================================================

echo -e "${BLUE}[1/5] Checking if migration is already applied...${NC}"

ALREADY_APPLIED=$(psql "$CONN_STR" -t -A -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '$VERSION';" 2>/dev/null)

if [ "$ALREADY_APPLIED" = "1" ]; then
    echo -e "${GREEN}✓ Migration $VERSION is already tracked as applied.${NC}"
    echo ""
    echo -e "${YELLOW}If you need to re-apply this migration:${NC}"
    echo -e "${YELLOW}1. First verify this is intentional${NC}"
    echo -e "${YELLOW}2. Use --force flag: $0 $MIGRATION_FILE --force${NC}"

    if [ "$FORCE_MODE" = false ]; then
        echo ""
        echo -e "${GREEN}Skipping (already applied).${NC}"
        exit 0
    else
        echo ""
        echo -e "${YELLOW}--force specified, continuing anyway...${NC}"
    fi
fi

# ============================================================================
# DETECT FUNCTIONS IN MIGRATION
# ============================================================================

echo -e "${BLUE}[2/5] Scanning migration for function definitions...${NC}"

# Extract function names from CREATE [OR REPLACE] FUNCTION statements.
# Supports schema-qualified names like public.my_function and stores only the function name.
FUNCTIONS_IN_MIGRATION=$(grep -oiE 'CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*' "$MIGRATION_FILE" | \
    sed -E 's/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+//i' | \
    sed -E 's/^[^.]+\.//' | \
    tr '[:upper:]' '[:lower:]' | \
    sort -u || true)

if [ -n "$FUNCTIONS_IN_MIGRATION" ]; then
    echo -e "  Functions found:"
    for func in $FUNCTIONS_IN_MIGRATION; do
        echo -e "    - $func"
    done
else
    echo -e "  ${GREEN}No function definitions found in this migration.${NC}"
fi

# ============================================================================
# CHECK FOR DOWNGRADES
# ============================================================================

echo ""
echo -e "${BLUE}[3/5] Checking for function version conflicts...${NC}"

DOWNGRADE_DETECTED=false
DOWNGRADE_FUNCTIONS=""

for func in $FUNCTIONS_IN_MIGRATION; do
    CURRENT_VERSION=$(psql "$CONN_STR" -t -A -c "SELECT current_version FROM supabase_migrations.function_versions WHERE function_name = '$func';" 2>/dev/null || echo "")

    if [ -n "$CURRENT_VERSION" ]; then
        if [ "$VERSION" -lt "$CURRENT_VERSION" ]; then
            echo -e "  ${RED}✗ DOWNGRADE DETECTED: $func${NC}"
            echo -e "    Current version: $CURRENT_VERSION"
            echo -e "    This migration:  $VERSION"
            DOWNGRADE_DETECTED=true
            DOWNGRADE_FUNCTIONS="$DOWNGRADE_FUNCTIONS $func"
        elif [ "$VERSION" = "$CURRENT_VERSION" ]; then
            echo -e "  ${YELLOW}= Same version: $func (version $VERSION)${NC}"
        else
            echo -e "  ${GREEN}✓ Upgrade: $func ($CURRENT_VERSION → $VERSION)${NC}"
        fi
    else
        echo -e "  ${GREEN}+ New function: $func (will be tracked at version $VERSION)${NC}"
    fi
done

if [ -z "$FUNCTIONS_IN_MIGRATION" ]; then
    echo -e "  ${GREEN}No version conflicts (no functions in migration).${NC}"
fi

if [ "$DOWNGRADE_DETECTED" = true ]; then
    echo ""
    echo -e "${RED}============================================================================${NC}"
    echo -e "${RED}  MIGRATION BLOCKED - WOULD DOWNGRADE FUNCTIONS${NC}"
    echo -e "${RED}============================================================================${NC}"
    echo ""
    echo -e "The following functions would be downgraded to older versions:"
    for func in $DOWNGRADE_FUNCTIONS; do
        echo -e "  ${RED}- $func${NC}"
    done
    echo ""
    echo -e "This typically means:"
    echo -e "  1. You're trying to apply an old migration that was already superseded"
    echo -e "  2. A newer migration already fixed/updated these functions"
    echo ""

    if [ "$FORCE_MODE" = true ]; then
        echo -e "${YELLOW}--force specified. Proceeding despite downgrade risk...${NC}"
        echo -e "${YELLOW}YOU ARE RESPONSIBLE FOR ANY ISSUES THIS CAUSES.${NC}"
        echo ""
    else
        echo -e "If you're CERTAIN this is correct, use --force:"
        echo -e "  $0 $MIGRATION_FILE --force"
        echo ""
        exit 1
    fi
fi

# ============================================================================
# APPLY MIGRATION
# ============================================================================

echo ""
echo -e "${BLUE}[4/5] Applying migration...${NC}"

# IMPORTANT: ON_ERROR_STOP prevents psql from continuing after SQL errors and
# falsely reporting success when a transaction rolls back.
if psql -v ON_ERROR_STOP=1 "$CONN_STR" -f "$MIGRATION_FILE" 2>&1; then
    echo -e "${GREEN}✓ Migration SQL executed successfully.${NC}"
else
    echo -e "${RED}✗ Migration failed!${NC}"
    exit 1
fi

# ============================================================================
# UPDATE TRACKING
# ============================================================================

echo ""
echo -e "${BLUE}[5/5] Updating tracking tables...${NC}"

# Track migration
psql -v ON_ERROR_STOP=1 "$CONN_STR" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$VERSION', '$NAME') ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;" 2>/dev/null
echo -e "  ${GREEN}✓ schema_migrations updated${NC}"

# Update function versions
for func in $FUNCTIONS_IN_MIGRATION; do
    psql -v ON_ERROR_STOP=1 "$CONN_STR" -c "INSERT INTO supabase_migrations.function_versions (function_name, current_version) VALUES ('$func', '$VERSION') ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();" 2>/dev/null
    echo -e "  ${GREEN}✓ function_versions: $func → $VERSION${NC}"
done

# ============================================================================
# SUCCESS
# ============================================================================

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  ✅ MIGRATION APPLIED SUCCESSFULLY${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Version: $VERSION"
echo -e "Name:    $NAME"
if [ -n "$FUNCTIONS_IN_MIGRATION" ]; then
    echo -e "Functions updated:"
    for func in $FUNCTIONS_IN_MIGRATION; do
        echo -e "  - $func"
    done
fi
echo ""
