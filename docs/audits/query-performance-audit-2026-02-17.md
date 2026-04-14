# Query Performance Audit — 2026-02-17

> **STATUS: CRITICAL finding RESOLVED 2026-02-17.** The `get_premium_matrices_for_imo`
> issue (1,166 ms avg, 9,546 calls — rank #1 worst query) was addressed in migration
> `supabase/migrations/20260217103400_optimize_get_premium_matrices_for_imo.sql` the
> same day as this audit. Overload cleanup followed in `20260217104622_drop_old_get_premium_matrices_overload.sql`.
> Other findings (HIGH/MEDIUM/LOW) may still be open — re-audit recommended before
> relying on this doc.

Data source: `pg_stat_statements` + `pg_stat_user_tables` on Supabase project `pcyaqwodnyrpkaiojnpz`.

---

## Executive Summary

| Rank | Query / Function | Avg (ms) | Calls | Total (s) | Severity |
|------|-----------------|----------|-------|-----------|----------|
| 1 | `get_premium_matrices_for_imo` RPC | **1,166** | 9,546 | **11,131** | CRITICAL |
| 2 | Supabase Realtime WAL processing | 5.3 | 1,796,103 | 9,562 | INTERNAL |
| 3 | `premium_matrix` + product JOIN | **281** | 404 | 114 | HIGH |
| 4 | `policies` user_id queries | 20–32 | ~3,500 | ~90 | MEDIUM |
| 5 | `user_profiles` roles filter | 51 | 586 | 30 | MEDIUM |
| 6 | `get_imo_production_by_agency` RPC | 95 | 159 | 15 | MEDIUM |
| 7 | `get_team_analytics_data` RPC | 83 | 91 | 8 | LOW |
| 8 | `get_leaderboard_data` RPC | 49 | 100 | 5 | LOW |
| 9 | Lead RPC functions (4 funcs) | 39–73 | ~230 | ~12 | LOW |
| 10 | `subscription_plans` reads | 8.5 | 647 | 6 | LOW |

---

## 1. CRITICAL — `get_premium_matrices_for_imo` (avg 1,166 ms)

**The single worst query in the database.** 9,546 calls averaging 1.17 seconds each.

### Codebase Location

| File | Method | Lines |
|------|--------|-------|
| `src/services/underwriting/premiumMatrixService.ts` | `getPremiumMatricesForImo()` | 636, 651 |

### What It Does

Fetches all premium matrix rows for an IMO. The method uses **parallel pagination** (line 648–655), spawning multiple concurrent RPC calls when the dataset exceeds `PAGE_SIZE`. Each page fires a separate `get_premium_matrices_for_imo` RPC call.

### Why It's Slow

- The `premium_matrix` table has **47,231 rows** (19 MB).
- The RPC is called repeatedly via `Promise.all()` pagination — multiplying the call count.
- The RPC function likely does a full scan filtered only by `imo_id`.

### Recommendations

1. Check the RPC function body for missing index usage (needs `WHERE imo_id = $1` hitting `idx_premium_matrix_product` or add a dedicated `idx_premium_matrix_imo_id`).
2. Replace parallel-pagination pattern with a single RPC call that uses server-side pagination or streaming.
3. Cache results per IMO — premium matrices change infrequently.
4. Consider if the UI actually needs all 47K rows or if filtering/aggregation can happen server-side.

---

## 2. HIGH — `premium_matrix` with product JOIN (avg 281 ms)

### Codebase Location

| File | Method | Lines | Pattern |
|------|--------|-------|---------|
| `src/services/underwriting/premiumMatrixService.ts` | `getPremiumMatrixForProduct()` | 405, 433, 452 | `.select(*).eq("product_id", ...).eq("imo_id", ...)` |
| `src/services/underwriting/premiumMatrixService.ts` | `getPremiumMatrixByClassification()` | 539 | `.eq("product_id", ...).eq("gender", ...).eq("tobacco_class", ...).eq("health_class", ...)` |
| `src/services/underwriting/premiumMatrixService.ts` | `getProductsWithPremiumMatrix()` | 573 | `.select("product_id").eq("imo_id", ...)` |
| `src/services/underwriting/premiumMatrixService.ts` | `getTermYearsForProduct()` | 593 | `.select("term_years").eq("product_id", ...).eq("imo_id", ...)` |
| `src/services/underwriting/product-evaluation.ts` | `getAllMatricesForImo()` | 173 | `.select(*).in("product_id", [...]).eq("imo_id", ...).limit(10000)` |

### Why It's Slow

The 281ms average comes from queries that LEFT JOIN `products` table for every row. With 47K rows and a per-row lateral join, this is expensive.

### Existing Indexes (adequate)

- `idx_premium_matrix_product` — `(product_id, imo_id)` ✓
- `idx_premium_matrix_lookup` — `(product_id, gender, tobacco_class, health_class, imo_id)` ✓
- `idx_premium_matrix_quick_quote` — `(imo_id, product_id, age, face_amount)` ✓

### Recommendations

1. Avoid `select(*)` — only select needed columns to reduce I/O.
2. The `product-evaluation.ts:173` call fetches up to 10,000 rows at once — consider batching.
3. PostgREST lateral joins (the `product` embed) add overhead; fetch product data separately if possible.

---

## 3. MEDIUM — `policies` Table Queries (avg 20–32 ms)

### Codebase Locations

| File | Key Methods | Lines |
|------|-------------|-------|
| `src/services/policies/PolicyRepository.ts` | All CRUD operations | 59–928 (22+ query sites) |
| `src/services/policies/policyService.ts` | `cancelPolicy()`, `lapsePolicy()`, `reinstatePolicy()` | 579, 707, 827 |
| `src/services/reports/reportGenerationService.ts` | `generateUserReport()`, `fetchPolicyData()` | 180, 371, 897 |
| `src/services/reports/insightsService.ts` | `findLapsedPolicies()`, `getPersistencyMetrics()` | 123, 224, 395, 493 |
| `src/services/reports/drillDownService.ts` | `getPoliciesByCarrier()`, `getPoliciesByProduct()` | 214, 304 |
| `src/services/commissions/CommissionCRUDService.ts` | `findByLeadPurchaseId()` | 264 |
| `src/services/clients/client/ClientRepository.ts` | `hasPolicies()` | 226 |
| `src/services/workflow-recipient-resolver.ts` | `resolveAgentFromPolicy()`, `resolveClientFromPolicy()` | 305, 335 |
| `src/hooks/reports/useReportFilterOptions.ts` | `fetchPolicies()` | 67 |

### Current State

- 739 rows, 1.5 MB — small table.
- **35 indexes** (extremely over-indexed for 739 rows).
- 776 seq_scans vs 224,546 idx_scans — indexes are being used heavily.
- Queries are generally well-optimized with proper `user_id` and `status` filters.

### Recommendations

1. **Remove redundant indexes** — 35 indexes for 739 rows is excessive. Many overlapping indexes:
   - `idx_policies_user_id` is redundant with `idx_policies_user_status`, `idx_policies_user_created`, etc.
   - `idx_policies_status` is redundant with `idx_policies_status_lifecycle`, `idx_policies_status_effective_date`.
   - Could safely drop ~10 indexes.
2. Performance is acceptable; optimization effort should go elsewhere.

---

## 4. MEDIUM — `user_profiles` Roles Filter (avg 51 ms, 140K seq_scans)

### Why It Looks Worse Than It Is

- Only **104 rows** in the table (1 MB). Sequential scans on 104 rows take **0.163 ms** (verified via EXPLAIN ANALYZE).
- The 140K seq_scan count is high because PostgreSQL chooses seq scan over index scan for tiny tables (correct behavior).
- The 51ms average in `pg_stat_statements` includes PostgREST overhead + RLS policy evaluation, not just the scan.

### Codebase Locations (44+ files)

| Category | Key Files |
|----------|-----------|
| **Auth/Permissions** | `src/contexts/AuthContext.tsx` (lines 98, 188, 278, 444), `src/services/permissions/PermissionRepository.ts` (154, 171, 185, 207) |
| **Agency** | `src/services/agency/AgencyService.ts` (94, 146, 257, 276, 445, 516, 547, 585), `src/services/agency/AgencyRepository.ts` (138) |
| **Recruiting** | `src/features/recruiting/hooks/useRecruitInvitations.ts`, `src/services/recruiting/checklistService.ts` (7 sites), `src/services/recruiting/pipelineAutomationService.ts` (3 sites) |
| **Settings** | `src/features/settings/components/UserProfile.tsx` (43, 86, 110, 278, 297) |
| **Messaging** | `src/features/messages/services/contactService.ts` (9 sites), `src/features/messages/services/emailService.ts` (214, 787) |
| **Workflows** | `src/services/workflow-recipient-resolver.ts` (9 sites) |
| **IMO** | `src/services/imo/ImoService.ts` (88, 279), `src/services/imo/ImoRepository.ts` (73) |
| **Leads** | `src/services/leads/leadsService.ts` (54, 361), `src/services/lead-purchases/LeadVendorRepository.ts` (50) |
| **Other** | `src/services/base/TenantContext.ts` (29), `src/hooks/users/useUserSearch.ts` (113) |

### Issues Found

1. **Duplicate GIN index**: Both `idx_user_profiles_roles` and `idx_user_profiles_roles_gin` exist — identical. Drop one.
2. **29 indexes for 104 rows** — massively over-indexed. Many will never be used.
3. The most common query pattern (`.select("roles").eq("id", userId).single()`) hits the PK index — fine.

### Recommendations

1. Drop `idx_user_profiles_roles` (duplicate of `idx_user_profiles_roles_gin`).
2. Audit and drop unused indexes (check `idx_scan = 0` for each).
3. No code changes needed — the 51ms average is dominated by RLS overhead, not the scan.

---

## 5. RPC Functions — IMO Dashboard & Analytics

### `get_imo_dashboard_metrics` (avg 52 ms, 159 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/imo/ImoService.ts` | `getDashboardMetrics()` | 317 |

### `get_imo_production_by_agency` (avg 95 ms, 159 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/imo/ImoService.ts` | `getProductionByAgency()` | 380 |

### `get_imo_override_summary` (avg 47 ms, 159 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/imo/ImoService.ts` | `getOverrideSummary()` | 637 |

### `get_team_analytics_data` (avg 83 ms, 91 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/analytics/teamAnalyticsService.ts` | `fetchRawData()` | 53 |

### `get_leaderboard_data` (avg 49 ms, 100 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/leaderboard/leaderboardService.ts` | `fetchAgentLeaderboard()` | 303 |

### Recommendations

These RPCs are acceptable for dashboard-style queries. If they become bottlenecks:
1. Add server-side caching (materialized views or pg_cron refresh).
2. Ensure the underlying functions use indexed columns for date range filters.

---

## 6. Lead Management RPCs

### `get_lead_pack_heat_metrics` (avg 73 ms, 33 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/lead-purchases/LeadPurchaseRepository.ts` | `getPackHeatMetrics()` | 552 |

### `get_lead_recent_policies` (avg 67 ms, 62 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/lead-purchases/LeadPurchaseRepository.ts` | `getLeadRecentPolicies()` | 516 |

### `get_lead_vendor_admin_overview` (avg 41 ms, 65 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/lead-purchases/LeadPurchaseRepository.ts` | `getVendorAdminOverview()` | 294 |

### `get_lead_pack_list` (avg 39 ms, 69 calls)

| File | Method | Line |
|------|--------|------|
| `src/services/lead-purchases/LeadPurchaseRepository.ts` | `getLeadPackList()` | 475 |

Performance is acceptable. No action needed.

---

## 7. LOW — `subscription_plans` (avg 8.5 ms, 647 calls)

### Codebase Locations

| File | Key Methods | Lines |
|------|-------------|-------|
| `src/services/subscription/SubscriptionRepository.ts` | `findAllPlans()`, `findActivePlans()`, `findPlanById()`, `findPlanByName()` | 128, 148, 169, 191 |
| `src/services/subscription/adminSubscriptionService.ts` | Various update/create methods | 146, 190, 234, 284, 367, 821, 870 |

### Analysis

647 calls at 8.5ms is fine. The high call count suggests repeated fetches from component re-renders. TanStack Query caching should handle this — verify `staleTime` is set appropriately.

---

## Table Health Summary

| Table | Size | Rows | Seq Scans | Idx Scans | Index Count | Issues |
|-------|------|------|-----------|-----------|-------------|--------|
| `cron.job_run_details` | **64 MB** | 69,158 | 13 | 23,896 | — | Needs purging |
| `premium_matrix` | 19 MB | 47,231 | 424 | 18,263 | 8 | OK |
| `auth.audit_log_entries` | 18 MB | 57,079 | 0 | 0 | 0 | Supabase internal, no action |
| `user_profiles` | 1 MB | 104 | 140,308 | 15,265,760 | **29** | Over-indexed, duplicate GIN |
| `policies` | 1.5 MB | 739 | 776 | 224,546 | **35** | Over-indexed |
| `workflow_events` | 1 MB | 1,833 | 1 | **0** | 3 | Indexes unused |

### Duplicate / Redundant Indexes to Clean Up

| Table | Index | Reason |
|-------|-------|--------|
| `user_profiles` | `idx_user_profiles_roles` | Duplicate of `idx_user_profiles_roles_gin` (both GIN on same column) |
| `user_profiles` | `idx_user_profiles_recruiter_id` | Duplicate of `idx_user_profiles_recruiter` (identical definition) |
| `policies` | `idx_policies_user_id` | Redundant — covered by `idx_policies_user_status`, `idx_policies_user_created`, etc. |
| `policies` | `idx_policies_status` | Redundant — covered by `idx_policies_status_lifecycle`, `idx_policies_status_effective_date` |

---

## Priority Action Items

### P0 — Fix Now
1. **Optimize `get_premium_matrices_for_imo` RPC function** — Review the SQL body, add proper index on `(imo_id)` if missing, and eliminate the parallel-pagination pattern in `premiumMatrixService.ts:648-655`.

### P1 — Do Soon
2. **Clean up `cron.job_run_details`** — 64 MB of cron history. Purge old entries.
3. **Drop duplicate indexes** on `user_profiles` and `policies` — saves write overhead on every INSERT/UPDATE.

### P2 — When Convenient
4. **Audit `premium_matrix` query patterns** — Replace `select(*)` with column selection in `premiumMatrixService.ts`.
5. **Verify TanStack Query `staleTime`** for `subscription_plans` to reduce 647 redundant calls.
6. **Consider materialized views** for IMO dashboard RPCs if they become bottlenecks at scale.
