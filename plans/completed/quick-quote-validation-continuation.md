# Quick Quote Age/Face Validation - Implementation Continuation

## Previous Session Summary

Fixed the Supabase 1000 row limit issue in Quick Quote. Now need to add age and face amount validation.

### Completed
- ✅ Created RPC function `get_premium_matrices_for_imo()` with composite index
- ✅ Implemented parallel pagination to fetch all 4,364 rows
- ✅ All 6 term products now display (was showing only 2)
- ✅ Fetch time: 384ms

### Migration Applied
- `supabase/migrations/20260111_001_quick_quote_rpc.sql`

---

## THE PROBLEM NOW

Quick Quote doesn't validate age or face amounts against product constraints:

1. **Shows invalid term lengths for age** - e.g., 30-year term for a 70-year-old (impossible - 30yr max age is typically 50-55)
2. **Quotes face amounts outside valid ranges** - Interpolates beyond data bounds
3. **Product metadata is fetched but ignored** - `min_age`, `max_age`, `min_face_amount`, `max_face_amount` exist in RPC response but aren't used

## Data Analysis

Premium matrix data shows age limits **vary by term length**:

| Product | 10yr | 15yr | 20yr | 25yr | 30yr |
|---------|------|------|------|------|------|
| Your Term | 18-80 | 18-70 | 18-65 | 18-60 | 18-55 |
| Strong Foundation | 18-80 | 18-70 | 18-65 | 18-55 | 18-50 |
| Term Life Express | 18-75 | 18-70 | 18-60 | - | 18-50 |
| Signature Term | 18-64 | 18-64 | 18-60 | - | 18-50 |
| Term Made Simple | 18-75 | 18-70 | 18-65 | - | 18-55 |
| Simple Term | - | - | 20-60 | - | 20-50 |

Product metadata in DB has placeholder values (0-120 age, null face). Real constraints are in premium_matrix data.

---

## IMPLEMENTATION PLAN

### Step 1: Add Constraint Types

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Add after line ~50 (after existing types):

```typescript
interface ProductConstraints {
  minAge: number;
  maxAge: number;
  minFaceAmount: number;
  maxFaceAmount: number;
}

interface TermAgeConstraint {
  minAge: number;
  maxAge: number;
}

interface ProductWithConstraints {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: QuickQuoteProductType;
  constraints: ProductConstraints;
  termConstraints?: Map<TermYears, TermAgeConstraint>;
}
```

### Step 2: Add Constraint Derivation Functions

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Add after `groupMatricesByProduct` function (~line 319):

```typescript
/**
 * Derive product constraints from matrix data
 * Uses actual data ranges, falls back to product metadata if valid
 */
function deriveProductConstraints(
  productMatrix: PremiumMatrixWithCarrier[],
): ProductConstraints {
  const product = productMatrix[0]?.product;

  const ages = productMatrix.map(m => m.age);
  const faceAmounts = productMatrix.map(m => m.face_amount);

  const matrixMinAge = Math.min(...ages);
  const matrixMaxAge = Math.max(...ages);
  const matrixMinFace = Math.min(...faceAmounts);
  const matrixMaxFace = Math.max(...faceAmounts);

  return {
    minAge: (product?.min_age && product.min_age > 0) ? product.min_age : matrixMinAge,
    maxAge: (product?.max_age && product.max_age < 120) ? product.max_age : matrixMaxAge,
    minFaceAmount: product?.min_face_amount ?? matrixMinFace,
    maxFaceAmount: product?.max_face_amount ?? matrixMaxFace,
  };
}

/**
 * For term products, derive age constraints per term length
 */
function deriveTermConstraints(
  productMatrix: PremiumMatrixWithCarrier[],
): Map<TermYears, TermAgeConstraint> {
  const constraints = new Map<TermYears, TermAgeConstraint>();

  const termYears = [...new Set(
    productMatrix
      .filter(m => m.term_years !== null)
      .map(m => m.term_years as TermYears)
  )];

  for (const term of termYears) {
    const termData = productMatrix.filter(m => m.term_years === term);
    const ages = termData.map(m => m.age);
    constraints.set(term, {
      minAge: Math.min(...ages),
      maxAge: Math.max(...ages),
    });
  }

  return constraints;
}
```

### Step 3: Update `getMatchingProducts` Function

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Replace entire `getMatchingProducts` function (~lines 324-369):

```typescript
/**
 * Get unique products matching the selected product types
 * Filters out products where user's age is outside valid range
 */
function getMatchingProducts(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
  userAge: number,
  selectedTermYears?: TermYears,
): ProductWithConstraints[] {
  const groupedMatrices = groupMatricesByProduct(matrices);
  const seen = new Set<string>();
  const products: ProductWithConstraints[] = [];

  for (const m of matrices) {
    if (!m.product) continue;

    const productType = m.product.product_type as QuickQuoteProductType;
    if (!productTypes.includes(productType)) continue;
    if (seen.has(m.product_id)) continue;
    seen.add(m.product_id);

    const productMatrix = groupedMatrices.get(m.product_id) || [];
    if (productMatrix.length === 0) continue;

    const constraints = deriveProductConstraints(productMatrix);

    // Skip if user age is outside product's overall age range
    if (userAge < constraints.minAge || userAge > constraints.maxAge) {
      continue;
    }

    const isTermProduct = productType === "term_life";
    let termConstraints: Map<TermYears, TermAgeConstraint> | undefined;

    if (isTermProduct) {
      termConstraints = deriveTermConstraints(productMatrix);

      // If specific term selected, check if user age is valid for that term
      if (selectedTermYears) {
        const termAgeConstraint = termConstraints.get(selectedTermYears);
        if (!termAgeConstraint ||
            userAge < termAgeConstraint.minAge ||
            userAge > termAgeConstraint.maxAge) {
          continue;
        }
      } else {
        // No specific term - check if ANY term is valid for this age
        const hasValidTerm = [...termConstraints.values()].some(
          c => userAge >= c.minAge && userAge <= c.maxAge
        );
        if (!hasValidTerm) continue;
      }
    }

    products.push({
      productId: m.product_id,
      productName: m.product.name,
      carrierId: m.product.carrier_id,
      carrierName: m.product.carrier?.name || "Unknown",
      productType,
      constraints,
      termConstraints,
    });
  }

  products.sort((a, b) => {
    const carrierCompare = a.carrierName.localeCompare(b.carrierName);
    if (carrierCompare !== 0) return carrierCompare;
    return a.productName.localeCompare(b.productName);
  });

  return products;
}
```

### Step 4: Update `calculateQuotesForCoverage` Function

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Replace the function (~lines 389-463). Key changes:
- Pass `userAge` and `selectedTermYears` to `getMatchingProducts`
- Filter term years by age constraints
- Use product constraints for validation

### Step 5: Update `calculateQuotesForBudget` Function

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Same changes as coverage function (~lines 470-551).

### Step 6: Add New Export Function

**File:** `src/services/underwriting/quickQuoteCalculator.ts`

Add at end of file:

```typescript
/**
 * Get available term years for a given age
 * Used by UI to show only valid term options
 */
export function getAvailableTermYearsForAge(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
  age: number,
): TermYears[] {
  const termYearsSet = new Set<TermYears>();
  const groupedMatrices = groupMatricesByProduct(matrices);

  for (const m of matrices) {
    if (!m.product) continue;
    if (!productTypes.includes(m.product.product_type as QuickQuoteProductType)) continue;
    if (m.product.product_type !== "term_life") continue;

    const productMatrix = groupedMatrices.get(m.product_id) || [];
    const termConstraints = deriveTermConstraints(productMatrix);

    for (const [term, constraint] of termConstraints.entries()) {
      if (age >= constraint.minAge && age <= constraint.maxAge) {
        termYearsSet.add(term);
      }
    }
  }

  return [...termYearsSet].sort((a, b) => a - b);
}
```

### Step 7: Update QuickQuotePage UI

**File:** `src/features/underwriting/components/QuickQuote/QuickQuotePage.tsx`

1. Import `getAvailableTermYearsForAge`
2. Replace term years calculation to filter by age
3. Add effect to auto-select valid term when age changes

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/underwriting/quickQuoteCalculator.ts` | Pure calculation functions - ADD filtering |
| `src/features/underwriting/components/QuickQuote/QuickQuotePage.tsx` | UI - UPDATE term selector |
| `src/services/underwriting/premiumMatrixService.ts` | Data fetch - NO CHANGES needed |

## Testing Verification

After implementation, verify:

1. **70 year old, Term Life selected** → Only 10yr term option shown
2. **50 year old, 30yr term** → All 6 products display
3. **55 year old, 30yr term** → Only products with 30yr max age >= 55 (excludes Signature Term, Strong Foundation)
4. **Change age slider** → Term dropdown updates to show only valid options
5. **Invalid term auto-corrects** → If age change makes current term invalid, auto-select first valid term

## Command to Start

```
Read plans/active/quick-quote-validation-continuation.md first, then implement the age and face amount validation for Quick Quote. Start with quickQuoteCalculator.ts.
```
