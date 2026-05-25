# Continuation: Fix PDF Parsing for Underwriting Criteria Extraction

## ✅ COMPLETED - Implementation

### Root Cause
**PDF.js fails silently in Deno edge function environment.** The library appears to work but produces empty/minimal text output.

### Solution Implemented
Replaced PDF.js with **unpdf** library (`npm:unpdf`) which is specifically designed for edge/serverless environments.

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/parse-underwriting-guide/index.ts` | Replaced PDF.js with unpdf, added content validation |
| `supabase/functions/extract-underwriting-criteria/index.ts` | Added input content validation to reject garbage |
| `scripts/reset-underwriting-guides.sql` | Created SQL script to reset all guides |

### Key Changes in parse-underwriting-guide

```typescript
// OLD (broken)
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";

// NEW (working)
import { extractText, getDocumentProxy } from "npm:unpdf";
```

### Content Validation Added
Both functions now validate content quality:
- Minimum 5,000 characters
- No placeholder patterns like `[PDF content from ...]`
- At least 20 unique characters (variety check)
- At least 500 words (density check)

## 🔄 REMAINING - Deployment & Testing

### Step 1: Deploy Functions
The Supabase CLI lacks permissions to deploy. Choose one:

**Option A: Re-authenticate CLI**
```bash
npx supabase login
npx supabase functions deploy parse-underwriting-guide --project-ref wbxljhbmfzgcpvkfrcsg
npx supabase functions deploy extract-underwriting-criteria --project-ref wbxljhbmfzgcpvkfrcsg
```

**Option B: Deploy via Dashboard**
1. Go to Supabase Dashboard → Edge Functions
2. Select `parse-underwriting-guide`
3. Click "Deploy" and paste the updated code
4. Repeat for `extract-underwriting-criteria`

### Step 2: Reset Guides Database
Run the SQL in `scripts/reset-underwriting-guides.sql`:

```sql
-- Reset all guides to pending status
UPDATE underwriting_guides
SET
  parsing_status = 'pending',
  parsed_content = NULL,
  parsing_error = NULL,
  updated_at = NOW()
WHERE parsing_status IN ('completed', 'failed');

-- Delete empty criteria records
DELETE FROM carrier_underwriting_criteria
WHERE
  criteria = '{}'::jsonb
  OR criteria->>'ageLimits' IS NULL
  OR extraction_status = 'failed';
```

### Step 3: Re-Parse All Guides
From the UI:
1. Go to Underwriting → Guides
2. Select each guide
3. Click "Parse Guide" button

Or trigger via API for all guides.

### Step 4: Verify Success
After re-parsing, check:
```sql
SELECT id, name, parsing_status, LENGTH(parsed_content::text) as content_len
FROM underwriting_guides
WHERE parsing_status = 'completed';
```

**Success criteria:**
- `content_len` should be 10,000+ characters (not 300-545)
- Criteria extraction should return non-null fields

## Technical Notes

### Why unpdf Works
- Designed specifically for edge/serverless (Deno Deploy, Supabase Edge Functions)
- Uses optimized PDF.js redistribution for edge environments
- Confirmed working in Supabase Edge Functions (see GitHub issue #3)

### Sources
- [unpdf GitHub](https://github.com/unjs/unpdf)
- [Supabase Edge Function compatibility issue resolved](https://github.com/unjs/unpdf/issues/3)

## Resume Command
```
The PDF parsing fix has been implemented. Deploy the functions and run the database reset to test.
```
