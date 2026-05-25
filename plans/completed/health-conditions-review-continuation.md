# Continuation Prompt: Health Conditions Data Completeness Review

## Copy This Into New Conversation

---

I was working on the underwriting wizard health conditions and need to continue reviewing and fixing the conditions data.

## Context - What Was Just Done

We just cleaned up the `underwriting_health_conditions` table by:
1. Removing FK constraint from `underwriting_rule_sets.condition_code` (migration `20260114_007`)
2. Deleting 217 junk conditions from categories: `medical_conditions`, `lifestyle`, `knockout` (migration `20260114_008`)
3. Updated TypeScript types to remove bad categories
4. Fixed HealthConditionsStep.tsx to remove the EXCLUDED_CATEGORIES hack
5. Fixed seed scripts to stop auto-creating junk conditions

**Current state after cleanup - 54 conditions across 13 categories:**
- autoimmune: 4
- cancer: 4
- cardiovascular: 14
- endocrine: 1
- gastrointestinal: 7
- infectious: 2
- mental_health: 4
- metabolic: 4
- neurological: 5
- other: 1
- renal: 1
- respiratory: 4
- substance: 3

## Problems Identified - NEED TO FIX

### 1. Missing Common Conditions

**Kidney/Renal (only 1 condition):**
- Missing: Kidney stones, Polycystic kidney disease, Glomerulonephritis, Nephrotic syndrome

**Mental Health (missing PTSD):**
- Currently has: depression, anxiety, bipolar (and maybe 1 more)
- Missing: PTSD, Schizophrenia, Eating disorders

**Respiratory (missing chronic bronchitis):**
- Currently has: copd, asthma, sleep_apnea + 1 other
- Missing: Chronic bronchitis, Pulmonary fibrosis

**Cardiovascular (potentially incomplete):**
- Need to verify we have: Heart murmur, Pericarditis, Aneurysm, Cardiomyopathy, Valve disorders

### 2. Redundant Conditions

**Metabolic has 4 diabetes entries when 1 is enough:**
- The follow-up questions handle the nuances (Type 1 vs Type 2, complications, etc.)
- Having "diabetes with complications" as a separate condition is redundant
- Review and consolidate to single entries with proper follow-up schemas

### 3. Verify Follow-up Questions

Need to test that:
- Selecting a condition properly shows follow-up questions in the right panel
- Follow-up responses are being saved with the condition
- Required follow-ups block "Next" button appropriately

## Tasks for This Session

1. **Research common health conditions** for life insurance underwriting in each category
2. **Audit current conditions** - query the database to see exactly what we have
3. **Identify gaps** - compare against common conditions list
4. **Create migration** to add missing conditions with proper follow-up schemas
5. **Remove redundant conditions** (like duplicate diabetes entries)
6. **Test the wizard** - verify follow-up questions work correctly
7. **Check "other" category** - what's in there? Should it be recategorized?

## Key Files

- **Conditions table:** `underwriting_health_conditions` in Supabase
- **Seed data:** `supabase/migrations/20260109_002_underwriting_health_conditions_seed.sql`
- **Types:** `src/features/underwriting/types/underwriting.types.ts` (ConditionCategory)
- **UI Component:** `src/features/underwriting/components/WizardSteps/HealthConditionsStep.tsx`
- **Hook:** `src/features/underwriting/hooks/useHealthConditions.ts`

## Database Query to Start

Run this to see current conditions:
```sql
SELECT category, code, name,
       jsonb_array_length(follow_up_schema->'questions') as question_count
FROM underwriting_health_conditions
WHERE is_active = true
ORDER BY category, sort_order, name;
```

## Important Rules

- Each condition MUST have meaningful follow-up questions (not empty `{}`)
- Follow-up questions should capture the underwriting-relevant details
- Don't duplicate - if details can be captured via follow-ups, use ONE condition
- Use the apply-migration script: `./scripts/apply-migration.sh <path>`

Start by querying the database to see what we currently have, then research what common conditions we're missing.

---
