# CRITICAL: Underwriting Criteria Extraction Redesign

## Problem Statement

The current extraction feature only captures a **fraction** of the underwriting data in carrier guides. Example from Transamerica guides:

### What's Being Missed

1. **Medical Condition Decision Chart**
   - Guides have full decision matrices showing: Select (immediate) / Graded (rated) / Decline
   - Current schema only has `knockoutConditions` (decline only)
   - Missing: ALL conditions with their decision outcome

2. **Complete Medication List**
   - Transamerica has 100+ declinable medications:
   ```
   Abacavir, Acamprosate, Adlarity, Adrucil, Alimta, Antabuse, Aricept,
   Atazanavir, Atripla, Azathioprine, Belbuca, Bicalutamide, Biktarvy...
   (and ~90 more)
   ```
   - Current schema only has 5 categories: insulin, bloodThinners, opioids, bpMedications, antidepressants

3. **Full Build Chart**
   - Guides have complete height/weight matrices with ratings per class
   - Current schema only has BMI thresholds

4. **The Prompt Doesn't Ask for COMPLETE Data**
   - Says "extract knockout conditions" but not "extract ALL knockout conditions"
   - No instruction to capture complete lists

5. **Additional Missing Fields** (from review)
   - Waiting periods / graded benefit schedules
   - Aviation/hazardous occupation rules
   - Foreign travel rules
   - Payment mode options

---

## Architecture Analysis

### Current Critical Failures

| ID | Issue | Impact | Business Risk |
|----|-------|--------|---------------|
| F1 | Schema captures 5 med categories vs 100+ actual | Silent data loss (~10% captured) | E&O exposure |
| F2 | Only knockout conditions, no SELECT/GRADED/REFER | Cannot differentiate coverage types | Wrong policy recommendations |
| F3 | BMI thresholds only, no height/weight matrix | Build chart mismatch | Incorrect eligibility |
| F4 | Type duplication (3 places) | Schema drift risk | Maintenance burden |

### Current Architecture Issues

| ID | Issue | Impact |
|----|-------|--------|
| A1 | Single-pass extraction, character chunking | Context loss for multi-page tables |
| A2 | First-wins merge strategy | Later chunks with better data ignored |
| A3 | No domain separation | 770-line monolith function |
| D2 | Tables split across pages | Height/weight extraction errors |
| D3 | Multi-column layouts | Garbled input from interleaved columns |

---

## Proposed New Schema

```typescript
// src/features/underwriting/types/underwriting.types.ts
// SINGLE SOURCE OF TRUTH - consolidate all definitions here

export interface ExtractedCriteria {
  // ==================== BASIC INFO ====================
  ageLimits?: {
    minIssueAge: number;
    maxIssueAge: number;
  };

  faceAmountLimits?: {
    minimum: number;
    maximum: number;
    ageTiers?: Array<{
      minAge: number;
      maxAge: number;
      maxFaceAmount: number;
    }>;
  };

  // ==================== CONDITIONS ====================
  // NEW: Complete condition decision matrix (replaces knockoutConditions)
  conditionDecisions?: {
    select: Array<ConditionRule>;   // Immediate coverage
    graded: Array<ConditionRule>;   // Rated/modified
    decline: Array<ConditionRule>;  // Knockout
    refer: Array<ConditionRule>;    // Manual review
  };

  // ==================== MEDICATIONS ====================
  // NEW: Complete medication lists (replaces medicationRestrictions)
  medications?: {
    declinable: Array<MedicationRule>;  // ALL medications that result in decline
    ratable: Array<MedicationRule>;     // Medications that result in rating
    acceptable: Array<MedicationRule>;  // Medications allowed without impact
  };

  // ==================== BUILD CHART ====================
  // NEW: Full build chart (replaces buildRequirements)
  buildChart?: {
    type: "height_weight" | "bmi";
    heightWeightMatrix?: Array<BuildRule>;
    bmiThresholds?: {
      selectMax: number;
      gradedMax: number;
      declineAbove: number;
    };
  };

  // ==================== TOBACCO ====================
  tobaccoRules?: {
    smokingClassifications: Array<{
      classification: string;
      requiresCleanMonths: number;
      ratingClass?: string;
    }>;
    nicotineTestRequired: boolean;
    marijuanaPolicy?: string;
  };

  // ==================== STATE AVAILABILITY ====================
  stateAvailability?: {
    availableStates: string[];
    unavailableStates: string[];
  };

  // ==================== WAITING PERIODS ====================
  waitingPeriods?: {
    naturalDeathMonths?: number;
    accidentalDeathMonths?: number;
    gradedBenefitSchedule?: Array<{ year: number; percentage: number }>;
  };

  // ==================== HAZARDOUS ACTIVITIES ====================
  // NEW: From review - commonly missed
  hazardousActivities?: {
    aviation?: { status: "decline" | "rate" | "acceptable"; notes?: string };
    scubaDiving?: { status: "decline" | "rate" | "acceptable"; notes?: string };
    racing?: { status: "decline" | "rate" | "acceptable"; notes?: string };
    otherActivities?: Array<{ activity: string; status: string; notes?: string }>;
  };

  // ==================== FOREIGN TRAVEL ====================
  // NEW: From review - commonly missed
  foreignTravel?: {
    excludedCountries?: string[];
    maxDaysPerYear?: number;
    notes?: string;
  };

  // ==================== PAYMENT OPTIONS ====================
  // NEW: From review - commonly missed
  paymentModes?: {
    available: Array<"monthly" | "quarterly" | "semi-annual" | "annual">;
    modalFactors?: Record<string, number>;
  };

  // ==================== METADATA ====================
  // NEW: Per-field confidence tracking
  fieldConfidence?: Record<string, number>;

  // Raw source data for manual review
  rawTables?: Array<RawTable>;
}

// ==================== SUPPORTING INTERFACES ====================

export interface ConditionRule {
  condition: string;
  decision: "select" | "graded" | "decline" | "refer";
  qualifiers?: string;  // e.g., "if controlled", "within 5 years"
  notes?: string;
  confidence: number;
  sourcePageRange?: [number, number];
}

export interface MedicationRule {
  rawName: string;                    // Exactly as extracted
  normalizedName?: string;            // After validation against DB
  decision: "decline" | "rate" | "acceptable" | "refer";
  notes?: string;
  sourceTableId?: string;
  sourcePageRange: [number, number];
  confidence: number;
}

export interface BuildRule {
  heightInches: number;
  minWeight?: number;
  maxWeightSelect?: number;
  maxWeightGraded?: number;
  maxWeightDecline?: number;
  sourceTableId?: string;
  confidence: number;
}

export interface RawTable {
  tableId: string;
  type: "medication" | "build" | "conditions" | "waiting_periods" | "unknown";
  rows: string[][];
  headerRows: number;
  pageRange: [number, number];
  confidence: number;
}

// ==================== INTERNAL PROCESSING INTERFACES ====================

export interface IngestedDocument {
  documentId: string;
  pages: Array<{
    pageNumber: number;
    textBlocks: string[];
    detectedTables: RawTable[];
    ocrDetected: boolean;
  }>;
  metadata: {
    totalPages: number;
    hasOcrContent: boolean;
    hasMultiColumnLayout: boolean;
  };
}

export interface ExtractionPass {
  passId: string;
  passType: "basic_info" | "conditions" | "medications" | "build_chart" | "tobacco" | "waiting_periods" | "hazardous";
  status: "pending" | "processing" | "completed" | "failed";
  confidence: number;
  tokensUsed: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  normalizedData?: Partial<ExtractedCriteria>;
}

export interface MergeConflict {
  field: string;
  passResults: Array<{ passId: string; value: unknown; confidence: number }>;
  resolution: "highest_confidence" | "manual_review" | "merged";
  resolvedValue?: unknown;
}
```

---

## Implementation Strategy

### Phase 1: Type Consolidation & Schema Migration

**Goal**: Single source of truth for ExtractedCriteria

1. Update `src/features/underwriting/types/underwriting.types.ts` with new schema
2. Remove duplicate definitions from:
   - `supabase/functions/extract-underwriting-criteria/index.ts`
   - `supabase/functions/underwriting-ai-analyze/criteria-evaluator.ts`
3. Create shared type import for edge functions (via build step or copy)
4. Database migration: JSONB is flexible, no DB changes needed

### Phase 2: Table Detection Pre-Processing

**Goal**: Identify and structure tables BEFORE sending to Claude

```typescript
// New: supabase/functions/parse-underwriting-guide/tableDetector.ts

interface TableDetectionResult {
  tables: RawTable[];
  nonTableText: string;
  confidence: number;
}

function detectTables(pages: ParsedSection[]): TableDetectionResult {
  // 1. Look for column-aligned text patterns
  // 2. Identify header rows (bold, caps, or positional)
  // 3. Group related rows into tables
  // 4. Classify table type based on headers
  // Return structured tables + remaining text
}
```

**Why**: Claude extracts tables more accurately when given structured input vs linear text.

### Phase 3: Multi-Pass Extraction

Replace single-pass character chunking with domain-specific passes:

| Pass | Domain | Input | Expected Output |
|------|--------|-------|-----------------|
| 1 | Basic Info | Full text (truncated) | ageLimits, faceAmountLimits, stateAvailability |
| 2 | Conditions | Condition tables + surrounding text | conditionDecisions |
| 3 | Medications | Medication tables + surrounding text | medications |
| 4 | Build Chart | Build/weight tables | buildChart |
| 5 | Tobacco | Tobacco section text | tobaccoRules |
| 6 | Extras | Remaining sections | waitingPeriods, hazardousActivities, foreignTravel |

```typescript
// Multi-pass orchestration
async function extractCriteriaMultiPass(
  document: IngestedDocument,
  anthropic: Anthropic
): Promise<{ criteria: ExtractedCriteria; passes: ExtractionPass[] }> {
  const passes: ExtractionPass[] = [];
  const results: Partial<ExtractedCriteria>[] = [];

  // Run each pass with focused prompt
  for (const passConfig of EXTRACTION_PASSES) {
    const passInput = preparePassInput(document, passConfig);
    const result = await runExtractionPass(anthropic, passInput, passConfig);

    passes.push({
      passId: passConfig.id,
      passType: passConfig.type,
      status: result.success ? "completed" : "failed",
      confidence: result.confidence,
      tokensUsed: result.tokensUsed,
      error: result.error,
    });

    if (result.success) {
      results.push(result.criteria);
    }
  }

  // Merge with conflict resolution
  const merged = mergeExtractionResults(results);

  return { criteria: merged.criteria, passes };
}
```

### Phase 4: Updated Prompts

**Medication Extraction Prompt**:
```typescript
const MEDICATION_EXTRACTION_PROMPT = `
You are extracting medication information from an insurance underwriting guide.

CRITICAL INSTRUCTIONS:
- Extract EVERY medication listed, not categories or examples
- If a table exists, extract ALL rows verbatim
- Preserve exact spelling as written in document
- Return [] (empty array) if no medications found - do NOT infer or guess
- Do NOT add medications not explicitly listed

INPUT FORMAT:
The input may include pre-detected tables in structured format.

OUTPUT FORMAT:
{
  "medications": {
    "declinable": [
      { "rawName": "Abacavir", "sourcePageRange": [15, 15], "confidence": 0.95 },
      ...
    ],
    "ratable": [...],
    "acceptable": [...]
  }
}

DOCUMENT CONTENT:
{{content}}
`;
```

**Condition Extraction Prompt**:
```typescript
const CONDITION_EXTRACTION_PROMPT = `
Extract the complete medical condition decision matrix from this underwriting guide.

COVERAGE TYPES TO IDENTIFY:
- SELECT: Immediate coverage, no modifications
- GRADED: Modified benefit (waiting period, reduced payout)
- DECLINE: Not eligible for coverage
- REFER: Requires manual underwriter review

CRITICAL INSTRUCTIONS:
- Extract EVERY condition with its coverage decision
- Include any qualifiers (e.g., "if controlled", "within 5 years")
- Do NOT infer decisions - only extract what is explicitly stated
- Return empty arrays for categories not found

OUTPUT FORMAT:
{
  "conditionDecisions": {
    "select": [{ "condition": "...", "qualifiers": "...", "confidence": 0.9 }],
    "graded": [...],
    "decline": [...],
    "refer": [...]
  }
}
`;
```

### Phase 5: Post-Extraction Validation

```typescript
// New: src/services/underwriting/criteriaValidation.ts

function validateExtractedCriteria(criteria: ExtractedCriteria): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Age limit validation
  if (criteria.ageLimits) {
    const { minIssueAge, maxIssueAge } = criteria.ageLimits;
    if (minIssueAge < 0 || minIssueAge > 100) {
      errors.push(`Invalid minIssueAge: ${minIssueAge}`);
    }
    if (maxIssueAge < 0 || maxIssueAge > 100) {
      errors.push(`Invalid maxIssueAge: ${maxIssueAge}`);
    }
    if (minIssueAge >= maxIssueAge) {
      errors.push(`Age range invalid: min (${minIssueAge}) >= max (${maxIssueAge})`);
    }
  }

  // Face amount validation
  if (criteria.faceAmountLimits) {
    const { minimum, maximum } = criteria.faceAmountLimits;
    if (minimum >= maximum) {
      errors.push(`Face amount range invalid: min >= max`);
    }
    if (minimum < 0 || maximum > 10000000) {
      warnings.push(`Face amount outside typical range`);
    }
  }

  // Medication name validation (against known database)
  if (criteria.medications?.declinable) {
    const unknownMeds = criteria.medications.declinable.filter(
      med => !validateMedicationName(med.rawName)
    );
    if (unknownMeds.length > 0) {
      warnings.push(`Unknown medications: ${unknownMeds.map(m => m.rawName).join(", ")}`);
    }
  }

  // State code normalization
  if (criteria.stateAvailability) {
    const normalized = normalizeStateCodes(criteria.stateAvailability);
    if (normalized.invalidCodes.length > 0) {
      errors.push(`Invalid state codes: ${normalized.invalidCodes.join(", ")}`);
    }
  }

  // Source excerpt coverage check
  const fieldsWithoutSources = findFieldsWithoutSourceExcerpts(criteria);
  if (fieldsWithoutSources.length > 0) {
    warnings.push(`Fields without source excerpts: ${fieldsWithoutSources.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Phase 6: OCR Detection

```typescript
// Add to parse-underwriting-guide/index.ts

function detectOCRContent(text: string): { hasOCR: boolean; confidence: number } {
  const ocrPatterns = [
    /[Il1|]{3,}/,           // Common I/l/1/| confusion
    /[0O]{3,}/,             // Zero/O confusion
    /[S5$]{3,}/,            // S/5/$ confusion
    /\b[A-Z]{2,}\s+[a-z]/,  // Broken word capitalization
  ];

  let matchCount = 0;
  for (const pattern of ocrPatterns) {
    if (pattern.test(text)) matchCount++;
  }

  return {
    hasOCR: matchCount >= 2,
    confidence: matchCount / ocrPatterns.length,
  };
}
```

### Phase 7: UI Updates

Update CriteriaEditor to display:
- Tabbed interface for condition decision matrix (Select | Graded | Decline | Refer)
- Searchable/filterable medication list with confidence badges
- Full build chart as visual grid
- Confidence indicators per section
- Validation warnings/errors display

---

## Test Strategy

### Golden File Tests

Create test fixtures with:
1. 5 representative carrier guides (different layouts, carriers)
2. Expected extraction output for each
3. CI test that validates extraction accuracy

```typescript
// tests/extraction/goldenFiles.test.ts
describe("Golden File Extraction Tests", () => {
  const testCases = [
    { guide: "transamerica-final-expense-2024.json", expected: "transamerica-expected.json" },
    { guide: "mutual-of-omaha-term-2024.json", expected: "mutual-expected.json" },
    // ...
  ];

  for (const tc of testCases) {
    it(`extracts ${tc.guide} correctly`, async () => {
      const result = await extractCriteria(loadGuide(tc.guide));
      expect(result).toMatchExtractionSnapshot(loadExpected(tc.expected));
    });
  }
});
```

### Regression Tests

- Test multi-chunk merge logic
- Test validation edge cases
- Test confidence scoring consistency

### Integration Tests

- Full parse → extract → validate flow
- Error handling for scanned PDFs
- API retry behavior

---

## Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/features/underwriting/types/underwriting.types.ts` | New ExtractedCriteria (SINGLE SOURCE) |
| `supabase/functions/extract-underwriting-criteria/index.ts` | Multi-pass extraction, import shared types |
| `supabase/functions/parse-underwriting-guide/index.ts` | Add table detection, OCR detection |
| `supabase/functions/underwriting-ai-analyze/criteria-evaluator.ts` | Import shared types |
| `src/features/underwriting/components/CriteriaReview/CriteriaEditor.tsx` | New section components, validation display |
| `src/services/underwriting/criteriaValidation.ts` | NEW: Post-extraction validation |
| `tests/extraction/` | NEW: Golden file tests |

---

## Success Criteria

After implementation:
- [ ] Transamerica guide extracts ALL 100+ declinable medications
- [ ] Full condition decision chart with SELECT/GRADED/DECLINE/REFER
- [ ] Complete build chart data (all height/weight rows)
- [ ] Per-field confidence scores
- [ ] Validation catches invalid extractions
- [ ] UI displays all extracted data with search/filter
- [ ] Golden file tests pass for 5 carrier guides
- [ ] Type consolidation complete (single ExtractedCriteria definition)

---

## Priority

**CRITICAL** - The current extraction captures ~10% of available data. This fundamentally undermines the feature's value.

---

## Start Command

```
Continue from: plans/active/extraction-schema-redesign.md

The underwriting criteria extraction is only capturing a fraction of the data.
Transamerica guides have:
- 100+ declinable medications (we capture ~5 categories)
- Full condition decision charts with SELECT/GRADED/DECLINE (we only capture decline)
- Complete build charts (we only capture BMI thresholds)

Redesign the extraction schema and prompts to capture COMPLETE data from guides.
Start by reviewing the current schema and prompt, then implement the expanded version.
```

---

## Reference: Transamerica Declinable Medications (Partial)

```
Abacavir, Acamprosate, Adlarity, Adrucil, Alimta, Antabuse, Aricept,
Atazanavir, Atripla, Azathioprine, Belbuca, Bicalutamide, Biktarvy,
Brixadi, Bunavail, Buprenorphine HCl, Cabanuva, Campral, Casodex,
Cellcept, Cyclosporine, Cytoxan, Disulfiram, Dolutegravir, Donepazil,
Dovato, Eligard, Eloxatin, Emtriva, Envarsus, Epzicom, Erleada,
Etravirine, Evotaz, Exelon, Gengraf, Genvoya, Gleevec, Imbruvica,
Imnovid, Imuran, Intelence, Isentress, Juluca, Kaletra, Keytruda,
Lexiva, Lupron, Lynparza, Memantine, Mycophenolate mofetil, Myfortic,
Mytesi, Naltrexone, Namenda, Neoral, Neosar, Norvir, Nubeqa, Odefsey,
Orgovyx, Paraplatin, Pifeltro, Pomalyst, Prezcobix, Prograf,
Raltegravir, Rapamune, Revlimid, Reyataz, Ritonavir, Rivastigmine,
Rukobia, Sandimmune, Sirolimus, Sublocade, Suboxone, Subutex, Symtuza,
Tabrecta, Tacrolimus, Tasigna, Thalomid, Tivicay, Triumeq, Vidaza,
Vivitrol, Xtandi, Ziagen, Zubsolv, Zytiga
```

This is just from ONE guide. The current system captures none of these.
