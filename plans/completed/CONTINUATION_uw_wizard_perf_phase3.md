# Continuation: UW Wizard Performance Phase 3 - Bug Fix Required

## Status: BUG - Only Mutual of Omaha Returning

## Problem
After implementing batch premium matrix fetch optimization, the UW wizard is now faster BUT only returns products from one carrier (Mutual of Omaha) instead of all carriers.

## What Was Done (2026-01-16)

### Optimizations Implemented
1. **Batch fetch premium matrices** - Added `batchFetchPremiumMatrices()` function in `decisionEngine.ts` (lines 802-847)
2. **Parallel pre-fetch** - Criteria and matrices now fetched in parallel
3. **Eliminated count query** - `getPremiumMatrixForProduct()` no longer does count first

### Files Modified
- `src/services/underwriting/decisionEngine.ts`
  - Added `batchFetchPremiumMatrices()` function (lines 802-847)
  - Added `premiumMatrixMap` to `ProductEvaluationContext` interface (line 223)
  - Updated `getRecommendations()` to call batch fetch (lines 1309-1314)
  - Updated `evaluateSingleProduct()` to use prefetched matrix (lines 909, 930-931)
- `src/services/underwriting/premiumMatrixService.ts`
  - Refactored `getPremiumMatrixForProduct()` to eliminate count query first

## Likely Bug Location

The `batchFetchPremiumMatrices()` function in `decisionEngine.ts` (lines 802-847):

```typescript
async function batchFetchPremiumMatrices(
  productIds: string[],
  imoId: string,
): Promise<Map<string, PremiumMatrix[]>> {
  // ... fetch all matrices with IN clause
  // Group by productId
  for (const row of data || []) {
    const pid = row.product_id;
    // ... grouping logic
  }
}
```

### Possible Issues to Investigate
1. **Query returning limited rows** - Supabase default limit is 1000 rows. If total matrix data exceeds this, only some products get data.
2. **Grouping logic bug** - The Map grouping might have an issue
3. **Empty matrix = product skipped** - Products with no matrix data in the Map might be getting skipped incorrectly
4. **RLS policy issue** - The batch query might have different RLS behavior than individual queries

## Debugging Steps

1. Add logging to `batchFetchPremiumMatrices()`:
   ```typescript
   console.log(`[BatchFetch] Fetching matrices for ${productIds.length} products`);
   console.log(`[BatchFetch] Got ${data?.length || 0} total rows`);
   console.log(`[BatchFetch] Unique products in result: ${matrixMap.size}`);
   ```

2. Check if the batch query is hitting row limits:
   - Add `.limit(10000)` to the query
   - Or use pagination for batch fetch

3. Compare results:
   - Log which products have matrix data vs which don't
   - Check if Mutual of Omaha products are first alphabetically or have more matrix rows

## Key Code References

### batchFetchPremiumMatrices (decisionEngine.ts:802-847)
```typescript
const { data, error } = await supabase
  .from("premium_matrix")
  .select(`*, product:products(id, name, product_type, carrier_id)`)
  .in("product_id", productIds)
  .eq("imo_id", imoId)
  .order("product_id", { ascending: true })
  // MISSING: .limit() - might be truncating results!
```

### evaluateSingleProduct matrix lookup (decisionEngine.ts:930-931)
```typescript
const matrix = premiumMatrixMap.get(product.productId) ??
  await getPremiumMatrixForProduct(product.productId, imoId);
```

## Fix Strategy

1. **Add row limit to batch query** - Set `.limit(50000)` or implement pagination
2. **Add diagnostic logging** - Log product counts and matrix data distribution
3. **Verify Map contains all products** - Check the initialization loop at end of function
4. **Test with DEBUG_DECISION_ENGINE=true** - Enable verbose logging

## Tests to Run After Fix
```bash
npx vitest run src/services/underwriting/__tests__/decisionEngine.test.ts
npx vitest run src/services/underwriting/__tests__/premiumMatrixService.test.ts
npm run typecheck
npm run build
```

## Memory File
See `.serena/memories/decision_engine_performance_optimizations.md` for full optimization history.
