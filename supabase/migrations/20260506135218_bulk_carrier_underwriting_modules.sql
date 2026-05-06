-- ============================================================================
-- Bulk Carrier Underwriting Training Modules — Phase B (Bulk)
-- ============================================================================
-- Creates 6 new carrier-specific training modules grounded in parsed UW guides:
--   1. Legal & General America (Banner Life "BeyondTerm")
--   2. F&G (Pathsetter & Everlast)
--   3. American Amicable (Term Made Simple)
--   4. ELCO Mutual (Whole Life)
--   5. Kansas City Life (Signature Term Express)
--   6. Transamerica (Trendsetter Super/LB, FFIUL II, FCIUL II)
--
-- Each module structure (slimmer than Foresters pilot):
--   - 1 module record
--   - 4 lessons (3 content + 1 final exam quiz)
--   - 8 rich_text content blocks
--   - 1 quiz with 6 multiple-choice questions × 4 options each
--   - 1 badge (Mastery)
--   - 1 certification (12-month validity)
--   - 1 agency assignment to The Standard
--
-- UUID scheme: eX (X = 1-6 for carrier index)
-- Module = eX000000-0001-, Lessons = eX100001-LLLL-, Content = eX200001-LLLL-NNN
-- Quiz = eX300001-0004-, Q = eX400001-0001-NNN, Opts = eX500001-0001-NNN-8000-OOO
-- Badge = eX600001-0001-, Cert = eX700001-0001-, Assignment = eX800001-0001-
-- ============================================================================

-- Constants:
--   imo_id = ffffffff-ffff-ffff-ffff-ffffffffffff (The Standard)
--   created_by = d0d3edea-af6d-4990-80b8-1765ba829896 (super-admin Nick)
--   agency_id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (The Standard agency)
--
-- Carrier IDs:
--   Legal & General:    0db015b9-defc-4184-b7ca-2063d9ed4caf
--   F&G:                5fcc1244-46ed-4b41-bed1-b3e088433bdd
--   American Amicable:  045536d6-c8bc-4d47-81e3-c3831bdc8826
--   ELCO Mutual:        a04c25c3-edd8-404a-91d8-cd39e5faf2e8
--   Kansas City Life:   beb4739d-6dd3-4b24-9621-8b33dc8b61eb
--   Transamerica:       cf4b8c4d-6332-44c3-8eca-c83f280ebaa0

-- ============================================================================
-- ============================================================================
-- 1. LEGAL & GENERAL — BeyondTerm (e1)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Legal & General BeyondTerm Underwriting',
  'Master Banner Life''s BeyondTerm — the digital-first term product offering instant decisions to ~70% of applicants and 20% APS-free decisions within 24 hours. Learn the build chart, accepted conditions, and decline triggers. No table ratings on this product.',
  'carrier_training','intermediate',75,1000,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['legal-general','banner-life','beyondterm','term','carrier_training']::text[],
  jsonb_build_object('carrier_id','0db015b9-defc-4184-b7ca-2063d9ed4caf','carrier_name','Legal & General America','products',ARRAY['BeyondTerm'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e1100001-0001-4000-8000-000000000001','e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','BeyondTerm Product Basics','What makes BeyondTerm different and which clients fit it.',0,'content',75,TRUE,15),
  ('e1100001-0002-4000-8000-000000000001','e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Build & Class Mastery','The 4-class build chart and weight-loss credit rules.',1,'content',75,TRUE,15),
  ('e1100001-0003-4000-8000-000000000001','e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Accept vs Decline','Conditions BeyondTerm accepts and the auto-decline list.',2,'content',100,TRUE,20),
  ('e1100001-0004-4000-8000-000000000001','e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: BeyondTerm Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e1200001-0001-4000-8000-000000000001','e1100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'What BeyondTerm Is',
   E'<p>BeyondTerm is Banner Life''s digital-first term product, designed for fast turnaround. Their target metrics:</p><ul><li><strong>~70% of applicants get an instant decision</strong> at point of sale</li><li><strong>20% of applicants get APS-free decisions within 24 hours</strong></li></ul><p>That speed comes with one tradeoff you must remember: <strong>BeyondTerm has NO table ratings</strong>. The maximum rate class is Standard. If your client would normally come back at Table B/C/D, BeyondTerm declines them. Use a different carrier for substandard cases.</p>'),
  ('e1200001-0001-4000-8000-000000000002','e1100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'When BeyondTerm Wins',
   E'<p>BeyondTerm wins when your client is:</p><ul><li>Healthy (could realistically hit Standard or better)</li><li>Wants speed — needs coverage in days, not weeks</li><li>Term needs (no permanent products on this platform)</li></ul><p>BeyondTerm is the WRONG carrier when:</p><ul><li>Client has any condition that would table-rate elsewhere (e.g. Crohn''s requiring meds, controlled diabetes age 35, Afib in last 2 years)</li><li>BMI under 18 or over 43</li><li>Multiple DUIs in last 10 years, or any DUI in last 2 years</li></ul>'),
  ('e1200001-0002-4000-8000-000000000001','e1100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'The 4-Class Build Chart',
   E'<p>BeyondTerm uses 4 classes: Preferred Plus, Preferred, Standard Plus, Standard. Build maxes (sample):</p><table><thead><tr><th>Height</th><th>Pref Plus</th><th>Preferred</th><th>Std Plus</th><th>Standard</th></tr></thead><tbody><tr><td>5''6"</td><td>115-174</td><td>175-200</td><td>201-253</td><td>254-266</td></tr><tr><td>5''10"</td><td>129-196</td><td>197-225</td><td>226-285</td><td>286-299</td></tr><tr><td>6''0"</td><td>136-207</td><td>208-239</td><td>240-302</td><td>301-317</td></tr></tbody></table><p>Notice the chart has BOTH min and max — clients below the minimum get declined too (BMI &lt;18 cutoff).</p>'),
  ('e1200001-0002-4000-8000-000000000002','e1100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Weight-Loss Credit',
   E'<p>BeyondTerm''s rule: <strong>HALF of intentional weight loss</strong> over the last 12 months may be added to the current build to determine the final rate class.</p><p><strong>Example from the guide:</strong> A 5''8" client lost 40 pounds over the past year and currently weighs 185. BeyondTerm may underwrite at 205 lbs (185 + half of 40 = 205). At 5''8" that lands in Preferred (186-213 max).</p><p><strong>Coaching:</strong> if your client just had bariatric surgery less than 6 months ago, BeyondTerm declines outright. They may consider after 6 months IF stabilized weight + ½ credit puts them in Standard or better.</p>'),
  ('e1200001-0003-4000-8000-000000000001','e1100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'What BeyondTerm Accepts',
   E'<p>BeyondTerm is more permissive than most simplified-issue products. Common acceptable conditions:</p><ul><li><strong>Asthma</strong> (no ER, no time off work, ≤1 medication, no steroids in past year)</li><li><strong>Atrial Fibrillation</strong> (no occurrence in past 2 years, no procedure other than ablation)</li><li><strong>Sleep Apnea</strong> (compliant with treatment or no treatment required, no oxygen)</li><li><strong>Hypertension</strong> (≤2 meds, no hospitalizations, normal BP last 2 years)</li><li><strong>Hyperlipidemia</strong> treated, with known favorable values</li><li><strong>Diabetes Type 2</strong> (non-insulin, A1c &lt;8, no complications, diagnosed over age 40, &gt;6 months ago and &lt;5 years)</li><li><strong>Mild Multiple Sclerosis</strong> (relapsing/remitting, &lt;3 episodes/year, dx ≥1yr ago, dx age ≤35 or current age ≥61)</li><li><strong>Marijuana</strong> (non-tobacco rates; rate class based on frequency and type)</li></ul>'),
  ('e1200001-0003-4000-8000-000000000002','e1100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'BeyondTerm Auto-Decline List',
   E'<p>If your client has ANY of these, BeyondTerm declines — go fully underwritten with another carrier:</p><ul><li><strong>Cancer</strong> in last 10 years, current treatment, OR history of recurrence/metastasis ever (basal/squamous skin cancer OK)</li><li><strong>Any aneurysm history</strong></li><li><strong>Heart valve replacement, pacemaker, or defibrillator</strong></li><li><strong>Coronary artery disease or angioplasty</strong> ever</li><li><strong>Cardiomyopathy</strong> ever</li><li><strong>Cystic fibrosis</strong> ever</li><li><strong>HIV/AIDS</strong> ever</li><li><strong>Bipolar disorder</strong> any</li><li><strong>Stroke history</strong> (TIA consideration after 4 years)</li><li><strong>BMI &lt;18 or &gt;43</strong></li><li><strong>Polycystic kidney disease, kidney failure, transplant recipient</strong></li><li><strong>Substance abuse in last 10 years</strong> or any history of polysubstance abuse / relapse ever</li><li><strong>DWI/DUI within 2 years</strong> or multiple DUIs in last 10 years</li><li><strong>Felony, currently on probation/parole, outstanding fines, in jail, awaiting trial</strong></li></ul>'),
  ('e1200001-0003-4000-8000-000000000003','e1100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'Beneficiary Rules',
   E'<p>BeyondTerm allows broader beneficiary designations than most carriers. Acceptable beneficiaries include: parent, spouse or ex-spouse, fiancé, domestic partner, child, parent of proposed insured''s child, sibling, niece/nephew, estate.</p><p><strong>Owner</strong> can be: proposed insured, spouse, parent or grandparent (if PI is full-time student and coverage &lt;$100k), or fiancé/domestic partner with shared expenses, children, or like coverage.</p><p><strong>Practical:</strong> if your client wants their unmarried partner as beneficiary, BeyondTerm makes that easy where other carriers require explanation. Use this advantage when relevant.</p>'),
  ('e1200001-0003-4000-8000-000000000004','e1100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',3,'Riders',
   E'<p>BeyondTerm includes Chronic Illness, Critical Illness, and Terminal Illness Accelerated Death Benefit riders automatically on policies effective Dec 11, 2024+. Substandard tabled policies are NOT eligible for the Critical and Chronic Illness riders, but are eligible for the Terminal Illness rider.</p><p>Aviation: Pilots of major airlines flying in US/Canada accepted with an Aviation Exclusion Rider.</p>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e1300001-0004-4000-8000-000000000001','e1100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e1400001-0001-4000-8000-000000000001','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','What is the maximum rate class available on BeyondTerm?',0,1,'BeyondTerm has no table ratings — the maximum rate class is Standard. Risks above Standard are declined.'),
  ('e1400001-0001-4000-8000-000000000002','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','A 5''8" client lost 40 lbs in the past year and weighs 185. What weight does BeyondTerm use for the build chart?',1,1,'Half of intentional weight loss in the last 12 months can be added back. 185 + (40/2 = 20) = 205 lbs.'),
  ('e1400001-0001-4000-8000-000000000003','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client had a single DUI 18 months ago. Can you submit BeyondTerm?',2,1,'DUI within the past 2 years = automatic decline. They must wait until past the 24-month mark.'),
  ('e1400001-0001-4000-8000-000000000004','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Type 2 diabetic, age 45, A1c 7.2, on metformin only, no complications, dx 2 years ago. Acceptable for BeyondTerm?',3,1,'Acceptable. Non-insulin, A1c <8, no complications, dx after age 40, >6 months ago and <5 years.'),
  ('e1400001-0001-4000-8000-000000000005','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','BMI threshold for automatic decline?',4,1,'BMI <18 (underweight) or >43 (overweight) is auto-decline.'),
  ('e1400001-0001-4000-8000-000000000006','e1300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Cancer history — when does BeyondTerm decline?',5,1,'Any cancer in last 10 years, current treatment, or recurrence/metastasis history (ever) = decline. Exception: non-melanoma skin cancers.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1500001-0001-0001-8000-000000000001','e1400001-0001-4000-8000-000000000001','Preferred Plus',FALSE,0),
  ('e1500001-0001-0001-8000-000000000002','e1400001-0001-4000-8000-000000000001','Standard',TRUE,1),
  ('e1500001-0001-0001-8000-000000000003','e1400001-0001-4000-8000-000000000001','Table D (4)',FALSE,2),
  ('e1500001-0001-0001-8000-000000000004','e1400001-0001-4000-8000-000000000001','Table H (8)',FALSE,3),
  ('e1500001-0001-0002-8000-000000000001','e1400001-0001-4000-8000-000000000002','185 lbs',FALSE,0),
  ('e1500001-0001-0002-8000-000000000002','e1400001-0001-4000-8000-000000000002','205 lbs',TRUE,1),
  ('e1500001-0001-0002-8000-000000000003','e1400001-0001-4000-8000-000000000002','225 lbs',FALSE,2),
  ('e1500001-0001-0002-8000-000000000004','e1400001-0001-4000-8000-000000000002','165 lbs',FALSE,3),
  ('e1500001-0001-0003-8000-000000000001','e1400001-0001-4000-8000-000000000003','Yes, single DUI is OK',FALSE,0),
  ('e1500001-0001-0003-8000-000000000002','e1400001-0001-4000-8000-000000000003','No — DUI within 2 years is auto-decline',TRUE,1),
  ('e1500001-0001-0003-8000-000000000003','e1400001-0001-4000-8000-000000000003','Yes, with table rating',FALSE,2),
  ('e1500001-0001-0003-8000-000000000004','e1400001-0001-4000-8000-000000000003','Yes, with Aviation Exclusion Rider',FALSE,3),
  ('e1500001-0001-0004-8000-000000000001','e1400001-0001-4000-8000-000000000004','Yes — meets all BeyondTerm criteria',TRUE,0),
  ('e1500001-0001-0004-8000-000000000002','e1400001-0001-4000-8000-000000000004','No — diagnosed under age 40',FALSE,1),
  ('e1500001-0001-0004-8000-000000000003','e1400001-0001-4000-8000-000000000004','No — Type 2 diabetes is always decline',FALSE,2),
  ('e1500001-0001-0004-8000-000000000004','e1400001-0001-4000-8000-000000000004','Only if A1c is below 6.5',FALSE,3),
  ('e1500001-0001-0005-8000-000000000001','e1400001-0001-4000-8000-000000000005','BMI <20 or >35',FALSE,0),
  ('e1500001-0001-0005-8000-000000000002','e1400001-0001-4000-8000-000000000005','BMI <18 or >43',TRUE,1),
  ('e1500001-0001-0005-8000-000000000003','e1400001-0001-4000-8000-000000000005','BMI <22 or >40',FALSE,2),
  ('e1500001-0001-0005-8000-000000000004','e1400001-0001-4000-8000-000000000005','No BMI cutoff',FALSE,3),
  ('e1500001-0001-0006-8000-000000000001','e1400001-0001-4000-8000-000000000006','Cancer in last 5 years only',FALSE,0),
  ('e1500001-0001-0006-8000-000000000002','e1400001-0001-4000-8000-000000000006','Any cancer in last 10 years, current treatment, or recurrence/metastasis ever',TRUE,1),
  ('e1500001-0001-0006-8000-000000000003','e1400001-0001-4000-8000-000000000006','Only Stage IV cancers decline',FALSE,2),
  ('e1500001-0001-0006-8000-000000000004','e1400001-0001-4000-8000-000000000006','Cancer never causes decline',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e1600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','BeyondTerm Specialist','Mastered Banner Life BeyondTerm — speed wins, no table ratings.','Zap','#0d9488','mastery','{"type":"module_completed","module_id":"e1000000-0001-4000-8000-000000000001"}'::jsonb,1000,TRUE,80)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e1700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Legal & General BeyondTerm Certified','Certifies the agent has mastered Banner Life BeyondTerm underwriting — accept/decline triggers, build chart, weight-loss rules.',ARRAY['e1000000-0001-4000-8000-000000000001']::uuid[],12,'e1600001-0001-4000-8000-000000000001',1500,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e1800001-0001-4000-8000-000000000001','e1000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ============================================================================
-- 2. F&G — Pathsetter & Everlast (e2)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'F&G Pathsetter & Everlast Underwriting',
  'Master Fidelity & Guaranty Life''s Pathsetter (IUL) and Everlast products. Learn the Exam-Free / InstApproval pathways, Express Standard catch-all class, and the gender-distinct build chart. Risk Assessment Line: 800.445.6758 option 2/5.',
  'carrier_training','intermediate',80,1200,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['f&g','fidelity-guaranty','pathsetter','everlast','iul','carrier_training']::text[],
  jsonb_build_object('carrier_id','5fcc1244-46ed-4b41-bed1-b3e088433bdd','carrier_name','F&G','products',ARRAY['F&G Pathsetter','F&G Everlast'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e2100001-0001-4000-8000-000000000001','e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','F&G Underwriting Pathways','Exam-Free, InstApproval, fully underwritten, and Express Standard.',0,'content',75,TRUE,15),
  ('e2100001-0002-4000-8000-000000000001','e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Preferred Criteria & Build','BP, cholesterol, tobacco lookback, and the gender-distinct build chart.',1,'content',75,TRUE,15),
  ('e2100001-0003-4000-8000-000000000001','e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Foreign Nationals & Special Cases','Country categories, visa types, and the cases that need Risk Assessment.',2,'content',100,TRUE,20),
  ('e2100001-0004-4000-8000-000000000001','e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: F&G Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e2200001-0001-4000-8000-000000000001','e2100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Exam-Free Underwriting',
   E'<p>F&G''s Exam-Free program skips paramed exams, blood, and (often) APS. Eligibility:</p><ul><li><strong>Issue ages 0-50:</strong> through $5,000,000 (APS required for ages 0-17 over $1M)</li><li><strong>Issue ages 51-60:</strong> through $3,000,000</li><li><strong>InstApproval available to age 60:</strong> through $1,000,000 applied for + in force with F&G</li><li><strong>Non-US citizens / non-permanent residents:</strong> max Exam-Free face amount is $500,000</li></ul><p><strong>Critical:</strong> if your client is in the Exam-Free zone, do NOT order a paramedical exam — F&G may charge you for unnecessary exam expenses. Just submit clean.</p>'),
  ('e2200001-0001-4000-8000-000000000002','e2100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'InstApproval & Express Standard',
   E'<p><strong>InstApproval</strong> = approval at the time of application via e-App. Available to age 60 up to $1M, considered low-risk in all underwriting categories with no additional risks uncovered in instant database searches.</p><p><strong>Express Standard</strong> is F&G''s catch-all when your client doesn''t qualify for Preferred or Standard but isn''t a decline:</p><ul><li>Used when health condition falls outside standard parameters</li><li>OR for ages 45-60 who haven''t seen a medical professional in the previous 3 years</li><li>Priced higher than Standard but allows F&G to make a fair offer without medical requirements</li></ul>'),
  ('e2200001-0002-4000-8000-000000000001','e2100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'BP & Cholesterol Thresholds',
   E'<p><strong>Blood Pressure (Preferred):</strong></p><ul><li>Ages 18-50: ≤150/90</li><li>Ages 51-65: ≤160/95</li><li>Ages 66+: ≤160/95</li></ul><p><strong>Cholesterol (Preferred):</strong></p><ul><li>Ages 18-50: ≤260</li><li>Ages 51-65: ≤280</li><li>Ages 66+: ≤300</li></ul><p><strong>Cholesterol/HDL Ratio:</strong> Preferred ≤7, Standard ≤8</p><p><strong>Tobacco for Non-Tobacco rates:</strong> No use for 24 months for Preferred, 12 months for Standard. Includes nicotine substitutes, e-cigs, vaping. Cigar exception with full disclosure.</p>'),
  ('e2200001-0002-4000-8000-000000000002','e2100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'F&G Build Chart is Gender-Distinct',
   E'<p>Unlike most carriers, F&G uses separate male/female build charts. Sample at 5''10" (ages 16-50, add 5 lbs ages 51-65, add 10 lbs ages 66+):</p><table><thead><tr><th>Class</th><th>Male Max</th><th>Female Max</th></tr></thead><tbody><tr><td>Preferred</td><td>235</td><td>208</td></tr><tr><td>Standard</td><td>259</td><td>229</td></tr></tbody></table><p>Adult absolute max (Table H 300%) at 5''10" is 324 lbs. Below minimum or above max = decline.</p><p><strong>Driving:</strong> Preferred requires ≤2 moving violations in 3 years, no DUI/DWI in 5 years. Family history: no more than 1 death due to coronary or cancer prior to age 60.</p>'),
  ('e2200001-0003-4000-8000-000000000001','e2100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Country Risk Categories A-E',
   E'<p>F&G categorizes countries by risk: <strong>A (least risky)</strong> through <strong>E (most risky)</strong>. Sample classifications from the guide:</p><ul><li><strong>Category A:</strong> Argentina, Australia, Canada, France, Germany, Italy, Japan, UK, US Virgin Islands, Korea (S)</li><li><strong>Category B:</strong> Brazil, China, Mexico, Hong Kong, India, Trinidad &amp; Tobago, Vietnam</li><li><strong>Category C:</strong> Colombia, Egypt, Guatemala, Indonesia, Philippines, Turkey</li><li><strong>Category D:</strong> Cameroon, Honduras, Madagascar, Pakistan, Rwanda, Vietnam</li><li><strong>Category E (worst):</strong> Afghanistan, Belarus, Iran, Iraq, North Korea, Russia, Syria, Venezuela, Yemen</li></ul><p>Foreign travel to A/B = OK. Travel to C &lt;6 weeks/year = Individual Consideration. Travel to D/E = NOT acceptable.</p>'),
  ('e2200001-0003-4000-8000-000000000002','e2100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Visa Acceptance',
   E'<p><strong>Acceptable visas (US 6+ months):</strong> E1, E2, E3, EB5, H1B, H1C, H4, K3, K4, L1, L2, O1, O3, OPT-F1, P1, P2, P3, P4, TN/TN1.</p><p><strong>Will NOT approve:</strong> A1, A2, A3, G, I, P, R1, R2, S, U1, U2, U3, U4, U5.</p><p><strong>DACA, no VISA, expired VISA:</strong> max $1,000,000 coverage.</p><p><strong>Other documented or undocumented residents (TPS, Humanitarian Parolees, Asylees, Refugees):</strong> acceptable if in US 12+ months.</p>'),
  ('e2200001-0003-4000-8000-000000000003','e2100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'When to Call Risk Assessment',
   E'<p><strong>Risk Assessment Line: 800.445.6758, option 2, option 5</strong> — or RiskAssessment@fglife.com.</p><p>Call BEFORE submitting if your client has:</p><ul><li>Any complex medical history</li><li>Foreign national status with edge-case visa</li><li>High net worth requiring Premium-to-Income justification (income &lt;$15k or premium &gt;guidelines)</li><li>Business insurance over $5M</li><li>Multiple impairments in combination</li></ul><p>The underwriter gives a tentative non-binding risk class — saves you the embarrassment of misquoting your client.</p>'),
  ('e2200001-0003-4000-8000-000000000004','e2100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',3,'Common Decline Triggers',
   E'<p>F&G commonly declines for:</p><ul><li>Use of drugs other than marijuana in last 2 years</li><li>Recurrent cancer (other than basal cell skin)</li><li>Any Stage IV cancers</li><li>Heart disease + diabetes combo</li><li>Heart disease + cerebrovascular/stroke combo</li><li>Awaiting heart, lung, or liver transplant or recipient</li><li>Renal dialysis</li><li>Use of oxygen</li><li>Currently hospitalized or in care facility</li><li>Suicide attempt in last 2 years (or &gt;2 attempts in last 10)</li><li>Driving without a valid license</li></ul>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e2300001-0004-4000-8000-000000000001','e2100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e2400001-0001-4000-8000-000000000001','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Healthy 35-year-old wants $4M F&G Pathsetter. What pathway should you use?',0,1,'Exam-Free Underwriting covers ages 0-50 through $5M. No paramedical needed.'),
  ('e2400001-0001-4000-8000-000000000002','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Non-US citizen client wants $750k Exam-Free. Acceptable?',1,1,'Non-US citizens / non-permanent residents are capped at $500,000 for Exam-Free. $750k requires fully underwritten or a different product.'),
  ('e2400001-0001-4000-8000-000000000003','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','55-year-old client hasn''t seen a doctor in 4 years. What class will F&G likely offer?',2,1,'Express Standard is used for ages 45-60 who haven''t seen a medical professional in 3+ years.'),
  ('e2400001-0001-4000-8000-000000000004','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Tobacco-free lookback for F&G Preferred Non-Tobacco?',3,1,'F&G Preferred requires 24 months (2 years) tobacco-free, including nicotine substitutes, e-cigs, vaping. Standard requires 12 months.'),
  ('e2400001-0001-4000-8000-000000000005','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client travels to Iran for 4 weeks per year. Acceptable for F&G?',4,1,'Iran is Category E (most risky). Travel to D/E countries is NOT acceptable for F&G regardless of duration.'),
  ('e2400001-0001-4000-8000-000000000006','e2300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','How is the F&G build chart structured differently from most carriers?',5,1,'F&G uses gender-distinct build charts (separate Male and Female max weights). Most carriers use a single chart for both genders.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2500001-0001-0001-8000-000000000001','e2400001-0001-4000-8000-000000000001','Order paramed exam + bloods upfront',FALSE,0),
  ('e2500001-0001-0001-8000-000000000002','e2400001-0001-4000-8000-000000000001','Submit Exam-Free — covers ages 0-50 up to $5M',TRUE,1),
  ('e2500001-0001-0001-8000-000000000003','e2400001-0001-4000-8000-000000000001','Skip F&G — they cap at $1M',FALSE,2),
  ('e2500001-0001-0001-8000-000000000004','e2400001-0001-4000-8000-000000000001','Use the Express Standard pathway',FALSE,3),
  ('e2500001-0001-0002-8000-000000000001','e2400001-0001-4000-8000-000000000002','Yes, Exam-Free covers all face amounts',FALSE,0),
  ('e2500001-0001-0002-8000-000000000002','e2400001-0001-4000-8000-000000000002','No — non-US citizens capped at $500k Exam-Free',TRUE,1),
  ('e2500001-0001-0002-8000-000000000003','e2400001-0001-4000-8000-000000000002','Yes, with passport copy attached',FALSE,2),
  ('e2500001-0001-0002-8000-000000000004','e2400001-0001-4000-8000-000000000002','Yes, only with W-8BEN form',FALSE,3),
  ('e2500001-0001-0003-8000-000000000001','e2400001-0001-4000-8000-000000000003','Preferred',FALSE,0),
  ('e2500001-0001-0003-8000-000000000002','e2400001-0001-4000-8000-000000000003','Standard',FALSE,1),
  ('e2500001-0001-0003-8000-000000000003','e2400001-0001-4000-8000-000000000003','Express Standard',TRUE,2),
  ('e2500001-0001-0003-8000-000000000004','e2400001-0001-4000-8000-000000000003','Decline',FALSE,3),
  ('e2500001-0001-0004-8000-000000000001','e2400001-0001-4000-8000-000000000004','12 months',FALSE,0),
  ('e2500001-0001-0004-8000-000000000002','e2400001-0001-4000-8000-000000000004','24 months',TRUE,1),
  ('e2500001-0001-0004-8000-000000000003','e2400001-0001-4000-8000-000000000004','36 months',FALSE,2),
  ('e2500001-0001-0004-8000-000000000004','e2400001-0001-4000-8000-000000000004','60 months',FALSE,3),
  ('e2500001-0001-0005-8000-000000000001','e2400001-0001-4000-8000-000000000005','Yes, under 6 weeks/year is acceptable',FALSE,0),
  ('e2500001-0001-0005-8000-000000000002','e2400001-0001-4000-8000-000000000005','No — Category D/E countries are not acceptable',TRUE,1),
  ('e2500001-0001-0005-8000-000000000003','e2400001-0001-4000-8000-000000000005','Yes, with Aviation rider',FALSE,2),
  ('e2500001-0001-0005-8000-000000000004','e2400001-0001-4000-8000-000000000005','Yes, only if business-related',FALSE,3),
  ('e2500001-0001-0006-8000-000000000001','e2400001-0001-4000-8000-000000000006','By BMI only',FALSE,0),
  ('e2500001-0001-0006-8000-000000000002','e2400001-0001-4000-8000-000000000006','Gender-distinct (separate Male/Female max weights)',TRUE,1),
  ('e2500001-0001-0006-8000-000000000003','e2400001-0001-4000-8000-000000000006','Same as Foresters',FALSE,2),
  ('e2500001-0001-0006-8000-000000000004','e2400001-0001-4000-8000-000000000006','By age and tobacco status only',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e2600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','F&G Pathsetter Pro','Mastered F&G Pathsetter & Everlast underwriting.','Award','#7c3aed','mastery','{"type":"module_completed","module_id":"e2000000-0001-4000-8000-000000000001"}'::jsonb,1200,TRUE,90)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e2700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','F&G Certified Producer','Certifies the agent has mastered F&G Pathsetter & Everlast underwriting.',ARRAY['e2000000-0001-4000-8000-000000000001']::uuid[],12,'e2600001-0001-4000-8000-000000000001',1700,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e2800001-0001-4000-8000-000000000001','e2000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ============================================================================
-- 3. AMERICAN AMICABLE — Term Made Simple (e3)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'American Amicable Term Made Simple',
  'Master American Amicable''s simplified-issue term product. 10/15/20/30 year levels, $50k-$500k face, 3 classes (Preferred NT, Standard NT, Standard T). Accept/reject only — no table ratings. Telephone interview required for 65+.',
  'carrier_training','beginner',60,1000,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['american-amicable','term-made-simple','simplified-issue','carrier_training']::text[],
  jsonb_build_object('carrier_id','045536d6-c8bc-4d47-81e3-c3831bdc8826','carrier_name','American Amicable','products',ARRAY['Term Made Simple'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e3100001-0001-4000-8000-000000000001','e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Product Basics & Issue Limits','Term durations, issue ages, face amount limits, and the 3 classes.',0,'content',75,TRUE,12),
  ('e3100001-0002-4000-8000-000000000001','e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Build Charts & Preferred Criteria','Standard build chart, Preferred build chart, the 8 Preferred questions.',1,'content',75,TRUE,12),
  ('e3100001-0003-4000-8000-000000000001','e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','The Submission Rules That Trip Agents','Third-Party Payor restrictions, replacement watch-list, telephone interview rules.',2,'content',100,TRUE,16),
  ('e3100001-0004-4000-8000-000000000001','e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: Term Made Simple Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e3200001-0001-4000-8000-000000000001','e3100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Term Made Simple Specifications',
   E'<p>Level Term Life to age 95 with 10/15/20/30 year level premium periods.</p><p><strong>Issue Ages:</strong></p><ul><li>10-Year Level: ages 18-75</li><li>15-Year Level: ages 18-70</li><li>20-Year Level: ages 18-65</li><li>30-Year Level: ages 18-55</li></ul><p><strong>Face Amount:</strong> $50,000 minimum (or $20/month premium, whichever is greater) up to $500,000 maximum.</p><p><strong>Premium Bands:</strong> Band 1 ($50k-$249,999), Band 2 ($250k-$500k).</p><p><strong>Policy fee:</strong> $70 annually (fully commissionable).</p>'),
  ('e3200001-0001-4000-8000-000000000002','e3100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'The 3 Classes & Accept/Reject Only',
   E'<p>Term Made Simple has only 3 underwriting classes:</p><ul><li><strong>Preferred Non-Tobacco</strong> (must answer NO to all 8 Preferred questions)</li><li><strong>Standard Non-Tobacco</strong></li><li><strong>Standard Tobacco</strong></li></ul><p><strong>Underwriting is accept/reject — NO table ratings.</strong> Anyone considered above a Table 4 risk is DECLINED. So if your client would normally come back at Table 6 elsewhere, Term Made Simple is wrong for them.</p><p><strong>Telephone interview required:</strong> for ALL proposed insureds ages 65 and above. Can be completed at point-of-sale via MRS (1-855-758-6049, English) or ExamOne (833-587-0376, Spanish).</p>'),
  ('e3200001-0002-4000-8000-000000000001','e3100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Standard Build Chart',
   E'<p>For Standard Non-Tobacco & Standard Tobacco rates, sample max weights:</p><table><thead><tr><th>Height</th><th>Min</th><th>Table 2 Max</th><th>Table 4 Max</th></tr></thead><tbody><tr><td>5''4"</td><td>101</td><td>221</td><td>242</td></tr><tr><td>5''8"</td><td>113</td><td>250</td><td>273</td></tr><tr><td>5''10"</td><td>120</td><td>265</td><td>289</td></tr><tr><td>6''0"</td><td>129</td><td>280</td><td>306</td></tr></tbody></table><p>Below minimum or above Table 4 max = NOT eligible. If client has a medical condition combined with build that exceeds Table 2, they''re NOT eligible either.</p>'),
  ('e3200001-0002-4000-8000-000000000002','e3100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'The 8 Preferred Questions',
   E'<p>To qualify for Preferred Non-Tobacco, the proposed insured must answer NO to ALL 8:</p><ol><li>Tobacco/nicotine use in past 36 months?</li><li>Weight outside the Preferred build chart?</li><li>In past 10 years, taken meds for high BP OR elevated cholesterol?</li><li>In past 10 years, diagnosed/tested/treated for diabetes, cancer, or cardiac disease?</li><li>More than ONE family member (parent or sibling) died before age 60 from breast/colon/intestinal/prostate cancer or cardiovascular disease?</li><li>In past 10 years, treated for alcohol abuse?</li><li>In past 10 years, treated for drug abuse / used non-prescribed drugs?</li><li>In past 5 years, more than 2 moving violations OR any alcohol/drug-related infractions OR convicted of felony/misdemeanor?</li></ol><p>Preferred build chart at 5''10": 126 min, 225 max (vs Standard 120 min, 265 max).</p>'),
  ('e3200001-0003-4000-8000-000000000001','e3100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Third-Party Payor Restrictions',
   E'<p>This trips agents up. American Amicable does NOT accept Term Made Simple applications where a Third-Party Payor is involved AND the proposed insured is age 30 or older. Examples of Third-Party Payors: brothers, sisters, in-laws, parents, grandparents, aunts, uncles, cousins.</p><p><strong>Acceptable payors regardless of age:</strong> spouse, business, business partner.</p><p><strong>Ages 18-29:</strong> a parent CAN pay premiums, but additional UW requirements (including criminal records check) will be ordered, particularly for ages 25-29.</p>'),
  ('e3200001-0003-4000-8000-000000000002','e3100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Replacement Sales Watch-List',
   E'<p>Replacement sales are MONITORED daily. Trends or patterns of improper replacements can result in agent contract termination.</p><p><strong>States that won''t accept replacement sales for Term Made Simple at all:</strong> Kansas, Kentucky.</p><p><strong>Auto-decline conditions on the proposed insured:</strong></p><ul><li>2 policies with any of their companies (American Amicable, Occidental Life NC, Pioneer American) within previous 12 months</li><li>3+ policies in past 5 years that lapsed, were not-taken, surrendered, or cancelled</li></ul><p>This applies regardless of plan type or who the writing agent was.</p>'),
  ('e3200001-0003-4000-8000-000000000003','e3100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'Mobile App Decision Engine',
   E'<p>Term Made Simple supports a Mobile Application with point-of-sale decisions. Possible outcomes:</p><ul><li><strong>Approved as applied for</strong> (Firm Decision)</li><li><strong>Telephone Interview Needed</strong></li><li><strong>Refer to Home Office</strong></li><li><strong>Not Eligible for Coverage</strong></li></ul><p>Use the mobile app for fastest issue. Client signs via stylus, finger, email, voice, or text. Application available at <em>www.insuranceapplication.com</em>.</p>'),
  ('e3200001-0003-4000-8000-000000000004','e3100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',3,'Re-Writes & Re-Applications',
   E'<p>If a SECOND application is written on the same individual within 6 months of the first policy issuing, OR if it increases face to the maximum allowable for that age, MEDICAL RECORDS will be ordered.</p><p>Money orders are NOT accepted as initial premium. Use bank draft, eCheck, or personal check from the proposed insured.</p><p>The Requested Policy Date cannot be more than 30 days out from the application signature date.</p>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e3300001-0004-4000-8000-000000000001','e3100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e3400001-0001-4000-8000-000000000001','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Maximum face amount on Term Made Simple?',0,1,'Maximum is $500,000 across all term durations. Minimum is $50,000 (or $20/month premium, whichever is greater).'),
  ('e3400001-0001-4000-8000-000000000002','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','35-year-old client''s sister wants to pay the premiums. Can you submit?',1,1,'Third-Party Payor restrictions: NOT accepted for proposed insureds age 30+ unless payor is spouse, business, or business partner. Sister doesn''t qualify.'),
  ('e3400001-0001-4000-8000-000000000003','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','67-year-old client wants Term Made Simple. What is required at submission?',2,1,'Telephone interview is required for ALL proposed insureds ages 65 and above. Can be done at point-of-sale via MRS or ExamOne.'),
  ('e3400001-0001-4000-8000-000000000004','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Tobacco-free lookback for Preferred Non-Tobacco?',3,1,'Preferred Non-Tobacco requires NO tobacco/nicotine in past 36 months.'),
  ('e3400001-0001-4000-8000-000000000005','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','What is the maximum age available for the 30-year level term?',4,1,'30-year level term issue ages: 18-55 only. The longer the level period, the lower the max issue age.'),
  ('e3400001-0001-4000-8000-000000000006','e3300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Your client had 3 policies with American Amicable and affiliates lapse in the past 5 years. Can you submit a new Term Made Simple?',5,1,'3+ policies in past 5 years that lapsed/were-not-taken/surrendered/cancelled = AUTO-DECLINE on a new app, regardless of plan or writing agent.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e3500001-0001-0001-8000-000000000001','e3400001-0001-4000-8000-000000000001','$250,000',FALSE,0),
  ('e3500001-0001-0001-8000-000000000002','e3400001-0001-4000-8000-000000000001','$500,000',TRUE,1),
  ('e3500001-0001-0001-8000-000000000003','e3400001-0001-4000-8000-000000000001','$1,000,000',FALSE,2),
  ('e3500001-0001-0001-8000-000000000004','e3400001-0001-4000-8000-000000000001','No maximum',FALSE,3),
  ('e3500001-0001-0002-8000-000000000001','e3400001-0001-4000-8000-000000000002','Yes — sister is family',FALSE,0),
  ('e3500001-0001-0002-8000-000000000002','e3400001-0001-4000-8000-000000000002','No — Third-Party Payor restriction for age 30+',TRUE,1),
  ('e3500001-0001-0002-8000-000000000003','e3400001-0001-4000-8000-000000000002','Yes, with criminal records check',FALSE,2),
  ('e3500001-0001-0002-8000-000000000004','e3400001-0001-4000-8000-000000000002','Only if sister signs as proposed insured',FALSE,3),
  ('e3500001-0001-0003-8000-000000000001','e3400001-0001-4000-8000-000000000003','Telephone interview',TRUE,0),
  ('e3500001-0001-0003-8000-000000000002','e3400001-0001-4000-8000-000000000003','Paramedical exam',FALSE,1),
  ('e3500001-0001-0003-8000-000000000003','e3400001-0001-4000-8000-000000000003','APS only',FALSE,2),
  ('e3500001-0001-0003-8000-000000000004','e3400001-0001-4000-8000-000000000003','Notarized application',FALSE,3),
  ('e3500001-0001-0004-8000-000000000001','e3400001-0001-4000-8000-000000000004','12 months',FALSE,0),
  ('e3500001-0001-0004-8000-000000000002','e3400001-0001-4000-8000-000000000004','24 months',FALSE,1),
  ('e3500001-0001-0004-8000-000000000003','e3400001-0001-4000-8000-000000000004','36 months',TRUE,2),
  ('e3500001-0001-0004-8000-000000000004','e3400001-0001-4000-8000-000000000004','60 months',FALSE,3),
  ('e3500001-0001-0005-8000-000000000001','e3400001-0001-4000-8000-000000000005','Age 50',FALSE,0),
  ('e3500001-0001-0005-8000-000000000002','e3400001-0001-4000-8000-000000000005','Age 55',TRUE,1),
  ('e3500001-0001-0005-8000-000000000003','e3400001-0001-4000-8000-000000000005','Age 65',FALSE,2),
  ('e3500001-0001-0005-8000-000000000004','e3400001-0001-4000-8000-000000000005','Age 75',FALSE,3),
  ('e3500001-0001-0006-8000-000000000001','e3400001-0001-4000-8000-000000000006','Yes, with explanation cover letter',FALSE,0),
  ('e3500001-0001-0006-8000-000000000002','e3400001-0001-4000-8000-000000000006','No — auto-decline due to lapse history',TRUE,1),
  ('e3500001-0001-0006-8000-000000000003','e3400001-0001-4000-8000-000000000006','Yes, only if a different writing agent',FALSE,2),
  ('e3500001-0001-0006-8000-000000000004','e3400001-0001-4000-8000-000000000006','Yes, with $500 administrative fee',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e3600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Term Made Simple Pro','Mastered American Amicable Term Made Simple — accept/reject simplified-issue.','Award','#dc2626','mastery','{"type":"module_completed","module_id":"e3000000-0001-4000-8000-000000000001"}'::jsonb,1000,TRUE,100)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e3700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','American Amicable Certified Producer','Certifies the agent has mastered Term Made Simple underwriting and submission rules.',ARRAY['e3000000-0001-4000-8000-000000000001']::uuid[],12,'e3600001-0001-4000-8000-000000000001',1500,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e3800001-0001-4000-8000-000000000001','e3000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ============================================================================
-- 4. ELCO MUTUAL — Whole Life (e4)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'ELCO Mutual Whole Life Underwriting',
  'Master ELCO Mutual Life & Annuity''s Whole Life product. Detailed impairment list with substandard tables 4-6 / 7-8, lookback periods, and the 3-part health questionnaire on the application.',
  'carrier_training','intermediate',75,1000,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['elco-mutual','whole-life','final-expense','carrier_training']::text[],
  jsonb_build_object('carrier_id','a04c25c3-edd8-404a-91d8-cd39e5faf2e8','carrier_name','ELCO Mutual','products',ARRAY['Whole Life'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e4100001-0001-4000-8000-000000000001','e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Decline No-Go List','The conditions that always decline at ELCO — memorize these.',0,'content',75,TRUE,15),
  ('e4100001-0002-4000-8000-000000000001','e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Substandard Acceptable Cases','Conditions that accept at Table 4-6 or Table 7-8.',1,'content',75,TRUE,15),
  ('e4100001-0003-4000-8000-000000000001','e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Drug Combinations & Lookback Rules','Why specific drug combos auto-decline and how lookback periods work.',2,'content',100,TRUE,15),
  ('e4100001-0004-4000-8000-000000000001','e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: ELCO Whole Life Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e4200001-0001-4000-8000-000000000001','e4100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Auto-Decline Forever',
   E'<p>Some conditions decline regardless of how long ago — "Ever" lookback. Your client cannot get ELCO Whole Life with any of these:</p><ul><li>Activities of Daily Living: unable to perform any (bathing, toileting, eating, dressing, walking, continence, transferring)</li><li>AIDS / HIV positive</li><li>ALS (Lou Gehrig''s disease)</li><li>Alzheimer''s / memory loss / dementia / organic brain syndrome / mental incapacity</li><li>Cardiomyopathy</li><li>Congestive Heart Failure (CHF)</li><li>Cystic Fibrosis</li><li>Defibrillator implanted</li><li>Down''s Syndrome</li><li>End Stage Renal Disease (ESRD) / Dialysis</li><li>Heart transplant / Liver transplant / Liver failure</li><li>Huntington''s Disease</li><li>Kidney disease (chronic) including dialysis</li><li>Pulmonary Fibrosis</li><li>Schizophrenia / schizoaffective disorder</li><li>Stem cell treatment</li><li>Quadriplegia / Tetraplegia</li><li>Terminal illness with life expectancy &lt;12 months</li></ul>'),
  ('e4200001-0001-4000-8000-000000000002','e4100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Decline With Lookback',
   E'<p>Some conditions decline within a recent window:</p><ul><li><strong>Cancer (excluding basal/squamous):</strong> within 2 years OR more than 1 occurrence ever</li><li><strong>Heart attack:</strong> within 3 years</li><li><strong>Heart disease / heart surgery (valve):</strong> within 2-3 years</li><li><strong>Stroke:</strong> within 2 years (full recovery 4 years = substandard)</li><li><strong>Coronary Artery Bypass / Disease:</strong> within 2 years</li><li><strong>Hodgkin''s, Leukemia, Lymphoma, Melanoma:</strong> within 2-4 years</li><li><strong>Cirrhosis:</strong> within 4 years</li><li><strong>Hepatitis B/C/D:</strong> within 4 years</li><li><strong>Drug abuse / Alcohol abuse:</strong> within 2 years</li><li><strong>Multiple Myeloma, Pulmonary Hypertension, Pancreatitis chronic:</strong> within 2 years</li><li><strong>DUI/DWI repeat:</strong> within 2 years</li><li><strong>Hospitalized 3+ times</strong> in last 2 years</li></ul>'),
  ('e4200001-0002-4000-8000-000000000001','e4100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Standard / Acceptable Conditions',
   E'<p>Many conditions are acceptable at Standard:</p><ul><li><strong>Asthma</strong> (any) — Standard</li><li><strong>Cataract treatment</strong> 2+ years — Standard</li><li><strong>Edema / Fluid Retention</strong> 2 years — Standard</li><li><strong>Hernia repair</strong> any — Standard</li><li><strong>Controlled high BP / hypertension</strong> 2 years — Standard</li><li><strong>Tooth/tonsil removal</strong> any — Standard</li><li><strong>Iron deficiency anemia</strong> 2 years — Standard</li><li><strong>Crohn''s</strong> (otherwise stable) — Standard</li><li><strong>Diabetes — Type 2 with no complications</strong> — Standard (with retinopathy ok)</li><li><strong>Hepatitis A or E full recovery</strong> 4 years — Standard</li><li><strong>Cataract / Gallbladder / Gastritis / Gout / GERD:</strong> Standard</li><li><strong>PTSD</strong> 2 years — Standard</li><li><strong>Pancreatitis acute (>2 years ago):</strong> Standard</li><li><strong>Peripheral Vascular Disease age 65+:</strong> Standard</li></ul>'),
  ('e4200001-0002-4000-8000-000000000002','e4100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Substandard Tables 4-6 / 7-8',
   E'<p>ELCO uses table-rated substandard. Common substandard placements:</p><p><strong>Table 4-6 (moderate substandard):</strong></p><ul><li>Afib mild (no episodes in 12 months) — Table 4-6</li><li>Bipolar controlled (no manic episodes / hospitalization in 12 months) — Table 4-6</li><li>COPD / Chronic bronchitis / Emphysema (none of severe criteria) — Table 4-6</li><li>Crohn''s with surgery in last 2 years — Table 4-6</li><li>Diabetes with neuropathy (Table 3-4)</li><li>Multiple Sclerosis dx 1-3 years ago — Table 7-8; dx over 3 years ago — Table 4-6</li></ul><p><strong>Table 7-8 (heavier substandard):</strong></p><ul><li>Angina 3 years — Table 7-8</li><li>Afib moderate (less than 4 episodes in 12 months) — Table 7-8</li><li>Heart surgery non-valve other surgery — Table 7-8</li><li>Lupus systemic 2 years — Table 7-8</li><li>Paraplegia 2 years — Table 7-8</li><li>Parkinson''s no surgery, single limb, age 50+ — Table 7-8</li></ul>'),
  ('e4200001-0003-4000-8000-000000000001','e4100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Combination Killer Drugs',
   E'<p>Specific drug combinations indicate underlying severity and trigger DECLINE even when individual conditions might be acceptable:</p><ul><li><strong>Anticoagulant (Eliquis/Xarelto) + Beta Blocker (Metoprolol) or Calcium Channel Blocker (Diltiazem):</strong> Decline (indicates worse Afib)</li><li><strong>Opioid (Oxycodone) + Suboxone or Buprenorphine/Naloxone:</strong> Decline (indicates substance abuse treatment)</li><li><strong>Multiple anti-hypertensives + diuretics (furosemide / spironolactone):</strong> may indicate CHF — Decline</li><li><strong>Rescue inhaler + steroids (Prednisone):</strong> indicates severe COPD — Decline</li><li><strong>Antipsychotics (Quetiapine / Seroquel) for depression:</strong> Decline</li><li><strong>Ondansetron prescribed by an oncologist:</strong> Decline (active cancer treatment)</li></ul>'),
  ('e4200001-0003-4000-8000-000000000002','e4100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Opioid Dosage Thresholds',
   E'<p>Opioid use is dosage-based. For Oxycodone:</p><ul><li><strong>Under 50mg/day:</strong> Standard</li><li><strong>50mg-100mg/day:</strong> Substandard</li><li><strong>Over 100mg/day:</strong> Decline</li></ul><p>Non-opioid pain meds (Hydrocodone-Acetaminophen, Tramadol HCl) follow similar dosage tiers but are evaluated case-by-case.</p>'),
  ('e4200001-0003-4000-8000-000000000003','e4100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'Hazardous Activities',
   E'<p>2-year lookback for hazardous activities — all auto-decline:</p><ul><li>Auto racing / Motor boat racing / Motorcycle racing</li><li>Hang gliding</li><li>Parasailing</li><li>Ultralight aircraft</li></ul><p>If your client did any of these in the past 24 months, ELCO is wrong. Consider another carrier with avocation rating capability.</p>'),
  ('e4200001-0003-4000-8000-000000000004','e4100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',3,'Pre-Qualification Workflow',
   E'<p>ELCO offers a pre-qualification questionnaire for agents. Send to <em>agency@elcomutual.com</em> with the following info:</p><ul><li>Agent name, email, phone, best time to call, anticipated date of app</li><li>Client name, DOB, age, height, weight, sex, nicotine use</li><li>Any postponement / denial / felony / parole status</li><li>Which product applying for</li><li>Prescription drug list (name, dosage, daily timing)</li><li>Surgeries, conditions, cancers, cardiac events with how many years ago</li></ul><p>Response within 24 hours with a best-guess estimate. NOT an offer of coverage — but excellent for managing client expectations.</p>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e4300001-0004-4000-8000-000000000001','e4100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e4400001-0001-4000-8000-000000000001','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client takes Eliquis + Metoprolol for Afib. ELCO decision?',0,1,'The combination of anticoagulant (Eliquis) + beta blocker (Metoprolol) for Afib indicates moderate-to-severe disease. This combo is auto-decline at ELCO.'),
  ('e4400001-0001-4000-8000-000000000002','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client''s heart attack was 4 years ago, full recovery. ELCO decision?',1,1,'Heart attack within 3 years = decline. Past 3 years with full recovery would be reviewed; past 4 years = generally acceptable but heart disease 2 years lookback still applies. Best classification depends on the rest of the medical picture.'),
  ('e4400001-0001-4000-8000-000000000003','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client uses Oxycodone 30mg/day for chronic back pain. ELCO decision?',2,1,'Oxycodone under 50mg/day is Standard. Between 50-100mg/day = substandard. Over 100mg/day = decline.'),
  ('e4400001-0001-4000-8000-000000000004','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Type 2 diabetic, no complications, on Metformin. ELCO classification?',3,1,'Type 2 diabetes with no complications is Standard at ELCO Mutual. Retinopathy alone is also Standard. Neuropathy = Substandard (Table 3-4). Nephropathy = Decline.'),
  ('e4400001-0001-4000-8000-000000000005','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client went hang gliding 18 months ago. ELCO decision?',4,1,'Hang gliding within 2 years = auto-decline. Decline applies to motor sports, hang gliding, parasailing, ultralights.'),
  ('e4400001-0001-4000-8000-000000000006','e4300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','MS diagnosed 4 years ago, requires walking aid but no motor impairment. ELCO classification?',5,1,'MS diagnosed over 3 years ago = Substandard Table 4-6. Diagnosed 1-3 years ago = Table 7-8. Within 12 months = Decline.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e4500001-0001-0001-8000-000000000001','e4400001-0001-4000-8000-000000000001','Standard',FALSE,0),
  ('e4500001-0001-0001-8000-000000000002','e4400001-0001-4000-8000-000000000001','Substandard Table 4-6',FALSE,1),
  ('e4500001-0001-0001-8000-000000000003','e4400001-0001-4000-8000-000000000001','Decline (combination killer)',TRUE,2),
  ('e4500001-0001-0001-8000-000000000004','e4400001-0001-4000-8000-000000000001','Individual consideration',FALSE,3),
  ('e4500001-0001-0002-8000-000000000001','e4400001-0001-4000-8000-000000000002','Decline — heart attack ever is decline',FALSE,0),
  ('e4500001-0001-0002-8000-000000000002','e4400001-0001-4000-8000-000000000002','Possible substandard (past 3-year decline window)',TRUE,1),
  ('e4500001-0001-0002-8000-000000000003','e4400001-0001-4000-8000-000000000002','Standard — over 3 years ago',FALSE,2),
  ('e4500001-0001-0002-8000-000000000004','e4400001-0001-4000-8000-000000000002','Preferred',FALSE,3),
  ('e4500001-0001-0003-8000-000000000001','e4400001-0001-4000-8000-000000000003','Decline',FALSE,0),
  ('e4500001-0001-0003-8000-000000000002','e4400001-0001-4000-8000-000000000003','Standard (under 50mg/day)',TRUE,1),
  ('e4500001-0001-0003-8000-000000000003','e4400001-0001-4000-8000-000000000003','Substandard',FALSE,2),
  ('e4500001-0001-0003-8000-000000000004','e4400001-0001-4000-8000-000000000003','Individual consideration only',FALSE,3),
  ('e4500001-0001-0004-8000-000000000001','e4400001-0001-4000-8000-000000000004','Decline',FALSE,0),
  ('e4500001-0001-0004-8000-000000000002','e4400001-0001-4000-8000-000000000004','Standard',TRUE,1),
  ('e4500001-0001-0004-8000-000000000003','e4400001-0001-4000-8000-000000000004','Substandard Table 4-6',FALSE,2),
  ('e4500001-0001-0004-8000-000000000004','e4400001-0001-4000-8000-000000000004','Substandard Table 7-8',FALSE,3),
  ('e4500001-0001-0005-8000-000000000001','e4400001-0001-4000-8000-000000000005','Standard',FALSE,0),
  ('e4500001-0001-0005-8000-000000000002','e4400001-0001-4000-8000-000000000005','Substandard',FALSE,1),
  ('e4500001-0001-0005-8000-000000000003','e4400001-0001-4000-8000-000000000005','Decline (within 2-year lookback)',TRUE,2),
  ('e4500001-0001-0005-8000-000000000004','e4400001-0001-4000-8000-000000000005','Acceptable with avocation rider',FALSE,3),
  ('e4500001-0001-0006-8000-000000000001','e4400001-0001-4000-8000-000000000006','Decline',FALSE,0),
  ('e4500001-0001-0006-8000-000000000002','e4400001-0001-4000-8000-000000000006','Substandard Table 4-6',TRUE,1),
  ('e4500001-0001-0006-8000-000000000003','e4400001-0001-4000-8000-000000000006','Substandard Table 7-8',FALSE,2),
  ('e4500001-0001-0006-8000-000000000004','e4400001-0001-4000-8000-000000000006','Standard',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e4600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','ELCO Whole Life Specialist','Mastered ELCO Mutual whole life impairments and table ratings.','Award','#16a34a','mastery','{"type":"module_completed","module_id":"e4000000-0001-4000-8000-000000000001"}'::jsonb,1000,TRUE,110)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e4700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','ELCO Mutual Certified Producer','Certifies the agent has mastered ELCO Mutual whole life underwriting — impairment guide, drug combinations, lookback periods.',ARRAY['e4000000-0001-4000-8000-000000000001']::uuid[],12,'e4600001-0001-4000-8000-000000000001',1500,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e4800001-0001-4000-8000-000000000001','e4000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ============================================================================
-- 5. KANSAS CITY LIFE — Signature Term Express (e5)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Kansas City Life Signature Term Express',
  'Master Kansas City Life''s Signature Term Express — simplified-issue term to age 95 (10/15/20/30 year and ROP versions). Built-in living benefits riders, prescription drug exclusion list, and the diabetes underwriting rules.',
  'carrier_training','intermediate',70,1000,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['kansas-city-life','kcl','signature-term-express','term','rop','carrier_training']::text[],
  jsonb_build_object('carrier_id','beb4739d-6dd3-4b24-9621-8b33dc8b61eb','carrier_name','Kansas City Life','products',ARRAY['Signature Term Express','Signature Term Express ROP'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e5100001-0001-4000-8000-000000000001','e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Product Specs & ROP Differences','Term durations, max face by age, ROP version benefits.',0,'content',75,TRUE,12),
  ('e5100001-0002-4000-8000-000000000001','e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Built-In Living Benefits','Chronic Condition, Critical Illness, Terminal Illness, Residential Damage, Unemployment Waivers — all included.',1,'content',75,TRUE,12),
  ('e5100001-0003-4000-8000-000000000001','e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Diabetes Rules & Drug Exclusions','The diabetes underwriting decision tree and the long prescription exclusion list.',2,'content',100,TRUE,18),
  ('e5100001-0004-4000-8000-000000000001','e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: KCL Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e5200001-0001-4000-8000-000000000001','e5100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Signature Term Express Specs',
   E'<p>Level term to age 95 with 10/15/20/30 year level periods. Sex-distinct rates. 2 risk classes: Standard Non-Tobacco, Standard Tobacco. Min face $50,000.</p><p><strong>Issue ages by term length:</strong></p><ul><li>10-Year: 18-70</li><li>15-Year: 18-65</li><li>20-Year: 18-60</li><li>30-Year: 18-50</li></ul><p><strong>Max face by age (10-year sample):</strong> ages 18-50 = $400k, 51-65 = $300k, 66-70 = $150k. Policy fee: $60 (non-commissionable).</p>'),
  ('e5200001-0001-4000-8000-000000000002','e5100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'The ROP (Return of Premium) Version',
   E'<p>Signature Term Express ROP comes in 20/25/30 year flavors. Issue ages 20-55 (SNT) or 20-50 (ST), max $400k (50-55 capped at $300k).</p><p><strong>The pitch:</strong> if the client outlives the term, they get ALL eligible base premiums back, tax-free. Example: 30-year term at $100/mo regular vs $150/mo ROP. Outlive 30 years on the ROP, you get $54,000 tax-free.</p><p><strong>Caveats to know cold:</strong> Premiums paid for rider benefits NOT included in ROP. Cash value at end equals base premiums only, assuming no policy changes. ROP no-cost-rider but higher base premium.</p>'),
  ('e5200001-0002-4000-8000-000000000001','e5100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Living Benefits — Built In, No Cost',
   E'<p>KCL bundles 5 valuable riders at NO additional cost — automatically attached at issue:</p><ul><li><strong>ADB Chronic Condition:</strong> accelerated death benefit if insured needs help with 2 of 6 ADLs for 90 consecutive days, OR has severe cognitive impairment.</li><li><strong>ADB Critical Illness:</strong> accelerated payment for heart attack, cancer, kidney failure, major organ failure, or stroke. Use multiple times (once per trigger, max once/12 months).</li><li><strong>ADB Terminal Illness:</strong> up to 80% of face up to $250k cap if life expectancy ≤12 months.</li><li><strong>Residential Damage Waiver:</strong> if primary residence sustains $25,000+ in damages, all premiums waived for 6 months. Once per policy.</li><li><strong>Unemployment Waiver:</strong> if insured becomes unemployed, premiums waived up to 6 months. Available 24 months after issue date.</li></ul><p>This is the "rider stack" — make sure your client knows they get this all built in.</p>'),
  ('e5200001-0002-4000-8000-000000000002','e5100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Optional Riders',
   E'<p><strong>ADB (Accidental Death Benefit Rider):</strong> issue ages 18-60 STE / 20-55 STE ROP. $200k max coverage across all KCL policies. Terminates at age 70.</p><p><strong>CTI (Children''s Term Insurance):</strong> issue ages 14 days-17 years. One annual premium covers all dependent children. New children auto-covered at 14 days.</p><p><strong>WP (Waiver of Premium for Disability):</strong> ages 18-55 STE / 20-55 STE ROP. Disability must exist for 6 consecutive months and have occurred before age 60.</p><p><strong>IAO (Income Assured Option):</strong> at no cost, lets owner choose how death benefit is paid (lump sum + installments).</p>'),
  ('e5200001-0003-4000-8000-000000000001','e5100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'The Diabetes Decision Tree',
   E'<p>Diabetes is a hard line at KCL:</p><ul><li><strong>Diagnosed before age 45:</strong> DECLINE</li><li><strong>On insulin (any age):</strong> DECLINE</li><li><strong>Any complication (neuropathy, retinopathy, etc.):</strong> DECLINE</li><li><strong>Question 8a "Yes":</strong> can be Yes, BUT 8b and 8c must be No</li></ul><p>For build with diabetes, KCL provides a SEPARATE max-weight column ("Diabetic and Multiple Impairments"). Sample at 5''10": regular max 288, diabetic max 263 lbs.</p>'),
  ('e5200001-0003-4000-8000-000000000002','e5100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Mortgage Question on the App',
   E'<p>Signature Term Express has an unusual application question: <em>"Has the proposed insured purchased or refinanced a home in the last 5 years?"</em></p><p>If "Yes," approximate mortgage loan amount and financial institution name are requested. The product is positioned around mortgage protection — having a recent mortgage strengthens the underwriting narrative.</p><p>It''s NOT a hard requirement — but the app tracks it.</p>'),
  ('e5200001-0003-4000-8000-000000000003','e5100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'The Prescription Drug Exclusion List',
   E'<p>KCL''s Signature Term Express has a long auto-decline drug list. If your client takes any of these, the case is DECLINED:</p><p><strong>Cancer drugs:</strong> Avastin, Tykerb, Hydrea, Hydroxyurea, Methotrexate, Tamoxifen, Femara, Targretin, Yervoy, Opdivo, Keytruda, Revlimid, Mercaptopurine</p><p><strong>Cardiac:</strong> Amiodarone, Digitek, Digoxin, Sotalol, Tikosyn, Eliquis, Nitroglycerin, Pradaxa, Inspra, Eminase, Rhythmol, Xarelto</p><p><strong>HIV:</strong> Atripla, Combivir, Crixivan, Truvada, Genvoya, Descovy, Odefsey, Stribild, Sustiva, Viramune, Viread</p><p><strong>Mental health:</strong> Abilify, Clozapine, Geodon, Haldol, Invega, Latuda, Lithium, Risperdal, Saphris, Seroquel, Vraylor, Zyprexa</p><p><strong>Neurological:</strong> Aricept, Donepezil, Galantamine, Namenda, Razadyne, Tysabri, Avonex, Betaseron, Copaxone, Rebif, Lamictal</p><p><strong>Substance abuse:</strong> Antabuse, Buprenorphine (Subutex), Campral, Methadone, Naloxone, Naltrexone, Suboxone, Revia</p><p><strong>Individual Consideration:</strong> Carvedilol, Clopidogrel, Coreg, Coumadin, Enoxaparin, Lovenox, Prednisone, Plavix, Warfarin (provide reason).</p>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e5300001-0004-4000-8000-000000000001','e5100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e5400001-0001-4000-8000-000000000001','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Diabetic, age 38, on Metformin, A1c 6.5, no complications. KCL Signature Term Express decision?',0,1,'Diabetes diagnosed before age 45 = DECLINE on KCL Signature Term Express, regardless of complications or insulin status.'),
  ('e5400001-0001-4000-8000-000000000002','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Which rider is NOT included automatically with Signature Term Express?',1,1,'Disability Waiver of Premium (WP) is OPTIONAL. The 5 included no-cost riders are: Chronic Condition, Critical Illness, Terminal Illness, Residential Damage, Unemployment.'),
  ('e5400001-0001-4000-8000-000000000003','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Maximum face on 30-year Signature Term Express for age 50?',2,1,'30-year Signature Term Express max issue age is 50, with $400k max face for ages 18-50.'),
  ('e5400001-0001-4000-8000-000000000004','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','How does the Residential Damage Waiver work?',3,1,'If insured''s primary residence sustains $25,000+ in damages, all premiums are waived for 6 months. Proof of damage required. Once per policy.'),
  ('e5400001-0001-4000-8000-000000000005','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client takes Plavix after a heart procedure. KCL decision?',4,1,'Plavix is on the Individual Consideration list — not auto-decline. Provide reason for medication on the application. May be approvable.'),
  ('e5400001-0001-4000-8000-000000000006','e5300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','30-year ROP example: $150/mo premium for 30 years, client outlives. What does the client get back?',5,1,'$150 × 12 × 30 = $54,000 in base premiums (excluding rider premiums) returned tax-free at end of level period.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e5500001-0001-0001-8000-000000000001','e5400001-0001-4000-8000-000000000001','Standard Non-Tobacco',FALSE,0),
  ('e5500001-0001-0001-8000-000000000002','e5400001-0001-4000-8000-000000000001','Decline (under age 45)',TRUE,1),
  ('e5500001-0001-0001-8000-000000000003','e5400001-0001-4000-8000-000000000001','Standard Tobacco',FALSE,2),
  ('e5500001-0001-0001-8000-000000000004','e5400001-0001-4000-8000-000000000001','Substandard',FALSE,3),
  ('e5500001-0001-0002-8000-000000000001','e5400001-0001-4000-8000-000000000002','Disability Waiver of Premium (WP)',TRUE,0),
  ('e5500001-0001-0002-8000-000000000002','e5400001-0001-4000-8000-000000000002','Terminal Illness ADB',FALSE,1),
  ('e5500001-0001-0002-8000-000000000003','e5400001-0001-4000-8000-000000000002','Residential Damage Waiver',FALSE,2),
  ('e5500001-0001-0002-8000-000000000004','e5400001-0001-4000-8000-000000000002','Unemployment Waiver',FALSE,3),
  ('e5500001-0001-0003-8000-000000000001','e5400001-0001-4000-8000-000000000003','$150,000',FALSE,0),
  ('e5500001-0001-0003-8000-000000000002','e5400001-0001-4000-8000-000000000003','$300,000',FALSE,1),
  ('e5500001-0001-0003-8000-000000000003','e5400001-0001-4000-8000-000000000003','$400,000',TRUE,2),
  ('e5500001-0001-0003-8000-000000000004','e5400001-0001-4000-8000-000000000003','$1,000,000',FALSE,3),
  ('e5500001-0001-0004-8000-000000000001','e5400001-0001-4000-8000-000000000004','$25k+ damage waives premiums for 6 months, once per policy',TRUE,0),
  ('e5500001-0001-0004-8000-000000000002','e5400001-0001-4000-8000-000000000004','Any damage waives 1 month',FALSE,1),
  ('e5500001-0001-0004-8000-000000000003','e5400001-0001-4000-8000-000000000004','$50k+ damage waives 12 months',FALSE,2),
  ('e5500001-0001-0004-8000-000000000004','e5400001-0001-4000-8000-000000000004','Only available for ROP version',FALSE,3),
  ('e5500001-0001-0005-8000-000000000001','e5400001-0001-4000-8000-000000000005','Auto-decline (cardiac drug)',FALSE,0),
  ('e5500001-0001-0005-8000-000000000002','e5400001-0001-4000-8000-000000000005','Individual Consideration — provide reason',TRUE,1),
  ('e5500001-0001-0005-8000-000000000003','e5400001-0001-4000-8000-000000000005','Standard',FALSE,2),
  ('e5500001-0001-0005-8000-000000000004','e5400001-0001-4000-8000-000000000005','Substandard automatic',FALSE,3),
  ('e5500001-0001-0006-8000-000000000001','e5400001-0001-4000-8000-000000000006','$0 — term policies never return premium',FALSE,0),
  ('e5500001-0001-0006-8000-000000000002','e5400001-0001-4000-8000-000000000006','$54,000 tax-free (base premiums only)',TRUE,1),
  ('e5500001-0001-0006-8000-000000000003','e5400001-0001-4000-8000-000000000006','$54,000 plus interest',FALSE,2),
  ('e5500001-0001-0006-8000-000000000004','e5400001-0001-4000-8000-000000000006','Premiums minus rider charges',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e5600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','KCL Signature Specialist','Mastered Kansas City Life Signature Term Express + ROP.','Award','#0891b2','mastery','{"type":"module_completed","module_id":"e5000000-0001-4000-8000-000000000001"}'::jsonb,1000,TRUE,120)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e5700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Kansas City Life Certified Producer','Certifies the agent has mastered KCL Signature Term Express underwriting and the rider stack.',ARRAY['e5000000-0001-4000-8000-000000000001']::uuid[],12,'e5600001-0001-4000-8000-000000000001',1500,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e5800001-0001-4000-8000-000000000001','e5000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ============================================================================
-- 6. TRANSAMERICA — Trendsetter, FFIUL II, FCIUL II (e6)
-- ============================================================================
-- ============================================================================

INSERT INTO training_modules (id, imo_id, title, description, category, difficulty_level, estimated_duration_minutes, xp_reward, is_published, is_active, version, created_by, tags, metadata) VALUES (
  'e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Transamerica Trendsetter & IUL Underwriting',
  'Master Transamerica''s Trendsetter Super, Trendsetter LB, FFIUL II, and FCIUL II products. BMI-based underwriting via the digital iGO e-App. Transamerica orders ALL requirements through their vendors — agents do not order separately.',
  'carrier_training','intermediate',85,1300,TRUE,TRUE,1,'d0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['transamerica','trendsetter','ffiul','fciul','iul','digital-uw','carrier_training']::text[],
  jsonb_build_object('carrier_id','cf4b8c4d-6332-44c3-8eca-c83f280ebaa0','carrier_name','Transamerica','products',ARRAY['Trendsetter Super','Trendsetter LB','FFIUL II','FCIUL II'])
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes) VALUES
  ('e6100001-0001-4000-8000-000000000001','e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Digital Underwriting & iGO e-App','How Transamerica''s digital UW solution works. Decisions in minutes.',0,'content',75,TRUE,15),
  ('e6100001-0002-4000-8000-000000000001','e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','BMI-Based Class Determination','The blended BMI chart that determines class — different from height/weight charts.',1,'content',75,TRUE,15),
  ('e6100001-0003-4000-8000-000000000001','e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Risk Class Criteria & Living Benefits','Tobacco lookbacks, BP/cholesterol thresholds, family history, and which conditions limit living benefits.',2,'content',100,TRUE,20),
  ('e6100001-0004-4000-8000-000000000001','e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Final Exam: Transamerica Mastery','Certification quiz. 70% to pass.',3,'quiz',100,TRUE,15)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content) VALUES
  ('e6200001-0001-4000-8000-000000000001','e6100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'iGO e-App = Digital UW',
   E'<p>Transamerica''s iGO e-App provides reflexive questions that only ask what''s applicable. The application captures information upfront for digital underwriting decisions <strong>within minutes</strong> of submission.</p><p><strong>Key feature: Client-Driven Part II.</strong> The proposed insured can complete the personal/medical history Part II privately — without disclosing specifics to the agent. Useful when clients are uncomfortable discussing medical history face-to-face.</p><p><strong>Important:</strong> Applicants who receive a digital underwriting decision will NOT be reconsidered for a better rate classification. Get the e-App right the first time.</p>'),
  ('e6200001-0001-4000-8000-000000000002','e6100001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Transamerica Orders All Requirements',
   E'<p>This is critical to understand: Transamerica orders ALL requirements through Transamerica-approved vendors. <strong>Agents do not order paramed exams, blood, or APS separately.</strong></p><p>The digital application closes after 45 days if outstanding requirements remain (60-day window before total close). The agent receives 4 emails before the case closes. Total app validity: 180 days.</p><p>Available requirements: Vitals + Paramed Physical Findings, Home Office Specimen (HOS), Blood Chemistry Profile (BCP), Resting EKG, Minnesota Cognitive Acuity Screen (CS), Inspection Reports (IR/BBIR/EIR), Personal Financial Statements (PFS), MVR, Criminal Background Check, Prescription/Medical Data Check, APS.</p>'),
  ('e6200001-0002-4000-8000-000000000001','e6100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'BMI Chart for Trendsetter Super (Ages 16-59)',
   E'<table><thead><tr><th>BMI Range</th><th>Trendsetter Super</th></tr></thead><tbody><tr><td>≤ 16</td><td>DECLINE</td></tr><tr><td>16.0001–17</td><td>Standard (S/NS)</td></tr><tr><td>17.0001–28</td><td>Preferred Plus</td></tr><tr><td>28.0001–30</td><td>Preferred (S/NS)</td></tr><tr><td>30.0001–32</td><td>Standard Plus</td></tr><tr><td>32.0001–35</td><td>Standard (S/NS)</td></tr><tr><td>35.0001–37</td><td>Table A</td></tr><tr><td>37.0001–39</td><td>Table B</td></tr><tr><td>39.0001–41</td><td>Table C</td></tr><tr><td>41.0001–42</td><td>Table D</td></tr><tr><td>42.0001–43</td><td>Table E</td></tr><tr><td>43.0001–44</td><td>Table F</td></tr><tr><td>44.0001–46</td><td>Table H</td></tr><tr><td>&gt; 46</td><td>DECLINE</td></tr></tbody></table>'),
  ('e6200001-0002-4000-8000-000000000002','e6100001-0002-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'BMI Chart for FFIUL II / FCIUL II (Ages 16-59)',
   E'<p>The IUL products use slightly different terminology — same BMI ranges, different class names:</p><table><thead><tr><th>BMI Range</th><th>FFIUL II / FCIUL II</th></tr></thead><tbody><tr><td>17.0001–28</td><td>Preferred Elite</td></tr><tr><td>28.0001–30</td><td>Preferred Plus / Preferred Tobacco</td></tr><tr><td>30.0001–32</td><td>Preferred</td></tr><tr><td>32.0001–35</td><td>Nontobacco &amp; Tobacco</td></tr><tr><td>35.0001–37</td><td>Table A</td></tr></tbody></table><p><strong>Ages 60+:</strong> BMI 16.0001–18 moves to Individual Consideration (more conservative for older applicants).</p><p><strong>Juvenile (ages 2-15):</strong> BMI ranges expand with age (e.g., age 2: 13.9-30, age 15: 15.9-38). Ages under 2 generally OK unless premature.</p>'),
  ('e6200001-0003-4000-8000-000000000001','e6100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',0,'Tobacco & Health Thresholds by Class',
   E'<p><strong>Tobacco-free for Preferred Plus:</strong> none in past 5 years (60 months).</p><p><strong>Tobacco-free for Preferred Nonsmoker / Standard Plus:</strong> none in past 2 years.</p><p><strong>Tobacco-free for Standard Nonsmoker:</strong> none in past year.</p><p><strong>Cigar exception (all classes):</strong> admitted on application + HOS negative for cotinine + ≤1 cigar/month.</p><p><strong>Cholesterol/BP for FFIUL II/FCIUL II Preferred Elite (ages ≤70):</strong></p><ul><li>Cholesterol ≤230, Cholesterol/HDL ratio ≤5.0</li><li>BP ≤135/85</li><li>BP treatment: ages 18-49 must be UNTREATED. Ages 50-80 OK with treatment if readings fit. Ages 81+ must be untreated.</li></ul><p><strong>Family history Preferred Plus / Preferred:</strong> No death in parent or sibling prior to age 60. Standard Plus: no more than 1 death prior to age 60.</p>'),
  ('e6200001-0003-4000-8000-000000000002','e6100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',1,'Driving Record & Avocations',
   E'<p><strong>DUI / reckless driving:</strong> Preferred classes require none in past 5 years.</p><p><strong>Serious MVR violations:</strong></p><ul><li>Preferred Plus: none in last 12 months, no more than 1 in past 3 years</li><li>Preferred / Standard Plus: max 1 serious in past 3 years</li></ul><p><strong>Minor MVR violations:</strong> up to 2 in last year for Preferred classes.</p><p><strong>Auto-decline avocations (Preferred):</strong> hang gliding, ultralight, soaring, skydiving, ballooning, power racing, mountain climbing, rodeos, competitive skiing, scuba diving &gt;75 feet.</p><p><strong>Alcohol/substance abuse:</strong> Preferred Plus / Preferred require NO history at any time. Standard Plus: no history in past 10 years. Standard: no history in past 7 years.</p>'),
  ('e6200001-0003-4000-8000-000000000003','e6100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',2,'Living Benefits Restrictions',
   E'<p>Critical Illness, Chronic Illness, and Long-Term Care riders are NOT available if base is rated higher than Table D. Some conditions ALSO disqualify living benefit coverage even when base is acceptable:</p><ul><li>Drug and alcohol abuse</li><li>Cancer (other than nonmelanoma skin cancer)</li><li>Coronary artery disease</li><li>Diabetes with insulin use</li><li>Inability to perform Activities of Daily Living (ADLs)</li><li>Motor neuron disease</li><li>Multiple sclerosis</li><li>Muscular dystrophy</li><li>Parkinson''s disease</li><li>Pregnancy — current through three months postpartum</li><li>Stroke or transient ischemic attack</li><li>Systemic lupus erythematosus</li></ul><p>Sum of all living benefit coverages cannot exceed lesser of 90% of available death benefit or $1,500,000.</p>'),
  ('e6200001-0003-4000-8000-000000000004','e6100001-0003-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','rich_text',3,'AccessMyHealth & Cognitive Screen',
   E'<p><strong>AccessMyHealth:</strong> if your client opts in to text notifications when completing labs/paramed, they get a link to <em>transamerica.accessmyhealth.com</em> where they can view their own results (lab report available 12 months from sample collection).</p><p><strong>Minnesota Cognitive Acuity Screen (CS):</strong> required at age 70 on amounts ≥$100,000. Telephone interview by RN, takes 15-20 minutes. Client should be in distraction-free environment. Hearing aid OK. Family/agent CANNOT be in same room during the interview.</p><p><strong>Face-to-face CS:</strong> required for proposed insureds 70+ ALSO applying for the LTC Rider.</p>')
ON CONFLICT (id) DO UPDATE SET rich_text_content=EXCLUDED.rich_text_content, title=EXCLUDED.title, updated_at=now();

INSERT INTO training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes, xp_bonus_perfect) VALUES
  ('e6300001-0004-4000-8000-000000000001','e6100001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff',70,3,FALSE,FALSE,TRUE,15,100)
ON CONFLICT (id) DO UPDATE SET pass_threshold=EXCLUDED.pass_threshold, updated_at=now();

INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation) VALUES
  ('e6400001-0001-4000-8000-000000000001','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Tobacco-free lookback for Transamerica Preferred Plus?',0,1,'Preferred Plus on Trendsetter Super requires none in past 5 years. Preferred Nonsmoker / Standard Plus require 2 years.'),
  ('e6400001-0001-4000-8000-000000000002','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Client BMI = 31, age 40, healthy. Best class on FFIUL II?',1,1,'BMI 30.0001-32 = Preferred (NOT Preferred Plus or Preferred Elite). The chart is BMI-based on these products.'),
  ('e6400001-0001-4000-8000-000000000003','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Diabetic on insulin wants the Critical Illness Rider on Trendsetter LB. Eligible?',2,1,'Diabetes with insulin use is on the living benefits exclusion list. The base policy might be approvable, but the Critical Illness, Chronic Illness, and LTC riders won''t be.'),
  ('e6400001-0001-4000-8000-000000000004','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Why doesn''t Transamerica reconsider digital UW decisions for better rates?',3,1,'Per the guide: "Applicants receiving a digital underwriting decision will not be reconsidered for a better rate classification." Get it right the first time on the e-App.'),
  ('e6400001-0001-4000-8000-000000000005','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Should you order a paramed exam yourself for a Transamerica case?',4,1,'NO. Transamerica orders ALL requirements through their approved vendors. Agents do not order separately.'),
  ('e6400001-0001-4000-8000-000000000006','e6300001-0004-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Age 70 client applying for $200k FCIUL II. What additional requirement?',5,1,'Minnesota Cognitive Acuity Screen (CS) is required at age 70 on amounts ≥$100,000. Telephone interview by RN, 15-20 minutes, distraction-free environment.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e6500001-0001-0001-8000-000000000001','e6400001-0001-4000-8000-000000000001','1 year',FALSE,0),
  ('e6500001-0001-0001-8000-000000000002','e6400001-0001-4000-8000-000000000001','2 years',FALSE,1),
  ('e6500001-0001-0001-8000-000000000003','e6400001-0001-4000-8000-000000000001','5 years',TRUE,2),
  ('e6500001-0001-0001-8000-000000000004','e6400001-0001-4000-8000-000000000001','10 years',FALSE,3),
  ('e6500001-0001-0002-8000-000000000001','e6400001-0001-4000-8000-000000000002','Preferred Elite',FALSE,0),
  ('e6500001-0001-0002-8000-000000000002','e6400001-0001-4000-8000-000000000002','Preferred Plus',FALSE,1),
  ('e6500001-0001-0002-8000-000000000003','e6400001-0001-4000-8000-000000000002','Preferred',TRUE,2),
  ('e6500001-0001-0002-8000-000000000004','e6400001-0001-4000-8000-000000000002','Standard',FALSE,3),
  ('e6500001-0001-0003-8000-000000000001','e6400001-0001-4000-8000-000000000003','Yes — full eligibility',FALSE,0),
  ('e6500001-0001-0003-8000-000000000002','e6400001-0001-4000-8000-000000000003','No — insulin use disqualifies living benefits',TRUE,1),
  ('e6500001-0001-0003-8000-000000000003','e6400001-0001-4000-8000-000000000003','Only if A1c < 6.5',FALSE,2),
  ('e6500001-0001-0003-8000-000000000004','e6400001-0001-4000-8000-000000000003','Only with Risk Assessment approval',FALSE,3),
  ('e6500001-0001-0004-8000-000000000001','e6400001-0001-4000-8000-000000000004','To save underwriting bandwidth',FALSE,0),
  ('e6500001-0001-0004-8000-000000000002','e6400001-0001-4000-8000-000000000004','Per guide: digital decisions are final and not reconsidered for better classification',TRUE,1),
  ('e6500001-0001-0004-8000-000000000003','e6400001-0001-4000-8000-000000000004','Reconsideration available with extra fee',FALSE,2),
  ('e6500001-0001-0004-8000-000000000004','e6400001-0001-4000-8000-000000000004','Always reconsidered automatically',FALSE,3),
  ('e6500001-0001-0005-8000-000000000001','e6400001-0001-4000-8000-000000000005','Yes, faster turnaround',FALSE,0),
  ('e6500001-0001-0005-8000-000000000002','e6400001-0001-4000-8000-000000000005','No — Transamerica orders all requirements',TRUE,1),
  ('e6500001-0001-0005-8000-000000000003','e6400001-0001-4000-8000-000000000005','Only if face >$1M',FALSE,2),
  ('e6500001-0001-0005-8000-000000000004','e6400001-0001-4000-8000-000000000005','Only on paper applications',FALSE,3),
  ('e6500001-0001-0006-8000-000000000001','e6400001-0001-4000-8000-000000000006','Standard MVR only',FALSE,0),
  ('e6500001-0001-0006-8000-000000000002','e6400001-0001-4000-8000-000000000006','Minnesota Cognitive Acuity Screen (CS)',TRUE,1),
  ('e6500001-0001-0006-8000-000000000003','e6400001-0001-4000-8000-000000000006','APS only',FALSE,2),
  ('e6500001-0001-0006-8000-000000000004','e6400001-0001-4000-8000-000000000006','No additional requirements',FALSE,3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order) VALUES
  ('e6600001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Transamerica Trendsetter Pro','Mastered Transamerica Trendsetter, FFIUL II, FCIUL II underwriting.','Award','#ea580c','mastery','{"type":"module_completed","module_id":"e6000000-0001-4000-8000-000000000001"}'::jsonb,1300,TRUE,130)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active) VALUES
  ('e6700001-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','Transamerica Certified Producer','Certifies the agent has mastered Transamerica Trendsetter & IUL underwriting — BMI charts, digital UW, living benefits restrictions.',ARRAY['e6000000-0001-4000-8000-000000000001']::uuid[],12,'e6600001-0001-4000-8000-000000000001',1800,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

INSERT INTO training_assignments (id, module_id, imo_id, agency_id, assigned_by, assigned_to, assignment_type, module_version, status, priority, is_mandatory) VALUES
  ('e6800001-0001-4000-8000-000000000001','e6000000-0001-4000-8000-000000000001','ffffffff-ffff-ffff-ffff-ffffffffffff','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d0d3edea-af6d-4990-80b8-1765ba829896',NULL,'agency',1,'active','normal',FALSE)
ON CONFLICT (id) DO NOTHING;
