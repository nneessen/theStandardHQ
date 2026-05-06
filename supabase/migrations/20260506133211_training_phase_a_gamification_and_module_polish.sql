-- ============================================================================
-- Training Phase A: Gamification scaffolding + module polish
-- ============================================================================
-- Goals:
--   1. Seed badges, certifications, and challenge so the gamification UI on
--      My Training has real rewards (all three tables were empty).
--   2. Remove 4 empty video blocks in the Advanced Markets module (broken
--      players were rendering with no source).
--   3. Backfill 7 missing script prompts in Advanced Markets module.
--   4. Add additional quiz questions to Warm Lead quizzes that previously
--      had only 3 questions each.
--
-- Idempotency: all inserts use ON CONFLICT (id) DO NOTHING; deletes target
-- specific UUIDs that exist as broken video shells.
-- ============================================================================

-- The Standard agency context — used for agency-scoped challenge.
-- imo_id = ffffffff-ffff-ffff-ffff-ffffffffffff (The Standard IMO seed)
-- agency_id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (The Standard agency)
-- created_by = d0d3edea-af6d-4990-80b8-1765ba829896 (super-admin Nick)

-- ============================================================================
-- 1. BADGES
-- ============================================================================

INSERT INTO training_badges (id, imo_id, name, description, icon, color, badge_type, criteria, xp_reward, is_active, sort_order)
VALUES
  (
    'bd000001-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'First Steps',
    'Complete your very first lesson. Welcome to the team.',
    'Sparkles',
    '#10b981',
    'progression',
    '{"type":"lessons_completed","count":1}'::jsonb,
    50,
    TRUE,
    10
  ),
  (
    'bd000002-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Streak Starter',
    'Train 3 days in a row. Consistency compounds.',
    'Flame',
    '#f59e0b',
    'streak',
    '{"type":"current_streak_days","count":3}'::jsonb,
    100,
    TRUE,
    20
  ),
  (
    'bd000003-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Streak Hero',
    '7-day training streak. You are unstoppable.',
    'Trophy',
    '#ef4444',
    'streak',
    '{"type":"current_streak_days","count":7}'::jsonb,
    250,
    TRUE,
    30
  ),
  (
    'bd000004-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Warm Lead Master',
    'Complete the Warm Lead Mastery module. You know how to convert.',
    'Phone',
    '#3b82f6',
    'mastery',
    '{"type":"module_completed","module_id":"a4d5e6f7-0102-4304-8506-070809000a0b"}'::jsonb,
    500,
    TRUE,
    40
  ),
  (
    'bd000005-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Advanced Markets Pro',
    'Complete the Advanced Markets Mastery module. Premium products, premium clients.',
    'GraduationCap',
    '#8b5cf6',
    'mastery',
    '{"type":"module_completed","module_id":"93c1d2e3-f4a5-4b67-8901-cdef34567890"}'::jsonb,
    1000,
    TRUE,
    50
  ),
  (
    'bd000006-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Quiz Sniper',
    'Score 100% on any 3 quizzes. Knowledge is power.',
    'Target',
    '#06b6d4',
    'achievement',
    '{"type":"perfect_quiz_count","count":3}'::jsonb,
    300,
    TRUE,
    60
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. CERTIFICATIONS
-- ============================================================================

INSERT INTO training_certifications (id, imo_id, name, description, required_module_ids, validity_months, badge_id, xp_reward, is_active)
VALUES
  (
    'ce000001-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Warm Lead Specialist',
    'Awarded upon completing the Warm Lead Mastery module. Demonstrates mastery of speed-to-lead, opening scripts, the 30-day cadence, and aged-lead conversion.',
    ARRAY['a4d5e6f7-0102-4304-8506-070809000a0b']::uuid[],
    12,
    'bd000004-0001-4000-8000-000000000001',
    750,
    TRUE
  ),
  (
    'ce000002-0001-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Advanced Markets Specialist',
    'Awarded upon completing the Advanced Markets Mastery module. Certifies the agent on annuities, IUL/LIRP, Infinite Banking, LTC, and reset appointments.',
    ARRAY['93c1d2e3-f4a5-4b67-8901-cdef34567890']::uuid[],
    12,
    'bd000005-0001-4000-8000-000000000001',
    1500,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. CHALLENGE (agency-scoped, 30 days)
-- ============================================================================

INSERT INTO training_challenges (
  id, imo_id, agency_id, title, description, challenge_type,
  target_value, start_date, end_date, xp_reward, badge_id, created_by, is_active
)
VALUES (
  'cc000001-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '30-Day Training Sprint',
  'Complete any 2 training modules within 30 days. Earn 1,000 bonus XP and the Streak Hero badge if you also keep a 7-day streak.',
  'modules_completed',
  2,
  '2026-05-06 00:00:00+00',
  '2026-06-05 23:59:59+00',
  1000,
  'bd000003-0001-4000-8000-000000000001',
  'd0d3edea-af6d-4990-80b8-1765ba829896',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. CLEANUP: remove 4 empty video blocks in Advanced Markets module
-- ============================================================================
-- These rows had content_type='video' with NULL/empty video_url, rendering
-- broken empty player widgets. Removing rather than backfilling because the
-- user can re-add real video URLs through the admin builder later.

DELETE FROM training_lesson_content
WHERE id IN (
  'b1000001-0001-0001-0001-000000000002', -- The Advanced Markets Opportunity
  'b1000002-0001-0001-0001-000000000004', -- Fact-Finder Walkthrough
  'b1000004-0001-0001-0001-000000000004', -- Annuity Types Explained
  'b1000012-0001-0001-0001-000000000004'  -- Full Reset Appointment Walkthrough
);

-- ============================================================================
-- 5. ADD 7 SCRIPT PROMPTS to Advanced Markets module
-- ============================================================================
-- Sort orders chosen so each script lands at the END of its lesson, after
-- existing rich_text content. Existing max sort_order in those lessons:
--   0002: 2, 0004: 2, 0005: 0, 0007: 2, 0009: 2, 0011: 1, 0012: 2

INSERT INTO training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES
  -- Lesson 0002: Mindset Shift / Fact-Finding
  (
    'b1000002-9001-4000-8000-000000000001',
    'a1000001-0002-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Three Magic Questions Script',
    E'1) "If something happened to you tomorrow, what would your family''s biggest financial worry be?"\n2) "If you could retire today with any income, what would feel like enough?"\n3) "If we could get you the same return without the market downside, would that be worth a 15-minute conversation?"',
    'Use these three open-ended questions in EVERY fact-finder. Wait at least 5 seconds after each — silence is where you learn the real answer. Never lead with product names.'
  ),
  -- Lesson 0004: Annuities
  (
    'b1000004-9001-4000-8000-000000000001',
    'a1000001-0004-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Annuity Soft Intro',
    E'"You mentioned wanting income that doesn''t depend on the market. Most of my clients in your situation use a vehicle called an indexed annuity — it lets you participate in part of the upside and gives you a guaranteed floor of zero. Would you like me to show you the math on what that could look like for your $X?"',
    'Drop this AFTER the prospect tells you they want guarantees + growth. Never use the word "annuity" first — let them describe the problem, then introduce the solution.'
  ),
  -- Lesson 0005: Annuity Objections
  (
    'b1000005-9001-4000-8000-000000000001',
    'a1000001-0005-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Top 5 Annuity Objection Rebuttals',
    E'"Annuities have high fees" → "The product I''m showing you has zero annual fees on the index strategy — only an income rider if you elect it."\n\n"They''re too complex" → "Let me explain it in 30 seconds: principal protected, capped upside, lifetime income switch. That''s the whole product."\n\n"I lose access to my money" → "You have 10% free withdrawal every year. After 7-10 years, you have full access. What you give up is the ability to lose it."\n\n"My financial advisor says no" → "Most fee-only advisors can''t sell guaranteed products — they''re paid AUM. That''s not advice, that''s a business model."\n\n"What if I die early?" → "Beneficiaries receive 100% of remaining account value. Your money never goes to the company unless you choose lifetime income."',
    'Practice these out loud until they roll off your tongue. The first 5 seconds of your rebuttal decide whether the prospect listens to the next 30.'
  ),
  -- Lesson 0007: LIRP / IUL
  (
    'b1000007-9001-4000-8000-000000000001',
    'a1000001-0007-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'LIRP Discovery Script',
    E'"You said you''re maxing out your 401(k) at work. Have you ever heard of a Roth IRA on steroids? It''s called a LIRP — Life Insurance Retirement Plan. It works like a Roth but with no contribution limits, no income limits, no penalties for early access, and a tax-free death benefit on top. Most of my high-income clients use it as their #2 retirement bucket. Want to see if you qualify?"',
    'Use ONLY with prospects who already have meaningful retirement savings ($50k+ in 401k or equivalent). Never pitch LIRP to someone without an emergency fund — it triggers compliance flags and is wrong for them.'
  ),
  -- Lesson 0009: Infinite Banking
  (
    'b1000009-9001-4000-8000-000000000001',
    'a1000001-0009-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Infinite Banking Story Hook',
    E'"Imagine if every dollar you spent on cars, college, weddings, or business expansion over the next 30 years went BACK into a pool you owned — earning interest the whole time — instead of going to a bank that loaned it to someone else. That''s called Infinite Banking. The richest 1% have been doing this for 100 years. Want me to show you how it works on a $250 / month policy?"',
    'IBC is a long-term commitment (10+ years). Never sell it to someone with high credit-card debt or no emergency fund. Lead with the STORY of who uses it (Disney, Rockefeller, JC Penney) not the mechanics.'
  ),
  -- Lesson 0011: Long-Term Care / Living Benefits
  (
    'b1000011-9001-4000-8000-000000000001',
    'a1000001-0011-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Living Benefits Reframe Script',
    E'"Most people think life insurance only pays when you die. The newer policies actually pay you WHILE you''re alive if you have a heart attack, stroke, cancer, or can''t do 2 of 6 daily activities. Statistically you''re 7x more likely to use those benefits than the death benefit. Would you rather have a policy that only protects against death, or one that also protects against the things much more likely to happen?"',
    'Living benefits are a HUGE close-strength multiplier. When the prospect realizes the policy pays them while alive, the conversation flips from "do I need this" to "how much can I get".'
  ),
  -- Lesson 0012: Reset Appointment
  (
    'b1000012-9001-4000-8000-000000000001',
    'a1000001-0012-4000-8000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'script_prompt',
    10,
    'Reset Appointment Opener',
    E'"Hey [Name], it''s [Agent] over at The Standard — we set up your policy back in [Year]. I''m calling because I do a yearly review with all my clients and we''re due. Two things have changed since then: rates have moved, and there are some new living-benefit riders you didn''t have access to. It''s 15 minutes either over Zoom or at your kitchen table — what works better, Tuesday afternoon or Thursday morning?"',
    'Reset appointments are GOLD. Your existing book trusts you. They will refer 2-3 people if you do this right. Always end with a binary choice (Tuesday or Thursday) — never an open question.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. WARM LEAD: Add 1 question to each quiz under 5 questions
-- ============================================================================
-- Existing: quizzes 0002, 0004, 0006, 0008, 0010 each have 3 questions; 0012
-- has 4. Adding 1 question to each (sort_order = highest existing + 1) so every
-- quiz has at least 4 — minimum bar for true knowledge check. The Warm Lead
-- quiz expansion to 5+ questions is intentionally deferred to a later pass to
-- keep this migration focused.

-- Quiz 0002 (Warm Lead Mindset) — quiz_id c2000001-0002-0001-0001-000000000001
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation)
VALUES (
  'd2000002-9001-4000-8000-000000000001',
  'c2000001-0002-0001-0001-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'You receive a fresh internet lead at 2:14 PM. By when must you make your first dial to maximize contact rate?',
  10,
  1,
  'Fresh leads contacted within 5 minutes are 9x more likely to convert. After 30 minutes, conversion rate drops by 80%.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order)
VALUES
  ('e2000002-9001-4000-8000-000000000001','d2000002-9001-4000-8000-000000000001','Within 5 minutes',TRUE,0),
  ('e2000002-9001-4000-8000-000000000002','d2000002-9001-4000-8000-000000000001','Within 30 minutes',FALSE,1),
  ('e2000002-9001-4000-8000-000000000003','d2000002-9001-4000-8000-000000000001','Within 2 hours',FALSE,2),
  ('e2000002-9001-4000-8000-000000000004','d2000002-9001-4000-8000-000000000001','Same business day',FALSE,3)
ON CONFLICT (id) DO NOTHING;

-- Quiz 0004 (Speed-to-Lead) — quiz_id c2000001-0004-0001-0001-000000000001
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation)
VALUES (
  'd2000004-9001-4000-8000-000000000001',
  'c2000001-0004-0001-0001-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A shared lead is one where the same prospect was sold to multiple agents simultaneously. What is the most important thing to do?',
  10,
  1,
  'On shared leads, speed is the entire game. The agent who calls first is dramatically more likely to set the appointment because the prospect commits to the first credible voice.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order)
VALUES
  ('e2000004-9001-4000-8000-000000000001','d2000004-9001-4000-8000-000000000001','Call FIRST — even at the cost of perfect script',TRUE,0),
  ('e2000004-9001-4000-8000-000000000002','d2000004-9001-4000-8000-000000000001','Wait until you have a full quote ready',FALSE,1),
  ('e2000004-9001-4000-8000-000000000003','d2000004-9001-4000-8000-000000000001','Send an email first to qualify',FALSE,2),
  ('e2000004-9001-4000-8000-000000000004','d2000004-9001-4000-8000-000000000001','Refuse to work shared leads',FALSE,3)
ON CONFLICT (id) DO NOTHING;

-- Quiz 0006 (Opening Scripts) — quiz_id c2000001-0006-0001-0001-000000000001
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation)
VALUES (
  'd2000006-9001-4000-8000-000000000001',
  'c2000001-0006-0001-0001-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'When opening a call to an aged lead (30+ days old), what should you NEVER say?',
  10,
  1,
  'Saying "you requested information" on an aged lead immediately reveals the lead is old and the prospect feels embarrassed or annoyed. Acknowledge the time gap directly and pivot to value.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order)
VALUES
  ('e2000006-9001-4000-8000-000000000001','d2000006-9001-4000-8000-000000000001','"You requested information about life insurance"',TRUE,0),
  ('e2000006-9001-4000-8000-000000000002','d2000006-9001-4000-8000-000000000001','"I know it''s been a while since you looked into this"',FALSE,1),
  ('e2000006-9001-4000-8000-000000000003','d2000006-9001-4000-8000-000000000001','"Rates have changed since you last shopped"',FALSE,2),
  ('e2000006-9001-4000-8000-000000000004','d2000006-9001-4000-8000-000000000001','"I''d love to give you a quick rate update"',FALSE,3)
ON CONFLICT (id) DO NOTHING;

-- Quiz 0008 (30-Day Cadence) — quiz_id c2000001-0008-0001-0001-000000000001
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation)
VALUES (
  'd2000008-9001-4000-8000-000000000001',
  'c2000001-0008-0001-0001-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Why does varying the time of day you call a lead matter over a 30-day cadence?',
  10,
  1,
  'People answer phones at different times depending on their schedule. Calling at 9 AM every day for 30 days means you only ever reach early-shift workers. Rotating windows (morning / afternoon / evening) increases contact rate dramatically.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order)
VALUES
  ('e2000008-9001-4000-8000-000000000001','d2000008-9001-4000-8000-000000000001','Different prospects answer at different times of day — rotation maximizes contact rate',TRUE,0),
  ('e2000008-9001-4000-8000-000000000002','d2000008-9001-4000-8000-000000000001','Calling early in the morning is always best',FALSE,1),
  ('e2000008-9001-4000-8000-000000000003','d2000008-9001-4000-8000-000000000001','It doesn''t matter — call when convenient for you',FALSE,2),
  ('e2000008-9001-4000-8000-000000000004','d2000008-9001-4000-8000-000000000001','Only call between 5–7 PM when people are home',FALSE,3)
ON CONFLICT (id) DO NOTHING;

-- Quiz 0010 (Booking & Show Rate) — quiz_id c2000001-0010-0001-0001-000000000001
INSERT INTO training_quiz_questions (id, quiz_id, imo_id, question_text, sort_order, points, explanation)
VALUES (
  'd2000010-9001-4000-8000-000000000001',
  'c2000001-0010-0001-0001-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is the most effective time to send a personal SMS reminder before a booked appointment?',
  10,
  1,
  'A morning-of personal SMS — written casually as if you were texting a friend — converts cold appointments into warm conversations. Generic 24h-before reminders are too far out and feel automated; same-day texts feel human.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_quiz_options (id, question_id, option_text, is_correct, sort_order)
VALUES
  ('e2000010-9001-4000-8000-000000000001','d2000010-9001-4000-8000-000000000001','Morning of the appointment, written casually',TRUE,0),
  ('e2000010-9001-4000-8000-000000000002','d2000010-9001-4000-8000-000000000001','24 hours before, formal tone',FALSE,1),
  ('e2000010-9001-4000-8000-000000000003','d2000010-9001-4000-8000-000000000001','One week before booking confirmation only',FALSE,2),
  ('e2000010-9001-4000-8000-000000000004','d2000010-9001-4000-8000-000000000001','Never — texts annoy prospects',FALSE,3)
ON CONFLICT (id) DO NOTHING;
