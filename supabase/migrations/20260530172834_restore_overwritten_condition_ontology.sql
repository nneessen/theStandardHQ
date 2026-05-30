-- Corrective migration — restore 10 condition rows that migration
-- 20260530141719_seed_underwriting_condition_ontology.sql unintentionally OVERWROTE.
--
-- ROOT CAUSE: that seed was authored against a LOCAL DB where
-- underwriting_health_conditions was empty (0 rows), but REMOTE prod already had a
-- curated ~142-condition ontology (seeded by 20260109_002... in Jan 2026, which was
-- never applied to local — a local↔remote drift). The seed's ON CONFLICT(code) DO
-- UPDATE therefore replaced 10 pre-existing prod conditions' follow_up_schema/name/
-- category/sort_order with near-duplicate (same field-ids, minor option/label diffs)
-- versions, altering the still-live wizard's intake.
--
-- The authoritative definition of these 10 codes lives SOLELY in 20260109_002
-- (verified: 009/003/004/the deactivation migration do not touch them). The rows
-- below are copied VERBATIM from 20260109_002 to restore prod to its known-good
-- state. This migration has a later timestamp than the seed, so it also wins on any
-- fresh replay. `atrial_fibrillation` (genuinely new in the seed) is intentionally
-- left untouched.

INSERT INTO underwriting_health_conditions (code, name, category, risk_weight, sort_order, follow_up_schema)
VALUES
('heart_disease', 'Heart Disease / Coronary Artery Disease', 'cardiovascular', 7, 1, '{
  "questions": [
    {
      "id": "type",
      "type": "select",
      "label": "Type of heart disease",
      "options": ["Coronary Artery Disease (CAD)", "Congestive Heart Failure (CHF)", "Cardiomyopathy", "Valve Disease", "Other"],
      "required": true
    },
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date of diagnosis",
      "required": true
    },
    {
      "id": "procedures",
      "type": "multiselect",
      "label": "Procedures performed",
      "options": ["Angioplasty/Stent", "Bypass Surgery (CABG)", "Valve Replacement", "Pacemaker", "Defibrillator (ICD)", "None"],
      "required": true
    },
    {
      "id": "ejection_fraction",
      "type": "number",
      "label": "Last known ejection fraction (%)",
      "min": 10,
      "max": 80,
      "required": false
    },
    {
      "id": "symptoms_controlled",
      "type": "select",
      "label": "Are symptoms controlled?",
      "options": ["Yes, fully controlled", "Mostly controlled", "Partially controlled", "Not well controlled"],
      "required": true
    },
    {
      "id": "medications",
      "type": "multiselect",
      "label": "Current medications",
      "options": ["Beta Blocker", "ACE Inhibitor/ARB", "Statin", "Blood Thinner", "Diuretic", "Nitrate", "Other", "None"],
      "required": true
    }
  ]
}'::jsonb),
('heart_attack', 'Heart Attack (Myocardial Infarction)', 'cardiovascular', 8, 2, '{
  "questions": [
    {
      "id": "date_of_event",
      "type": "date",
      "label": "Date of heart attack",
      "required": true
    },
    {
      "id": "number_of_events",
      "type": "select",
      "label": "Number of heart attacks",
      "options": ["1", "2", "3 or more"],
      "required": true
    },
    {
      "id": "treatment",
      "type": "multiselect",
      "label": "Treatment received",
      "options": ["Angioplasty/Stent", "Bypass Surgery (CABG)", "Medication only", "Cardiac Rehab"],
      "required": true
    },
    {
      "id": "ejection_fraction_post",
      "type": "number",
      "label": "Post-event ejection fraction (%)",
      "min": 10,
      "max": 80,
      "required": false
    },
    {
      "id": "complications",
      "type": "multiselect",
      "label": "Any complications?",
      "options": ["Heart failure", "Arrhythmia", "Cardiogenic shock", "None"],
      "required": true
    },
    {
      "id": "full_recovery",
      "type": "select",
      "label": "Made full recovery?",
      "options": ["Yes", "Mostly", "Partial", "No"],
      "required": true
    }
  ]
}'::jsonb),
('stroke', 'Stroke / TIA', 'cardiovascular', 8, 3, '{
  "questions": [
    {
      "id": "type",
      "type": "select",
      "label": "Type of event",
      "options": ["Ischemic Stroke", "Hemorrhagic Stroke", "TIA (Mini-Stroke)"],
      "required": true
    },
    {
      "id": "date_of_event",
      "type": "date",
      "label": "Date of event",
      "required": true
    },
    {
      "id": "number_of_events",
      "type": "select",
      "label": "Number of strokes/TIAs",
      "options": ["1", "2", "3 or more"],
      "required": true
    },
    {
      "id": "residual_effects",
      "type": "multiselect",
      "label": "Residual effects",
      "options": ["Speech difficulty", "Paralysis/weakness", "Vision problems", "Cognitive changes", "None"],
      "required": true
    },
    {
      "id": "cause_identified",
      "type": "select",
      "label": "Was a cause identified?",
      "options": ["AFib", "Carotid artery disease", "Blood clot", "Aneurysm", "Unknown", "Other"],
      "required": true
    },
    {
      "id": "on_blood_thinners",
      "type": "select",
      "label": "Currently on blood thinners?",
      "options": ["Yes", "No"],
      "required": true
    }
  ]
}'::jsonb),
('high_blood_pressure', 'High Blood Pressure (Hypertension)', 'cardiovascular', 3, 5, '{
  "questions": [
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date first diagnosed",
      "required": true
    },
    {
      "id": "current_reading",
      "type": "text",
      "label": "Most recent BP reading (e.g., 130/85)",
      "required": true
    },
    {
      "id": "controlled",
      "type": "select",
      "label": "Is it well controlled?",
      "options": ["Yes, consistently normal", "Mostly controlled", "Sometimes elevated", "Poorly controlled"],
      "required": true
    },
    {
      "id": "medication_count",
      "type": "select",
      "label": "Number of BP medications",
      "options": ["0 (diet/lifestyle only)", "1", "2", "3 or more"],
      "required": true
    },
    {
      "id": "complications",
      "type": "multiselect",
      "label": "Any complications from high BP?",
      "options": ["Heart disease", "Kidney problems", "Eye problems", "None"],
      "required": true
    }
  ]
}'::jsonb),
('diabetes', 'Diabetes', 'metabolic', 6, 10, '{
  "questions": [
    {
      "id": "type",
      "type": "select",
      "label": "Type of diabetes",
      "options": ["Type 1", "Type 2", "Gestational (during pregnancy)", "Pre-diabetes"],
      "required": true
    },
    {
      "id": "diagnosis_age",
      "type": "number",
      "label": "Age at diagnosis",
      "min": 0,
      "max": 120,
      "required": true
    },
    {
      "id": "a1c_level",
      "type": "number",
      "label": "Most recent A1C level",
      "min": 4,
      "max": 15,
      "step": 0.1,
      "required": true
    },
    {
      "id": "treatment",
      "type": "select",
      "label": "Current treatment",
      "options": ["Diet and exercise only", "Oral medication only", "Insulin only", "Oral medication + Insulin", "Insulin pump"],
      "required": true
    },
    {
      "id": "complications",
      "type": "multiselect",
      "label": "Any complications?",
      "options": ["Retinopathy (eye)", "Neuropathy (nerve)", "Nephropathy (kidney)", "Amputation", "Heart disease", "None"],
      "required": true
    },
    {
      "id": "monitoring",
      "type": "select",
      "label": "How often do you monitor blood sugar?",
      "options": ["Multiple times daily", "Once daily", "Weekly", "Only at doctor visits"],
      "required": true
    }
  ]
}'::jsonb),
('cancer', 'Cancer (any type)', 'cancer', 9, 20, '{
  "questions": [
    {
      "id": "cancer_type",
      "type": "select",
      "label": "Type of cancer",
      "options": ["Breast", "Prostate", "Lung", "Colon/Colorectal", "Skin (Melanoma)", "Skin (Non-Melanoma)", "Thyroid", "Bladder", "Kidney", "Lymphoma", "Leukemia", "Pancreatic", "Brain", "Other"],
      "required": true
    },
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date of diagnosis",
      "required": true
    },
    {
      "id": "stage_at_diagnosis",
      "type": "select",
      "label": "Stage at diagnosis",
      "options": ["Stage 0 (in situ)", "Stage I", "Stage II", "Stage III", "Stage IV", "Unknown"],
      "required": true
    },
    {
      "id": "treatment",
      "type": "multiselect",
      "label": "Treatment received",
      "options": ["Surgery", "Chemotherapy", "Radiation", "Immunotherapy", "Hormone therapy", "Watchful waiting", "Other"],
      "required": true
    },
    {
      "id": "current_status",
      "type": "select",
      "label": "Current status",
      "options": ["In remission - no evidence of disease", "In treatment", "Stable/chronic", "Recurrence"],
      "required": true
    },
    {
      "id": "remission_date",
      "type": "date",
      "label": "Date entered remission (if applicable)",
      "required": false
    },
    {
      "id": "follow_up",
      "type": "select",
      "label": "Current follow-up schedule",
      "options": ["Every 3 months", "Every 6 months", "Annually", "No longer requires follow-up", "Still in treatment"],
      "required": true
    }
  ]
}'::jsonb),
('copd', 'COPD / Emphysema', 'respiratory', 6, 30, '{
  "questions": [
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date of diagnosis",
      "required": true
    },
    {
      "id": "severity",
      "type": "select",
      "label": "Severity (GOLD stage if known)",
      "options": ["Mild", "Moderate", "Severe", "Very Severe", "Unknown"],
      "required": true
    },
    {
      "id": "oxygen_use",
      "type": "select",
      "label": "Do you use supplemental oxygen?",
      "options": ["No", "Yes, occasionally", "Yes, at night only", "Yes, continuously"],
      "required": true
    },
    {
      "id": "hospitalizations",
      "type": "select",
      "label": "Hospitalizations in past 2 years for COPD",
      "options": ["0", "1", "2", "3 or more"],
      "required": true
    },
    {
      "id": "smoking_status",
      "type": "select",
      "label": "Current smoking status",
      "options": ["Never smoked", "Former smoker", "Current smoker"],
      "required": true
    },
    {
      "id": "inhalers",
      "type": "select",
      "label": "Number of inhaler medications",
      "options": ["0", "1", "2", "3 or more"],
      "required": true
    }
  ]
}'::jsonb),
('depression', 'Depression', 'mental_health', 4, 40, '{
  "questions": [
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date first diagnosed",
      "required": true
    },
    {
      "id": "severity",
      "type": "select",
      "label": "Current severity",
      "options": ["Mild", "Moderate", "Severe", "In remission"],
      "required": true
    },
    {
      "id": "treatment",
      "type": "multiselect",
      "label": "Current treatment",
      "options": ["Antidepressant medication", "Therapy/Counseling", "Both medication and therapy", "No current treatment"],
      "required": true
    },
    {
      "id": "hospitalizations",
      "type": "select",
      "label": "Ever hospitalized for depression?",
      "options": ["No", "Yes, once", "Yes, more than once"],
      "required": true
    },
    {
      "id": "suicide_attempt",
      "type": "select",
      "label": "Any history of suicide attempt?",
      "options": ["No", "Yes"],
      "required": true
    },
    {
      "id": "work_impact",
      "type": "select",
      "label": "Has depression affected your work?",
      "options": ["No", "Yes, reduced hours", "Yes, disability leave", "Yes, unable to work"],
      "required": true
    }
  ]
}'::jsonb),
('anxiety', 'Anxiety Disorder', 'mental_health', 3, 41, '{
  "questions": [
    {
      "id": "type",
      "type": "select",
      "label": "Type of anxiety disorder",
      "options": ["Generalized Anxiety (GAD)", "Panic Disorder", "Social Anxiety", "PTSD", "OCD", "Other/Unspecified"],
      "required": true
    },
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date first diagnosed",
      "required": true
    },
    {
      "id": "severity",
      "type": "select",
      "label": "Current severity",
      "options": ["Mild", "Moderate", "Severe", "In remission"],
      "required": true
    },
    {
      "id": "treatment",
      "type": "multiselect",
      "label": "Current treatment",
      "options": ["Anti-anxiety medication (benzodiazepine)", "Antidepressant (SSRI/SNRI)", "Therapy/Counseling", "No treatment"],
      "required": true
    },
    {
      "id": "panic_attacks",
      "type": "select",
      "label": "Frequency of panic attacks (if applicable)",
      "options": ["Never", "Rarely (few per year)", "Monthly", "Weekly", "Daily"],
      "required": false
    },
    {
      "id": "hospitalizations",
      "type": "select",
      "label": "Ever hospitalized for anxiety?",
      "options": ["No", "Yes"],
      "required": true
    }
  ]
}'::jsonb),
('bipolar', 'Bipolar Disorder', 'mental_health', 6, 42, '{
  "questions": [
    {
      "id": "type",
      "type": "select",
      "label": "Type of bipolar disorder",
      "options": ["Bipolar I", "Bipolar II", "Cyclothymic", "Unspecified"],
      "required": true
    },
    {
      "id": "diagnosis_date",
      "type": "date",
      "label": "Date first diagnosed",
      "required": true
    },
    {
      "id": "current_state",
      "type": "select",
      "label": "Current state",
      "options": ["Stable/Controlled", "Manic episode", "Depressive episode", "Mixed episode", "Hypomanic"],
      "required": true
    },
    {
      "id": "medications",
      "type": "multiselect",
      "label": "Current medications",
      "options": ["Mood stabilizer (Lithium)", "Anticonvulsant", "Antipsychotic", "Antidepressant", "None"],
      "required": true
    },
    {
      "id": "hospitalizations",
      "type": "select",
      "label": "Psychiatric hospitalizations ever",
      "options": ["0", "1", "2", "3 or more"],
      "required": true
    },
    {
      "id": "compliance",
      "type": "select",
      "label": "Medication compliance",
      "options": ["Always compliant", "Mostly compliant", "Sometimes miss doses", "Often non-compliant"],
      "required": true
    }
  ]
}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  risk_weight = EXCLUDED.risk_weight,
  sort_order = EXCLUDED.sort_order,
  follow_up_schema = EXCLUDED.follow_up_schema,
  updated_at = now();
