# Continuation: Align Dashboard to use MTD (Month-to-Date)

## Context
We consolidated agency production metrics to use a single service chain:
- Hook: `useImoProductionByAgency`
- Service: `imoService.getProductionByAgency`
- RPC: `get_imo_production_by_agency`

Both Dashboard and Reports now use this same chain. However, they pass different date ranges:
- **Dashboard**: defaults to `timePeriod = "monthly"` (full calendar month, e.g., Jan 1-31)
- **Reports**: defaults to `timePeriod = "MTD"` (month-to-date, e.g., Jan 1-17)

This causes different numbers to display (Dashboard: $143,911 vs Reports: $132,098).

## Task
Change Dashboard to default to MTD instead of "monthly" so both pages show the same numbers.

## File to Change
`src/features/dashboard/DashboardHome.tsx`

### Current (line ~61):
```typescript
const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");
```

### Required Change:
1. The Dashboard uses `TimePeriod` type from `src/utils/dateRange.ts` which only has: `"daily" | "weekly" | "monthly" | "yearly"`
2. Reports uses `AdvancedTimePeriod` from `src/features/analytics/components/TimePeriodSelector.tsx` which includes `"MTD"`

**Options:**
- Option A: Add "MTD" to the Dashboard's TimePeriod type and update `getDateRange()` to handle it
- Option B: Refactor Dashboard to use `AdvancedTimePeriod` and `getAdvancedDateRange()` like Reports does
- Option C: Change Dashboard default from "monthly" to compute MTD manually (start of month to today)

**Recommended: Option A** - Add MTD support to the existing date range utility since it's a common use case.

## Files Likely Involved
- `src/utils/dateRange.ts` - Add "MTD" to TimePeriod type and handle in getDateRange()
- `src/features/dashboard/DashboardHome.tsx` - Change default from "monthly" to "MTD"

## Verification
After changes:
1. Run `npm run typecheck`
2. Load Dashboard - should show same agency production numbers as Reports page
3. Both should now default to MTD (month-to-date) range

## Related Changes Made in Previous Session
- Fixed 403 error on `commission_chargeback_summary` (use RPC instead of direct query)
- Extended `get_imo_production_by_agency` RPC to include retention_rate, ranks, policies_lapsed
- Refactored `ImoPerformanceReport.tsx` to use `useImoProductionByAgency` instead of duplicate `useTeamComparisonReport`
- Removed duplicate `getTeamComparisonReport` service method and `useTeamComparisonReport` hook
- Applied migrations: `20260117_002_fix_team_comparison_hierarchy.sql`, `20260117_003_extend_imo_production_by_agency.sql`
