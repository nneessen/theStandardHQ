# UW Wizard Cost Analysis

This document breaks down the AI costs for running the Underwriting Wizard feature.

## Quick Summary

| Operation | When It Runs | Cost Per Use |
|-----------|--------------|--------------|
| Wizard Analysis | Each time a user runs the wizard | **$0.02 - $0.05** |
| Guide Extraction | Once per uploaded guide | **$0.08 - $0.23** |

---

## AI Model & Pricing

**Model Used:** `claude-sonnet-4-20250514` (Claude Sonnet 4)

| Token Type | Price |
|------------|-------|
| Input | $3.00 per 1 million tokens |
| Output | $15.00 per 1 million tokens |

> **Note:** Verify current pricing at [anthropic.com/pricing](https://anthropic.com/pricing) as rates may change.

---

## Function 1: Wizard Analysis

**File:** `supabase/functions/underwriting-ai-analyze/index.ts`

This runs every time a user completes the wizard and requests carrier recommendations.

### What Gets Sent to AI

| Component | Description | Est. Tokens |
|-----------|-------------|-------------|
| Base instructions | Underwriting guidelines, rating criteria | ~750 |
| Carrier/product list | Available carriers and their products | 500 - 2,000 |
| Decision tree rules | Pre-configured routing rules (if any) | 250 - 750 |
| Guide excerpts | Relevant sections from uploaded guides | 0 - 3,750 |
| Criteria context | Extracted underwriting criteria | 125 - 500 |
| Client profile | Age, BMI, conditions, medications, coverage | 400 - 625 |
| **Total Input** | | **2,000 - 8,000** |
| **Output (recommendations)** | JSON with carrier recommendations | **800 - 1,500** |

### Cost Per Run

| Scenario | Input | Output | Total Cost |
|----------|-------|--------|------------|
| **Light** — Few carriers, no guides | 2,000 tokens | 800 tokens | **$0.018** |
| **Typical** — 5 carriers, some guides | 4,000 tokens | 1,000 tokens | **$0.027** |
| **Heavy** — Many carriers, full guides | 8,000 tokens | 1,500 tokens | **$0.047** |

### Built-in Cost Controls

These limits prevent token explosion:

| Setting | Value | Purpose |
|---------|-------|---------|
| `MAX_TOTAL_GUIDE_CHARS` | 15,000 | Total chars from all guides combined |
| `MAX_EXCERPT_LENGTH` | 1,500 | Max chars per individual excerpt |
| `MAX_EXCERPTS_PER_GUIDE` | 5 | Max excerpts pulled from each guide |
| `max_tokens` (output) | 2,000 | Caps AI response length |

---

## Function 2: Guide Extraction

**File:** `supabase/functions/extract-underwriting-criteria/index.ts`

This runs **once** when an admin uploads a new underwriting guide PDF. It extracts structured criteria (age limits, knockout conditions, BMI requirements, etc.) from the guide.

### What Gets Sent to AI

| Component | Description | Tokens |
|-----------|-------------|--------|
| System prompt | Extraction instructions | ~700 |
| Guide content | PDF text (chunked if large) | ~10,000 per chunk |
| **Max chunks processed** | Cost control limit | 3 |

### Cost Per Extraction

| Guide Size | Chunks | Input Tokens | Output Tokens | Total Cost |
|------------|--------|--------------|---------------|------------|
| Small (<40K chars) | 1 | ~11,000 | ~3,000 | **$0.078** |
| Medium (40-80K chars) | 2 | ~21,000 | ~6,000 | **$0.153** |
| Large (80K+ chars) | 3 | ~31,000 | ~9,000 | **$0.228** |

### Built-in Cost Controls

| Setting | Value | Purpose |
|---------|-------|---------|
| `MAX_CHUNK_CHARS` | 40,000 | Max chars per chunk (~10K tokens) |
| `MAX_TOTAL_CHUNKS` | 3 | Max API calls per extraction |
| `max_tokens` (output) | 4,000 | Caps AI response per chunk |

---

## Monthly Cost Estimates

### Wizard Usage

| Monthly Runs | Est. Cost (Typical) |
|--------------|---------------------|
| 50 runs | $1.35 |
| 100 runs | $2.70 |
| 250 runs | $6.75 |
| 500 runs | $13.50 |
| 1,000 runs | $27.00 |

### Guide Extractions

| Guides Uploaded | Est. Cost |
|-----------------|-----------|
| 5 guides | $0.40 - $1.15 |
| 10 guides | $0.80 - $2.30 |
| 25 guides | $2.00 - $5.75 |

### Combined Example

A typical agency with:
- 200 wizard runs/month
- 5 new guides/month

**Estimated Monthly AI Cost: $6 - $8**

---

## Cost Optimization Tips

1. **Limit guide excerpts** — The system already caps at 15K chars total. Larger guides don't cost more per wizard run.

2. **Pre-extract criteria** — Running guide extraction once creates structured criteria that reduce reliance on raw guide text.

3. **Use decision trees** — Deterministic rules reduce AI processing by pre-filtering carriers before the AI call.

4. **Monitor usage** — Check Supabase function invocation logs to track actual usage patterns.

---

## Technical Reference

### Code Locations

| Function | Path |
|----------|------|
| Wizard Analysis | `supabase/functions/underwriting-ai-analyze/index.ts` |
| Guide Extraction | `supabase/functions/extract-underwriting-criteria/index.ts` |

### Token Estimation

- ~4 characters ≈ 1 token (for English text)
- 40,000 characters ≈ 10,000 tokens

### API Configuration

```typescript
// Wizard Analysis
model: "claude-sonnet-4-20250514"
max_tokens: 2000

// Guide Extraction
model: "claude-sonnet-4-20250514"
max_tokens: 4000
```
