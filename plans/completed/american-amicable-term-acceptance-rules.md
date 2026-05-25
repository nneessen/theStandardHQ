# Continuation: American Amicable Term Made Simple - Acceptance Rules

## Task
Create carrier acceptance rules for **American Amicable - Term Made Simple** product, populating BOTH the v1 (`carrier_condition_acceptance`) and v2 (`underwriting_rule_sets` + `underwriting_rules`) systems.

## CRITICAL: Read memory first
Read `memory/carrier_acceptance_rules_workflow.md` for the dual-system workflow, enum type names, and migration template pattern.

## Steps
1. Query DB for American Amicable carrier ID and product IDs:
   ```sql
   SELECT id, name FROM carriers WHERE name ILIKE '%amicable%' OR name ILIKE '%american am%';
   SELECT id, name, product_type FROM products WHERE carrier_id = '<carrier_id>';
   ```
2. Check existing rules:
   ```sql
   SELECT COUNT(*) FROM carrier_condition_acceptance WHERE carrier_id = '<id>';
   SELECT COUNT(DISTINCT condition_code) FROM underwriting_rule_sets WHERE carrier_id = '<id>' AND product_id = '<id>' AND scope = 'condition' AND review_status = 'approved';
   ```
3. Create a single migration file using `date +%Y%m%d%H%M%S` for timestamp
4. Use the pattern from `20260227122723_sbli_term_acceptance_rules.sql` as template (temp table + batch INSERT approach)
5. Apply with `./scripts/migrations/run-migration.sh supabase/migrations/<file>.sql`
6. Verify counts in both systems
7. Run `./scripts/validate-app.sh`

## Application Structure: Term Made Simple Knockout Conditions

Three timeframe tiers — all conditions below result in DECLINE:

### EVER (lifetime knockout)
- Congestive Heart Failure (CHF) → `congestive_heart_failure`
- Cardiomyopathy → `cardiomyopathy`
- AIDS → `aids`
- HIV → `hiv_aids`, `hiv_positive`
- Kidney Dialysis → `kidney_dialysis`
- Renal Insufficiency / Chronic Kidney Disease → `chronic_kidney_disease`, `kidney_disease`, `kidney_failure`
- Liver, Renal or Respiratory Failure → `liver_failure`, `liver_disease`
- Diabetic Complications (Retinopathy, Neuropathy, Nephropathy) → `diabetic_retinopathy`, `diabetic_neuropathy`
- Insulin use prior to age 50 → `diabetes_insulin_early`
- Alzheimer's or Dementia → `alzheimers`, `dementia`
- Suicide attempt → `suicide_attempt`
- Mental incapacity → `mental_incapacity`
- Down Syndrome / Autism → `cerebral_palsy` (nearest code — check if better match exists)
- Organ or Tissue Transplant → `organ_transplant`, `transplant_advised`
- Multiple occurrences of cancer or metastatic cancer → `cancer_multiple`, `cancer_metastatic`

### 2 YEARS (past 2 year knockout)
- Schizophrenia → `schizophrenia`, `severe_mental_illness`
- Bipolar Disorder → `bipolar`
- Seizure → `epilepsy`
- Myasthenia Gravis → (check if code exists, may need to add to `underwriting_health_conditions`)
- Stroke → `stroke`
- TIA → `tia`
- Heart/brain/circulatory procedure → `heart_surgery`, `coronary_bypass`, `angioplasty`, `cardiac_stent`, `vascular_surgery`
- Angina → `angina`
- Parkinson's disease → `parkinsons`
- Cancer → `cancer`, `leukemia`, `melanoma`, `lymphoma`, `internal_cancer`, `hodgkins_disease`
- COPD → `copd`
- Chronic Bronchitis → `chronic_bronchitis`
- Emphysema → `emphysema`
- Multiple Sclerosis → `ms`, `multiple_sclerosis`
- Hepatitis (B, C or Chronic) → `hepatitis_c`
- Cirrhosis → `cirrhosis`
- Liver Disease → `liver_disease` (if not already covered by "ever" tier)
- Chronic Pancreatitis → `pancreatitis`
- Rheumatoid or Psoriatic Arthritis → `rheumatoid_arthritis`, `psoriasis`
- Systemic Lupus (SLE) → `lupus`, `sle_lupus`
- Connective Tissue Disease → `scleroderma`
- Pulmonary Hypertension → (check if code exists)
- Alcohol or Drug abuse → `alcohol_abuse`, `drug_abuse`

### 1 YEAR
- Chronic Pain with Opiate Use → `chronic_pain_opiates`, `opioid_usage`
- Been declined for life insurance → (no direct condition code — use notes)

### CURRENT (right now)
- Hospitalized or confined to nursing facility → `nursing_facility`, `hospitalization_extended`
- Receiving Hospice or home health care → `hospice_care`
- Require assistance with ADLs → `adl_impairment`

## Notes
- Some conditions appear in both "ever" and "2yr" tiers (e.g., liver_disease). For v1, use the strictest (ever = declined). For v2, create one rule set per condition with the appropriate note.
- Check if Myasthenia Gravis and Pulmonary Hypertension exist in `underwriting_health_conditions`. If not, add them.
- The v1 `product_type` will likely be `term_life`. Confirm from the products query.
- Use `imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'` (wildcard).
