# Business Tools — Continuation Prompt

## What Was Done

Implemented the full Business Tools feature (Paddle Parser API integration) across 12 new files and 8 modified files. Feature registration, edge function proxy, service layer, TanStack Query hooks, and UI components are all created.

**Paddle Parser API** is deployed at `https://the-standard-tools.fly.dev/api/v1/` (Fly.io app name: `the-standard-tools`). Server-side pagination was added to the API (limit/offset/trust_state/category filters on GET /transactions and GET /statements). The API has 3,277 transactions and 88 statements.

**Edge function** `business-tools-proxy` is deployed (v3) with:
- Correct URL: `the-standard-tools.fly.dev` (NOT `paddle-parser.fly.dev`)
- Correct paths: `/meta/categories`, `/meta/institutions` (NOT root-level)
- Correct HTTP methods: all mutations use `POST` (NOT `PUT`)
- `batchInit` action that loads transactions + categories + institutions in a single call
- Pagination params forwarded as query strings

**Supabase secrets** are set: `PADDLE_PARSER_URL`, `PADDLE_PARSER_EMAIL`, `PADDLE_PARSER_PASSWORD`.

**Migration** `20260313132358_add_business_tools_feature.sql` applied — `business_tools` added to all plans, enabled for Team tier.

## What Still Needs Fixing

### 1. StatementsTab.tsx — Needs rewrite for paginated response
The `useStatements` hook now returns `PaginatedStatements` (with `items`, `total`, `limit`, `offset`) instead of `StatementResponse[]`. The component still expects an array. Needs:
- Accept paginated response shape (`data?.items` instead of `data`)
- Add pagination controls (page prev/next)
- Add server-side trust_state filter
- Same pattern as TransactionsTab.tsx (which is already updated)

### 2. UploadTab.tsx — useInstitutions may need adjustment
The `useInstitutions` hook works independently but on the Transactions tab we now use `useBatchInit` which seeds the institutions cache. The UploadTab still calls `useInstitutions()` directly which is fine (it'll use the seeded cache if available).

### 3. Build verification
After fixing StatementsTab, run:
```bash
npx tsc --noEmit   # Must be zero errors
npm run build       # Must succeed
./scripts/validate-app.sh  # Full validation
```

### 4. Edge function redeploy (if any changes)
```bash
supabase functions deploy business-tools-proxy
```

### 5. Test end-to-end in browser
- Navigate to `/business-tools`
- Transactions tab should load 50 rows with pagination controls
- Filters (trust_state, category) should work as server-side filters
- Statements tab should load paginated statements
- Upload tab should work for file upload

## Key Files

### Modified in this session (committed state may differ from working tree):
- `src/constants/features.ts` — Added `tools` category + `business_tools` feature
- `src/services/subscription/SubscriptionRepository.ts` — Added `business_tools: boolean`
- `src/services/subscription/adminSubscriptionService.ts` — Added `business_tools: false` to defaults
- `src/hooks/subscription/useFeatureAccess.ts` — Added display name
- `src/hooks/subscription/useOwnerDownlineAccess.ts` — Added to granted features
- `src/components/layout/Sidebar.tsx` — Added Briefcase nav item in Tools group
- `src/router.tsx` — Added `/business-tools` route (lazy-loaded)
- `src/features/billing/components/admin/FeatureAssignmentMatrix.tsx` — Added Wrench icon

### New files:
- `supabase/functions/business-tools-proxy/index.ts` — Edge function proxy
- `supabase/migrations/20260313132358_add_business_tools_feature.sql`
- `src/features/business-tools/types.ts` — Includes PaginatedTransactions, PaginatedStatements, TransactionQuery, StatementQuery, BatchInitResponse
- `src/features/business-tools/services/businessToolsService.ts` — With batchInit, paginated getTransactions/getStatements
- `src/features/business-tools/hooks/useBusinessTools.ts` — With useBatchInit, paginated queries, keepPreviousData
- `src/features/business-tools/BusinessToolsPage.tsx` — Main page with access gating + tabs
- `src/features/business-tools/components/BusinessToolsLanding.tsx` — Upsell page
- `src/features/business-tools/components/UploadTab.tsx` — File upload + job polling
- `src/features/business-tools/components/TransactionsTab.tsx` — Already updated for pagination via useBatchInit
- `src/features/business-tools/components/StatementsTab.tsx` — **NEEDS FIX for pagination**
- `src/features/business-tools/components/ExportButton.tsx` — Workbook download
- `src/features/business-tools/index.ts` — Barrel export

### Paddle Parser API (separate project):
- Project: `~/projects/paddle-parser`
- Fly.io app: `the-standard-tools`
- Pagination added to `src/bank_statement_parser/web/routes/transactions.py` (GET /transactions and GET /statements)
- Schema models added to `src/bank_statement_parser/web/schemas.py` (PaginatedTransactions, PaginatedStatements)
- Already deployed to Fly.io

## API Reference (Paddle Parser)

Key endpoints (all require Bearer token from POST /auth/login):
- `GET /transactions?limit=50&offset=0&trust_state=X&category=X` → `{ items, total, limit, offset }`
- `GET /statements?limit=50&offset=0&trust_state=X` → `{ items, total, limit, offset }`
- `GET /meta/categories` → `{ categories, kinds, quick_classifications }`
- `GET /meta/institutions` → `{ institutions: [...] }`
- `POST /pipeline/run` (multipart) → `{ job_id }`
- `GET /jobs/{job_id}` → `{ job_id, status, progress_stage, progress_total, progress_message, result, error }`
- `POST /transactions/{id}/categorize` → TransactionResponse
- `POST /transactions/{id}/approve` → TransactionResponse
- `POST /transactions/{id}/exclude` → TransactionResponse
- `POST /transactions/bulk/categorize` → `{ updated, failed }`
- `POST /transactions/bulk/approve` → `{ updated, failed }`
- `POST /transactions/bulk/exclude` → `{ updated, failed }`
- `POST /statements/{id}/trust` → StatementResponse
- `POST /export/workbook` (generate) → `{ output_path, statement_count, transaction_count }`
- `GET /export/workbook` (download) → binary .xlsx
