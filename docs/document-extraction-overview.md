# Document Extraction Service — Knowledge Base

## What This Is

A unified document extraction layer that takes insurance carrier PDF underwriting guides and extracts structured text, tables, and metadata — so the app can automatically build underwriting criteria, populate the Coverage Builder, and power the Underwriting Wizard.

## Where This Lives in the App

### Entry Point

**Settings page → "Underwriting" section → "Guides" tab**

Route: `/settings` → click "Underwriting" in the sidebar → click "Guides" tab

The Settings page has 6 underwriting sub-tabs:
1. **Criteria** — Review/approve AI-extracted criteria
2. **Rates** — Premium rate tables
3. **Acceptance** — Acceptance rule configuration
4. **Coverage** — Coverage Builder (carrier → product → condition drill-down)
5. **Guides** — **THIS IS WHERE PDF UPLOAD + PARSING HAPPENS**
6. **History** — Session history

### The Guides Tab UI

The Guides tab shows a **table of all uploaded carrier PDF guides** with columns:

| Column | Shows |
|--------|-------|
| Name | Guide name + filename + version |
| Carrier | Which insurance carrier this guide belongs to |
| Size | File size |
| Parse | Status badge: `—` → `Parsing (spinner)` → `Parsed (green)` → `Failed (red)` |
| Criteria | Status badge: `Extract (button)` → `Extracting (spinner)` → `95% (green)` → `Failed (red)` |
| Uploaded | Date |
| Actions | Dropdown menu with: View, Edit, **Parse**, **Parse with OCR**, Delete |

### Buttons That Matter

- **"Upload Guide"** button (top-right) → Opens upload dialog where you:
  - Select a carrier from dropdown
  - Name the guide
  - Optionally set version + effective/expiration dates
  - Drag-and-drop or browse for the PDF file (max 50MB)
  - Uploads to Supabase Storage bucket `underwriting-guides` under `{imo_id}/{carrier_id}/`

- **"Parse"** (in Actions dropdown) → Extracts text using the fast text-layer method. Works well on digitally-created PDFs. Calls the `parse-underwriting-guide` Supabase edge function.

- **"Parse with OCR"** (in Actions dropdown, ScanEye icon) → Extracts text + tables using PaddleOCR. Slower (3-100s) but handles scanned documents, tables, and complex layouts. Calls the Railway PaddleOCR service.

- **"Extract"** (in Criteria column, purple Sparkles icon) → Only enabled after a guide is parsed. Sends parsed content to the `extract-underwriting-criteria` edge function which uses Claude AI to identify and structure underwriting rules from the text.

## Complete Step-by-Step Flow

Here's exactly what happens when you go from a carrier PDF to usable underwriting rules:

### Step 1: Upload the PDF

**Where:** Settings → Underwriting → Guides → "Upload Guide" button

**What happens:**
1. Admin selects carrier (e.g., "Prudential"), names the guide, picks the PDF file
2. `GuideUploader.tsx` validates it's a PDF under 50MB
3. File uploads to Supabase Storage: `underwriting-guides/{imo_id}/{carrier_id}/{file_hash}`
4. Database row created in `underwriting_guides` table with `parsing_status: "pending"`
5. Guide appears in the table with a `—` in the Parse column

**Files:** `GuideUploader.tsx`, `useUnderwritingGuides.ts` → `useUploadGuide()`

### Step 2: Parse the PDF

**Where:** Settings → Underwriting → Guides → Actions dropdown on the guide row → "Parse" or "Parse with OCR"

**What happens (text-layer — "Parse"):**
1. `useParseGuide` hook calls `extractionGateway.extract()` with no features
2. Gateway routes to `UwTextAdapter`
3. Adapter does RLS ownership check (SELECT to confirm guide belongs to your IMO)
4. Calls `parse-underwriting-guide` Supabase edge function
5. Edge function downloads PDF from storage, extracts text using `unpdf`/PDF.js
6. Writes `parsed_content` JSON to the `underwriting_guides` row
7. Sets `parsing_status: "completed"`
8. UI badge changes to green "Parsed"

**What happens (OCR — "Parse with OCR"):**
1. `useParseGuide` hook calls `extractionGateway.extract()` with `{ ocr: true, tables: true, layout: true }`
2. Gateway routes to `PaddleOcrAdapter` (because OCR features are requested)
3. Adapter does RLS ownership check
4. Downloads PDF from Supabase Storage
5. Sends PDF to Railway PaddleOCR service (`POST /api/paddle-ocr`)
6. PaddleOCR runs PP-Structure: detects page regions (headings, paragraphs, tables), runs OCR on each
7. Tables extracted as HTML → parsed into structured `values[][]` grids → converted to pipe-separated text for fullText
8. Result normalized to canonical `ExtractionResult` format
9. Converted back to legacy `UwParsedContent` format and written to `underwriting_guides.parsed_content`
10. Sets `parsing_status: "completed"`
11. UI shows toast: "Guide parsed (OCR): X pages, Y sections, Z tables"

**Files:** `useParseGuide.ts` → `extraction-gateway.ts` → `uw-text-adapter.ts` OR `paddle-ocr-adapter.ts`

### Step 3: Extract Criteria with AI

**Where:** Settings → Underwriting → Guides → "Extract" button (purple sparkles) in the Criteria column

**Prerequisite:** Guide must be parsed first (Parse column shows green "Parsed")

**What happens:**
1. `useExtractCriteria` hook calls `extract-underwriting-criteria` edge function
2. Edge function reads `parsed_content` from the guide's DB row
3. Validates: `fullText.length >= 5000`, `>= 500 words`, `>= 20 unique chars`
4. Splits fullText into chunks (max 40KB each, max 3 chunks)
5. Sends each chunk to Claude AI with a structured extraction prompt
6. Claude identifies and returns structured criteria:
   - **Age limits** (min/max issue age)
   - **Face amount limits** (min/max, age-tiered brackets)
   - **Knockout conditions** (disqualifying medical conditions with codes)
   - **Build requirements** (BMI thresholds, height/weight tables)
   - **Tobacco rules** (classifications, nicotine test requirements)
   - **Medication restrictions** (insulin, blood thinners, opioids, etc.)
   - **State availability**
7. Saves to `carrier_underwriting_criteria` table with `extraction_status: "completed"` and `extraction_confidence: 0.0-1.0`
8. UI badge changes to green "95%" (or whatever confidence)

**Files:** `useExtractCriteria.ts` → `supabase/functions/extract-underwriting-criteria/index.ts`

### Step 4: Review & Approve Criteria

**Where:** Settings → Underwriting → **Criteria** tab (first tab)

**What happens:**
1. `CriteriaReviewDashboard.tsx` shows a table of all extracted criteria
2. Each row shows: carrier, guide name, extraction confidence, review status
3. Admin can click to edit/review the extracted JSON (age limits, face amounts, etc.)
4. Admin sets `review_status` to `"approved"`, `"rejected"`, or `"needs_revision"`
5. Only **approved** criteria are used downstream

**Files:** `CriteriaReviewDashboard.tsx`, `CriteriaEditor.tsx`, `useExtractCriteria.ts` → `useUpdateCriteriaReview()`

### Step 5: Coverage Builder Consumes Criteria

**Where:** Settings → Underwriting → **Coverage** tab

**What happens:**
1. Three-level drill-down UI: **Carrier** → **Product** → **Condition checklist**
2. Reads from `carrier_underwriting_criteria.extracted_criteria` for the selected carrier
3. Shows extracted fields: age limits, face amounts, knockout conditions, BMI rules
4. Admin configures per-condition rules (which conditions does this product cover?)
5. Saves rules to `underwriting_rule_sets` + `underwriting_rules` tables

**Files:** `CoverageTab.tsx` → `CarrierCoverageList.tsx` → `ProductCoverageList.tsx` → `ConditionChecklist.tsx`

### Step 6: Underwriting Wizard Uses the Rules

**Where:** `/underwriting/wizard` route (main nav)

**What happens:**
1. Agent enters client info (age, health conditions, tobacco use, coverage amount)
2. Wizard fetches `underwriting_rule_sets` for all carriers/products
3. Applies rules: age limits, face amount limits, knockout conditions, build charts
4. Filters out carriers where client doesn't qualify
5. Returns sorted recommendations: eligible carriers with rates and risk classifications

**Files:** `UnderwritingWizard.tsx`, `useDecisionEngineRecommendations.ts`

## Complete Data Flow Diagram

```
SETTINGS → UNDERWRITING → GUIDES TAB
    │
    ├── [Upload Guide] button
    │       ↓
    │   GuideUploader dialog → select carrier, name, PDF file
    │       ↓
    │   Supabase Storage: underwriting-guides/{imo_id}/{carrier_id}/{hash}
    │       ↓
    │   DB: underwriting_guides row (parsing_status: "pending")
    │
    ├── [Parse] or [Parse with OCR] in Actions dropdown
    │       ↓
    │   useParseGuide → ExtractionGateway → UwTextAdapter OR PaddleOcrAdapter
    │       ↓
    │   DB: underwriting_guides.parsed_content = JSON (fullText, sections, tables)
    │   DB: underwriting_guides.parsing_status = "completed"
    │
    └── [Extract] button in Criteria column (after parsing)
            ↓
        useExtractCriteria → extract-underwriting-criteria edge function
            ↓
        Claude AI analyzes parsed text → identifies UW rules
            ↓
        DB: carrier_underwriting_criteria (age limits, face amounts,
            knockouts, build charts, tobacco rules, medications)

SETTINGS → UNDERWRITING → CRITERIA TAB
    │
    └── CriteriaReviewDashboard → review/approve extracted criteria
            ↓
        review_status: "approved"

SETTINGS → UNDERWRITING → COVERAGE TAB
    │
    └── CoverageBuilder → Carrier → Product → Condition drill-down
            ↓
        Reads carrier_underwriting_criteria
            ↓
        Saves to underwriting_rule_sets + underwriting_rules

/UNDERWRITING/WIZARD (main nav)
    │
    └── Agent enters client info
            ↓
        Wizard reads underwriting_rule_sets
            ↓
        Filters carriers by eligibility
            ↓
        Shows recommendations with rates + risk class
```

## Why It Exists (The Business Problem)

Insurance carriers publish underwriting guidelines as PDFs. These PDFs contain:

- **Build charts** — height/weight tables that determine risk classification (Preferred, Standard, Substandard)
- **Impairment guides** — medical conditions mapped to ratings and flat extras
- **Tobacco/nicotine rules** — product eligibility based on usage type and frequency
- **Financial underwriting limits** — max coverage by age, income, net worth
- **Foreign travel/residency** — country-specific rules

**Before this feature:** Agents and back-office staff manually read 20-100 page PDFs and hand-entered every rule into the system. This took hours per carrier and was error-prone.

**After this feature:** Upload the PDF → click Parse → click Extract → review the AI output → approve. Minutes instead of hours.

### Why PaddleOCR Was Added

The original text-layer parser worked for digitally-created PDFs but **failed on**:

- Scanned documents (no text layer — just images of pages)
- Table-heavy pages (build charts came through as garbled text with no row/column structure)
- Mixed-layout guides (sidebars, multi-column, callout boxes)
- Image-heavy carrier brochures

**Benchmark results across 11 real carrier guides:**
- PaddleOCR extracts 2x more content from table-heavy documents
- 31 tables detected that text-layer missed entirely
- 11/11 guides succeeded with zero crashes
- Processing time: 3-103 seconds (scales ~7s/page)

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `underwriting_guides` | Stores uploaded PDFs + metadata + `parsing_status` + `parsed_content` (extracted text JSON) |
| `carrier_underwriting_criteria` | Stores AI-extracted criteria per guide (age limits, knockouts, build charts, etc.) + `extraction_status` + `review_status` |
| `underwriting_rule_sets` | Configured rule sets per carrier/product (from Coverage Builder) |
| `underwriting_rules` | Individual rules within a rule set |

## Key Files by Area

### Upload & Parse
| File | Purpose |
|------|---------|
| `src/features/underwriting/components/GuideManager/GuideUploader.tsx` | Upload dialog (carrier picker, name, file input) |
| `src/features/underwriting/components/GuideManager/GuideList.tsx` | Guides table with Parse/OCR/Extract buttons |
| `src/features/underwriting/hooks/guides/useUnderwritingGuides.ts` | Upload/delete/update mutations |
| `src/features/underwriting/hooks/guides/useParseGuide.ts` | Parse mutation → gateway |

### Extraction Service
| File | Purpose |
|------|---------|
| `src/services/document-extraction/extraction-gateway.ts` | Routes to correct adapter |
| `src/services/document-extraction/adapters/uw-text-adapter.ts` | Text-layer extraction via edge function |
| `src/services/document-extraction/adapters/paddle-ocr-adapter.ts` | OCR extraction via Railway service |
| `src/types/document-extraction.types.ts` | Canonical request/result types |
| `services/paddleocr-service/app.py` | Python FastAPI OCR service (deployed to Railway) |

### AI Criteria Extraction
| File | Purpose |
|------|---------|
| `src/features/underwriting/hooks/criteria/useExtractCriteria.ts` | Extract trigger hook |
| `supabase/functions/extract-underwriting-criteria/index.ts` | Claude AI extraction edge function |
| `src/features/underwriting/hooks/criteria/useCriteria.ts` | Criteria query hooks |

### Review & Configuration
| File | Purpose |
|------|---------|
| `src/features/underwriting/components/CriteriaReview/CriteriaReviewDashboard.tsx` | Review/approve criteria table |
| `src/features/underwriting/components/CriteriaReview/CriteriaEditor.tsx` | Edit extracted criteria JSON |
| `src/features/underwriting/components/CoverageBuilder/CoverageTab.tsx` | Coverage Builder container |
| `src/features/underwriting/components/CoverageBuilder/ConditionChecklist.tsx` | Per-condition rule configuration |

### Wizard (Consumption)
| File | Purpose |
|------|---------|
| `src/features/underwriting/components/Wizard/UnderwritingWizard.tsx` | Main wizard UI |
| `src/features/underwriting/hooks/wizard/useDecisionEngineRecommendations.ts` | Eligibility filtering + recommendations |

## Security Model

- **RLS pre-flight**: All adapters do a `SELECT id` ownership check before any side effects — ensures the guide belongs to the current user's IMO
- **Storage RLS**: Supabase storage policies scope file access to `{imo_id}/` folders
- **API key auth**: PaddleOCR Railway service gated by `X-API-Key` header (cost control)
- **Edge functions**: Use `service_role` key internally — the RLS pre-flight prevents unauthorized access

## PaddleOCR Service (Railway)

- **Project**: bubbly-manifestation
- **URL**: `https://bubbly-manifestation-production-f87d.up.railway.app`
- **Auth**: `X-API-Key` header (env var `PADDLEOCR_API_KEY`)
- **Health**: `GET /health` (no auth required)
- **Extract**: `POST /api/extract` (multipart file upload, auth required)
- **Proxied via**: Vite dev proxy + Vercel rewrite at `/api/paddle-ocr`
- **Engine**: PP-Structure (PaddleOCR 2.9.1) — detects headings, paragraphs, tables, runs OCR per region
- **Table parsing**: HTML tables → regex state-machine → `values[][]` grids → pipe-separated text in fullText

## Env Vars

| Var | Where | Purpose |
|-----|-------|---------|
| `PADDLEOCR_API_KEY` | Railway | API key for the PaddleOCR service |
| `VITE_PADDLEOCR_API_KEY` | Vercel (prod + preview) | Same key, passed in browser fetch headers |
| `PADDLEOCR_SERVICE_URL` | Vite dev (optional) | Override PaddleOCR service URL for local dev |

## Phase Status

| Phase | Status | What It Did |
|-------|--------|-------------|
| 1 | Done | Created ExtractionGateway, adapter interface, canonical types, UwTextAdapter, TrainingRailwayAdapter |
| 2 | Done | Rewired useParseGuide from direct `supabase.functions.invoke` to gateway |
| 3 | Done | PaddleOCR adapter + Python service + "Parse with OCR" UI + benchmark + DB persistence |
| 4 | Done | Decision: keep Railway training extractor separate (AI enrichment can't be replicated by OCR) |
| 5 | Not Started | Migrate `parsed_content` from legacy format to canonical `ExtractionResult` schema |
