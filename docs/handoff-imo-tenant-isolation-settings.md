# IMO Tenant Isolation Settings Handoff

## Goal

Make Settings-managed reference data truly IMO-scoped end to end:

- carriers
- products
- comp guide / commission rates
- constants
- product commission overrides
- related policy creation lookup data
- agency creation / assignment flows

The requirement is that one IMO must not be able to read, update, delete, or accidentally use another IMO's settings data, while still allowing the same carrier names to exist in multiple IMOs.

## Current Status

Most of the architectural hardening is done.

- Database migration added to enforce IMO scoping and remove global/null settings rows.
- New `TenantScopedRepository` base added so IMO-owned repositories default to tenant-safe reads/writes.
- Carrier, product, comp guide, constants, and product override repository/service flows were updated to respect IMO boundaries.
- Policy-add related hooks were changed to stop reading global/shared carrier/product/comp data.
- Super-admin carrier and agency creation now have explicit IMO selection instead of relying on implicit current IMO context.
- Products and Commission Rates settings pages were partially updated to follow the same explicit IMO-selection pattern.

## Open Issue To Start With

The immediate bug still reported by the user:

- Carrier `Aflac` was added for IMO `Epic Life`.
- In `Settings -> Products`, after selecting `Epic Life`, that carrier is still not visible.

That means there is still at least one data-flow mismatch between:

- selected IMO in Settings UI
- carrier query hook
- product form carrier lookup
- actual `carriers.imo_id` value in the database

## Most Likely Remaining Failure Modes

The next conversation should validate these in order:

1. `Aflac` was inserted with the wrong `imo_id`.
2. The Products page selected IMO state is not propagating into the carrier query used by `ProductForm`.
3. The page-level selected IMO and the form-level selected IMO are diverging.
4. Carrier creation succeeded under super-admin but used stale `selectedImoId`.
5. The UI shows the selected IMO, but the query key or hook enablement still points at the wrong tenant.

## Key Files Changed

### Database / backend boundary

- [supabase/migrations/20260519090000_harden_imo_scoped_settings.sql](/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260519090000_harden_imo_scoped_settings.sql:1)
- [src/services/base/TenantScopedRepository.ts](/Users/nickneessen/projects/commissionTracker/src/services/base/TenantScopedRepository.ts:1)
- [src/services/settings/carriers/CarrierRepository.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/carriers/CarrierRepository.ts:1)
- [src/services/settings/carriers/CarrierService.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/carriers/CarrierService.ts:1)
- [src/services/settings/products/ProductRepository.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/products/ProductRepository.ts:1)
- [src/services/settings/products/ProductService.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/products/ProductService.ts:1)
- [src/services/settings/comp-guide/CompGuideRepository.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/comp-guide/CompGuideRepository.ts:1)
- [src/services/settings/comp-guide/CompGuideService.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/comp-guide/CompGuideService.ts:1)
- [src/services/settings/ConstantsRepository.ts](/Users/nickneessen/projects/commissionTracker/src/services/settings/ConstantsRepository.ts:1)

### UI / hooks

- [src/features/settings/carriers/CarriersManagement.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/carriers/CarriersManagement.tsx:32)
- [src/features/settings/carriers/components/CarrierForm.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/carriers/components/CarrierForm.tsx:56)
- [src/features/settings/carriers/hooks/useCarriers.ts](/Users/nickneessen/projects/commissionTracker/src/features/settings/carriers/hooks/useCarriers.ts:28)
- [src/features/settings/products/ProductsManagement.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/products/ProductsManagement.tsx:39)
- [src/features/settings/products/components/ProductForm.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/products/components/ProductForm.tsx:97)
- [src/features/settings/products/components/ProductBulkImport.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/products/components/ProductBulkImport.tsx:20)
- [src/features/settings/products/hooks/useProducts.ts](/Users/nickneessen/projects/commissionTracker/src/features/settings/products/hooks/useProducts.ts:7)
- [src/features/settings/commission-rates/CommissionRatesManagement.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/commission-rates/CommissionRatesManagement.tsx:54)
- [src/features/settings/commission-rates/hooks/useCommissionRates.ts](/Users/nickneessen/projects/commissionTracker/src/features/settings/commission-rates/hooks/useCommissionRates.ts:52)
- [src/features/settings/agency/AgencyManagement.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/agency/AgencyManagement.tsx:59)
- [src/features/settings/agency/components/AgencyForm.tsx](/Users/nickneessen/projects/commissionTracker/src/features/settings/agency/components/AgencyForm.tsx:34)
- [src/hooks/imo/useImoQueries.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/imo/useImoQueries.ts:75)

### Policy / downstream consumer fixes

- [src/hooks/products/useProducts.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/products/useProducts.ts:1)
- [src/hooks/comps/useCompGuide.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/comps/useCompGuide.ts:1)
- [src/hooks/commissions/useCommissionRate.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/commissions/useCommissionRate.ts:1)
- [src/hooks/reports/useReportFilterOptions.ts](/Users/nickneessen/projects/commissionTracker/src/hooks/reports/useReportFilterOptions.ts:1)
- [src/features/policies/hooks/usePolicyCommission.ts](/Users/nickneessen/projects/commissionTracker/src/features/policies/hooks/usePolicyCommission.ts:1)
- [src/services/underwriting/workflows/product-evaluation.ts](/Users/nickneessen/projects/commissionTracker/src/services/underwriting/workflows/product-evaluation.ts:1)

## What The Migration Does

The new migration does the heavy lifting:

- makes `imo_id` non-null on `carriers`, `products`, `comp_guide`, `constants`, and `product_commission_overrides`
- converts `constants` from global rows to per-IMO rows
- replaces global uniqueness with per-IMO uniqueness
- adds trigger-level cross-IMO consistency checks
- hardens RLS so normal users only access rows in their IMO, while super-admins retain broad access
- hardens related RPC/functions to reject arbitrary cross-IMO reads

## Important Architectural Decision

This work intentionally moved tenant scoping into a base repository layer instead of relying on every page/hook/service to remember `imo_id`.

That principle now is:

- RLS is the hard security boundary.
- Repository defaults should mirror RLS.
- Super-admin screens must pass an explicit tenant when operating on tenant-owned data.
- Settings UI should never rely on ambiguous "current IMO" behavior when the actor is a super-admin.

## Validation Already Completed

- `pnpm typecheck` passed after the latest changes.
- `pnpm vitest run src/services/settings/__tests__/compGuideService.test.ts` passed.
- The migration was applied locally and re-run to verify idempotence.

## Known Caveat

`src/types/database.types.ts` was manually patched because `npm run generate:types` could not complete due invalid Supabase auth/token state.

That means the next conversation should eventually regenerate types once auth is fixed, rather than treating the current generated types file as authoritative forever.

## Recommended First Steps In New Conversation

1. Inspect the actual `Aflac` row in `carriers` and confirm its `imo_id`.
2. Inspect the `Epic Life` IMO id.
3. Trace the selected IMO value flowing through:
   - `ProductsManagement`
   - `ProductForm`
   - `useCarriers`
   - `CarrierService.getAllForImo`
4. If the row is correct, add temporary logging or a targeted test around the product-form carrier list for super-admin tenant switching.
5. If the row is wrong, fix the stale selected-IMO bug in carrier creation first.

## Useful Commands For Continuation

```bash
pnpm typecheck
pnpm vitest run src/services/settings/__tests__/compGuideService.test.ts
git status --short
```

If database access is available in the next session, start by checking:

```sql
select id, name, imo_id from carriers where lower(name) = 'aflac';
select id, name from imos where lower(name) = 'epic life';
```

## Worktree Notes

There were unrelated pre-existing changes in the worktree that were not part of this tenant-isolation task:

- `docs/business/competitive-matrix.md`
- `docs/business/exec-pitch-deck.md`
- `src/components/layout/Sidebar.tsx`
- `supabase/functions/slack-list-channels/index.ts`
- `supabase/functions/slack-send-message/index.ts`

Do not revert those when continuing.
