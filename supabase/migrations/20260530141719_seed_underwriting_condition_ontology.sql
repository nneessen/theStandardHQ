-- Phase 1.1 — Seed the underwriting condition ontology.
--
-- WHY THIS SHAPE (load-bearing — do not "improve" without reading):
-- The ONLY thing that makes a condition assessable end-to-end is that the
-- intake responses flow cleanly through `conditionResponseTransformer.ts`
-- (imported by the edge engine at engine.ts:5, so it survives the wizard
-- deletion) and then `buildFactMap` (ruleEvaluator.ts), which keys facts as
-- `${condition_code}.${transformedFieldId}`.
--
-- Therefore each question `id` below is a field the TRANSFORMER READS (its
-- INPUT), and `select`/`multiselect` option strings match the transformer's
-- lookup maps EXACTLY. The transformer DERIVES the fact names rules reference
-- (e.g. diabetes `treatment:"Oral medication only"` -> fact
-- `diabetes.insulin_use=false`; `diagnosis_age` -> `years_since_diagnosis`;
-- heart_attack `date_of_event` -> `years_since_event`). NEVER collect a derived
-- fact directly — the transformer ignores it and the fact goes silently
-- undefined, abstaining everything.
--
-- SCOPE (honest): these are the ~11 conditions the engine can actually
-- transform today, NOT the plan's nominal 80–150. This deliberately avoids
-- seeding 100+ medically-unreviewed follow-up schemas; breadth is added later
-- alongside transformers/rules. `atrial_fibrillation` has NO transformer, so it
-- is PASS-THROUGH: its question ids ARE the fact names and rule predicates must
-- match the raw option values verbatim (e.g. `atrial_fibrillation.rate_controlled = "Yes"`).
--
-- acceptance_key_fields / knockout_category / risk_weight are left NULL — no
-- business logic reads them (verified); only `code`, `name`, `category`, and
-- `follow_up_schema` are consumed today.
--
-- Idempotent: ON CONFLICT (code) DO UPDATE (code is uniquely indexed).

INSERT INTO underwriting_health_conditions
  (code, name, category, follow_up_schema, follow_up_schema_version, is_active, sort_order)
VALUES
-- ── Metabolic ───────────────────────────────────────────────────────────────
(
  'diabetes', 'Diabetes', 'metabolic',
  '{"questions":[
    {"id":"type","type":"select","label":"Type of diabetes","options":["Type 1","Type 2","Gestational","Pre-diabetes"]},
    {"id":"treatment","type":"select","label":"Current treatment","options":["Diet and exercise only","Oral medication only","Oral medication + Insulin","Insulin only","Insulin pump","No medication"]},
    {"id":"a1c_level","type":"number","label":"Most recent A1C (%)","min":4,"max":20,"step":0.1},
    {"id":"diagnosis_age","type":"number","label":"Age at diagnosis","min":0,"max":100},
    {"id":"complications","type":"multiselect","label":"Complications","options":["Retinopathy (eye)","Neuropathy (nerve)","Nephropathy (kidney)","Amputation","Heart disease","None"]}
  ]}'::jsonb,
  1, true, 10
),
-- ── Cardiovascular ────────────────────────────────────────────────────────────
(
  'heart_attack', 'Heart Attack (Myocardial Infarction)', 'cardiovascular',
  '{"questions":[
    {"id":"date_of_event","type":"date","label":"Date of most recent heart attack"},
    {"id":"number_of_events","type":"select","label":"Number of heart attacks","options":["1","2","3 or more"]},
    {"id":"treatment","type":"multiselect","label":"Treatment received","options":["Angioplasty/Stent","Bypass Surgery (CABG)","Medication only"]},
    {"id":"ejection_fraction_post","type":"number","label":"Ejection fraction after event (%)","min":10,"max":80},
    {"id":"complications","type":"multiselect","label":"Complications","options":["Heart failure","Arrhythmia","Cardiogenic shock","None"]},
    {"id":"full_recovery","type":"select","label":"Recovery status","options":["Yes","Mostly","Partial","No"]}
  ]}'::jsonb,
  1, true, 20
),
(
  'heart_disease', 'Heart Disease (non-MI)', 'cardiovascular',
  '{"questions":[
    {"id":"type","type":"select","label":"Type of heart disease","options":["Coronary artery disease","Heart failure","Valve disease","Cardiomyopathy","Arrhythmia","Other"]},
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"procedures","type":"multiselect","label":"Procedures","options":["Angioplasty/Stent","Bypass Surgery (CABG)","Valve Replacement","Pacemaker","Defibrillator (ICD)","None"]},
    {"id":"ejection_fraction","type":"number","label":"Ejection fraction (%)","min":10,"max":80},
    {"id":"symptoms_controlled","type":"select","label":"Symptom control","options":["Yes, fully controlled","Mostly controlled","Partially controlled","Not controlled"]},
    {"id":"medications","type":"multiselect","label":"Medications","options":["Beta Blocker","ACE Inhibitor/ARB","Statin","Blood Thinner","Diuretic","Nitrate","Other","None"]}
  ]}'::jsonb,
  1, true, 30
),
(
  'atrial_fibrillation', 'Atrial Fibrillation (AFib)', 'cardiovascular',
  '{"questions":[
    {"id":"type","type":"select","label":"Type of AFib","options":["Paroxysmal","Persistent","Permanent","Unknown"]},
    {"id":"date_of_diagnosis","type":"date","label":"Date of diagnosis"},
    {"id":"rate_controlled","type":"select","label":"Rate/rhythm controlled?","options":["Yes","No"]},
    {"id":"anticoagulated","type":"select","label":"On anticoagulation (blood thinner)?","options":["Yes","No"]},
    {"id":"other_heart_disease","type":"select","label":"Other heart disease present?","options":["Yes","No"]}
  ]}'::jsonb,
  1, true, 40
),
(
  'high_blood_pressure', 'High Blood Pressure (Hypertension)', 'cardiovascular',
  '{"questions":[
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"current_reading","type":"text","label":"Most recent reading (e.g. 130/85)"},
    {"id":"controlled","type":"select","label":"Control status","options":["Yes, consistently normal","Mostly controlled","Poorly controlled"]},
    {"id":"medication_count","type":"select","label":"Number of BP medications","options":["0 (diet/lifestyle only)","1","2","3 or more"]},
    {"id":"complications","type":"multiselect","label":"Complications","options":["Heart disease","Kidney problems","Eye problems","None"]}
  ]}'::jsonb,
  1, true, 50
),
-- ── Neurological ──────────────────────────────────────────────────────────────
(
  'stroke', 'Stroke / TIA', 'neurological',
  '{"questions":[
    {"id":"type","type":"select","label":"Type","options":["Ischemic","Hemorrhagic","TIA (mini-stroke)"]},
    {"id":"date_of_event","type":"date","label":"Date of most recent event"},
    {"id":"number_of_events","type":"select","label":"Number of events","options":["1","2","3 or more"]},
    {"id":"residual_effects","type":"multiselect","label":"Residual effects","options":["Speech difficulty","Paralysis/weakness","Vision problems","Cognitive changes","None"]},
    {"id":"cause_identified","type":"select","label":"Identified cause","options":["Atrial fibrillation (AFib)","High blood pressure","Carotid artery disease","Unknown","Other"]},
    {"id":"on_blood_thinners","type":"select","label":"On blood thinners?","options":["Yes","No"]}
  ]}'::jsonb,
  1, true, 60
),
-- ── Cancer ────────────────────────────────────────────────────────────────────
(
  'cancer', 'Cancer', 'cancer',
  '{"questions":[
    {"id":"cancer_type","type":"text","label":"Type of cancer"},
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"stage_at_diagnosis","type":"select","label":"Stage at diagnosis","options":["Stage 0 (in situ)","Stage I","Stage II","Stage III","Stage IV"]},
    {"id":"treatment","type":"multiselect","label":"Treatment","options":["Surgery","Chemotherapy","Radiation","Immunotherapy","Watchful waiting"]},
    {"id":"current_status","type":"select","label":"Current status","options":["In remission","No evidence of disease","In treatment","Recurrence","Stable"]},
    {"id":"remission_date","type":"date","label":"Date of remission (if applicable)"}
  ]}'::jsonb,
  1, true, 70
),
-- ── Respiratory ───────────────────────────────────────────────────────────────
(
  'copd', 'COPD / Emphysema', 'respiratory',
  '{"questions":[
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"severity","type":"select","label":"Severity","options":["Mild","Moderate","Severe","Very severe"]},
    {"id":"oxygen_use","type":"select","label":"Supplemental oxygen","options":["No","Nighttime only","Continuously"]},
    {"id":"hospitalizations","type":"select","label":"Hospitalizations (past 2 years)","options":["0","1","2","3 or more"]},
    {"id":"smoking_status","type":"select","label":"Smoking status","options":["Current smoker","Former smoker","Never smoked"]},
    {"id":"inhalers","type":"select","label":"Number of inhalers/medications","options":["0","1","2","3 or more"]}
  ]}'::jsonb,
  1, true, 80
),
-- ── Mental health ─────────────────────────────────────────────────────────────
(
  'depression', 'Depression', 'mental_health',
  '{"questions":[
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"severity","type":"select","label":"Severity","options":["Mild","Moderate","Severe","In remission"]},
    {"id":"treatment","type":"multiselect","label":"Treatment","options":["Medication","Therapy/counseling","No current treatment"]},
    {"id":"hospitalizations","type":"select","label":"Psychiatric hospitalizations","options":["No","Once","More than once"]},
    {"id":"suicide_attempt","type":"select","label":"History of suicide attempt?","options":["Yes","No"]},
    {"id":"work_impact","type":"select","label":"Impact on work","options":["No impact","Some impact","On disability / unable to work"]}
  ]}'::jsonb,
  1, true, 90
),
(
  'anxiety', 'Anxiety Disorder', 'mental_health',
  '{"questions":[
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"severity","type":"select","label":"Severity","options":["Mild","Moderate","Severe","In remission"]},
    {"id":"treatment","type":"multiselect","label":"Treatment","options":["Medication","Therapy/counseling","No current treatment"]},
    {"id":"hospitalizations","type":"select","label":"Psychiatric hospitalizations","options":["No","Once","More than once"]},
    {"id":"type","type":"select","label":"Type","options":["Generalized (GAD)","Panic disorder","PTSD","OCD","Social anxiety"]},
    {"id":"panic_attacks","type":"select","label":"Panic attack frequency","options":["Never","Monthly","Weekly","Daily"]}
  ]}'::jsonb,
  1, true, 100
),
(
  'bipolar', 'Bipolar Disorder', 'mental_health',
  '{"questions":[
    {"id":"diagnosis_date","type":"date","label":"Date of diagnosis"},
    {"id":"severity","type":"select","label":"Severity","options":["Mild","Moderate","Severe","In remission"]},
    {"id":"treatment","type":"multiselect","label":"Treatment","options":["Medication","Therapy/counseling","No current treatment"]},
    {"id":"hospitalizations","type":"select","label":"Psychiatric hospitalizations","options":["No","Once","More than once"]},
    {"id":"type","type":"select","label":"Type","options":["Bipolar I","Bipolar II"]},
    {"id":"current_state","type":"select","label":"Current state","options":["Stable","Manic episode","Depressive episode","Mixed episode"]},
    {"id":"medications","type":"multiselect","label":"Medications","options":["Lithium","Antipsychotic","Mood stabilizer","Other"]},
    {"id":"compliance","type":"select","label":"Treatment compliance","options":["Always compliant","Mostly compliant","Often non-compliant"]}
  ]}'::jsonb,
  1, true, 110
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  follow_up_schema = EXCLUDED.follow_up_schema,
  follow_up_schema_version = EXCLUDED.follow_up_schema_version,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
