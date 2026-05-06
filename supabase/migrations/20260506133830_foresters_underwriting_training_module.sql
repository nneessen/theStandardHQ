-- ============================================================================
-- Foresters Underwriting Mastery — Training Module (Phase B Pilot)
-- ============================================================================
-- Source: Foresters Underwriting Guide, document 506305 US (05/25), 22 pages
-- Products covered: Your Term, Strong Foundation, Advantage Plus II, SMART UL
--
-- This migration creates the FIRST carrier-specific training module that is
-- 100% grounded in real underwriting guide content. Future migrations will
-- extend this pattern for the other 24 UW guides.
--
-- Module structure:
--   - 8 content lessons (rich_text + 1 script prompt)
--   - 4 quiz lessons with ~22 multiple-choice questions
--   - 1 carrier-specific badge
--   - 1 certification
--   - Linked to Foresters Financial carrier_id: acca122f-4261-46d9-9287-da47b8ba5e37
-- ============================================================================

-- Constants used throughout:
--   imo_id      = ffffffff-ffff-ffff-ffff-ffffffffffff (The Standard)
--   created_by  = d0d3edea-af6d-4990-80b8-1765ba829896 (Nick @ thestandardhq)
--   module_id   = f0000001-0001-4000-8000-000000000001

-- ============================================================================
-- 1. MODULE
-- ============================================================================

INSERT INTO training_modules (
  id, imo_id, title, description, category, difficulty_level,
  estimated_duration_minutes, xp_reward, is_published, is_active,
  version, created_by, tags, metadata
)
VALUES (
  'f0000001-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Foresters Underwriting Mastery',
  'Master Foresters Financial underwriting for Your Term, Strong Foundation, Advantage Plus II, and SMART UL. Learn the build charts, preferred criteria, non-medical limits, and the impairment guide so you can pre-qualify clients on the first call. Grounded in the official 2025 producer underwriting guide.',
  'carrier_training',
  'intermediate',
  140,
  1500,
  TRUE,
  TRUE,
  1,
  'd0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['foresters','underwriting','term','iul','whole_life','carrier_training']::text[],
  jsonb_build_object(
    'carrier_id','acca122f-4261-46d9-9287-da47b8ba5e37',
    'carrier_name','Foresters Financial',
    'source_document','506305 US (05/25)',
    'products', ARRAY['Your Term','Strong Foundation','Advantage Plus II','SMART UL']
  )
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  xp_reward = EXCLUDED.xp_reward,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ============================================================================
-- 2. LESSONS
-- ============================================================================

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES
  ('f1000001-0001-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','The Foresters Approach',                'Why field underwriting is the producer''s #1 job, and the 3 things you can never do.', 0, 'content', 50, TRUE, 10),
  ('f1000001-0002-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Insurance Classes & Tobacco Rules',      'The 6 classes, the tobacco lookback windows, and the cigar exception.',                  1, 'content', 50, TRUE, 12),
  ('f1000001-0003-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Quiz: Insurance Classes',                'Lock in tobacco rules, class definitions, and the cigar exception.',                     2, 'quiz',    75, TRUE, 8),
  ('f1000001-0004-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Build Charts — Adult & Juvenile',        'Master the height/weight tables. Pre-qualify on the first call so you don''t waste pulls.', 3, 'content', 75, TRUE, 15),
  ('f1000001-0005-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Quiz: Build Charts',                     'Real height/weight scenarios. Can you eyeball Preferred vs Standard?',                   4, 'quiz',    75, TRUE, 8),
  ('f1000001-0006-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Preferred Criteria Deep Dive',           'Cholesterol, BP, family history, driving record — the thresholds that separate Standard from Preferred Plus.', 5, 'content', 75, TRUE, 15),
  ('f1000001-0007-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Non-Medical vs Fully Underwritten',      'When to go Non-Medical, when to go Fully Underwritten, and the Accelerated Underwriting shortcut.', 6, 'content', 50, TRUE, 12),
  ('f1000001-0008-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Quiz: Non-Medical Limits',               'Test your face-amount-by-age recall.',                                                   7, 'quiz',    75, TRUE, 8),
  ('f1000001-0009-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','The Impairment Guide',                   'Accept, Decline, Individual Consideration. The medical conditions that make or break a case.', 8, 'content', 100, TRUE, 20),
  ('f1000001-0010-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Pre-Qualifying Scripts & TIA',           'The 5 questions to ask before you submit. Plus the Temporary Insurance Agreement playbook.', 9, 'content', 75, TRUE, 10),
  ('f1000001-0011-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Field Underwriting Best Practices',     'Ordering requirements, vendors (APPS / ExamOne), and the Risk Assessment Line.',          10, 'content', 50, TRUE, 8),
  ('f1000001-0012-4000-8000-000000000001','f0000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: Foresters Mastery',         'Comprehensive certification quiz. 70% to pass.',                                          11, 'quiz',    150, TRUE, 15)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  xp_reward = EXCLUDED.xp_reward,
  updated_at = now();

-- ============================================================================
-- 3. LESSON CONTENT — rich_text blocks
-- ============================================================================

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES
  -- Lesson 1: The Foresters Approach
  ('f2000001-0001-4000-8000-000000000001','f1000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'Field Underwriting is YOUR Job',
    E'<p>Foresters Financial is a fraternal benefit society founded in 1874 — it is owned by its members, not shareholders. That shapes how they underwrite: they want clean, well-documented cases over volume.</p><p><strong>Your role as the producer:</strong> The Underwriting Team only sees what you submit. They cannot read your client''s mind. Every "Yes" answer in the application that comes with no detail equals a phone call back to you, an APS request, and a 2-week delay.</p><p><strong>The single biggest lever you control:</strong> the level of detail you provide upfront. Date of first diagnosis, treatment, medications, physician contact info. Get it once, send it once, get the case issued.</p>'),
  ('f2000001-0001-4000-8000-000000000002','f1000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'The 3 Things You Must Never Do',
    E'<p><strong>1. Never alter or correct the application without all parties initialing.</strong> If your client signs and you change a date, a city, or a medical answer afterward, the underwriter will catch it via MIB or pharmacy data and your case is dead.</p><p><strong>2. Never use a stamped or shared email signature on e-Apps.</strong> Each signer must use their own unique email address that nobody else accesses. This is a fraud control — Foresters voids cases where signatures cross-contaminate.</p><p><strong>3. Never promise coverage.</strong> Only the Underwriter makes the final call. Your job is to set the expectation that the application gets reviewed, not to pre-approve. Saying "you''ll definitely get Preferred" sets you up to lose the client when reality lands at Standard Plus.</p>'),
  ('f2000001-0001-4000-8000-000000000003','f1000001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'The Risk Assessment Line — Use It',
    E'<p>Foresters operates a Risk Assessment Line: <strong>1-877-622-4249, option 2</strong>.</p><p>Call BEFORE you submit if your client has:</p><ul><li>Multiple DUIs</li><li>Foreign travel/residency outside North America</li><li>An impairment combo (e.g. diabetes + heart disease)</li><li>Edge-case build (close to Standard / Standard Plus line)</li></ul><p>A 10-minute call saves you 14 days of back-and-forth. Use it.</p>'),

  -- Lesson 2: Insurance Classes & Tobacco Rules
  ('f2000001-0002-4000-8000-000000000001','f1000001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'The 6 Insurance Classes',
    E'<p>Foresters fully-underwritten products have <strong>6 classes</strong>, not 4. Knowing them is the difference between quoting accurately and embarrassing yourself on a delivery call.</p><ol><li><strong>Preferred Plus Non-Tobacco</strong> — best rates, hardest to qualify (5-yr clean tobacco lookback)</li><li><strong>Preferred Non-Tobacco</strong> — 3-yr lookback, slightly relaxed health criteria</li><li><strong>Standard Plus Non-Tobacco</strong> — 1-yr lookback</li><li><strong>Standard Non-Tobacco</strong> — 1-yr lookback, no preferred criteria required</li><li><strong>Tobacco Plus</strong> — uses tobacco BUT meets all Preferred Plus health criteria (≤ 1 pack/day)</li><li><strong>Standard Tobacco</strong> — uses tobacco, no preferred criteria met</li></ol><p><strong>Plus a 7th: Substandard</strong> — extra premium or exclusions for ratable conditions.</p>'),
  ('f2000001-0002-4000-8000-000000000002','f1000001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'The Tobacco Rules Differ by Product',
    E'<p>This trips up new agents constantly. Tobacco rules are NOT the same across all Foresters products:</p><p><strong>Strong Foundation Non-Medical Non-Tobacco:</strong></p><ul><li>"No cigarettes within the past 12 months"</li><li>Cigar, pipe, chew, vape, marijuana, nicotine patches all OK</li></ul><p><strong>SMART UL, Your Term, Advantage Plus II Non-Medical Non-Tobacco:</strong></p><ul><li>"No tobacco OR nicotine product within the past 12 months"</li><li>Marijuana OK, but vape pens (nicotine OR non-nicotine) DECLINE</li></ul><p><strong>Practical takeaway:</strong> if your prospect uses a vape pen, Strong Foundation is your only non-medical option. Cigar smoker who cleans up urinalysis? Standard rates available on the medical products.</p>'),
  ('f2000001-0002-4000-8000-000000000003','f1000001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'The Cigar Exception',
    E'<p>For fully underwritten medical products, cigar use can qualify for non-smoker rates (Standard, Standard Plus, Preferred) IF:</p><ul><li>The use is admitted upfront on the application</li><li>Urinalysis is negative for nicotine</li><li>Use is limited to 1 cigar per month, max 12 cigars per year</li></ul><p><strong>Cigar use is NOT available for Preferred Plus rates.</strong> If your client is a 1-cigar-per-month person and you''re shopping Preferred Plus, you''re wasting your time. Aim for Preferred or Standard Plus and disclose it upfront.</p>'),

  -- Lesson 4: Build Charts
  ('f2000001-0004-4000-8000-000000000001','f1000001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'Why Build Matters',
    E'<p>An overweight individual has measurably higher mortality risk from cardiovascular disease, renal disease, diabetes, and joint stress. Foresters has FOUR adult build charts (16+) to match the four classes:</p><ul><li>Preferred Plus / Preferred Smoker</li><li>Preferred (Non-Tobacco)</li><li>Standard Plus</li><li>Standard</li></ul><p><strong>Plus a separate Non-Medical Underwriting build chart</strong> with both minimum AND maximum weights — used only when applying for non-medical products.</p>'),
  ('f2000001-0004-4000-8000-000000000002','f1000001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'Adult Build Reference (Fully Underwritten Maximum Weights)',
    E'<table><thead><tr><th>Height</th><th>Pref+ / Pref Smoker</th><th>Preferred</th><th>Standard Plus</th><th>Standard</th></tr></thead><tbody><tr><td>5''2"</td><td>152</td><td>162</td><td>180</td><td>199</td></tr><tr><td>5''6"</td><td>170</td><td>182</td><td>200</td><td>226</td></tr><tr><td>5''10"</td><td>190</td><td>205</td><td>222</td><td>254</td></tr><tr><td>6''0"</td><td>202</td><td>220</td><td>234</td><td>269</td></tr><tr><td>6''2"</td><td>211</td><td>230</td><td>247</td><td>284</td></tr></tbody></table><p><em>Always reference the full chart in the producer guide — these are illustrative only.</em></p>'),
  ('f2000001-0004-4000-8000-000000000003','f1000001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'Weight Loss Credit',
    E'<p>This rule moves cases:</p><ul><li><strong>Stable for 12+ months at the new weight:</strong> full credit, use the new weight on the build chart.</li><li><strong>Less than 12 months stable:</strong> half credit only — add HALF the lost weight back before referencing the chart.</li><li><strong>Loss due to illness or unknown reason:</strong> likely DECLINE.</li></ul><p><strong>Example:</strong> Female, 5''7", lost 36 lbs in 2 months from 231 → 195 lbs. Half credit: add back 18 lbs → underwriter uses 213 lbs to reference the chart. At 5''7", that''s Standard ($213 < $233 max) but not Standard Plus ($213 > $205 max).</p><p><strong>Coaching point:</strong> if your client just had bariatric surgery, recommend they wait 12 months before applying for life insurance — they''ll qualify at a much better class.</p>'),

  -- Lesson 6: Preferred Criteria Deep Dive
  ('f2000001-0006-4000-8000-000000000001','f1000001-0006-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'Cholesterol & Blood Pressure Thresholds',
    E'<p><strong>Cholesterol (untreated):</strong></p><ul><li>Preferred Plus Non-Tobacco: < 220</li><li>Preferred Non-Tobacco: < 230</li><li>Standard Plus Non-Tobacco: < 260</li><li>Tobacco Plus: < 220</li></ul><p><strong>Cholesterol/HDL Ratio:</strong></p><ul><li>Preferred Plus: < 4.5</li><li>Preferred: < 5.0</li><li>Standard Plus: < 6.5</li></ul><p><strong>Blood Pressure:</strong></p><ul><li>Preferred Plus: < 135/80</li><li>Preferred: < 140/90</li><li>Standard Plus: < 140/90</li></ul><p><strong>Critical:</strong> all of these are "with NO history of treatment or medication." If your client is on a statin or BP med, even with great labs, the BEST they can hit is Standard Plus.</p>'),
  ('f2000001-0006-4000-8000-000000000002','f1000001-0006-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'Family History — The Silent Killer of Preferred Plus',
    E'<p>This is where most "should-be-preferred" cases drop a class. Foresters looks at:</p><ul><li><strong>Preferred Plus Non-Tobacco:</strong> NO death of a parent before age 65 due to CAD, CVD, or Cancer</li><li><strong>Preferred Non-Tobacco:</strong> Same — no death of a parent before age 65</li><li><strong>Standard Plus Non-Tobacco:</strong> No death of a parent before age <strong>60</strong> — slightly relaxed</li></ul><p><strong>Your Term has stricter family history:</strong> "no death OR diagnosis of a parent OR sibling" — diagnosis counts, not just death.</p><p><strong>Practical:</strong> ask early. "Are both your parents still living? If not, what age and what cause?" If dad died of a heart attack at 58, your client is capped at Standard Plus on Your Term and Preferred on the medical products.</p>'),
  ('f2000001-0006-4000-8000-000000000003','f1000001-0006-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'Driving Record & Avocations',
    E'<p><strong>DUI / DWI / Reckless Driving:</strong> 0 in the past 5 years for ALL non-tobacco classes.</p><p><strong>Moving Violations:</strong></p><ul><li>Preferred Plus / Tobacco Plus (Advantage/SMART UL): < 3 within 5 years</li><li>Preferred / Standard Plus: < 3 within 3 years</li><li>Your Term Preferred Plus: < 2 within 5 years (stricter)</li></ul><p><strong>Avocations that disqualify Preferred:</strong> hazardous sports — scuba diving (depth-dependent), motorized racing, hang-gliding/skydiving, mountain/rock climbing.</p><p><strong>Aviation:</strong> private pilot or crew = no Preferred. Commercial pilots are excepted.</p>'),

  -- Lesson 7: Non-Medical vs Fully Underwritten
  ('f2000001-0007-4000-8000-000000000001','f1000001-0007-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'Non-Medical Issue Limits by Product',
    E'<p><strong>Strong Foundation:</strong></p><ul><li>Age 18-55: $500,000 standard / $300,000 substandard</li><li>Age 56-80: $250,000 standard / $150,000 substandard</li></ul><p><strong>Your Term:</strong></p><ul><li>Age 18-55: $400,000</li><li>Age 56-80: $150,000</li></ul><p><strong>SMART UL & Advantage Plus II:</strong></p><ul><li>Age 0-15: $150,000</li><li>Age 16-55: $400,000</li><li>Age 56-75: $150,000</li></ul><p><strong>Translation:</strong> if your 45-year-old client wants $750k of coverage, you cannot do it non-medical on any product. They need full underwriting (paramedical exam, blood/urine, possibly EKG).</p>'),
  ('f2000001-0007-4000-8000-000000000002','f1000001-0007-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'How Non-Medical Underwriting Works',
    E'<p>Non-medical underwriting requires answers to Lifestyle Questions, Part 1: Medical Questions, and Other Insurance — but no exam.</p><p>Behind the scenes Foresters runs:</p><ul><li><strong>Pharmacy + medical data check via Milliman</strong> — past prescriptions, labs, treatments</li><li><strong>Credit attributes-based insurance score</strong> — different from FICO, governed by FCRA, correlates to mortality risk</li><li><strong>MIB check</strong> — Medical Information Bureau cross-reference</li></ul><p><strong>If they don''t qualify for non-medical, the application is DECLINED.</strong> In some cases a fresh fully-underwritten application is required. So if you suspect any complications, just go fully underwritten from the start.</p>'),
  ('f2000001-0007-4000-8000-000000000003','f1000001-0007-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'Accelerated Underwriting — The Healthy Client Shortcut',
    E'<p>For healthy clients, Accelerated Underwriting skips lab tests, medical exams, medical records, and tele-med interviews.</p><p><strong>Eligibility:</strong></p><ul><li>Issue ages 18 to 55</li><li>Face amounts $100,000 to $1,000,000</li><li>Available on Your Term, SMART UL, Advantage Plus II</li><li>Must request acceleration in the producer section of the application</li><li><strong>DO NOT order age & amount requirements</strong> — defeats the purpose</li></ul><p><strong>Use it on:</strong> healthy 30-year-old, $500k Your Term, no impairments. Issue in days, not weeks.</p>'),

  -- Lesson 9: The Impairment Guide
  ('f2000001-0009-4000-8000-000000000001','f1000001-0009-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'The Decline No-Go List',
    E'<p>Memorize these. If your prospect has any of these, do NOT submit a non-medical application — go fully underwritten or call the Risk Assessment Line first:</p><ul><li>HIV positive</li><li>Aneurysm (any kind)</li><li>Heart disease — heart attack, MI, CAD, angina, bypass, angioplasty, valve disease/surgery, pacemaker</li><li>Stroke / CVA / TIA</li><li>Type 1 Diabetes (any age, any duration) — except Strong Foundation Individual Consideration</li><li>COPD on oxygen or steroids</li><li>Chronic kidney disease (other than stones)</li><li>Cancer (most types — basal cell skin cancer is OK; >10 yr remission is OK)</li><li>Cirrhosis of liver, Hepatitis B or C</li><li>Severe depression, bi-polar, schizophrenia</li><li>ALS, MS, Muscular Dystrophy, Parkinson''s, Alzheimer''s/Dementia</li><li>Wheelchair use due to chronic illness</li><li>Down''s Syndrome, Cystic Fibrosis, Cerebral Palsy, Spina Bifida</li><li>ADL assistance required</li></ul>'),
  ('f2000001-0009-4000-8000-000000000002','f1000001-0009-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'Conditions That ACCEPT (with caveats)',
    E'<p>These are MORE common than you think. Don''t turn away clients before checking:</p><ul><li><strong>Asthma (mild/moderate):</strong> ages 3+ accept, severe/hospitalization decline</li><li><strong>Controlled high blood pressure:</strong> accept</li><li><strong>Type 2 Diabetes (non-insulin, good control, age 30+):</strong> accept on Advantage/Term/SMART UL</li><li><strong>Mild depression/anxiety, age 25+, onset 1+ year ago, no hospitalization:</strong> accept</li><li><strong>Sleep apnea, treated and controlled:</strong> accept</li><li><strong>Iron-deficiency anemia:</strong> accept</li><li><strong>Osteoarthritis:</strong> accept</li><li><strong>Mild rheumatoid arthritis with no limitations:</strong> accept (Humira/Enbrel/Prednisone = decline)</li><li><strong>Diverticulitis/diverticulosis, gallbladder, gastritis, gout, GERD:</strong> accept</li><li><strong>Marijuana up to 6 days/week:</strong> accept (daily = individual consideration)</li><li><strong>Crohn''s in remission 5+ years:</strong> accept</li><li><strong>Cancer in full remission 10+ years:</strong> accept</li></ul>'),
  ('f2000001-0009-4000-8000-000000000003','f1000001-0009-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'Combination Killers',
    E'<p>Some impairments are individually fine, but in combination they auto-decline:</p><ul><li><strong>Chronic kidney disease + high blood pressure</strong></li><li><strong>Depression/anxiety + alcohol abuse</strong></li><li><strong>Diabetes + Coronary Artery Disease (CAD), Cardiovascular Disease (CVD), or kidney disease</strong></li></ul><p><strong>Wait periods that pause your case:</strong></p><ul><li>Cancer (any): minimum 1 year post-treatment</li><li>Coronary Artery Disease (heart attack, bypass, angioplasty, angina): minimum 6 months</li><li>Any uninvestigated symptoms — until investigation is complete</li></ul><p>If you''re selling within these waiting periods, the case will be POSTPONED with a reconsideration date. Set client expectations accordingly.</p>'),

  -- Lesson 10: Pre-Qualifying Scripts & TIA
  ('f2000001-0010-4000-8000-000000000001','f1000001-0010-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'The Temporary Insurance Agreement (TIA)',
    E'<p>The TIA gives the proposed insured coverage during the underwriting process. Critical to know cold:</p><ul><li><strong>Eligibility:</strong> 15 days old, not yet 71st birthday</li><li><strong>Maximum face for TIA eligibility:</strong> $1,000,000</li><li><strong>Maximum payout if claim during TIA:</strong> the LESSER of face amount applied for OR $500,000</li><li><strong>Trigger:</strong> answer "No" truthfully to all 3 TIA questions AND pay first month''s premium</li></ul><p><strong>Sales angle:</strong> "We can have temporary protection in place today for your family — up to $500,000 — while we wait for the medical exam to clear. The first month''s premium activates it."</p>'),
  ('f2000001-0010-4000-8000-000000000002','f1000001-0010-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','script_prompt', 1, 'Foresters Pre-Qualifying Script',
    NULL),

  -- Lesson 11: Field Underwriting Best Practices
  ('f2000001-0011-4000-8000-000000000001','f1000001-0011-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 0, 'Approved Vendors for Medical Requirements',
    E'<p><strong>APPS:</strong> appslive.com, or call 1-800-727-2101 for state contact info.</p><p><strong>ExamOne:</strong> examone.com, or call 1-800-768-2058 for servicing office in your area.</p><p><strong>Critical:</strong> when ordering, always SELECT FORESTERS as the company so the completed results route to them. Wrong company = your client sits in limbo.</p>'),
  ('f2000001-0011-4000-8000-000000000002','f1000001-0011-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 1, 'When to Submit Questionnaires',
    E'<p>Foresters has specific questionnaires for almost every "Yes" answer. Submit them upfront if your client has:</p><ul><li>Military service / current military</li><li>Drug or substance use (including marijuana)</li><li>Aviation (pilot, crew)</li><li>Diabetes</li><li>Heart Murmur or Irregular Heartbeat</li><li>Chest Pain</li><li>Tumor, Cyst, or Cancer</li><li>Respiratory issues</li><li>Mental Health</li><li>Foreign Travel (>12 weeks planned)</li></ul><p><strong>Why this matters:</strong> if you don''t submit the questionnaire, the underwriter requests it, your case stalls 3-7 days, and your client''s confidence in you drops. Submit clean.</p>'),
  ('f2000001-0011-4000-8000-000000000003','f1000001-0011-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text', 2, 'Inspection Reports & Age 75+',
    E'<p>For applicants <strong>age 75 and above</strong>, an Activities of Daily Living Questionnaire (ADLQ) is REQUIRED with the application. Don''t forget — it triggers an automatic APS at submission anyway.</p><p>For high face amounts ($2M+) at any age, Inspection Reports are ordered automatically by Foresters — you don''t need to do anything.</p><p>For additional insurance applications within 12 months of an existing policy, age & amount requirements are based on the TOTAL insurance in-force AND applied for with all companies (not just Foresters).</p>')
ON CONFLICT (id) DO UPDATE SET
  rich_text_content = EXCLUDED.rich_text_content,
  title = EXCLUDED.title,
  updated_at = now();

-- Insert the script prompt separately because it has different fields
UPDATE training_lesson_content
SET script_prompt_text = E'Before I prepare your application, I need to ask 5 quick health questions so I can match you with the right Foresters product on the first try:\n\n1) Have you used any tobacco or nicotine product — including vape pens — in the past 12 months? In the past 3 years? In the past 5 years?\n\n2) Are you currently on any medication for blood pressure or cholesterol? When was the last reading you remember?\n\n3) Are both your parents living? If not, what age did they pass and what cause?\n\n4) Any DUI, DWI, or reckless driving in the past 5 years? Any moving violations in the past 3 years?\n\n5) Any medical conditions you''re currently being treated for? Any hospitalization in the past 5 years? Any prescriptions?\n\n[Listen carefully. Note every "Yes" — these answers determine whether to submit Non-Medical, Fully Underwritten, or call the Risk Assessment Line first.]',
    script_prompt_instructions = 'Use this BEFORE submitting any Foresters application. Five minutes of pre-qualification saves 14 days of back-and-forth with the underwriter and prevents the embarrassment of telling your client they were rated when you quoted Preferred. The 3-class tobacco lookback (1yr / 3yr / 5yr) is the single highest-leverage question — knowing exactly when they last used nicotine determines their best rate class.'
WHERE id = 'f2000001-0010-4000-8000-000000000002';

-- ============================================================================
-- 4. QUIZZES (4: classes, build, non-medical, final exam)
-- ============================================================================

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect)
VALUES
  ('f3000001-0003-4000-8000-000000000001','f1000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, FALSE, FALSE, TRUE,  8, 50),
  ('f3000001-0005-4000-8000-000000000001','f1000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, FALSE, FALSE, TRUE,  8, 50),
  ('f3000001-0008-4000-8000-000000000001','f1000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, FALSE, FALSE, TRUE,  8, 50),
  ('f3000001-0012-4000-8000-000000000001','f1000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff', 80, 2, TRUE,  TRUE,  TRUE, 15, 200)
ON CONFLICT (id) DO UPDATE SET
  pass_threshold = EXCLUDED.pass_threshold,
  time_limit_minutes = EXCLUDED.time_limit_minutes,
  updated_at = now();

-- ============================================================================
-- 5. QUIZ QUESTIONS + OPTIONS
-- ============================================================================

-- ----- QUIZ 1: Insurance Classes (5 questions) -----
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('f4000001-0003-4000-8000-000000000001','f3000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client says he quit cigarettes 4 years ago. He''s 100% healthy. What is the BEST tobacco class he can hit on Your Term?', 0, 1, 'Preferred Non-Tobacco requires no nicotine for 3 years. Preferred Plus requires 5 years. At 4 years out, he''s in the Preferred but not Preferred Plus window.'),
  ('f4000001-0003-4000-8000-000000000002','f3000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','A 50-year-old client uses a non-nicotine vape pen. Which non-medical product can you submit?', 1, 1, 'Strong Foundation Non-Medical Non-Tobacco only excludes cigarette use. SMART UL, Your Term, and Advantage Plus II all decline ALL vape pen use (nicotine OR non-nicotine) for non-tobacco rates.'),
  ('f4000001-0003-4000-8000-000000000003','f3000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client smokes 1 cigar per month and is otherwise perfectly healthy. What rate class is unavailable to her on the medical products?', 2, 1, 'Cigar use up to 1/month with negative urinalysis qualifies for Standard, Standard Plus, and Preferred non-tobacco rates — but NEVER Preferred Plus.'),
  ('f4000001-0003-4000-8000-000000000004','f3000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Tobacco Plus is available to clients who use tobacco AND meet which criteria?', 3, 1, 'Tobacco Plus is for tobacco users (≤ 1 pack/day) who would otherwise meet ALL Preferred Plus health criteria. It''s a "you''re healthy except for the tobacco" class.'),
  ('f4000001-0003-4000-8000-000000000005','f3000001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','How many official insurance classes does Foresters have for fully underwritten products (excluding Substandard)?', 4, 1, 'There are 6 classes: Preferred Plus NT, Preferred NT, Standard Plus NT, Standard NT, Tobacco Plus, and Standard Tobacco. Substandard is a 7th rated category.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  -- Q1
  ('f5000001-0003-0001-8000-000000000001','f4000001-0003-4000-8000-000000000001','Preferred Plus Non-Tobacco', FALSE, 0),
  ('f5000001-0003-0001-8000-000000000002','f4000001-0003-4000-8000-000000000001','Preferred Non-Tobacco',      TRUE,  1),
  ('f5000001-0003-0001-8000-000000000003','f4000001-0003-4000-8000-000000000001','Standard Plus Non-Tobacco',  FALSE, 2),
  ('f5000001-0003-0001-8000-000000000004','f4000001-0003-4000-8000-000000000001','Standard Non-Tobacco',       FALSE, 3),
  -- Q2
  ('f5000001-0003-0002-8000-000000000001','f4000001-0003-4000-8000-000000000002','Strong Foundation only',                              TRUE,  0),
  ('f5000001-0003-0002-8000-000000000002','f4000001-0003-4000-8000-000000000002','Your Term and SMART UL',                              FALSE, 1),
  ('f5000001-0003-0002-8000-000000000003','f4000001-0003-4000-8000-000000000002','Advantage Plus II only',                              FALSE, 2),
  ('f5000001-0003-0002-8000-000000000004','f4000001-0003-4000-8000-000000000002','All Foresters non-medical products',                   FALSE, 3),
  -- Q3
  ('f5000001-0003-0003-8000-000000000001','f4000001-0003-4000-8000-000000000003','Standard',          FALSE, 0),
  ('f5000001-0003-0003-8000-000000000002','f4000001-0003-4000-8000-000000000003','Standard Plus',     FALSE, 1),
  ('f5000001-0003-0003-8000-000000000003','f4000001-0003-4000-8000-000000000003','Preferred',         FALSE, 2),
  ('f5000001-0003-0003-8000-000000000004','f4000001-0003-4000-8000-000000000003','Preferred Plus',    TRUE,  3),
  -- Q4
  ('f5000001-0003-0004-8000-000000000001','f4000001-0003-4000-8000-000000000004','All Preferred Plus health criteria, ≤ 1 pack/day', TRUE,  0),
  ('f5000001-0003-0004-8000-000000000002','f4000001-0003-4000-8000-000000000004','5+ years cigarette-free',                          FALSE, 1),
  ('f5000001-0003-0004-8000-000000000003','f4000001-0003-4000-8000-000000000004','Cholesterol < 220 only',                           FALSE, 2),
  ('f5000001-0003-0004-8000-000000000004','f4000001-0003-4000-8000-000000000004','BP < 135/80 only',                                 FALSE, 3),
  -- Q5
  ('f5000001-0003-0005-8000-000000000001','f4000001-0003-4000-8000-000000000005','4', FALSE, 0),
  ('f5000001-0003-0005-8000-000000000002','f4000001-0003-4000-8000-000000000005','5', FALSE, 1),
  ('f5000001-0003-0005-8000-000000000003','f4000001-0003-4000-8000-000000000005','6', TRUE,  2),
  ('f5000001-0003-0005-8000-000000000004','f4000001-0003-4000-8000-000000000005','7', FALSE, 3)
ON CONFLICT (id) DO NOTHING;

-- ----- QUIZ 2: Build Charts (5 questions) -----
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('f4000001-0005-4000-8000-000000000001','f3000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Female client, 5''10", lost 30 lbs in 4 months and is now 200 lbs. What weight does the underwriter use to reference the build chart?', 0, 1, 'Less than 12 months stable = HALF credit. Add back 15 lbs (half of 30 lost) to her current 200 lbs = 215 lbs. At 5''10", that puts her in Standard Plus territory ($222 max), but NOT Preferred Plus ($190 max).'),
  ('f4000001-0005-4000-8000-000000000002','f3000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Male, 6''0", 240 lbs, fully underwritten — what is the BEST class he can hit based on build alone?', 1, 1, 'At 6''0", Standard max is 269 lbs. Standard Plus max is 234 lbs. He''s at 240 — over Standard Plus, but under Standard. So Standard Non-Tobacco is the best class his build allows.'),
  ('f4000001-0005-4000-8000-000000000003','f3000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','For Non-Medical Underwriting at 5''6", what is the maximum weight allowed?', 2, 1, 'Per the Non-Medical build chart, 5''6" maxes out at 263 lbs (assumes no other ratable impairments).'),
  ('f4000001-0005-4000-8000-000000000004','f3000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','When does an applicant get FULL weight-loss credit?', 3, 1, 'Full credit requires the new weight to be stable for 12+ months. Less = 50% credit. Loss due to illness = likely decline.'),
  ('f4000001-0005-4000-8000-000000000005','f3000001-0005-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','For ages 0-2, what does the Juvenile Build Chart use to evaluate?', 4, 1, 'For ages 0-2 the chart uses LENGTH and WEIGHT ranges. From age 3-15 it switches to BMI ranges (with min/max heights and weights also considered).')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  -- Q1
  ('f5000001-0005-0001-8000-000000000001','f4000001-0005-4000-8000-000000000001','200 lbs (use current weight)',                FALSE, 0),
  ('f5000001-0005-0001-8000-000000000002','f4000001-0005-4000-8000-000000000001','215 lbs (half credit, add 15 back)',          TRUE,  1),
  ('f5000001-0005-0001-8000-000000000003','f4000001-0005-4000-8000-000000000001','230 lbs (no credit, use original)',           FALSE, 2),
  ('f5000001-0005-0001-8000-000000000004','f4000001-0005-4000-8000-000000000001','185 lbs (assume future weight loss)',         FALSE, 3),
  -- Q2
  ('f5000001-0005-0002-8000-000000000001','f4000001-0005-4000-8000-000000000002','Preferred Plus',  FALSE, 0),
  ('f5000001-0005-0002-8000-000000000002','f4000001-0005-4000-8000-000000000002','Preferred',       FALSE, 1),
  ('f5000001-0005-0002-8000-000000000003','f4000001-0005-4000-8000-000000000002','Standard Plus',   FALSE, 2),
  ('f5000001-0005-0002-8000-000000000004','f4000001-0005-4000-8000-000000000002','Standard',        TRUE,  3),
  -- Q3
  ('f5000001-0005-0003-8000-000000000001','f4000001-0005-4000-8000-000000000003','226 lbs', FALSE, 0),
  ('f5000001-0005-0003-8000-000000000002','f4000001-0005-4000-8000-000000000003','263 lbs', TRUE,  1),
  ('f5000001-0005-0003-8000-000000000003','f4000001-0005-4000-8000-000000000003','280 lbs', FALSE, 2),
  ('f5000001-0005-0003-8000-000000000004','f4000001-0005-4000-8000-000000000003','300 lbs', FALSE, 3),
  -- Q4
  ('f5000001-0005-0004-8000-000000000001','f4000001-0005-4000-8000-000000000004','Stable for 6 months', FALSE, 0),
  ('f5000001-0005-0004-8000-000000000002','f4000001-0005-4000-8000-000000000004','Stable for 12 months', TRUE,  1),
  ('f5000001-0005-0004-8000-000000000003','f4000001-0005-4000-8000-000000000004','Loss exceeds 50 lbs',  FALSE, 2),
  ('f5000001-0005-0004-8000-000000000004','f4000001-0005-4000-8000-000000000004','Doctor-supervised loss', FALSE, 3),
  -- Q5
  ('f5000001-0005-0005-8000-000000000001','f4000001-0005-4000-8000-000000000005','BMI only',                          FALSE, 0),
  ('f5000001-0005-0005-8000-000000000002','f4000001-0005-4000-8000-000000000005','Length and weight ranges',          TRUE,  1),
  ('f5000001-0005-0005-8000-000000000003','f4000001-0005-4000-8000-000000000005','Adult build chart',                 FALSE, 2),
  ('f5000001-0005-0005-8000-000000000004','f4000001-0005-4000-8000-000000000005','Parent height/weight',              FALSE, 3)
ON CONFLICT (id) DO NOTHING;

-- ----- QUIZ 3: Non-Medical Limits (5 questions) -----
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('f4000001-0008-4000-8000-000000000001','f3000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','45-year-old client wants $750,000 of life insurance. Which path do you take?', 0, 1, 'Non-medical max for SMART UL/Your Term/Advantage Plus II at age 16-55 is $400k; Strong Foundation is $500k. $750k requires fully underwritten with paramedical exam.'),
  ('f4000001-0008-4000-8000-000000000002','f3000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','What is the maximum standard non-medical face amount for Strong Foundation at age 30?', 1, 1, 'Strong Foundation NM standard limit ages 18-55 is $500,000. Substandard drops to $300,000.'),
  ('f4000001-0008-4000-8000-000000000003','f3000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Accelerated Underwriting is available for which age range and face amount?', 2, 1, 'Issue ages 18 to 55, face amounts $100,000 to $1,000,000, on Your Term, SMART UL, and Advantage Plus II only. Must request acceleration in the producer section.'),
  ('f4000001-0008-4000-8000-000000000004','f3000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','If a client doesn''t qualify for non-medical rates, what happens to the application?', 3, 1, 'The application is DECLINED. In some cases a brand new fully-underwritten application is required — Foresters does NOT auto-roll a non-medical to fully underwritten.'),
  ('f4000001-0008-4000-8000-000000000005','f3000001-0008-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','For Accelerated Underwriting, which action should you NOT take?', 4, 1, 'Ordering age and amount requirements (paramedical, blood, etc.) DEFEATS the purpose of Accelerated Underwriting. Just request acceleration in the producer section and submit clean.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  -- Q1
  ('f5000001-0008-0001-8000-000000000001','f4000001-0008-4000-8000-000000000001','Submit Strong Foundation non-medical for $750k',           FALSE, 0),
  ('f5000001-0008-0001-8000-000000000002','f4000001-0008-4000-8000-000000000001','Submit Your Term non-medical for $750k',                    FALSE, 1),
  ('f5000001-0008-0001-8000-000000000003','f4000001-0008-4000-8000-000000000001','Submit fully underwritten with paramedical exam + bloods',  TRUE,  2),
  ('f5000001-0008-0001-8000-000000000004','f4000001-0008-4000-8000-000000000001','Split the case across 2 carriers',                          FALSE, 3),
  -- Q2
  ('f5000001-0008-0002-8000-000000000001','f4000001-0008-4000-8000-000000000002','$250,000', FALSE, 0),
  ('f5000001-0008-0002-8000-000000000002','f4000001-0008-4000-8000-000000000002','$400,000', FALSE, 1),
  ('f5000001-0008-0002-8000-000000000003','f4000001-0008-4000-8000-000000000002','$500,000', TRUE,  2),
  ('f5000001-0008-0002-8000-000000000004','f4000001-0008-4000-8000-000000000002','$1,000,000', FALSE, 3),
  -- Q3
  ('f5000001-0008-0003-8000-000000000001','f4000001-0008-4000-8000-000000000003','Ages 18-55, $100k-$1M',  TRUE,  0),
  ('f5000001-0008-0003-8000-000000000002','f4000001-0008-4000-8000-000000000003','Ages 18-65, $50k-$500k',  FALSE, 1),
  ('f5000001-0008-0003-8000-000000000003','f4000001-0008-4000-8000-000000000003','Ages 25-50, $250k-$2M',  FALSE, 2),
  ('f5000001-0008-0003-8000-000000000004','f4000001-0008-4000-8000-000000000003','All ages, any face amount', FALSE, 3),
  -- Q4
  ('f5000001-0008-0004-8000-000000000001','f4000001-0008-4000-8000-000000000004','Auto-rolled to fully underwritten',  FALSE, 0),
  ('f5000001-0008-0004-8000-000000000002','f4000001-0008-4000-8000-000000000004','Declined; new fully-underwritten app may be required', TRUE,  1),
  ('f5000001-0008-0004-8000-000000000003','f4000001-0008-4000-8000-000000000004','Issued at substandard rates',         FALSE, 2),
  ('f5000001-0008-0004-8000-000000000004','f4000001-0008-4000-8000-000000000004','Held until client appeals',           FALSE, 3),
  -- Q5
  ('f5000001-0008-0005-8000-000000000001','f4000001-0008-4000-8000-000000000005','Request acceleration in producer section', FALSE, 0),
  ('f5000001-0008-0005-8000-000000000002','f4000001-0008-4000-8000-000000000005','Order age and amount requirements',         TRUE,  1),
  ('f5000001-0008-0005-8000-000000000003','f4000001-0008-4000-8000-000000000005','Submit complete medical history details',   FALSE, 2),
  ('f5000001-0008-0005-8000-000000000004','f4000001-0008-4000-8000-000000000005','Choose Your Term, SMART UL, or Advantage Plus II', FALSE, 3)
ON CONFLICT (id) DO NOTHING;

-- ----- QUIZ 4: Final Exam (8 questions, mixed difficulty) -----
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('f4000001-0012-4000-8000-000000000001','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client''s father died of a heart attack at age 58. Your client is otherwise perfect on Your Term. What''s the BEST class available?', 0, 2, 'Your Term Preferred Plus + Preferred both require no parent death before age 65 from CAD/CVD/Cancer. With dad''s heart attack at 58, the best class is Standard Plus (allows death before age 60 = decline; age 60-65 cap means Standard Plus is the ceiling).'),
  ('f4000001-0012-4000-8000-000000000002','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','What is the maximum payout under a TIA?', 1, 2, 'TIA pays the LESSER of the face amount applied for OR $500,000. So a $1M application has TIA coverage capped at $500k.'),
  ('f4000001-0012-4000-8000-000000000003','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Type 2 diabetic, age 35, treated with metformin only, good control, non-smoker, no complications. Can he get Advantage Plus II?', 2, 2, 'Yes. Foresters accepts Type 2 diabetes (non-insulin, good control, no complications) on Advantage Plus II / Your Term / SMART UL when current age is 30+. He needs to be referenced against the Diabetes Ratings Worksheet for final class.'),
  ('f4000001-0012-4000-8000-000000000004','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Which combination is an automatic decline?', 3, 2, 'Diabetes + CAD/CVD/kidney disease is a known auto-decline combination. The other options listed are insurable individually.'),
  ('f4000001-0012-4000-8000-000000000005','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','How long must an applicant wait after a heart attack before being considered?', 4, 1, 'Coronary Artery Disease (heart attack, bypass, angioplasty, angina) requires a minimum 6-month wait period before reconsideration.'),
  ('f4000001-0012-4000-8000-000000000006','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','What questionnaire is REQUIRED for applicants age 75 and above?', 5, 1, 'The Activities of Daily Living Questionnaire (ADLQ) is required at submission for ages 75+. An automatic APS is also triggered.'),
  ('f4000001-0012-4000-8000-000000000007','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client uses marijuana 3 days per week recreationally. What is the underwriting decision?', 6, 1, 'Recreational marijuana use up to 6 days per week is ACCEPT. Daily use moves to Individual Consideration. Medical marijuana depends on the underlying reason for use.'),
  ('f4000001-0012-4000-8000-000000000008','f3000001-0012-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','When should you call the Foresters Risk Assessment Line BEFORE submitting?', 7, 2, 'Multiple DUIs, foreign travel/residency outside North America, impairment combinations, and edge-case builds all warrant a pre-submission call. It saves days of back-and-forth.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  -- Final Q1
  ('f5000001-0012-0001-8000-000000000001','f4000001-0012-4000-8000-000000000001','Preferred Plus Non-Tobacco', FALSE, 0),
  ('f5000001-0012-0001-8000-000000000002','f4000001-0012-4000-8000-000000000001','Preferred Non-Tobacco',      FALSE, 1),
  ('f5000001-0012-0001-8000-000000000003','f4000001-0012-4000-8000-000000000001','Standard Plus Non-Tobacco',  TRUE,  2),
  ('f5000001-0012-0001-8000-000000000004','f4000001-0012-4000-8000-000000000001','Substandard',                 FALSE, 3),
  -- Final Q2
  ('f5000001-0012-0002-8000-000000000001','f4000001-0012-4000-8000-000000000002','$250,000',                FALSE, 0),
  ('f5000001-0012-0002-8000-000000000002','f4000001-0012-4000-8000-000000000002','$500,000 max, lesser of face or $500k', TRUE,  1),
  ('f5000001-0012-0002-8000-000000000003','f4000001-0012-4000-8000-000000000002','$1,000,000',              FALSE, 2),
  ('f5000001-0012-0002-8000-000000000004','f4000001-0012-4000-8000-000000000002','Full face amount applied for', FALSE, 3),
  -- Final Q3
  ('f5000001-0012-0003-8000-000000000001','f4000001-0012-4000-8000-000000000003','No, Type 2 diabetes is always declined',           FALSE, 0),
  ('f5000001-0012-0003-8000-000000000002','f4000001-0012-4000-8000-000000000003','Yes, accept based on Diabetes Ratings Worksheet', TRUE,  1),
  ('f5000001-0012-0003-8000-000000000003','f4000001-0012-4000-8000-000000000003','Only if he switches to insulin',                   FALSE, 2),
  ('f5000001-0012-0003-8000-000000000004','f4000001-0012-4000-8000-000000000003','Only on Strong Foundation, never Advantage Plus II', FALSE, 3),
  -- Final Q4
  ('f5000001-0012-0004-8000-000000000001','f4000001-0012-4000-8000-000000000004','Asthma + sleep apnea',                                       FALSE, 0),
  ('f5000001-0012-0004-8000-000000000002','f4000001-0012-4000-8000-000000000004','Diabetes + Coronary Artery Disease',                        TRUE,  1),
  ('f5000001-0012-0004-8000-000000000003','f4000001-0012-4000-8000-000000000004','GERD + iron-deficiency anemia',                              FALSE, 2),
  ('f5000001-0012-0004-8000-000000000004','f4000001-0012-4000-8000-000000000004','Mild osteoarthritis + controlled blood pressure',            FALSE, 3),
  -- Final Q5
  ('f5000001-0012-0005-8000-000000000001','f4000001-0012-4000-8000-000000000005','30 days',  FALSE, 0),
  ('f5000001-0012-0005-8000-000000000002','f4000001-0012-4000-8000-000000000005','3 months', FALSE, 1),
  ('f5000001-0012-0005-8000-000000000003','f4000001-0012-4000-8000-000000000005','6 months', TRUE,  2),
  ('f5000001-0012-0005-8000-000000000004','f4000001-0012-4000-8000-000000000005','2 years',  FALSE, 3),
  -- Final Q6
  ('f5000001-0012-0006-8000-000000000001','f4000001-0012-4000-8000-000000000006','Mental Health Questionnaire',          FALSE, 0),
  ('f5000001-0012-0006-8000-000000000002','f4000001-0012-4000-8000-000000000006','Activities of Daily Living (ADLQ)',     TRUE,  1),
  ('f5000001-0012-0006-8000-000000000003','f4000001-0012-4000-8000-000000000006','Foreign Travel Questionnaire',          FALSE, 2),
  ('f5000001-0012-0006-8000-000000000004','f4000001-0012-4000-8000-000000000006','Personal Financial Questionnaire',      FALSE, 3),
  -- Final Q7
  ('f5000001-0012-0007-8000-000000000001','f4000001-0012-4000-8000-000000000007','Decline — any marijuana use is declined', FALSE, 0),
  ('f5000001-0012-0007-8000-000000000002','f4000001-0012-4000-8000-000000000007','Accept — recreational use up to 6 days/week is fine', TRUE, 1),
  ('f5000001-0012-0007-8000-000000000003','f4000001-0012-4000-8000-000000000007','Individual consideration only',           FALSE, 2),
  ('f5000001-0012-0007-8000-000000000004','f4000001-0012-4000-8000-000000000007','Substandard rating only',                  FALSE, 3),
  -- Final Q8
  ('f5000001-0012-0008-8000-000000000001','f4000001-0012-4000-8000-000000000008','Only when explicitly told to by an underwriter', FALSE, 0),
  ('f5000001-0012-0008-8000-000000000002','f4000001-0012-4000-8000-000000000008','Multiple DUIs, foreign residency, impairment combos, edge-case builds', TRUE, 1),
  ('f5000001-0012-0008-8000-000000000003','f4000001-0012-4000-8000-000000000008','Never — only call after submission',           FALSE, 2),
  ('f5000001-0012-0008-8000-000000000004','f4000001-0012-4000-8000-000000000008','Only for face amounts over $5M',               FALSE, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. CARRIER-SPECIFIC BADGE & CERTIFICATION
-- ============================================================================

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order)
VALUES (
  'bd000007-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Foresters Underwriting Specialist',
  'Awarded for completing the Foresters Underwriting Mastery module. You can pre-qualify clients on the first call.',
  'ShieldCheck',
  '#0ea5e9',
  'mastery',
  '{"type":"module_completed","module_id":"f0000001-0001-4000-8000-000000000001"}'::jsonb,
  1500,
  TRUE,
  70
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active)
VALUES (
  'ce000003-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Foresters Certified Producer',
  'Certifies the agent has mastered Foresters underwriting for Your Term, Strong Foundation, Advantage Plus II, and SMART UL. Demonstrates ability to pre-qualify clients on insurance class, build, preferred criteria, non-medical limits, and the impairment guide.',
  ARRAY['f0000001-0001-4000-8000-000000000001']::uuid[],
  12,
  'bd000007-0001-4000-8000-000000000001',
  2000,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- 7. AUTO-ASSIGN to The Standard agency (matches existing module pattern)
-- ============================================================================

INSERT INTO training_assignments (
  id, module_id, imo_id, agency_id, assigned_by, assigned_to,
  assignment_type, module_version, status, priority, is_mandatory
)
VALUES (
  'a3000001-0001-4000-8000-000000000001',
  'f0000001-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'd0d3edea-af6d-4990-80b8-1765ba829896',
  NULL,
  'agency',
  1,
  'active',
  'high',
  FALSE
)
ON CONFLICT (id) DO NOTHING;
