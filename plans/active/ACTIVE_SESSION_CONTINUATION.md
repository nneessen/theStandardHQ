# Active Session Continuation

**Created**: 2026-03-11T15:00:00Z
**Branch**: `feat/document-extraction-consolidation`
**PR**: https://github.com/nneessen/commissionTracker/pull/8

## Context

Document Extraction Consolidation — Phases 1-4 complete. PaddleOCR adapter, Railway service, code review fixes all implemented. The OCR parsing itself works (Railway returns data, adapter normalizes it, DB persistence succeeds). BUT the downstream criteria extraction is garbage — hardly anything gets extracted.

## The Problem

After successfully parsing a guide with OCR, the user clicked "Extract" (criteria extraction via Claude AI). The result:

1. **Zod validation errors**: 11 fields came back as `null` instead of expected types — `ageLimits`, `faceAmountLimits`, `buildRequirements`, `tobaccoRules`, `medicationRestrictions` all null
2. **Almost nothing extracted**: The criteria review tab shows barely any data

This means either:
- The `parsed_content` written by PaddleOCR adapter is malformed or missing data that the criteria extraction edge function expects
- The `fullText` from OCR doesn't meet the validation thresholds (>= 5000 chars, >= 500 words, >= 20 unique chars)
- The Claude AI prompt in `extract-underwriting-criteria` doesn't handle OCR-formatted text well (pipe-separated tables vs the text-layer format it was trained on)
- The chunking logic is cutting content in bad places for OCR output

## Investigation Steps Required

### 1. Verify parsed_content quality
Run a query to check what PaddleOCR actually persisted:
```bash
./scripts/migrations/run-sql.sh "SELECT id, name, parsing_status, LENGTH(parsed_content) as content_length, LEFT(parsed_content, 500) as content_preview FROM underwriting_guides WHERE parsing_status = 'completed' ORDER BY updated_at DESC LIMIT 3;"
```

### 2. Check fullText meets extraction thresholds
The `extract-underwriting-criteria` edge function validates:
- `fullText.length >= 5000`
- No placeholder patterns
- `>= 20` unique characters
- `>= 500` words

If PaddleOCR output is shorter or structured differently, it may fail these checks.

### 3. Compare OCR vs text-layer parsed_content
For a guide that was previously parsed with text-layer (and successfully had criteria extracted), compare the parsed_content format. Check:
- Is `fullText` populated with actual content?
- Do `sections` have real page content?
- Is table data included in the text?

### 4. Read the criteria extraction edge function
Read `supabase/functions/extract-underwriting-criteria/index.ts` to understand:
- What format it expects from `parsed_content`
- How it chunks the content for Claude
- What Zod schema it validates against
- Whether the prompt assumes text-layer formatting

### 5. Check the Zod schema
The validation errors list specific field paths (`ageLimits`, `faceAmountLimits.minimum`, etc.). Find the Zod schema and check if the Claude prompt + OCR text is producing output that doesn't match.

### 6. Key files to read
- `supabase/functions/extract-underwriting-criteria/index.ts` — the extraction logic + Claude prompt
- `src/services/document-extraction/adapters/paddle-ocr-adapter.ts` — how parsed_content is built
- `src/types/document-extraction.types.ts` — canonical types
- Whatever file defines the criteria Zod schema (likely in the edge function or in `src/features/underwriting/types/`)

## Likely Root Causes (Hypotheses)

### A. OCR fullText format mismatch
PaddleOCR produces page text with pipe-separated table rows (`Height | Weight | Class | Rate`). The Claude extraction prompt may be optimized for flowing text-layer output and may not recognize tabular data in this format.

### B. Content too short
If PaddleOCR extracted less text than expected (e.g., the PDF had mostly images that OCR couldn't read well), the fullText might be below the 5000-char threshold, causing the edge function to skip or truncate extraction.

### C. Chunking breaks table context
The edge function splits fullText into ~40KB chunks. If a build chart table spans a chunk boundary, Claude loses context and returns nulls for those fields.

### D. Zod schema too strict
The schema expects non-null values for fields that may legitimately be absent from some carrier guides. The schema may need `nullable()` wrappers or the prompt may need to explicitly handle missing fields.

## What NOT To Do
- Don't start Phase 5 yet — criteria extraction must work first
- Don't modify the edge function without reading it first
- Don't guess at the schema — read the actual Zod definition

## Files Changed (Uncommitted — from review fixes session)

- `src/services/document-extraction/adapters/paddle-ocr-adapter.ts` — atomic UPDATE pre-flight
- `src/services/document-extraction/__tests__/paddle-ocr-adapter.test.ts` — updated mocks
- `services/paddleocr-service/app.py` — streaming upload, tmp_path guard, asyncio fix
- `vite.config.ts` — loadEnv() function form, proxy API key injection
- `docs/document-extraction-overview.md` — knowledge base doc
- `plans/active/ACTIVE_SESSION_CONTINUATION.md` — this file

## Test & Build Status
- 82/82 tests passing
- Zero TypeScript errors
- `validate-app.sh` all green
- Railway PaddleOCR service deployed and responding

## Env Vars Required (Local Dev)
In `.env.local`:
```
PADDLEOCR_SERVICE_URL=https://bubbly-manifestation-production-f87d.up.railway.app
VITE_PADDLEOCR_API_KEY=srzQHZmv7uG1SqZFvSUTqqjXuMZpt/5MpfJkqUFEycs=
PADDLEOCR_API_KEY=srzQHZmv7uG1SqZFvSUTqqjXuMZpt/5MpfJkqUFEycs=
```

## Priority
**BLOCKING**: Fix criteria extraction quality for OCR-parsed guides before merging PR #8. The OCR parsing pipeline works end-to-end but the output quality for downstream criteria extraction is poor/broken.
