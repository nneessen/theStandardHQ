-- "Warm Lead Mastery for Life Insurance Agents" training module.
-- 6 content lessons + 6 quizzes covering speed-to-lead, cadence, scripts, show-rate, and aged-lead profitability.
-- Tailored for remote agents working internet form-fill leads, mailer responses, and aged leads (NOT cold prospecting).
-- Cross-linked to the "Warm Lead Operations Rollout" roadmap via metadata.

BEGIN;

-- ============================================================================
-- MODULE
-- ============================================================================
INSERT INTO public.training_modules (
  id, imo_id, agency_id, title, description, category, difficulty_level,
  estimated_duration_minutes, xp_reward, is_published, is_active, version,
  created_by, tags, metadata, published_at
) VALUES (
  'a4d5e6f7-0102-4304-8506-070809000a0b',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  NULL,
  'Warm Lead Mastery for Life Insurance Agents',
  'Convert more form-fill and mailer-response leads into booked appointments and policies. Covers the 5-minute speed-to-lead rule, the 8-12 touch cadence that captures the 60-80% who buy after Day 60, fresh vs aged scripts, show-rate ops, and the aged-lead profit playbook.',
  'sales_skills',
  'intermediate',
  90,
  500,
  true,
  true,
  1,
  'd0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['warm leads','dialing','cadence','show rate','aged leads','speed to lead','SMS'],
  '{"complementary_roadmap_id": "b5e6f708-0203-4405-8607-08090a0b0c0d"}'::jsonb,
  NOW()
);

-- ============================================================================
-- LESSON 1: The Warm Lead Mindset (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0001-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The Warm Lead Mindset', 'Why warm leads are a 30-day relationship, not a phone call. The persistence math that separates top earners from quitters.', 0, 'content', 50, true, 12);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000001-0001-0001-0001-000000000001', 'a2000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'A Warm Lead Is Not a Phone Call',
  '<h3>A Warm Lead Is Not a Phone Call</h3><p>A warm lead is a <strong>30-day relationship</strong> you paid for the right to build. The agent who treats it as a single call wonders why their close rate is 2%. The agent who treats it as a 30-day campaign closes 8-12%.</p><p>This module is about becoming the second kind of agent.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000001-0001-0001-0001-000000000002', 'a2000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Three Numbers to Memorize',
  '<h3>Three Numbers to Memorize</h3><ul><li><strong>5 minutes:</strong> Leads contacted within 5 minutes are 9-21x more likely to convert than leads contacted after 30 minutes. (Velocify: under 1 minute = 391% lift.)</li><li><strong>8 attempts:</strong> Average attempts required to actually reach a warm lead. Most agents stop at 2-3.</li><li><strong>60-80%:</strong> Percentage of insurance policies that sell <strong>more than 60 days after the first inquiry</strong>. The tail matters more than the first call.</li></ul><p>If you internalize nothing else from this module, internalize those three numbers.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000001-0001-0001-0001-000000000003', 'a2000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Failure Mode',
  '<h3>The Most Common Failure Mode</h3><p><em>"I called twice, they didn''t answer, must be a bad lead."</em></p><p>This single thought costs the average agent six figures per year in left-on-the-table commission. Industry data: agents who stop after 1-3 attempts contact ~30% of their leads. Agents who push to 6+ attempts contact ~70%. Same leads. The difference is persistence, not lead quality.</p><p>Throughout this module, when you''re tempted to write a lead off after attempt #2 or #3, remember: you''re leaving the majority of your potential commission untouched.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000001-0001-0001-0001-000000000004', 'a2000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 3, 'What This Module Will Do For You',
  '<h3>By the End of This Module You Will</h3><ul><li>Contact 60%+ of your fresh leads within 5 minutes (vs the industry average of 42 hours)</li><li>Run an 8-12 touch cadence on every lead across phone, SMS, and email</li><li>Use the right opening script for fresh, aged, and mailer-response leads</li><li>Raise your appointment show rate above 80%</li><li>Run aged leads at higher net ROI than fresh leads</li></ul>');

-- ============================================================================
-- LESSON 2: Quiz — The Warm Lead Mindset
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0002-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: The Warm Lead Mindset', 'Confirm the persistence math and the 30-day relationship model.', 1, 'quiz', 50, true, 5);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0002-0001-0001-000000000001', 'a2000001-0002-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0001-0001-0001-000000000001', 'c2000001-0002-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What percentage of insurance policies sell more than 60 days after the first inquiry?', 'multiple_choice',
  '60-80% of policies sell more than 60 days after first inquiry. Most of your revenue lives in the follow-up tail, not the first call.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0001-0001-0001-000000000001', 'd2000001-0001-0001-0001-000000000001', '5-10%', false, 0),
  ('e2000001-0001-0001-0001-000000000002', 'd2000001-0001-0001-0001-000000000001', '20-30%', false, 1),
  ('e2000001-0001-0001-0001-000000000003', 'd2000001-0001-0001-0001-000000000001', '60-80%', true, 2),
  ('e2000001-0001-0001-0001-000000000004', 'd2000001-0001-0001-0001-000000000001', '90-100%', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0002-0001-0001-000000000001', 'c2000001-0002-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'How many call attempts on average does it take to reach a warm lead?', 'multiple_choice',
  '8 calls on average. Most agents stop at 2-3 attempts and miss the majority of their potential commission.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0002-0001-0001-000000000001', 'd2000001-0002-0001-0001-000000000001', '2 attempts', false, 0),
  ('e2000001-0002-0001-0001-000000000002', 'd2000001-0002-0001-0001-000000000001', '4 attempts', false, 1),
  ('e2000001-0002-0001-0001-000000000003', 'd2000001-0002-0001-0001-000000000001', '8 attempts', true, 2),
  ('e2000001-0002-0001-0001-000000000004', 'd2000001-0002-0001-0001-000000000001', '15 attempts', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0003-0001-0001-000000000001', 'c2000001-0002-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A warm lead should be treated as a single phone call to qualify or disqualify.', 'true_false',
  'False. A warm lead is a 30-day relationship you paid for. Treating it as a single call leaves most of the revenue on the table.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0003-0001-0001-000000000001', 'd2000001-0003-0001-0001-000000000001', 'True', false, 0),
  ('e2000001-0003-0001-0001-000000000002', 'd2000001-0003-0001-0001-000000000001', 'False', true, 1);

-- ============================================================================
-- LESSON 3: Speed-to-Lead — The 5-Minute Rule (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0003-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Speed-to-Lead: The 5-Minute Rule', 'The single highest-leverage lever in warm-lead workflow. Webhook -> auto-SMS -> live dial in 60 seconds.', 2, 'content', 75, true, 15);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000003-0001-0001-0001-000000000001', 'a2000001-0003-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Math',
  '<h3>The Math</h3><p>When a fresh lead hits your CRM, a clock starts. Industry data on response time vs. conversion:</p><ul><li><strong>&lt;1 minute:</strong> +391% conversion lift over baseline (Velocify study)</li><li><strong>&lt;5 minutes:</strong> 9-21x more likely to convert vs. &gt;30 minutes</li><li><strong>&lt;1 hour:</strong> 7x more likely to qualify vs. &gt;1 hour</li><li><strong>Industry average:</strong> 42 hours. The gap = your opportunity.</li></ul><p>Only 37% of companies hit the "golden hour." If you do, you''re already above three quarters of your competition.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000003-0001-0001-0001-000000000002', 'a2000001-0003-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Shared-Lead Problem',
  '<h3>The Shared-Lead Problem (Why Speed Matters Even More)</h3><p>Most form-fill leads are <strong>shared, not exclusive</strong>. The prospect filled out 2-3 competing forms in the same session — they''re comparing agents.</p><p>For shared web leads, the typical close-rate distribution is:</p><ul><li><strong>1st agent to call:</strong> ~50% of all closes</li><li><strong>2nd agent to call:</strong> ~25% of all closes</li><li><strong>3rd+ agent to call:</strong> ~12-15% of all closes</li></ul><p>The math is brutal. If you''re #2 to call, you''ve already lost half the deals before you say hello.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000003-0001-0001-0001-000000000003', 'a2000001-0003-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Workflow (Memorize This Sequence)',
  '<h3>The Workflow — Memorize This Sequence</h3><ol><li><strong>Lead webhook fires</strong> → CRM logs the new lead</li><li><strong>Auto-SMS sends within 10 seconds:</strong> "Hi [Name], it''s [You] with [Agency]. Got your request — calling you in 60 seconds from [###]"</li><li><strong>Power dialer rings prospect within 60 seconds</strong> from your number</li><li><strong>If no answer:</strong> leave a 15-second voicemail referencing the form they filled out</li></ol><p><strong>Why the auto-SMS first?</strong> It primes the prospect that the incoming call is expected, not spam. Field reports show this lifts answer rate by 15-25%.</p><p><strong>If you''re on another call when a lead comes in,</strong> the system should: (a) auto-text the prospect that you''ll call in 5 min, and (b) route to a backup agent if available. Never let a fresh lead sit in a queue.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000003-0001-0001-0001-000000000004', 'a2000001-0003-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 3, 'Auto-SMS Template (Fresh Lead, Sub-60-Second)',
  'Hi [Name], it''s [Your Name] with [Agency]. Got your request for life insurance info — calling you in about 60 seconds from [###]. If you can''t talk, just text back a better time and I''ll work around your schedule.',
  'Send this within 10 seconds of the lead landing in your CRM. Keep your number consistent so the prospect recognizes the incoming call. NEVER send before consent is captured on the form (your lead vendor handles this — verify their form has explicit SMS opt-in language).');

-- ============================================================================
-- LESSON 4: Quiz — Speed-to-Lead
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0004-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Speed-to-Lead', 'Confirm the response-time math and the auto-SMS workflow.', 3, 'quiz', 50, true, 5);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0004-0001-0001-000000000001', 'a2000001-0004-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0004-0001-0001-000000000001', 'c2000001-0004-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is the conversion lift for responding to a fresh lead within 1 minute, vs baseline?', 'multiple_choice',
  '~391% (Velocify study). Sub-1-minute response is the highest-leverage single change in warm-lead workflow.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0004-0001-0001-000000000001', 'd2000001-0004-0001-0001-000000000001', '~25%', false, 0),
  ('e2000001-0004-0001-0001-000000000002', 'd2000001-0004-0001-0001-000000000001', '~100%', false, 1),
  ('e2000001-0004-0001-0001-000000000003', 'd2000001-0004-0001-0001-000000000001', '~391%', true, 2),
  ('e2000001-0004-0001-0001-000000000004', 'd2000001-0004-0001-0001-000000000001', '~1000%', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0005-0001-0001-000000000001', 'c2000001-0004-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'For shared web leads, what percentage of total closes typically goes to the FIRST agent to call?', 'multiple_choice',
  '~50%. The first agent to call captures roughly half of all closes. Being #2 means you''ve already lost half the deals before saying hello.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0005-0001-0001-000000000001', 'd2000001-0005-0001-0001-000000000001', '~10%', false, 0),
  ('e2000001-0005-0001-0001-000000000002', 'd2000001-0005-0001-0001-000000000001', '~25%', false, 1),
  ('e2000001-0005-0001-0001-000000000003', 'd2000001-0005-0001-0001-000000000001', '~50%', true, 2),
  ('e2000001-0005-0001-0001-000000000004', 'd2000001-0005-0001-0001-000000000001', '~75%', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0006-0001-0001-000000000001', 'c2000001-0004-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'You should send the auto-SMS BEFORE you make the first dial.', 'true_false',
  'True. The auto-SMS primes the prospect that an expected call is incoming (not spam) and lifts answer rate by 15-25%.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0006-0001-0001-000000000001', 'd2000001-0006-0001-0001-000000000001', 'True', true, 0),
  ('e2000001-0006-0001-0001-000000000002', 'd2000001-0006-0001-0001-000000000001', 'False', false, 1);

-- ============================================================================
-- LESSON 5: The Opening Script — Fresh, Aged, and Mailer (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0005-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The Opening Script — Fresh vs Aged vs Mailer', 'Three different scripts for three different lead types. Win the first 90 seconds.', 4, 'content', 75, true, 18);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000005-0001-0001-0001-000000000001', 'a2000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'Why The First 90 Seconds Matter',
  '<h3>The First 90 Seconds Decide Everything</h3><p>The first 90 seconds of every warm-lead call determine whether you reach the quote stage. Don''t apologize. Don''t over-explain how you got the number. Don''t ask permission to talk.</p><p>You''re not interrupting. The prospect <em>asked</em> for this call by filling out a form or sending back a card. Act like it.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000005-0001-0001-0001-000000000002', 'a2000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 1, 'Fresh Lead Script (≤ 7 days old)',
  'Hi [Name], it''s [Your Name] with [Agency] — you filled out a form online about life insurance coverage. Got you down for [age, state]. I just need to confirm a couple details and we''ll get you a quote.',
  'Reference the form directly. Confident, not apologetic. Move IMMEDIATELY into qualifying questions — do not pause for permission. The prospect filled out the form 30 seconds ago; they''re expecting this.');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000005-0001-0001-0001-000000000003', 'a2000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 2, 'Aged Lead Script (30+ days old)',
  'Hi [Name], it''s [Your Name]. We connect agents with people researching life coverage — your name came up in our system. Quick question: are you still looking, or did you already get something in place?',
  'Do NOT reference the form they filled out. Do NOT acknowledge the time gap. Do NOT apologize. Stay clean and current. The "still looking?" question forces a binary that lets them either re-engage or politely close — both useful outcomes.');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000005-0001-0001-0001-000000000004', 'a2000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 3, 'Mailer-Response Script',
  'Hi [Name], it''s [Your Name]. I''m calling about the [color] card you sent back about [final expense / mortgage protection] coverage. Got that in front of me — let''s get you the information.',
  'Mailer responses are the highest-intent leads you can buy — they physically mailed a card back. Reference the card by color and product. Treat as priority-1 in your daily queue.');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000005-0001-0001-0001-000000000005', 'a2000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 4, 'Three Things Never to Say to an Aged Lead',
  '<h3>Three Things Never to Say to an Aged Lead</h3><ol><li>"<strong>Do you remember filling out a form?</strong>" — Hands them the exit. They''ll say no and you''re done.</li><li>"<strong>I know it''s been a while...</strong>" — Apologetic = weak. Lowers your authority before you''ve said anything useful.</li><li>"<strong>Sorry to bother you.</strong>" — You''re not bothering them. You''re helping them. Sounding apologetic ensures they treat you like an interruption.</li></ol><p>Confidence converts. Apology kills.</p>');

-- ============================================================================
-- LESSON 6: Quiz — Opening Scripts
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0006-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Opening Scripts', 'Confirm the right opener for each lead type and the three things never to say.', 5, 'quiz', 75, true, 8);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0006-0001-0001-000000000001', 'a2000001-0006-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0007-0001-0001-000000000001', 'c2000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'When opening with an aged lead (30+ days), what should you do?', 'multiple_choice',
  'Stay clean and current. Don''t reference the form, don''t reference the time gap, don''t apologize. Ask if they''re still looking — that''s the cleanest re-engagement.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0007-0001-0001-000000000001', 'd2000001-0007-0001-0001-000000000001', 'Apologize for the delay before saying anything else', false, 0),
  ('e2000001-0007-0001-0001-000000000002', 'd2000001-0007-0001-0001-000000000001', 'Ask if they remember filling out the form', false, 1),
  ('e2000001-0007-0001-0001-000000000003', 'd2000001-0007-0001-0001-000000000001', 'Stay clean and current — ask if they''re still looking, never reference the time gap', true, 2),
  ('e2000001-0007-0001-0001-000000000004', 'd2000001-0007-0001-0001-000000000001', 'Open with a hard pitch on the cheapest term policy', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0008-0001-0001-000000000001', 'c2000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Mailer-response leads should be deprioritized because the prospect filled the card out a long time ago.', 'true_false',
  'False. Mailer responses are the HIGHEST-intent leads you can buy — they physically mailed a card back. Treat them as priority-1 in your queue.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0008-0001-0001-000000000001', 'd2000001-0008-0001-0001-000000000001', 'True', false, 0),
  ('e2000001-0008-0001-0001-000000000002', 'd2000001-0008-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0009-0001-0001-000000000001', 'c2000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which of the following is one of the "three things never to say to an aged lead"?', 'multiple_choice',
  'All apologetic openers — "do you remember filling out a form," "I know it''s been a while," "sorry to bother you" — kill conversion. Apology lowers your authority before you''ve said anything useful.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0009-0001-0001-000000000001', 'd2000001-0009-0001-0001-000000000001', '"What''s your zip code?"', false, 0),
  ('e2000001-0009-0001-0001-000000000002', 'd2000001-0009-0001-0001-000000000001', '"Are you still looking for coverage?"', false, 1),
  ('e2000001-0009-0001-0001-000000000003', 'd2000001-0009-0001-0001-000000000001', '"Sorry to bother you — I know it''s been a while since you filled out that form."', true, 2),
  ('e2000001-0009-0001-0001-000000000004', 'd2000001-0009-0001-0001-000000000001', '"What''s the best time to follow up?"', false, 3);

-- ============================================================================
-- LESSON 7: The 30-Day Cadence (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0007-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The 30-Day Cadence', 'The 8-12 touch sequence across phone, SMS, and email that captures the 60-80% who buy after Day 60.', 6, 'content', 75, true, 18);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000007-0001-0001-0001-000000000001', 'a2000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Persistence Curve',
  '<h3>The Persistence Curve</h3><p>Industry data on contact rate by attempt count:</p><ul><li><strong>1 attempt:</strong> ~20-30% contact rate</li><li><strong>3 attempts:</strong> ~50% contact rate</li><li><strong>6+ attempts:</strong> ~70% lift over 1 attempt</li><li><strong>8-12 attempts in 30 days:</strong> industry best-practice ceiling</li></ul><p>Most warm leads need <strong>6-8 touches</strong> before meaningful contact. Stretch the cadence over 14-30 days, not 14-30 hours. The agents who win the most run cadence relentlessly while their competitors give up after touch #2.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000007-0001-0001-0001-000000000002', 'a2000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The 30-Day Blueprint',
  '<h3>The 30-Day Blueprint</h3><p>Tighten the front, stretch the back. <strong>8-12 touches over 14-30 days.</strong></p><table><thead><tr><th>Day</th><th>Touch #</th><th>Action</th><th>Channel</th></tr></thead><tbody><tr><td>0 (within 5 min)</td><td>1</td><td>Auto-SMS + 1st live dial</td><td>SMS + Call</td></tr><tr><td>0 (+30 min)</td><td>2</td><td>2nd dial — different time of day</td><td>Call</td></tr><tr><td>1</td><td>3</td><td>3rd dial AM/PM split</td><td>Call + Voicemail</td></tr><tr><td>2</td><td>4</td><td>"Saw your request — quick quote range"</td><td>SMS or Email</td></tr><tr><td>3</td><td>5</td><td>4th dial</td><td>Call</td></tr><tr><td>5</td><td>6</td><td>Educational SMS with 1-tap link</td><td>SMS</td></tr><tr><td>7</td><td>7</td><td>5th dial + voicemail</td><td>Call</td></tr><tr><td>10</td><td>8</td><td>Quote-comparison email</td><td>Email</td></tr><tr><td>14</td><td>9</td><td>6th dial</td><td>Call</td></tr><tr><td>21</td><td>10</td><td>"Still looking?" SMS</td><td>SMS</td></tr><tr><td>30</td><td>11</td><td>Breakup email</td><td>Email</td></tr></tbody></table>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000007-0001-0001-0001-000000000003', 'a2000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 2, 'The Day 30 Breakup Email',
  'Subject: Closing your file

Hi [Name] — I haven''t heard back, so I''m closing out your request on my end. If life insurance is still on your radar, just reply YES and I''ll reopen it. Otherwise, no hard feelings — best of luck.',
  'Counter-intuitively, this email gets the highest reply rate of any in the sequence. The "closing your file" framing creates urgency without pressure and re-engages 5-10% of stalled leads. Send exactly once at Day 30. Do not chase past this point — move them to your aged-lead bucket for re-marketing later.');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000007-0001-0001-0001-000000000004', 'a2000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 3, 'Vary Time of Day',
  '<h3>Vary Time of Day Across Attempts</h3><p>Most prospects have a "callable window" of 2-4 hours per day. If you only call at 2pm, you''ll never reach the morning-shift workers, the third-shift nurses, or the school-pickup parents. Rotate:</p><ul><li>Attempt 1: form-fill-time + 1 minute</li><li>Attempt 2: same day, 4-5pm window</li><li>Attempt 3: next morning, 9-10am</li><li>Attempt 4: evening, 6-7pm</li><li>Attempt 5: lunch hour, 12-1pm</li></ul><p>Best overall windows for warm-lead dialing: <strong>Tue/Wed 10am-12pm and 4-5pm</strong> in prospect-local time.</p>');

-- ============================================================================
-- LESSON 8: Quiz — The 30-Day Cadence
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0008-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: The 30-Day Cadence', 'Confirm the touch count, the breakup email purpose, and best-practice timing.', 7, 'quiz', 50, true, 5);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0008-0001-0001-000000000001', 'a2000001-0008-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0010-0001-0001-000000000001', 'c2000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'How many touches across how many days does the optimal warm-lead cadence include?', 'multiple_choice',
  '8-12 touches across 14-30 days. Tighten the front (multiple touches in the first 7 days), stretch the back (weekly check-ins through Day 30).', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0010-0001-0001-000000000001', 'd2000001-0010-0001-0001-000000000001', '2-3 touches across 3 days', false, 0),
  ('e2000001-0010-0001-0001-000000000002', 'd2000001-0010-0001-0001-000000000001', '8-12 touches across 14-30 days', true, 1),
  ('e2000001-0010-0001-0001-000000000003', 'd2000001-0010-0001-0001-000000000001', '20+ touches across 60 days', false, 2),
  ('e2000001-0010-0001-0001-000000000004', 'd2000001-0010-0001-0001-000000000001', 'Whatever feels right', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0011-0001-0001-000000000001', 'c2000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The Day 30 "breakup email" is sent because the lead is dead and you''re cleaning up your CRM.', 'true_false',
  'False. The breakup email re-engages 5-10% of stalled leads — counter-intuitively it gets the highest reply rate of any email in the sequence. The "closing your file" framing creates urgency without pressure.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0011-0001-0001-000000000001', 'd2000001-0011-0001-0001-000000000001', 'True', false, 0),
  ('e2000001-0011-0001-0001-000000000002', 'd2000001-0011-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0012-0001-0001-000000000001', 'c2000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What are the best overall windows for warm-lead dialing?', 'multiple_choice',
  'Tue/Wed 10am-12pm and 4-5pm in prospect-local time. Highest answer rates by far. Vary time-of-day across attempts to catch prospects with non-standard schedules.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0012-0001-0001-000000000001', 'd2000001-0012-0001-0001-000000000001', 'Mondays at 8am', false, 0),
  ('e2000001-0012-0001-0001-000000000002', 'd2000001-0012-0001-0001-000000000001', 'Tue/Wed 10am-12pm and 4-5pm prospect-local', true, 1),
  ('e2000001-0012-0001-0001-000000000003', 'd2000001-0012-0001-0001-000000000001', 'Friday afternoons', false, 2),
  ('e2000001-0012-0001-0001-000000000004', 'd2000001-0012-0001-0001-000000000001', 'Sundays after church', false, 3);

-- ============================================================================
-- LESSON 9: Booking & Show-Rate Mastery (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0009-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Booking & Show-Rate Mastery', 'Book tight, reinforce value, run reminders. Take show rate from 67% to 80%+.', 8, 'content', 50, true, 12);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000009-0001-0001-0001-000000000001', 'a2000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'Where Most Agents Bleed Silently',
  '<h3>Where Most Agents Bleed Silently</h3><p>You worked the speed-to-lead. You ran the cadence. You booked the appointment. Now the prospect doesn''t show. Your hourly rate just dropped to zero.</p><p>The data on no-show rate by booking window:</p><ul><li><strong>Same-day appointment:</strong> 2% no-show</li><li><strong>1-3 days out:</strong> 8-12% no-show</li><li><strong>15+ days out:</strong> 33% no-show</li></ul><p>The first lever is simple: <strong>book tight.</strong> "Can you do this afternoon at 3, or tomorrow at 10?" beats "What works next week?"</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000009-0001-0001-0001-000000000002', 'a2000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Three Booking Rules',
  '<h3>The Three Booking Rules</h3><ol><li><strong>Book tight.</strong> Same-day or next-day if at all possible. Every additional day = exponential drop in show rate.</li><li><strong>Get explicit commitment.</strong> "Tuesday at 2 — are you committed to that time?" forces a real yes/no. "Sounds good" is not commitment.</li><li><strong>Reinforce value at booking.</strong> "This is the call where we figure out if you''d save more with term or whole life — and how much coverage your family actually needs." A booked appointment with stated value shows up. A booked appointment without it gets canceled by the next shiny object.</li></ol>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000009-0001-0001-0001-000000000003', 'a2000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Reminder Cadence',
  '<h3>The Reminder Cadence</h3><p>SMS reminders cut no-shows by 29-39%. Run all four:</p><ul><li><strong>Immediate (at booking):</strong> calendar invite + confirmation SMS</li><li><strong>24 hours before:</strong> automated SMS reminder</li><li><strong>1 hour before:</strong> automated SMS reminder</li><li><strong>Morning of:</strong> <em>personal</em> SMS from you (beats automated by 5-7 percentage points)</li></ul><p>The morning-of personal SMS is the single highest-leverage manual task in your day. It takes 30 seconds per appointment and lifts show rate by 5-7 points. On 5 daily appointments, that''s the difference between 4 shows/week and 5+ shows/week — over a year, that''s 50+ extra appointments.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000009-0001-0001-0001-000000000004', 'a2000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 3, 'Morning-Of Personal SMS',
  'Morning [Name]! Just confirming our [time] call today — looking forward to walking you through your [coverage type] options. Talk soon.',
  'Send between 8-10am the day of the appointment. Personal, friendly, brief. Reference the specific time and what you''ll cover. If they''re going to cancel, this gives them an easy way to reply — and a no-show that becomes a reschedule is FAR more valuable than a silent no-show.');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, script_prompt_text, script_prompt_instructions)
VALUES ('b2000009-0001-0001-0001-000000000005', 'a2000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'script_prompt', 4, 'No-Show Recovery SMS (within 5 min of missed appt)',
  'Hey [Name] — looks like we missed each other for our [time] call. Want to grab a quick 15 min later today or tomorrow? Just reply with what works.',
  'Send within 5 minutes of the missed appointment. Friendly, no guilt-trip, no "what happened?" — just an easy reschedule path. Industry data: ~30-40% of no-shows reschedule when this SMS goes out within the first 10 minutes.');

-- ============================================================================
-- LESSON 10: Quiz — Booking & Show Rate
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0010-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Booking & Show Rate', 'Confirm the booking-window math, reminder cadence, and value-reinforcement principle.', 9, 'quiz', 50, true, 5);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0010-0001-0001-000000000001', 'a2000001-0010-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0013-0001-0001-000000000001', 'c2000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is the no-show rate for appointments booked 15+ days out vs same-day?', 'multiple_choice',
  'Same-day = 2% no-show. 15+ days out = 33% no-show. Book tight whenever possible.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0013-0001-0001-000000000001', 'd2000001-0013-0001-0001-000000000001', 'Same: ~10%, 15-day: ~12%', false, 0),
  ('e2000001-0013-0001-0001-000000000002', 'd2000001-0013-0001-0001-000000000001', 'Same: 2%, 15-day: 33%', true, 1),
  ('e2000001-0013-0001-0001-000000000003', 'd2000001-0013-0001-0001-000000000001', 'Same: 0%, 15-day: 50%', false, 2),
  ('e2000001-0013-0001-0001-000000000004', 'd2000001-0013-0001-0001-000000000001', 'No meaningful difference', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0014-0001-0001-000000000001', 'c2000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'How much do SMS reminders reduce no-shows?', 'multiple_choice',
  'SMS reminders cut no-shows by 29-39% — the single most effective intervention. Run 24hr + 1hr automated AND a morning-of personal SMS.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0014-0001-0001-000000000001', 'd2000001-0014-0001-0001-000000000001', '5-10%', false, 0),
  ('e2000001-0014-0001-0001-000000000002', 'd2000001-0014-0001-0001-000000000001', '10-15%', false, 1),
  ('e2000001-0014-0001-0001-000000000003', 'd2000001-0014-0001-0001-000000000001', '29-39%', true, 2),
  ('e2000001-0014-0001-0001-000000000004', 'd2000001-0014-0001-0001-000000000001', '60-70%', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0015-0001-0001-000000000001', 'c2000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A personal morning-of SMS lifts show rate by how much vs automated reminders alone?', 'multiple_choice',
  'A personal SMS the morning of beats automated reminders by 5-7 percentage points. 30 seconds of work per appointment. Highest-leverage manual task in your day.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0015-0001-0001-000000000001', 'd2000001-0015-0001-0001-000000000001', '0-1 percentage points', false, 0),
  ('e2000001-0015-0001-0001-000000000002', 'd2000001-0015-0001-0001-000000000001', '5-7 percentage points', true, 1),
  ('e2000001-0015-0001-0001-000000000003', 'd2000001-0015-0001-0001-000000000001', '20-30 percentage points', false, 2),
  ('e2000001-0015-0001-0001-000000000004', 'd2000001-0015-0001-0001-000000000001', 'Personal SMS hurts show rate', false, 3);

-- ============================================================================
-- LESSON 11: Working Aged Leads Profitably (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0011-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Working Aged Leads Profitably', 'Why aged leads ($1-3 each) often beat fresh leads ($20-40) on cost-per-acquisition. The 60/40 mix and disciplined cadence.', 10, 'content', 75, true, 15);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000011-0001-0001-0001-000000000001', 'a2000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Counter-Intuitive Math',
  '<h3>The Counter-Intuitive Math</h3><p>Most agents view aged leads as "garbage leads someone else couldn''t close." That framing is wrong.</p><p>Aged leads convert at 1-4% (vs 5-10% for fresh) — but at <strong>~10% the cost</strong>. The cost per acquired policy often beats fresh-lead-only programs. Disciplined aged-lead operations report <strong>+150% net ROI</strong> over fresh-only.</p><p>Aged Lead Economics:</p><table><thead><tr><th>Lead age</th><th>Cost per lead</th><th>Conversion rate</th></tr></thead><tbody><tr><td>30-60 days</td><td>$1.25-$5</td><td>1-4%</td></tr><tr><td>60-90 days</td><td>$0.75-$2</td><td>1-3%</td></tr><tr><td>91-365 days</td><td>&lt;$0.75</td><td>0.5-1%</td></tr></tbody></table>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000011-0001-0001-0001-000000000002', 'a2000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The 60/40 Mix Rule',
  '<h3>The 60/40 Mix Rule</h3><p>Don''t buy all aged leads at the same age. Allocate:</p><ul><li><strong>60% of aged-lead budget → 30-90 day age</strong> (better contact rate, higher conversion)</li><li><strong>40% of aged-lead budget → 91-365 day age</strong> (volume play, dirt-cheap, accept lower conversion)</li></ul><p>This balances contact rate with volume and keeps your cost per policy under control.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b2000011-0001-0001-0001-000000000003', 'a2000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'How To Work Them',
  '<h3>How To Work Aged Leads</h3><ol><li><strong>Use the aged-lead script</strong> (Lesson 5) — never reference the time gap, never apologize</li><li><strong>Run the same 8-12 touch cadence</strong> as fresh leads, just at lower per-lead expectation</li><li><strong>Track cost-per-policy, not just close rate</strong> — that''s where aged wins</li><li><strong>Don''t lead with aged leads when you have fresh leads queued</strong> — fresh leads have a clock; aged leads are evergreen</li></ol><p><strong>Calculation exercise:</strong> Take your last 90 days of fresh-lead spend ÷ policies written. That''s your fresh CPP (cost per policy). Then run a 50-lead aged batch and calculate the same. Compare. Most agents are shocked when aged CPP comes in lower.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, external_url, external_url_label)
VALUES ('b2000011-0001-0001-0001-000000000004', 'a2000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'external_link', 3, 'Aged Lead Vendor Reference',
  'https://agedleadstore.com/aged-lead-roi-for-insurance/',
  'Aged Lead ROI Guide (industry data on age-bucket pricing and conversion)');

-- ============================================================================
-- LESSON 12: Quiz — Aged Leads Mastery (final assessment)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a2000001-0012-4000-8000-000000000001', 'a4d5e6f7-0102-4304-8506-070809000a0b', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Aged Leads Mastery', 'Final assessment on aged-lead economics, the 60/40 mix, and discipline.', 11, 'quiz', 75, true, 8);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c2000001-0012-0001-0001-000000000001', 'a2000001-0012-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 50);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0016-0001-0001-000000000001', 'c2000001-0012-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Why are aged leads often more profitable than fresh leads despite lower conversion rates?', 'multiple_choice',
  'Aged leads cost ~10% of fresh leads. Even at 1-4% conversion vs 5-10% for fresh, the cost per acquired policy is often lower — driving +150% net ROI.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0016-0001-0001-000000000001', 'd2000001-0016-0001-0001-000000000001', 'Aged leads convert at higher rates than fresh', false, 0),
  ('e2000001-0016-0001-0001-000000000002', 'd2000001-0016-0001-0001-000000000001', 'Lower cost per acquisition despite lower conversion — the math wins on cost-per-policy', true, 1),
  ('e2000001-0016-0001-0001-000000000003', 'd2000001-0016-0001-0001-000000000001', 'Aged leads close faster than fresh', false, 2),
  ('e2000001-0016-0001-0001-000000000004', 'd2000001-0016-0001-0001-000000000001', 'Aged leads come pre-qualified', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0017-0001-0001-000000000001', 'c2000001-0012-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is the optimal aged-lead age-bucket mix?', 'multiple_choice',
  '60% in 30-90 day age (better contact rate), 40% in 91-365 day age (volume play). Balances contact with volume and keeps CPP in check.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0017-0001-0001-000000000001', 'd2000001-0017-0001-0001-000000000001', '100% in 30-60 day age', false, 0),
  ('e2000001-0017-0001-0001-000000000002', 'd2000001-0017-0001-0001-000000000001', '60% in 30-90 day, 40% in 91-365 day', true, 1),
  ('e2000001-0017-0001-0001-000000000003', 'd2000001-0017-0001-0001-000000000001', '50/50 split between fresh and aged', false, 2),
  ('e2000001-0017-0001-0001-000000000004', 'd2000001-0017-0001-0001-000000000001', '100% in 365+ day age (cheapest)', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0018-0001-0001-000000000001', 'c2000001-0012-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'When you have both fresh leads and aged leads queued, you should work the aged leads first because they''re cheaper.', 'true_false',
  'False. Fresh leads have a clock — speed-to-lead matters. Aged leads are evergreen and can be worked anytime. Always prioritize fresh leads when both are queued.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0018-0001-0001-000000000001', 'd2000001-0018-0001-0001-000000000001', 'True', false, 0),
  ('e2000001-0018-0001-0001-000000000002', 'd2000001-0018-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d2000001-0019-0001-0001-000000000001', 'c2000001-0012-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What metric matters most when evaluating aged-lead profitability?', 'multiple_choice',
  'Cost per acquired policy (CPP). Conversion rate alone undersells aged leads — when you factor in the dramatically lower per-lead cost, CPP often beats fresh.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e2000001-0019-0001-0001-000000000001', 'd2000001-0019-0001-0001-000000000001', 'Conversion rate alone', false, 0),
  ('e2000001-0019-0001-0001-000000000002', 'd2000001-0019-0001-0001-000000000001', 'Number of dials per lead', false, 1),
  ('e2000001-0019-0001-0001-000000000003', 'd2000001-0019-0001-0001-000000000001', 'Cost per acquired policy (CPP)', true, 2),
  ('e2000001-0019-0001-0001-000000000004', 'd2000001-0019-0001-0001-000000000001', 'Lead-vendor satisfaction score', false, 3);

COMMIT;
