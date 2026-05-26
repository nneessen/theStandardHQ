# Commissions & Overrides — Architecture & Financial-Accuracy Reference

> Synthesized knowledge doc for the commission + override subsystem: the money-flow,
> where each calculation lives, the seam where a future carrier API plugs in, and the
> verified financial-accuracy gaps that need hardening. Written 2026-05-26.

## 1. Why this doc exists

`commissionTracker` is named for this subsystem, yet it had no synthesized wiki page —
financial logic was documented only incidentally inside `data-layer-rpc-migration`. This
is the most business-critical money path in the platform (advances, earned/unearned
splits, chargebacks, persistency, upline override rollups), so it earns its own reference.

Two goals frame the doc:

1. **Harden financial accuracy now** — with the data we already have.
2. **Prepare a clean ingestion seam** so that when real carrier APIs become available,
   accurate policy/payment data lands in one well-defined place instead of being faked.

## 2. The core business model (one formula)

The entire system is built on the advance/earn-down model:

```
Advance        = Monthly Premium × Advance Months × Commission Rate   (default 9 months)
Monthly Earn   = Advance / Advance Months
Earned         = Monthly Earn × Months Paid        (capped at Advance Months)
Unearned       = Advance − Earned
Chargeback     = Unearned                          (when policy lapses early)
Persistency    = % of a cohort still active at the 3/6/9/12-month milestones
```

- Commission **rates are stored as decimals** in `comp_guide` (`0.95` = 95%, `1.025` = 102.5%).
  Do **not** divide by 100. Rates can exceed 100%.
- **Carrier advance caps**: some carriers cap the upfront advance (e.g. Mutual of Omaha
  ~$3,000). When the calculated advance exceeds the cap, the agent gets the capped amount
  upfront and the **overage** is paid "as earned" after the cap is recouped
  (`recoupmentMonths = ceil(cap / monthlyEarn)`, `overageStartMonth = recoupment + 1`).
- **Term modifiers**: `term_life` products can carry per-term-length rate modifiers stored
  in `products.metadata.termCommissionModifiers` (e.g. a 10-year term reduces the rate).

## 3. Where each piece lives

### Service layer (`src/services/commissions/`, `src/services/overrides/`)

| File | Responsibility |
|------|----------------|
| `CommissionLifecycleService.ts` | **Pure math.** `calculateAdvance`, `calculateCappedAdvance`, `calculateEarned`/`calculateUnearned`, `calculateChargeback`, `calculateMonthsPaid`, `calculatePersistencyMetrics`, `getChargebackRisk`. No DB access — this is the unit-tested core. |
| `CommissionCalculationService.ts` | Orchestrates a calculation: resolves carrier → contract comp level → `comp_guide` rate → term modifier → capped advance. `createWithAutoCalculation`, `recalculateCommission`, `recalculateCommissionByPolicyId`. **Hard-fails (no fallback rate) if no `comp_guide` entry exists** — intentional, to avoid silently writing a wrong number. |
| `commissionRateService.ts` | Looks up `comp_guide` rates by carrier × product × contract level. |
| `CommissionStatusService.ts` | Status transitions, `months_paid` updates, chargeback processing/reversal, summaries. |
| `CommissionLifecycleService` (status portion) + `CommissionCRUDService.ts` / `CommissionRepository.ts` | CRUD + DB row ↔ entity mapping. |
| `chargebackService.ts` | CRUD for the **`chargebacks` table** (parallel to the `commissions.chargeback_*` columns — see gap C). Emits `COMMISSION_CHARGEBACK` workflow event on create. |
| `termModifierUtils.ts` | `getTermModifier` / `applyTermModifier` — `rate × (1 + modifier)`. |
| `overrides/overrideService.ts` | **Read/display + trigger only.** Fetches overrides for the current upline, summaries, per-policy chains, status updates, and `recalculateOverridesForPolicy`. |
| `overrides/OverrideRepository.ts` | Override row queries + mapping. |

### Calculation boundary: TS vs SQL

- **Base commission math = TypeScript** (`CommissionLifecycleService`) → covered by Vitest.
- **Override rollup math = Postgres RPC** `regenerate_override_commissions(p_policy_id)`.
  The TS layer never computes override amounts; it deletes existing rows and calls the RPC
  to walk the hierarchy and recreate them. **Consequence: the override money math is not
  covered by the TS test suite** and lives in SQL that must be read in `supabase/migrations/`.

### Data model (key tables, all money columns `NUMERIC(12,2)`)

- **`commissions`** — `amount` (the advance), `earned_amount`, `unearned_amount`,
  `chargeback_amount`, `advance_months` (default 9), `months_paid`, `original_advance` /
  `overage_amount` / `overage_start_month` (cap fields, null unless capped), `status`,
  `type`, `policy_id` (nullable), `user_id`, `imo_id`.
- **`override_commissions`** — `base_agent_id`, `override_agent_id`, `base_commission_amount`,
  `override_commission_amount`, `base_comp_level`, `override_comp_level`, `hierarchy_depth`,
  `policy_premium` (snapshot), plus the same earned/unearned/chargeback/status fields.
- **`chargebacks`** — `commission_id`, `chargeback_amount`, `chargeback_date`, `status`,
  `reason`, `resolution_*`.
- Enums: `commission_status` = `pending | unpaid | paid | reversed | disputed | clawback | charged_back`;
  `chargeback_status` = `pending | resolved | disputed`; `comp_level` = `street | release | enhanced | premium`.
- Views: `override_commission_summary` (per-upline rollup, read by `getMyOverrideSummary`).

### Consumers (read commission/override data)

`analytics` (attribution, breakeven, forecast, cohort), `reports` (aging, chargeback
summaries), `targets`/`kpi` (YTD actual vs goal), `leaderboard` (rank by earned),
`hierarchy` (override propagation). `policyService` is the **producer** — creating/updating
a policy triggers `createWithAutoCalculation` / `recalculateCommissionByPolicyId`.

## 4. The carrier-API ingestion seam (future)

Today, policy and payment data is **entered manually** and commissions are auto-calculated
from `comp_guide`. The single biggest accuracy compromise is **persistency**:

> `CommissionLifecycleService.calculateMonthsPaid()` assumes `months_paid = months elapsed
> since effective_date`. Its own comment says: *"In production, this should come from actual
> payment records."* We currently assume every client kept paying every month.

A carrier API changes this from *assumed* to *known*. The clean seam:

1. **Edge function** `supabase/functions/carrier-webhook-*` (new) — receives per-carrier
   payloads, verifies signature, scoped per `imo_id`.
2. **Normalization adapter** `src/services/carriers/<carrier>-adapter.ts` (new) — maps each
   carrier's field names/product codes → our schema. *(This is the part that must be
   deferred until we have real carrier payload specs — it is carrier-format-specific.)*
3. **Canonical write path** — reuse existing `commissionService` /
   `recalculateCommissionByPolicyId`; the carrier's **actual paid-through date** feeds
   `months_paid` instead of the elapsed-time assumption.
4. **Idempotency** — unique `(carrier_id, external_policy_id)` key; webhook checks before
   re-processing.

The adapter pattern mirrors the existing `document-extraction` gateway (gateway → per-source
adapters → canonical result) — a proven seam in this codebase.

## 5. Verified financial-accuracy gaps (hardening targets)

Each item below was confirmed by reading the code against the schema, not inferred.

**A. No currency rounding in the math layer (highest correctness risk).**
`advanceAmount = monthlyPremium * advanceMonths * commissionRate` and
`earnedAmount = (advance / advanceMonths) * monthsPaid` are raw IEEE-754 floats
(`CommissionLifecycleService.ts:218-219, 373-375`). Rounding happens only when Postgres
coerces to `NUMERIC(12,2)`. Because `amount`, `earned_amount`, and `unearned_amount` are
each rounded independently on write, **`earned + unearned` can fail to reconcile to the
stored `amount` by a cent**, and intermediate JS sums (analytics/leaderboard) accumulate
drift. `lib/format.ts` only rounds for *display* — there is no storage-side `roundCurrency`.
*Fix (✓ DONE 2026-05-26):* `src/lib/currency.ts` `roundCurrency(n)` (half away from zero)
applied to final money outputs in `CommissionLifecycleService` + `src/utils/commissionProgress.ts`;
unearned derived from the rounded earned. SQL/override side needs no change — `numeric(12,2)`
columns + `DECIMAL(12,2)` RPC variables already round on assignment (verified: a
`numeric(12,2)` assign of `333.33*1.025*9` yields `3074.97`); the JS-float drift cannot occur there.

**B. Persistency is assumed, not measured.** `calculateMonthsPaid` (lines 520-536) returns
elapsed months, not paid months. Until the carrier seam (§4) exists, this overstates earned
and understates chargeback risk for any policy that lapsed silently. *Fix:* short-term, drive
`months_paid` only from explicit payment/status events; long-term, the carrier API.

**C. Two sources of truth for chargebacks.** Both the `chargebacks` table and
`commissions.chargeback_amount`/`chargeback_date` exist; nothing keeps them consistent.
*Fix:* pick the authoritative store (recommend the `chargebacks` table as the ledger,
`commissions.*` as a denormalized cache kept in sync in one transaction).

**D. Status-bucketing bugs (one real, one cosmetic).**
- **D1 — real $0 bug (fixed 2026-05-26):** `overrideService.getOverridesByDownline`
  bucketed on `status === "earned"`, but an override's status is only ever `pending` → `paid`
  — there is no `"earned"` status — so `earned_override` always summed to **$0**.
  `earned_override` is the earned *portion*, so it now sums the `earned_amount` column
  (null-coalesced to 0) independent of status.
- **D2 — dead-but-harmless literal (cleaned up 2026-05-26):**
  `chargebackService.getChargebackMetrics` had a `status === "processed"` check, but the enum
  is `pending | resolved | disputed`. The branch was `"processed" || "resolved"`, so
  `"resolved"` still matched and `processedAmount` was already correct — the `"processed"`
  literal was simply unreachable. Removed for type-safety. `disputed` stays bucketed with
  `pending` as "outstanding," which is the intended semantics.

**E. Destructive override regeneration.** `recalculateOverridesForPolicy` (lines 330-368)
`DELETE`s all override rows for a policy then calls the RPC to recreate them — wiping
`status` (`paid`), `payment_date`, and `months_paid` on any override that had already been
paid out. *Fix:* upsert/preserve payment state across regeneration, or block regeneration
once any override in the chain is `paid`.

**F. Divide-by-zero / NaN exposure.** `calculateEarned` (line 373) divides by `advanceMonths`
with no guard; only `calculateAdvance` validates the 1–12 range. A record with
`advance_months = 0` yields `Infinity`/`NaN` that propagates into stored money and rollups.
*Fix (✓ DONE 2026-05-26):* `calculateEarned` throws when `advanceMonths <= 0`.

**G. Timezone drift in month math.** `calculateMonthsElapsed` (lines 499-507) uses local
`getFullYear()/getMonth()` on `Date` objects; a date-only ISO string (`"2024-01-31"`) parses
as UTC midnight and reads back a month early for users west of UTC, shifting milestone and
months-paid boundaries. *Fix (✓ DONE 2026-05-26):* uses `getUTCFullYear()/getUTCMonth()`.

**H. Override calculation basis ≠ base advance basis (latent; 0 rows today).** The
`regenerate_override_commissions` RPC sizes the override on **annual** premium:
`override = annual_premium × (upline_rate − base_rate)`. But the base commission advance — the
canonical model everywhere else — uses a **9-month advance** basis: `monthly × advanceMonths × rate`.
Since `annual = monthly × 12` (verified, 0 exceptions), the override is overstated by **12/9 ≈ 33.3%**
relative to the advance basis. Worked example ($500/mo, base 95%, upline 102.5%): RPC override =
`6000 × 0.075 = $450.00`; advance-consistent override = `500 × 9 × 0.075 = $337.50`. Two internal
incoherences confirm this is unintended rather than an "overrides paid on annual production" rule:
(1) the 12-month-sized amount is stored with `advance_months = 9` and earned over 9 months; (2) the
override row's snapshot `base_commission_amount = annual × base_rate = $5,700` does not match the
policy's actual base commission advance of `$4,275`. **No authoritative spec exists** — the FFG
Comp Guide PDF is rate tables only (no mention of override/advance/annual treatment), and no
doc/migration defines the basis. *Fix (✓ DONE 2026-05-26, migration `20260526092932`):* Nick confirmed
overrides are paid **off the advance**, so `regenerate_override_commissions` now computes
`override = ROUND(monthly_premium × advance_months × (upline_rate − base_rate), 2)` using the base
commission's own `advance_months` (no longer hardcoded 9), and stores `base_commission_amount` on the
same advance basis. Verified on local via a rolled-back synthetic run (override `225.00` vs the old
annual `300.00`; `base 855.00`; `advance_months 9`). Applied to local + remote. No rows existed, so no
backfill was needed; generating overrides for existing policies remains a separate explicit action.

## 6. Test-coverage note

`commissionRateService.test.ts` and `overrideService.test.ts` exist; the pure-math
`CommissionLifecycleService` is the natural home for exhaustive financial unit tests
(rounding reconciliation, cap/overage, full-earn boundary, zero-month edge). The **override
rollup RPC has no TS-side test** — any hardening there needs a SQL-level or integration test.

## 7. Related

- `data-layer-rpc-migration` (wiki) — where commission RPCs were previously documented.
- `hierarchy-architecture` (wiki) — the upline tree the override rollup walks.
- `CLAUDE.md` edge-case mandate: null DB values, commission contract changes mid-year,
  negative balances/chargebacks, persistency over time ranges.
