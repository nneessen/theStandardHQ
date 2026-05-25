# CONTINUATION: Hierarchy AP Calculation Fix

## CRITICAL CONTEXT - READ FIRST

The previous assistant made multiple incorrect attempts to fix this. The user is frustrated. Do NOT repeat the same mistakes.

## The Business Requirement (VERY IMPORTANT)

This is an MLM-style insurance agency system. The "Production by Agency" dashboard panel should show **RECURSIVE HIERARCHY-BASED TOTALS**, NOT flat organizational membership.

### Agency Structure

```
Self Made Financial (TOP LEVEL - owned by Kerry Glass)
├── The Standard (child agency - owned by Nick Neessen, who is Kerry's DIRECT DOWNLINE)
├── 1 of 1 Financial (child agency - owned by Hayes Crockett, who is Kerry's DIRECT DOWNLINE)
└── Ten Toes Down (child agency - owned by Chase Cockrell, who is Kerry's DIRECT DOWNLINE)
```

### User Hierarchy (upline/downline relationships)

```
Kerry Glass (Self Made owner)
├── Nick Neessen (owns The Standard, reports to Kerry)
│   ├── Hunter Thornhill (reports to Nick)
│   │   └── nick@nickneessen.com (reports to Hunter)
│   └── [other Nick downlines]
├── Hayes Crockett (owns 1 of 1 Financial, reports to Kerry)
│   └── [Hayes' downlines]
└── Chase Cockrell (owns Ten Toes Down, reports to Kerry)
    └── [Chase's downlines]
```

### What "Production by Agency" SHOULD Show

| Agency              | Should Include                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Self Made Financial | Kerry + Nick + Hunter + nick@nickneessen.com + Hayes + all Hayes' downlines + Chase + all Chase' downlines = **ENTIRE ORGANIZATION** |
| The Standard        | Nick + Hunter + nick@nickneessen.com + all Nick's other downlines                                                                    |
| 1 of 1 Financial    | Hayes + all Hayes' downlines                                                                                                         |
| Ten Toes Down       | Chase + all Chase's downlines                                                                                                        |

**YES, THE NUMBERS WILL OVERLAP.** Self Made's total will be larger than the sum of the child agencies because Self Made includes EVERYTHING.

### The Key Insight

- Each agency's AP = SUM of policies written by users in the **agency owner's hierarchy tree**
- Use `hierarchy_path LIKE owner_path || '.%'` to find all descendants
- This is RECURSIVE - unlimited depth

## What Went Wrong

1. First attempt: Fixed `get_agency_dashboard_metrics` correctly (this one is OK)
2. Second attempt: Fixed `get_imo_production_by_agency` with hierarchy - but user said numbers were WAY too high ($1.8M when should be much less)
3. Third attempt: REVERTED to flat agency_id - user says this is STILL wrong and shows same numbers as before

The user explicitly said: "self made financial ap total should also include their downlines and everyone on their team, and their downlines downlines. its a recursive calculation"

So hierarchy-based IS correct, but something was wrong with the implementation.

## Files Involved

### SQL Migrations (in order applied)

```
supabase/migrations/20260115_001_fix_agency_metrics_hierarchy.sql  -- Fixed get_agency_dashboard_metrics
supabase/migrations/20260115_002_fix_remaining_hierarchy_bugs.sql  -- Fixed get_imo_production_by_agency (hierarchy) + others
supabase/migrations/20260115_003_revert_imo_production_by_agency.sql  -- REVERTED to agency_id (THIS WAS WRONG)
```

### Key RPC Functions

- `get_agency_dashboard_metrics` - Individual agency's team total (hierarchy-based) ✅
- `get_imo_production_by_agency` - Breakdown showing all agencies (NEEDS HIERARCHY)
- `get_agency_override_summary` - Override totals (hierarchy-based)

### Frontend Code Path

```
src/features/dashboard/components/OrgMetricsSection.tsx
  └── ProductionBreakdownPanel (line ~534)
      └── useImoProductionByAgency hook
          └── imoService.getProductionByAgency()
              └── RPC: get_imo_production_by_agency
```

## Database Schema

```sql
user_profiles (
  id UUID,
  email TEXT,
  agency_id UUID,           -- Organizational assignment (may be NULL or wrong)
  upline_id UUID,           -- Direct upline
  hierarchy_path TEXT,      -- Full path: "root_id.parent_id.user_id" (dot-separated UUIDs)
)

agencies (
  id UUID,
  name TEXT,
  owner_id UUID,            -- Who owns this agency
  parent_agency_id UUID,    -- Parent agency (NULL = top level)
)

policies (
  id UUID,
  user_id UUID,             -- Who wrote the policy
  annual_premium NUMERIC,
  status TEXT,
  effective_date DATE,
)
```

## The Correct Pattern for Hierarchy-Based AP

```sql
-- For each agency, get the owner's hierarchy path, then find ALL users in that tree
WITH agency_with_owner_path AS (
  SELECT
    a.id as agency_id,
    a.name,
    a.owner_id,
    COALESCE(up.hierarchy_path, up.id::text) as owner_path
  FROM agencies a
  JOIN user_profiles up ON a.owner_id = up.id
)
SELECT
  awp.agency_id,
  awp.name,
  SUM(p.annual_premium) as total_ap
FROM agency_with_owner_path awp
JOIN user_profiles team_member ON (
  team_member.id = awp.owner_id
  OR team_member.hierarchy_path LIKE awp.owner_path || '.%'
)
JOIN policies p ON p.user_id = team_member.id
WHERE p.status = 'active'
GROUP BY awp.agency_id, awp.name;
```

## Debug Queries to Run

### 1. Check actual policy data

```sql
SELECT COUNT(*), SUM(annual_premium)
FROM policies
WHERE status = 'active';
```

### 2. Check Kerry's full team (should be everyone)

```sql
WITH kerry AS (
  SELECT id, hierarchy_path FROM user_profiles WHERE email = 'kerryglass.ffl@gmail.com'
)
SELECT up.email, up.hierarchy_path
FROM user_profiles up, kerry k
WHERE up.id = k.id OR up.hierarchy_path LIKE k.hierarchy_path || '.%';
```

### 3. Check what the RPC actually returns

```sql
-- Run as authenticated user (not postgres) to test access
SELECT * FROM get_imo_production_by_agency('2025-01-01', '2026-12-31');
```

## Your Task

1. **Investigate** why the hierarchy-based calculation showed wrong numbers (too high)
2. **Fix** `get_imo_production_by_agency` to use hierarchy correctly
3. **Verify** with actual database queries that the totals match expectations
4. **Test** the dashboard shows correct numbers

## DO NOT

- Revert to flat agency_id - the user explicitly said hierarchy is required
- Make assumptions - verify with actual data queries
- Apply migrations without testing the SQL logic first

## User's Frustration

The user said: "you did absolutely nothing correct" and "this is showing me all the exact same #'s as before, so you literally changed/fixed nothing at all"

Take this seriously. Verify your changes actually work before telling the user it's fixed.
