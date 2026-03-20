#!/bin/bash
# scripts/migrations/run-sql.sh
# ============================================================================
# RUN ARBITRARY SQL SAFELY
# ============================================================================
#
# Use this for:
# - One-off data fixes
# - Queries
# - Testing
#
# DO NOT use this for:
# - Schema changes (use run-migration.sh)
# - Function updates (use run-migration.sh)
# - Anything that should be repeatable
#
# Usage:
#   ./scripts/migrations/run-sql.sh "SELECT * FROM users LIMIT 5;"
#   ./scripts/migrations/run-sql.sh -f /path/to/script.sql
#   ./scripts/migrations/run-sql.sh --interactive

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    exit 1
fi

# Skip SSL for local Supabase (127.0.0.1 / localhost)
if echo "$DATABASE_URL" | grep -qE '(127\.0\.0\.1|localhost)'; then
    CONN_STR="$DATABASE_URL"
else
    CONN_STR="${DATABASE_URL}?sslmode=require"
fi

# Check for function definitions in SQL and warn
check_for_functions() {
    local sql="$1"
    if echo "$sql" | grep -qiE 'CREATE\s+(OR\s+REPLACE\s+)?FUNCTION'; then
        echo -e "${RED}============================================================================${NC}"
        echo -e "${RED}  WARNING: SQL CONTAINS FUNCTION DEFINITIONS${NC}"
        echo -e "${RED}============================================================================${NC}"
        echo ""
        echo -e "${YELLOW}You should use run-migration.sh instead to:${NC}"
        echo -e "${YELLOW}  1. Track the migration properly${NC}"
        echo -e "${YELLOW}  2. Update function version registry${NC}"
        echo -e "${YELLOW}  3. Prevent accidental downgrades${NC}"
        echo ""
        echo -e "Create a migration file first:"
        echo -e "  Filename: supabase/migrations/\$(date +%Y%m%d%H%M%S)_description.sql"
        echo ""
        read -p "Continue anyway? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "Aborted."
            exit 1
        fi
        echo ""
    fi
}

# Interactive mode
if [ "$1" = "--interactive" ] || [ "$1" = "-i" ]; then
    echo -e "${BLUE}Connecting to database interactively...${NC}"
    echo -e "${YELLOW}WARNING: For migrations/functions, use run-migration.sh instead${NC}"
    echo ""
    psql "$CONN_STR"
    exit 0
fi

# File mode
if [ "$1" = "-f" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}ERROR: No file specified${NC}"
        exit 1
    fi
    SQL_FILE="$2"
    if [ ! -f "$SQL_FILE" ]; then
        echo -e "${RED}ERROR: File not found: $SQL_FILE${NC}"
        exit 1
    fi

    SQL_CONTENT=$(cat "$SQL_FILE")
    check_for_functions "$SQL_CONTENT"

    echo -e "${BLUE}Running SQL from file: $SQL_FILE${NC}"
    echo ""
    psql "$CONN_STR" -f "$SQL_FILE"
    exit 0
fi

# Direct SQL mode
if [ -z "$1" ]; then
    echo "Usage:"
    echo "  $0 \"SELECT * FROM users LIMIT 5;\""
    echo "  $0 -f /path/to/script.sql"
    echo "  $0 --interactive"
    exit 1
fi

SQL="$1"
check_for_functions "$SQL"

psql "$CONN_STR" -c "$SQL"
