# Migration & Trigger Audit Report

**Date:** 2026-01-17
**Auditor:** Claude Code

## Executive Summary

A critical issue was discovered with the migration naming convention. Only 17 of 140 migrations were properly tracked by Supabase, though the schema appears functional due to manual application.

## The Problem

### Wrong Naming Convention

The CLAUDE.md specified:
```
File format: YYYYMMDD_NNN_description.sql
```

This is **incompatible with Supabase**. Supabase tracks migrations by the numeric prefix only, so:
- `20260102_001_foo.sql`
- `20260102_002_bar.sql`

Are both seen as version `20260102`. Only the first one gets applied.

### Correct Format

The correct format should be:
```
File format: YYYYMMDDHHMMSS_description.sql
```

Example: `20260117193045_fix_override_sync.sql`

## Migration Statistics

| Category | Count |
|----------|-------|
| Total local migrations | 140 |
| Applied (tracked) | 17 |
| Not tracked | 123 |
| Archived (2024-2025) | 179 |

## Why The App Works

Despite the tracking issue, the schema exists. This suggests migrations were applied through:
- Manual SQL execution in Supabase dashboard
- Previous `supabase db push --include-all` runs
- Direct schema creation

## Trigger & Function Audit Results

### RPC Functions

| Function | Status | Used in Code |
|----------|--------|--------------|
| `validate_hierarchy_change` | ✅ EXISTS | Yes |
| `get_imo_production_by_agency` | ✅ EXISTS | Yes |
| `get_agency_weekly_production` | ✅ EXISTS | Yes |
| `get_hierarchy_tree` | ❌ MISSING | No |
| `get_team_comparison` | ❌ MISSING | No |
| `get_agent_production_metrics` | ❌ MISSING | No |

**Result:** All RPCs used by the codebase exist. Missing ones were planned but never implemented.

### Data Integrity Tests

| Test | Result |
|------|--------|
| Override status sync | ✅ PASS |
| Commission earned amounts | ✅ PASS |
| Hierarchy path consistency | ✅ PASS |
| Override records for active policies | ✅ PASS |

## Bug Fixed During Audit

### Override Commissions Showing $0

**Root Cause:** Two issues found and fixed:

1. **Cache Invalidation (Code Fix)**
   - `useUpdateCommissionStatus` hook wasn't invalidating override-related query keys
   - Added: `["overrides"]`, `["agent-overrides"]`, `["agent-details"]`, `["hierarchy", "stats"]`, `["team-comparison"]`

2. **Data Mismatch (Data Fix)**
   - 19 override_commissions had wrong status
   - Backfilled: 16 `pending` → `earned`, 3 `charged_back` → `chargedback`

## Recommendations

### Immediate

1. ✅ **DONE** - Updated CLAUDE.md with correct naming convention
2. ✅ **DONE** - Fixed override status cache invalidation
3. ✅ **DONE** - Backfilled mismatched override records

### Short-term

1. **Do NOT run `supabase db push --include-all`** without review
   - May cause conflicts or duplicate operations
   - Need to audit each pending migration for relevance

2. **Rename future migrations** using timestamp format:
   ```bash
   date +%Y%m%d%H%M%S  # Generate timestamp
   # Example: 20260117201530_add_new_feature.sql
   ```

### Long-term

1. Consider using Supabase's built-in migration commands:
   ```bash
   npx supabase migration new add_new_feature
   ```
   This auto-generates correct timestamps.

2. Audit and consolidate the 123 pending migrations:
   - Identify which contain unique SQL not yet in database
   - Merge or archive obsolete ones
   - Create a reconciliation migration if needed

## Files Changed

- `CLAUDE.md` - Updated migration naming convention
- `src/hooks/commissions/useUpdateCommissionStatus.ts` - Added override query invalidation

## Scripts Created (can be deleted)

- `scripts/audit-db-schema.ts`
- `scripts/audit-triggers.ts`
- `scripts/audit-critical-triggers.ts`
- `scripts/test-rpc-exists.ts`
