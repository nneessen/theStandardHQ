<!-- plans/active/quick-quote-rate-import-continuation.md -->
# Continuation Prompt: Quick Quote Rate Import Fix

## Session Context
**Date:** 2026-01-11
**Issue:** Quick Quote showing same rates for $25K and $50K for term products - likely CPT interpolation issue when only one face amount exists in database.

## Work Completed This Session

### 1. Rate Import Dialog Fix (`RateImportDialog.tsx`)
Fixed the product matching to properly recognize different rating classes:

**Changes Made:**
- `extractProductName()` (lines 110-146): Now preserves rating classes (Preferred, Standard) instead of stripping them
  - Before: "Term Made Simple Preferred 10-Year" → "Term Made Simple"
  - After: "Term Made Simple Preferred 10-Year" → "Term Made Simple Preferred"

- `autoMapGroups()` (lines 290-377): Enhanced matching logic with normalization and smarter candidate selection

### 2. UW Wizard Architecture Document
Created comprehensive knowledge document at `docs/underwriting-wizard-architecture.md` with:
- Full architecture overview (hybrid AI + 4-stage rule engine)
- Production-grade code review with 14 findings
- Performance analysis and recommendations

## Next Steps for This Task

### 1. Debug Quick Quote CPT Calculation
The issue is likely in `quickQuoteCalculator.ts` or `premiumMatrixService.ts` interpolation logic. Check:
- `interpolatePremium()` function when `faceAmounts.length === 1`
- CPT calculation: `ratePerThousand = premiumAtKnownFace / (knownFaceAmount / 1000)`

### 2. Import Transamerica Rates with Multiple Face Amounts
User needs to import rates at multiple face amounts (not just CPT mode) to fix the interpolation issue.

**Script to use (paste in browser console at Insurance Toolkits):**

```javascript
// Transamerica Standard Rates - Multiple Face Amounts ($10K increments)
// Filters: Trendsetter LB 2017 + Trendsetter Super 2021, Standard tier only

const fetchTransamericaStandardRates = async () => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    console.error('No access token found. Make sure you are logged in.');
    return;
  }

  const CONFIG = {
    // Face amounts in $10K increments from $10K to $500K
    faceAmounts: [
      10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
      150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000
    ],
    state: 'IL',
    ages: Array.from({ length: 63 }, (_, i) => i + 18), // Ages 18-80
    genders: ['Male', 'Female'],
    tobaccos: ['None', 'Tobacco'],
    terms: ['10', '15', '20', '25', '30'],
    // FILTER: Only keep Transamerica Trendsetter products with Standard tier
    filterCarrier: 'Transamerica',
    filterProducts: ['Trendsetter LB 2017', 'Trendsetter Super 2021'],
    filterTier: 'Standard'
  };

  const allQuotes = [];
  let requestCount = 0;
  const startTime = Date.now();

  // Estimate: 18 faces × 63 ages × 2 genders × 2 tobaccos × 5 terms = 113,400 requests
  // With filtering, we fetch all but only keep matching quotes
  const totalEstimate = CONFIG.faceAmounts.length * CONFIG.ages.length *
                        CONFIG.genders.length * CONFIG.tobaccos.length * CONFIG.terms.length;

  console.log(`Starting: ~${totalEstimate.toLocaleString()} requests, filtering for Transamerica Standard only`);
  console.log(`Products: ${CONFIG.filterProducts.join(', ')}`);

  for (const sex of CONFIG.genders) {
    for (const tobacco of CONFIG.tobaccos) {
      for (const term of CONFIG.terms) {
        for (const faceAmount of CONFIG.faceAmounts) {
          for (const age of CONFIG.ages) {
            requestCount++;

            try {
              const res = await fetch('https://api.insurancetoolkits.com/quoter/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  faceAmount,
                  sex,
                  term,
                  state: CONFIG.state,
                  age,
                  tobacco,
                  paymentType: 'Bank Draft/EFT',
                  underwritingItems: [],
                  toolkit: 'TERM'
                })
              });

              const data = await res.json();

              if (data.quotes) {
                for (const q of data.quotes) {
                  // FILTER: Only keep Transamerica Trendsetter Standard
                  const isTransamerica = q.company.includes(CONFIG.filterCarrier);
                  const isMatchingProduct = CONFIG.filterProducts.some(p => q.company.includes(p));
                  const isStandard = q.tier_name === CONFIG.filterTier ||
                                     q.plan_name.toLowerCase().includes('standard');

                  if (isTransamerica && isMatchingProduct && isStandard) {
                    allQuotes.push({
                      face_amount: faceAmount,
                      company: q.company,
                      plan_name: q.plan_name,
                      tier_name: q.tier_name,
                      monthly: q.monthly,
                      yearly: q.yearly,
                      state: CONFIG.state,
                      gender: sex,
                      age: age,
                      term_years: term,
                      tobacco: tobacco
                    });
                  }
                }
              }

              // Progress every 500 requests
              if (requestCount % 500 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
                const pct = Math.round(requestCount / totalEstimate * 100);
                console.log(`Progress: ${requestCount.toLocaleString()}/${totalEstimate.toLocaleString()} (${pct}%) - ${allQuotes.length} matched - ${elapsed} min`);
              }

              // Rate limiting: 30ms between requests
              await new Promise(r => setTimeout(r, 30));

            } catch (e) {
              console.error(`Error at ${sex}/${tobacco}/${term}yr/$${faceAmount}/age${age}:`, e.message);
              // Wait longer on error
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        // Status after each term
        console.log(`Completed: ${sex} ${tobacco} ${term}yr - ${allQuotes.length} total matches`);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone! ${allQuotes.length} Transamerica Standard rates in ${totalTime} minutes`);
  window.fetchedRates = allQuotes;

  // Generate CSV
  if (allQuotes.length > 0) {
    const headers = Object.keys(allQuotes[0]);
    const csvContent = [
      headers.join(','),
      ...allQuotes.map(row =>
        headers.map(h => {
          const val = String(row[h] ?? '');
          return val.includes(',') ? `"${val}"` : val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transamerica_standard_${CONFIG.state}_multi_face.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('CSV downloaded: ' + a.download);
  }

  return allQuotes;
};

fetchTransamericaStandardRates();
```

### 3. Investigate Interpolation Bug
After importing rates with multiple face amounts, if the issue persists, debug:
- File: `src/services/underwriting/premiumMatrixService.ts`
- Function: `interpolatePremium()` (lines 580-729)
- Specifically check the CPT calculation branch (lines 627-661)

---

## Files Modified This Session
1. `src/features/underwriting/components/RateEntry/RateImportDialog.tsx` - Fixed rating class preservation
2. `docs/underwriting-wizard-architecture.md` - Created architecture doc

## Files to Review Next Session
1. `src/services/underwriting/quickQuoteCalculator.ts` - Quick quote logic
2. `src/services/underwriting/premiumMatrixService.ts` - Interpolation logic
3. `src/features/underwriting/components/QuickQuote/` - Quick quote UI components

---

## Resume Command
```
Continue from plans/active/quick-quote-rate-import-continuation.md - the rate import dialog fix is complete. Next: help user run the Transamerica rate fetch script, then investigate if the $25K/$50K same-rate bug is an interpolation issue in quickQuoteCalculator.ts or premiumMatrixService.ts.
```
