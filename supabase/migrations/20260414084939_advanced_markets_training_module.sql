-- "Advanced Markets Mastery" training module.
-- 15 lessons (9 content + 6 quizzes), ~4 hours of training, 1,150 XP total.
-- Unassigned by default; admin manually assigns via UI.

BEGIN;

-- ============================================================================
-- MODULE
-- ============================================================================
INSERT INTO public.training_modules (
  id, imo_id, agency_id, title, description, category, difficulty_level,
  estimated_duration_minutes, xp_reward, is_published, is_active, version,
  created_by, tags, metadata, published_at
) VALUES (
  '93c1d2e3-f4a5-4b67-8901-cdef34567890',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  NULL,
  'Advanced Markets Mastery',
  'Level up from term life into annuities, IUL, Infinite Banking, long-term care, and reset appointments. 9 content lessons + 6 quizzes covering the full advanced markets playbook.',
  'product_knowledge',
  'advanced',
  240,
  500,
  true,
  true,
  1,
  'd0d3edea-af6d-4990-80b8-1765ba829896',
  ARRAY['annuities','IUL','IBC','LTC','advanced markets','retirement','estate planning'],
  '{"complementary_roadmap_id": "82b1c2d3-e4f5-4a67-8901-bcdef2345678"}'::jsonb,
  NOW()
);

-- ============================================================================
-- LESSON 1: Why Advanced Markets Matter (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0001-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Why Advanced Markets Matter', 'The income opportunity, the client benefit, and the business moat of advanced markets.', 0, 'content', 50, true, 15);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000001-0001-0001-0001-000000000001', 'a1000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Commission Math',
  '<h3>The Commission Math</h3><p>Let''s start with the numbers that matter. Here''s the typical commission comparison across products:</p><ul><li><strong>Term Life:</strong> $50/mo × $1,200/yr × 80% advance = <strong>$960 commission</strong></li><li><strong>Whole Life:</strong> $300/mo × $3,600/yr × 80% advance = <strong>$2,880 commission</strong></li><li><strong>Indexed Universal Life:</strong> $500/mo × $6,000/yr × 90% advance = <strong>$5,400 commission</strong></li><li><strong>Fixed Indexed Annuity:</strong> $100,000 single premium × 6% = <strong>$6,000 commission</strong></li><li><strong>Large Annuity Case:</strong> $500,000 single premium × 6% = <strong>$30,000 commission</strong></li></ul><p>One good annuity case can equal 30+ term policies. And the client acquisition cost is often lower because advanced market clients come from <em>your existing book of business</em>.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, video_url, video_platform)
VALUES ('b1000001-0001-0001-0001-000000000002', 'a1000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'video', 1, 'The Advanced Markets Opportunity', '', 'youtube');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000001-0001-0001-0001-000000000003', 'a1000001-0001-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Business Moat',
  '<h3>The Client Benefit</h3><p>This isn''t just about commissions. Advanced market products solve real problems term insurance can''t:</p><ul><li><strong>Term life</strong> replaces income if you die — but does nothing if you live.</li><li><strong>Annuities</strong> guarantee you won''t outlive your money.</li><li><strong>IUL</strong> provides tax-free retirement income plus a death benefit.</li><li><strong>Whole life / IBC</strong> builds cash value you can access throughout your life.</li><li><strong>LTC / living benefits</strong> protect against the #1 wealth destroyer.</li></ul><h3>The Business Moat</h3><p>Term life is commoditized. Anyone with a license can compare Quotacy or Haven Life — you compete on price and lose. Advanced markets is <strong>relationship-based</strong>. Top producers have 90%+ client retention and get 40-60% of new business from referrals.</p>');

-- ============================================================================
-- LESSON 2: The Mindset Shift — Fact-Finding (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0002-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The Mindset Shift — Fact-Finding', 'Stop pitching products. Start uncovering problems that products happen to solve.', 1, 'content', 50, true, 20);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000002-0001-0001-0001-000000000001', 'a1000001-0002-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Core Shift',
  '<h3>The Core Shift</h3><p>Term life sales is <strong>product-first</strong>: <em>"Let me show you how affordable coverage is."</em></p><p>Advanced markets is <strong>problem-first</strong>: <em>"Help me understand your situation so I can recommend what makes sense for you."</em></p><p>You''re not a product pusher. You''re a problem-solver. The product comes AFTER you understand the problem.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000002-0001-0001-0001-000000000002', 'a1000001-0002-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Fact-Finder Framework',
  '<h3>The Fact-Finder Framework</h3><p>Every advanced markets appointment should gather answers to these questions BEFORE you mention any product:</p><ol><li><strong>Family &amp; Dependents:</strong> Who depends on your income? Spouse, kids, parents?</li><li><strong>Income &amp; Occupation:</strong> What do you do? How stable? W-2 or self-employed?</li><li><strong>Assets:</strong> Home equity, retirement accounts, savings, investments, business ownership?</li><li><strong>Liabilities:</strong> Mortgage, student loans, credit cards, business debt?</li><li><strong>Current Insurance:</strong> Life, health, disability, LTC — what, where, how much?</li><li><strong>Retirement Plans:</strong> When do you want to retire? What monthly income will you need?</li><li><strong>Concerns:</strong> What keeps you up at night financially?</li><li><strong>Goals:</strong> Legacy? College? Charitable giving?</li></ol>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000002-0001-0001-0001-000000000003', 'a1000001-0002-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Three Magic Questions',
  '<h3>The Three Magic Questions</h3><p>These three questions unlock advanced market conversations:</p><ol><li>"<strong>If something happened to you tomorrow, would your family be okay financially?</strong>" (Identifies life insurance / income replacement gaps)</li><li>"<strong>When you retire, what do you want your monthly income to look like — and where will it come from?</strong>" (Identifies annuity / retirement income gaps)</li><li>"<strong>If you or your spouse needed long-term care, how would you pay for it without destroying your savings?</strong>" (Identifies LTC / living benefits gaps)</li></ol><p>Most clients have NEVER been asked these questions. When you ask them — genuinely, with curiosity — you become something rare: someone who actually cares about their situation.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, video_url, video_platform)
VALUES ('b1000002-0001-0001-0001-000000000004', 'a1000001-0002-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'video', 3, 'Fact-Finder Walkthrough', '', 'youtube');

-- ============================================================================
-- LESSON 3: Quiz — Advanced Markets Fundamentals
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0003-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Advanced Markets Fundamentals', 'Test your understanding of the advanced markets opportunity and the fact-finder framework.', 2, 'quiz', 75, true, 10);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c1000001-0003-0001-0001-000000000001', 'a1000001-0003-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

-- Q1
INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000001-0001-0001-0001-000000000001', 'c1000001-0003-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Why are existing clients typically better advanced markets prospects than cold leads?', 'multiple_choice',
  'Existing clients have a $0 acquisition cost, high trust, and far higher appointment-set and close rates. It''s 10-20x more efficient to work your book than buy new leads.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000001-0001-0001-0001-000000000001', 'd1000001-0001-0001-0001-000000000001', 'They already trust you, acquisition cost is $0, and close rates are 3-5x higher', true, 0),
  ('e1000001-0001-0001-0001-000000000002', 'd1000001-0001-0001-0001-000000000001', 'They''re easier to pressure into buying', false, 1),
  ('e1000001-0001-0001-0001-000000000003', 'd1000001-0001-0001-0001-000000000001', 'They have better credit scores', false, 2),
  ('e1000001-0001-0001-0001-000000000004', 'd1000001-0001-0001-0001-000000000001', 'There''s no difference — all prospects are equal', false, 3);

-- Q2
INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000001-0002-0001-0001-000000000001', 'c1000001-0003-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What percentage of the time should YOU be talking during a proper fact-finder appointment?', 'multiple_choice',
  'The client should talk 70-80% of the time. Your job is to ask great questions and listen. Most new agents talk too much.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000001-0002-0001-0001-000000000001', 'd1000001-0002-0001-0001-000000000001', '20-30%', true, 0),
  ('e1000001-0002-0001-0001-000000000002', 'd1000001-0002-0001-0001-000000000001', '50/50', false, 1),
  ('e1000001-0002-0001-0001-000000000003', 'd1000001-0002-0001-0001-000000000001', '70-80%', false, 2),
  ('e1000001-0002-0001-0001-000000000004', 'd1000001-0002-0001-0001-000000000001', '90-100%', false, 3);

-- Q3
INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000001-0003-0001-0001-000000000001', 'c1000001-0003-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Advanced markets is fundamentally a product-first sales approach.', 'true_false',
  'False. Advanced markets is problem-first. You uncover the client''s situation and concerns, THEN recommend products that solve identified problems. Product-first is term life sales — commoditized and price-driven.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000001-0003-0001-0001-000000000001', 'd1000001-0003-0001-0001-000000000001', 'True', false, 0),
  ('e1000001-0003-0001-0001-000000000002', 'd1000001-0003-0001-0001-000000000001', 'False', true, 1);

-- Q4
INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000001-0004-0001-0001-000000000001', 'c1000001-0003-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which of the three "magic questions" identifies retirement income gaps?', 'multiple_choice',
  '"When you retire, what do you want your monthly income to look like — and where will it come from?" opens annuity and retirement income conversations.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000001-0004-0001-0001-000000000001', 'd1000001-0004-0001-0001-000000000001', '"If something happened to you tomorrow, would your family be okay?"', false, 0),
  ('e1000001-0004-0001-0001-000000000002', 'd1000001-0004-0001-0001-000000000001', '"When you retire, what do you want your monthly income to look like — and where will it come from?"', true, 1),
  ('e1000001-0004-0001-0001-000000000003', 'd1000001-0004-0001-0001-000000000001', '"If you needed long-term care, how would you pay for it?"', false, 2),
  ('e1000001-0004-0001-0001-000000000004', 'd1000001-0004-0001-0001-000000000001', '"How much can you afford each month?"', false, 3);

-- Q5
INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000001-0005-0001-0001-000000000001', 'c1000001-0003-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Approximately how much commission does a $500,000 single-premium Fixed Indexed Annuity typically generate at a 6% commission rate?', 'multiple_choice',
  '$500,000 × 6% = $30,000. Large annuity cases can generate 30x the commission of a term life policy in a single appointment.', 4, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000001-0005-0001-0001-000000000001', 'd1000001-0005-0001-0001-000000000001', '$3,000', false, 0),
  ('e1000001-0005-0001-0001-000000000002', 'd1000001-0005-0001-0001-000000000001', '$6,000', false, 1),
  ('e1000001-0005-0001-0001-000000000003', 'd1000001-0005-0001-0001-000000000001', '$30,000', true, 2),
  ('e1000001-0005-0001-0001-000000000004', 'd1000001-0005-0001-0001-000000000001', '$100,000', false, 3);

-- ============================================================================
-- LESSON 4: Annuities — The Four Types (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0004-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Annuities — The Four Types', 'Fixed, Fixed Indexed, Immediate, and Deferred annuities — knowing which product fits which client.', 3, 'content', 75, true, 25);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000004-0001-0001-0001-000000000001', 'a1000001-0004-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'What Is an Annuity?',
  '<h3>What Is an Annuity?</h3><p>An annuity is a contract between a client and an insurance carrier. The client gives the carrier a lump sum (or series of payments). In return, the carrier provides guaranteed growth, guaranteed income, or both. Annuities are fundamentally about <strong>transferring risk</strong> — specifically market risk and longevity risk (the risk of outliving your money).</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000004-0001-0001-0001-000000000002', 'a1000001-0004-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Four Types',
  '<h3>1. Fixed Annuities (MYGAs)</h3><p>Multi-Year Guaranteed Annuities — like a CD but better. Guaranteed fixed interest rate for a set term (3, 5, 7, 10 years). Tax-deferred growth. Typical rates: 5-6% in current environment.</p><p><strong>Best for:</strong> Conservative clients, CD alternatives, short-term guaranteed growth.</p><h3>2. Fixed Indexed Annuities (FIAs)</h3><p>Principal guaranteed (zero market risk). Growth linked to a market index via participation rates, caps, or spreads. Typical caps: 6-10% per year. Floor: 0% (can''t lose money). Often includes income riders for guaranteed lifetime income.</p><p><strong>Best for:</strong> Market participation without downside risk, retirement income planning.</p><h3>3. Immediate Annuities (SPIAs)</h3><p>Single Premium Immediate Annuity — client gives a lump sum, carrier starts paying income immediately. Converts principal into guaranteed income for life (or period certain). No cash value after purchase.</p><p><strong>Best for:</strong> Retirees who need immediate guaranteed income.</p><h3>4. Deferred Annuities</h3><p>Client pays now, income starts later (5-20+ years). Money grows tax-deferred during deferral period. Can include income riders (GLWB, GMWB).</p><p><strong>Best for:</strong> Pre-retirees building retirement income.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000004-0001-0001-0001-000000000003', 'a1000001-0004-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'Matching Products to Clients',
  '<h3>Matching Products to Clients</h3><ul><li><strong>Age 50, saving for retirement, hates market risk:</strong> Fixed Indexed Annuity with income rider</li><li><strong>Age 65, just retired, needs income now:</strong> Immediate Annuity or FIA with turned-on income rider</li><li><strong>Age 55, has a maturing CD:</strong> Multi-Year Guaranteed Annuity (MYGA)</li><li><strong>Age 70, worried about leaving money behind:</strong> Annuity with death benefit rider</li></ul>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, video_url, video_platform)
VALUES ('b1000004-0001-0001-0001-000000000004', 'a1000001-0004-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'video', 3, 'Annuity Types Explained', '', 'youtube');

-- ============================================================================
-- LESSON 5: Handling Annuity Objections (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0005-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Handling the Top 5 Annuity Objections', 'What clients say, what they actually mean, and how to respond without being defensive.', 4, 'content', 50, true, 20);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000005-0001-0001-0001-000000000001', 'a1000001-0005-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'Top Objections',
  '<h3>Objection #1: "I don''t want to lock my money up."</h3><p><strong>Response:</strong> "Most annuities allow 10% penalty-free withdrawals per year. Tell me more about what emergency scenarios you''re thinking of — let''s make sure we structure this so you have access to what you need."</p><h3>Objection #2: "Annuities have high fees."</h3><p><strong>Response:</strong> "You''re thinking of variable annuities — those can have 2-4% fees. Fixed and indexed annuities have no annual fees. The only cost is the income rider if you choose one, typically 0.8-1.2%, which is in line with mutual fund expenses."</p><h3>Objection #3: "I can get better returns in the market."</h3><p><strong>Response:</strong> "You''re right — over 30 years, the S&P 500 averages 7-10%. But what if we hit a 2008-style crash the year you retire? You''d lose 40% right before you need the money. An annuity isn''t a replacement for growth investments — it''s insurance against sequence-of-returns risk."</p><h3>Objection #4: "What if the insurance company fails?"</h3><p><strong>Response:</strong> "Insurance companies are state-regulated with strict reserves. Every state has a guaranty association protecting annuity holders up to $250,000. I only work with A+ rated carriers. Your principal is as safe as it gets."</p><h3>Objection #5: "I need to think about it."</h3><p><strong>Response:</strong> "Of course — is there a specific concern I haven''t addressed, or do you need to sleep on it? Who else needs to be part of this decision?" Then set the follow-up appointment before you leave.</p>');

-- ============================================================================
-- LESSON 6: Quiz — Annuities Mastery
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0006-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Annuities Mastery', 'Test your knowledge of annuity types, use cases, and objection handling.', 5, 'quiz', 100, true, 15);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c1000001-0006-0001-0001-000000000001', 'a1000001-0006-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000002-0001-0001-0001-000000000001', 'c1000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which annuity type provides guaranteed income immediately after purchase?', 'multiple_choice',
  'An SPIA (Single Premium Immediate Annuity) converts a lump sum into guaranteed income starting within 12 months — best for clients who need income NOW.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000002-0001-0001-0001-000000000001', 'd1000002-0001-0001-0001-000000000001', 'Immediate Annuity (SPIA)', true, 0),
  ('e1000002-0001-0001-0001-000000000002', 'd1000002-0001-0001-0001-000000000001', 'Deferred Annuity', false, 1),
  ('e1000002-0001-0001-0001-000000000003', 'd1000002-0001-0001-0001-000000000001', 'MYGA', false, 2),
  ('e1000002-0001-0001-0001-000000000004', 'd1000002-0001-0001-0001-000000000001', 'Variable Annuity', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000002-0002-0001-0001-000000000001', 'c1000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A Fixed Indexed Annuity (FIA) guarantees principal protection with 0% downside floor.', 'true_false',
  'True. FIAs guarantee the principal — you cannot lose money due to market decline. Growth is linked to an index via caps/participation rates but the floor is 0%.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000002-0002-0001-0001-000000000001', 'd1000002-0002-0001-0001-000000000001', 'True', true, 0),
  ('e1000002-0002-0001-0001-000000000002', 'd1000002-0002-0001-0001-000000000001', 'False', false, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000002-0003-0001-0001-000000000001', 'c1000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A client says "annuities have high fees." What''s the BEST response?', 'multiple_choice',
  'Clients typically confuse fixed/indexed annuities with variable annuities. Fixed and indexed annuities have no annual fees — only the income rider (if chosen) costs ~1%. Clarifying this is essential.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000002-0003-0001-0001-000000000001', 'd1000002-0003-0001-0001-000000000001', 'Most fixed/indexed annuities have no annual fees — only optional income riders cost ~1%', true, 0),
  ('e1000002-0003-0001-0001-000000000002', 'd1000002-0003-0001-0001-000000000001', 'Yes, fees are high but the guarantees make it worth it', false, 1),
  ('e1000002-0003-0001-0001-000000000003', 'd1000002-0003-0001-0001-000000000001', 'Fees are always disclosed in fine print', false, 2),
  ('e1000002-0003-0001-0001-000000000004', 'd1000002-0003-0001-0001-000000000001', 'You get what you pay for', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000002-0004-0001-0001-000000000001', 'c1000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is "sequence-of-returns risk" and why do annuities help?', 'multiple_choice',
  'Sequence-of-returns risk is the danger of a major market decline early in retirement. Annuities provide guaranteed income regardless of market performance, protecting retirees from having to sell investments at a loss.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000002-0004-0001-0001-000000000001', 'd1000002-0004-0001-0001-000000000001', 'The risk of a major market crash near or during retirement; annuities provide guaranteed income regardless of market performance', true, 0),
  ('e1000002-0004-0001-0001-000000000002', 'd1000002-0004-0001-0001-000000000001', 'The risk of investing too conservatively', false, 1),
  ('e1000002-0004-0001-0001-000000000003', 'd1000002-0004-0001-0001-000000000001', 'The risk of inflation eating returns', false, 2),
  ('e1000002-0004-0001-0001-000000000004', 'd1000002-0004-0001-0001-000000000001', 'The risk of choosing the wrong carrier', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000002-0005-0001-0001-000000000001', 'c1000001-0006-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Variable annuities require a securities license (Series 6 or 7) to sell.', 'true_false',
  'True. Variable annuities are securities products. Insurance-only agents must focus on fixed and fixed indexed products unless they obtain securities licensing.', 4, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000002-0005-0001-0001-000000000001', 'd1000002-0005-0001-0001-000000000001', 'True', true, 0),
  ('e1000002-0005-0001-0001-000000000002', 'd1000002-0005-0001-0001-000000000001', 'False', false, 1);

-- ============================================================================
-- LESSON 7: IUL as a LIRP (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0007-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'IUL as a Retirement Tool — The LIRP Strategy', 'Life Insurance Retirement Plans use IUL to create tax-free income that beats 401(k)s for high earners.', 6, 'content', 75, true, 25);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000007-0001-0001-0001-000000000001', 'a1000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'What Is a LIRP?',
  '<h3>What Is a LIRP?</h3><p>A <strong>LIRP (Life Insurance Retirement Plan)</strong> is an IUL policy structured specifically for tax-free retirement income. Instead of optimizing for death benefit, you optimize for cash accumulation. Benefits include:</p><ul><li>Market-linked growth with 0% downside floor</li><li>Tax-free growth (no 1099s, no capital gains)</li><li>Tax-free retirement income via policy loans</li><li>Tax-free death benefit to heirs</li><li>No contribution limits (unlike 401k/IRA)</li><li>No required minimum distributions (RMDs)</li><li>Creditor protection in most states</li></ul>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000007-0001-0001-0001-000000000002', 'a1000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'LIRP Structure',
  '<h3>The Key Structural Elements</h3><ol><li><strong>Minimize the death benefit</strong> — lowest allowed to still qualify as life insurance (not a MEC)</li><li><strong>Maximize the premium</strong> — fund up to the MEC limit for 5-7 years</li><li><strong>Use Increasing Death Benefit (Option B)</strong> during funding years, then switch to Level (Option A)</li><li><strong>Use no-lapse guarantee or overloan protection riders</strong></li><li><strong>Choose a carrier with strong index options and reasonable caps</strong></li></ol><h3>MEC Warning</h3><p>A Modified Endowment Contract (MEC) loses tax benefits. If over-funded in the first 7 years, loans become taxable. Always run MEC-compliant illustrations with 10% buffer.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000007-0001-0001-0001-000000000003', 'a1000001-0007-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'Real LIRP Example',
  '<h3>Real LIRP Example</h3><p><strong>Client:</strong> 40-year-old, healthy, high-income professional ($200k+)</p><ul><li><strong>Premium:</strong> $25,000/year for 7 years = $175,000 total outlay</li><li><strong>Death benefit:</strong> $1,100,000 (minimum to qualify)</li><li><strong>Expected cash value at age 65:</strong> ~$650,000-750,000 (at 6.5% assumed crediting)</li><li><strong>Tax-free retirement income age 65-90:</strong> ~$60,000-75,000/year</li><li><strong>Remaining death benefit at death:</strong> ~$400,000+</li></ul><p><strong>Who is this for?</strong> People who max out 401(k)/IRA, are in high tax brackets (24%+), and want tax-free retirement income. Not for young agents needing cheap term or low-income clients.</p>');

-- ============================================================================
-- LESSON 8: Quiz — IUL & Living Benefits
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0008-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: IUL & Living Benefits', 'Test your understanding of LIRP strategy, MEC rules, and living benefits.', 7, 'quiz', 75, true, 10);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c1000001-0008-0001-0001-000000000001', 'a1000001-0008-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000003-0001-0001-0001-000000000001', 'c1000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'When structuring an IUL as a LIRP, what should you maximize?', 'multiple_choice',
  'For a LIRP, you MINIMIZE death benefit (just enough to qualify as life insurance, not a MEC) and MAXIMIZE premium funding. This creates the most cash value for tax-free retirement income.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000003-0001-0001-0001-000000000001', 'd1000003-0001-0001-0001-000000000001', 'The premium; minimize the death benefit', true, 0),
  ('e1000003-0001-0001-0001-000000000002', 'd1000003-0001-0001-0001-000000000001', 'The death benefit', false, 1),
  ('e1000003-0001-0001-0001-000000000003', 'd1000003-0001-0001-0001-000000000001', 'Both equally', false, 2),
  ('e1000003-0001-0001-0001-000000000004', 'd1000003-0001-0001-0001-000000000001', 'Neither — use a standard illustration', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000003-0002-0001-0001-000000000001', 'c1000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What happens if an IUL policy becomes a MEC (Modified Endowment Contract)?', 'multiple_choice',
  'A MEC loses the tax benefits of life insurance. Specifically, policy loans become taxable income. This is why proper LIRP design stays under MEC limits with 10%+ buffer.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000003-0002-0001-0001-000000000001', 'd1000003-0002-0001-0001-000000000001', 'Policy loans become taxable; tax benefits are lost', true, 0),
  ('e1000003-0002-0001-0001-000000000002', 'd1000003-0002-0001-0001-000000000001', 'The policy is cancelled', false, 1),
  ('e1000003-0002-0001-0001-000000000003', 'd1000003-0002-0001-0001-000000000001', 'Nothing — MEC is a marketing term', false, 2),
  ('e1000003-0002-0001-0001-000000000004', 'd1000003-0002-0001-0001-000000000001', 'The client gets a tax refund', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000003-0003-0001-0001-000000000001', 'c1000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which living benefit rider activates when a client is unable to perform 2+ Activities of Daily Living?', 'multiple_choice',
  'The Chronic Illness Rider triggers when the insured can''t perform 2+ ADLs (bathing, dressing, eating, toileting, transferring, continence) or has severe cognitive impairment.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000003-0003-0001-0001-000000000001', 'd1000003-0003-0001-0001-000000000001', 'Terminal Illness Rider', false, 0),
  ('e1000003-0003-0001-0001-000000000002', 'd1000003-0003-0001-0001-000000000001', 'Chronic Illness Rider', true, 1),
  ('e1000003-0003-0001-0001-000000000003', 'd1000003-0003-0001-0001-000000000001', 'Critical Illness Rider', false, 2),
  ('e1000003-0003-0001-0001-000000000004', 'd1000003-0003-0001-0001-000000000001', 'Disability Rider', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000003-0004-0001-0001-000000000001', 'c1000001-0008-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'LIRPs have no contribution limits and no required minimum distributions (RMDs).', 'true_false',
  'True. Unlike 401(k)s and IRAs which have annual contribution limits and RMDs starting at age 73, LIRPs have no such restrictions. This is a major advantage for high earners.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000003-0004-0001-0001-000000000001', 'd1000003-0004-0001-0001-000000000001', 'True', true, 0),
  ('e1000003-0004-0001-0001-000000000002', 'd1000003-0004-0001-0001-000000000001', 'False', false, 1);

-- ============================================================================
-- LESSON 9: Infinite Banking Concept (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0009-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Infinite Banking Concept (IBC)', 'Overfunded whole life as a personal banking system — controversial and powerful when done right.', 8, 'content', 75, true, 25);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000009-0001-0001-0001-000000000001', 'a1000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Concept',
  '<h3>The Concept</h3><p><strong>Infinite Banking Concept (IBC)</strong> was developed by R. Nelson Nash and published in his 2000 book <em>Becoming Your Own Banker</em>. The core idea: use a properly-structured dividend-paying whole life insurance policy as a personal banking system.</p><p>Instead of borrowing from banks, credit unions, or credit cards, you borrow against your policy''s cash value. You pay the loan back to yourself (with interest) rather than to a third-party lender. Over decades, you capture the interest you would have paid to outside lenders.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000009-0001-0001-0001-000000000002', 'a1000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'Policy Structure',
  '<h3>The 10/90 Rule</h3><ul><li><strong>~10% Base Premium</strong> — buys the death benefit, lowest allowable</li><li><strong>~90% Paid-Up Additions (PUAs)</strong> — adds cash value and paid-up coverage</li><li><strong>PUA Rider</strong> — required to super-fund the policy</li><li><strong>Term Rider</strong> — often added to allow larger PUAs without MEC issues</li></ul><p>Result: a policy with fast-growing cash value (60-70% of premium in year 1, 85-95% by year 5) that you can borrow against.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000009-0001-0001-0001-000000000003', 'a1000001-0009-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'Honest Tradeoffs',
  '<h3>Be Honest About Tradeoffs</h3><p>IBC isn''t magic. Be clear with clients:</p><ul><li>First-year cash value is typically 60-70% of premium — you ARE losing money in year 1</li><li>Break-even is usually year 5-8</li><li>IRR over 30 years is typically 4-6% — solid but not spectacular</li><li>It does NOT beat the stock market on pure returns</li></ul><p><strong>Do not oversell this as "better than the stock market"</strong> — that''s a compliance red flag and it''s not accurate. IBC is about control, liquidity, tax efficiency, and legacy — not maximum returns.</p><h3>Who IBC Is For</h3><ul><li>High-income earners ($150k+) who maxed other tax-advantaged accounts</li><li>Business owners who frequently need capital</li><li>Real estate investors who borrow often</li><li>Anyone with a 20+ year time horizon who values control</li></ul>');

-- ============================================================================
-- LESSON 10: Quiz — IBC
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0010-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Infinite Banking Concept', 'Test your understanding of IBC policy structure and ethical presentation.', 9, 'quiz', 75, true, 10);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c1000001-0010-0001-0001-000000000001', 'a1000001-0010-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000004-0001-0001-0001-000000000001', 'c1000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Who developed the Infinite Banking Concept?', 'multiple_choice',
  'R. Nelson Nash developed IBC and published Becoming Your Own Banker in 2000.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000004-0001-0001-0001-000000000001', 'd1000004-0001-0001-0001-000000000001', 'R. Nelson Nash', true, 0),
  ('e1000004-0001-0001-0001-000000000002', 'd1000004-0001-0001-0001-000000000001', 'Dave Ramsey', false, 1),
  ('e1000004-0001-0001-0001-000000000003', 'd1000004-0001-0001-0001-000000000001', 'Suze Orman', false, 2),
  ('e1000004-0001-0001-0001-000000000004', 'd1000004-0001-0001-0001-000000000001', 'Robert Kiyosaki', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000004-0002-0001-0001-000000000001', 'c1000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'In the 10/90 rule for IBC policy structure, what does the 90% refer to?', 'multiple_choice',
  'In a properly-structured IBC policy, ~10% is base premium (buys death benefit) and ~90% is Paid-Up Additions (PUAs) which add cash value and paid-up coverage.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000004-0002-0001-0001-000000000001', 'd1000004-0002-0001-0001-000000000001', 'Paid-Up Additions (PUAs)', true, 0),
  ('e1000004-0002-0001-0001-000000000002', 'd1000004-0002-0001-0001-000000000001', 'Death benefit', false, 1),
  ('e1000004-0002-0001-0001-000000000003', 'd1000004-0002-0001-0001-000000000001', 'Commission', false, 2),
  ('e1000004-0002-0001-0001-000000000004', 'd1000004-0002-0001-0001-000000000001', 'Term coverage', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000004-0003-0001-0001-000000000001', 'c1000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'IBC can legitimately be sold as "beating the stock market over 30 years."', 'true_false',
  'False. This is a compliance red flag and inaccurate. IBC typically returns 4-6% IRR over 30 years vs S&P 500 at 9-10%. IBC wins on tax efficiency, liquidity, and legacy — not raw returns. Overselling this is dishonest and will damage trust.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000004-0003-0001-0001-000000000001', 'd1000004-0003-0001-0001-000000000001', 'True', false, 0),
  ('e1000004-0003-0001-0001-000000000002', 'd1000004-0003-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000004-0004-0001-0001-000000000001', 'c1000001-0010-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which client is the BEST fit for IBC?', 'multiple_choice',
  'IBC requires significant long-term premium commitment and works best for high earners who have maxed other tax-advantaged accounts and value control/liquidity over maximum returns.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000004-0004-0001-0001-000000000001', 'd1000004-0004-0001-0001-000000000001', '25-year-old earning $50k, needs cheap life insurance', false, 0),
  ('e1000004-0004-0001-0001-000000000002', 'd1000004-0004-0001-0001-000000000001', 'Retiree age 75 needing immediate income', false, 1),
  ('e1000004-0004-0001-0001-000000000003', 'd1000004-0004-0001-0001-000000000001', 'Business owner, age 40, maxed 401(k), $250k+ income, 25+ year horizon', true, 2),
  ('e1000004-0004-0001-0001-000000000004', 'd1000004-0004-0001-0001-000000000001', 'Client with $10k to spare and wants quick returns', false, 3);

-- ============================================================================
-- LESSON 11: LTC & Living Benefits (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0011-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Long-Term Care & Living Benefits', 'The #1 threat to retirement wealth isn''t the market — it''s long-term care costs.', 10, 'content', 50, true, 20);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000011-0001-0001-0001-000000000001', 'a1000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'The Numbers',
  '<h3>The LTC Crisis by the Numbers</h3><ul><li><strong>70%</strong> of Americans 65+ will need some form of long-term care</li><li><strong>$108,000/year</strong> — average cost of a private room in a nursing home</li><li><strong>$60,000/year</strong> — average cost of in-home care (44 hours/week)</li><li><strong>2.4 years</strong> — average duration of LTC needed</li><li><strong>$250,000-$400,000+</strong> — total lifetime LTC cost for a typical American</li></ul><p>Medicare does NOT cover LTC beyond 100 days. Medicaid requires near-total asset depletion. Most families pay out of pocket — depleting retirement, selling homes, bankrupting surviving spouses.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000011-0001-0001-0001-000000000002', 'a1000001-0011-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'Three Solutions',
  '<h3>Three Solutions</h3><p><strong>1. Traditional LTC Insurance (declining)</strong></p><ul><li>Use-it-or-lose-it — if you never need care, premiums are gone</li><li>Premiums can (and often do) increase</li><li>Most carriers have exited the market</li></ul><p><strong>2. Hybrid Life/LTC Products (current standard)</strong></p><ul><li>Permanent life insurance with LTC rider</li><li>If you need LTC, access a portion of the death benefit</li><li>If you don''t, beneficiaries get the death benefit</li><li><strong>Never lose the premium</strong></li></ul><p><strong>3. Life Insurance with Chronic Illness Riders</strong></p><ul><li>Standard permanent life (IUL or WL) with chronic illness rider</li><li>Accelerate death benefit to pay for care</li><li>Often INCLUDED at no extra cost</li></ul><p><strong>Modern approach for age 45-65:</strong> Lead with IUL or WL with chronic illness riders — cheaper than traditional LTC, never use-it-or-lose-it.</p>');

-- ============================================================================
-- LESSON 12: The Reset Appointment (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0012-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The Reset Appointment', 'Your existing book is a goldmine. Learn to go back and protect what your clients have built.', 11, 'content', 75, true, 25);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000012-0001-0001-0001-000000000001', 'a1000001-0012-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'Why Existing Clients',
  '<h3>Why Existing Clients Are Your Best Prospects</h3><p>Compare new leads vs existing clients for advanced market sales:</p><ul><li><strong>CPA:</strong> New leads $200-500 | Existing clients $0</li><li><strong>Appointment set rate:</strong> New 10-20% | Existing 50-70%</li><li><strong>Close rate:</strong> New 5-15% | Existing 30-50%</li><li><strong>Avg case size:</strong> New $1,200 | Existing $3,000-8,000</li></ul><p>A single reset appointment with an existing client is worth 10-20 cold calls. Do 5 reviews per week = 260 reset appointments per year with clients who already trust you.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000012-0001-0001-0001-000000000002', 'a1000001-0012-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'The Opening Script',
  '<h3>The Opening Call</h3><p><em>"Hey [Client Name], it''s [Your Name] from [Agency]. I''m calling because it''s been about [X years] since we set up your life insurance policy, and I make it a practice to check in with all my clients once a year to make sure the coverage still fits. A lot can change in a year — new jobs, new kids, paying off debt, health changes. I''d love to grab 20-30 minutes with you to review where things are at. Do you have time next Tuesday afternoon or Thursday evening?"</em></p><h3>The Appointment Opening</h3><p><em>"Thanks for making time. Before we look at your current policy, I want to ask a few questions about what''s changed since we last talked. Is that okay?"</em></p><p>Then run the fact-finder. Write down everything. Take notes in front of them — signals you''re listening.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000012-0001-0001-0001-000000000003', 'a1000001-0012-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'The Transition & Close',
  '<h3>The Transition to Current Policy</h3><p><em>"Based on what you''ve told me, here''s what''s changed [summarize]. Now let''s look at what you have today. Your current policy is [details]. Does that still match where your life is now?"</em></p><p>Explore gaps based on their answers:</p><ul><li>"Retirement is 15 years out. What''s your plan for income you can''t outlive?" (Annuity)</li><li>"Your business has grown. What happens if something happens to you?" (Buy-sell/key person)</li><li>"Your parents are aging. Have you thought about LTC costs?" (LTC opening)</li></ul><h3>Setting the Next Appointment</h3><p>Advanced products rarely close on the first appointment. Goal: set the next one.</p><p><em>"Based on what we talked about, I want to put together some options for [specific need]. Can we get together again next [day] at [time]? I''ll email you a summary of today and what I''m looking into."</em></p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, video_url, video_platform)
VALUES ('b1000012-0001-0001-0001-000000000004', 'a1000001-0012-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'video', 3, 'Full Reset Appointment Walkthrough', '', 'youtube');

-- ============================================================================
-- LESSON 13: Quiz — Reset Appointments & Prospecting
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0013-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Quiz: Reset Appointments & Prospecting', 'Test your understanding of re-engaging existing clients and finding advanced market prospects.', 12, 'quiz', 75, true, 10);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect)
VALUES ('c1000001-0013-0001-0001-000000000001', 'a1000001-0013-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 70, 3, true, true, true, 25);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000005-0001-0001-0001-000000000001', 'c1000001-0013-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What is the ideal demographic sweet spot for advanced markets prospects?', 'multiple_choice',
  'Age 45-65 with $100k+ household income is the sweet spot — old enough to have wealth worth protecting, young enough to benefit from long-term strategies, thinking about retirement.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000005-0001-0001-0001-000000000001', 'd1000005-0001-0001-0001-000000000001', 'Age 45-65, household income $100k+', true, 0),
  ('e1000005-0001-0001-0001-000000000002', 'd1000005-0001-0001-0001-000000000001', 'Age 18-30, any income', false, 1),
  ('e1000005-0001-0001-0001-000000000003', 'd1000005-0001-0001-0001-000000000001', 'Age 75+, fixed income', false, 2),
  ('e1000005-0001-0001-0001-000000000004', 'd1000005-0001-0001-0001-000000000001', 'Any age, any income', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000005-0002-0001-0001-000000000001', 'c1000001-0013-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Approximately how much better is the close rate on existing clients vs cold leads for advanced market products?', 'multiple_choice',
  'Existing clients close at 30-50% vs cold leads at 5-15% — roughly 3-5x higher. This is why your book is more valuable than any new lead source.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000005-0002-0001-0001-000000000001', 'd1000005-0002-0001-0001-000000000001', 'Same', false, 0),
  ('e1000005-0002-0001-0001-000000000002', 'd1000005-0002-0001-0001-000000000001', '1.5x higher', false, 1),
  ('e1000005-0002-0001-0001-000000000003', 'd1000005-0002-0001-0001-000000000001', '3-5x higher', true, 2),
  ('e1000005-0002-0001-0001-000000000004', 'd1000005-0002-0001-0001-000000000001', '10x higher', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000005-0003-0001-0001-000000000001', 'c1000001-0013-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Advanced market products typically close on the first reset appointment.', 'true_false',
  'False. Advanced products require illustrations, follow-up, and usually spousal input. The goal of the first appointment is to uncover needs and SET the next appointment — not close on the spot.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000005-0003-0001-0001-000000000001', 'd1000005-0003-0001-0001-000000000001', 'True', false, 0),
  ('e1000005-0003-0001-0001-000000000002', 'd1000005-0003-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000005-0004-0001-0001-000000000001', 'c1000001-0013-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What''s the BEST way to identify reset appointment candidates in your book?', 'multiple_choice',
  'Use Close CRM Smart Views filtered by Status = Active Policy, Policy Issue Date > 2 years ago, Age 45-65 or Business Owner. This surfaces your best candidates automatically.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000005-0004-0001-0001-000000000001', 'd1000005-0004-0001-0001-000000000001', 'Build Close CRM Smart Views with status, age, and tenure filters', true, 0),
  ('e1000005-0004-0001-0001-000000000002', 'd1000005-0004-0001-0001-000000000001', 'Cold call everyone in your phone contacts', false, 1),
  ('e1000005-0004-0001-0001-000000000003', 'd1000005-0004-0001-0001-000000000001', 'Only call clients who call you first', false, 2),
  ('e1000005-0004-0001-0001-000000000004', 'd1000005-0004-0001-0001-000000000001', 'Wait for clients to ask for a review', false, 3);

-- ============================================================================
-- LESSON 14: Compliance & Suitability (content)
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0014-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Compliance, Ethics & Suitability', 'The regulatory requirements that govern advanced markets — and why ignoring them can end your career.', 13, 'content', 50, true, 20);

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000014-0001-0001-0001-000000000001', 'a1000001-0014-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 0, 'Suitability',
  '<h3>Suitability — The Legal Standard</h3><p><strong>Suitability</strong> means the product you recommend must be appropriate for the client based on age, income, net worth, risk tolerance, financial goals, and other factors.</p><p><strong>What this requires:</strong></p><ul><li>Collect and document client financial information BEFORE recommending</li><li>Recommendation must match client situation</li><li>Document the basis for your recommendation</li><li>Client must sign a suitability form</li></ul>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000014-0001-0001-0001-000000000002', 'a1000001-0014-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 1, 'Best Interest',
  '<h3>Best Interest — The Higher Standard</h3><p>Many states have adopted the NAIC Best Interest standard (updated 2020), which goes beyond suitability:</p><ul><li><strong>Care obligation:</strong> Know the products and the client</li><li><strong>Disclosure obligation:</strong> Disclose material conflicts of interest (including commissions)</li><li><strong>Conflict of interest obligation:</strong> Identify and mitigate conflicts</li><li><strong>Documentation obligation:</strong> Document the basis for recommendations</li></ul><p>You must act in the client''s best interest, not just recommend a "suitable" product that maximizes commission.</p>');

INSERT INTO public.training_lesson_content (id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content)
VALUES ('b1000014-0001-0001-0001-000000000003', 'a1000001-0014-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text', 2, 'Red Flags',
  '<h3>Compliance Red Flags</h3><p>These will get you fined, sued, or de-licensed:</p><ol><li>Recommending annuities to clients who need liquidity</li><li>Replacement sales without documenting financial benefit to the client</li><li>Misrepresenting non-guaranteed illustrations as guaranteed</li><li>Selling products the client clearly can''t afford</li><li>Pressuring seniors into fast decisions</li><li>Inadequate fact-finding and documentation</li></ol><h3>Documentation to Keep for 7+ Years</h3><ul><li>Suitability form with client financial info</li><li>Needs analysis / fact-finder</li><li>Written rationale for recommendation</li><li>Illustration signed by client</li><li>Replacement forms if applicable (1035 exchanges)</li><li>Application copy</li><li>Material disclosure acknowledgments</li></ul>');

-- ============================================================================
-- LESSON 15: Final Exam — Advanced Markets
-- ============================================================================
INSERT INTO public.training_lessons (id, module_id, imo_id, title, description, sort_order, lesson_type, xp_reward, is_required, estimated_duration_minutes)
VALUES ('a1000001-0015-4000-8000-000000000001', '93c1d2e3-f4a5-4b67-8901-cdef34567890', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Final Exam: Advanced Markets Certification', 'Comprehensive exam covering the entire Advanced Markets module. 80% to pass. Certification upon completion.', 14, 'quiz', 200, true, 20);

INSERT INTO public.training_quizzes (id, lesson_id, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, xp_bonus_perfect, time_limit_minutes)
VALUES ('c1000001-0015-0001-0001-000000000001', 'a1000001-0015-4000-8000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 80, 3, true, true, true, 100, 30);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0001-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'What''s the primary structural difference between a LIRP and a standard whole life policy for death benefit?', 'multiple_choice',
  'A LIRP minimizes death benefit (just enough to qualify as life insurance and avoid MEC status) and maximizes premium funding to create the largest possible cash value for tax-free retirement income.', 0, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0001-0001-0001-000000000001', 'd1000006-0001-0001-0001-000000000001', 'LIRP minimizes death benefit and maximizes premium funding', true, 0),
  ('e1000006-0001-0001-0001-000000000002', 'd1000006-0001-0001-0001-000000000001', 'LIRP maximizes death benefit and minimizes premium', false, 1),
  ('e1000006-0001-0001-0001-000000000003', 'd1000006-0001-0001-0001-000000000001', 'No structural difference', false, 2),
  ('e1000006-0001-0001-0001-000000000004', 'd1000006-0001-0001-0001-000000000001', 'LIRP has no death benefit', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0002-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which of the following is NOT typically a benefit of Fixed Indexed Annuities?', 'multiple_choice',
  'FIAs have caps/participation rates that limit upside — they don''t give unlimited market upside like a direct S&P 500 investment. They DO offer principal protection (0% floor), tax deferral, and guaranteed income options.', 1, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0002-0001-0001-000000000001', 'd1000006-0002-0001-0001-000000000001', 'Unlimited market upside', true, 0),
  ('e1000006-0002-0001-0001-000000000002', 'd1000006-0002-0001-0001-000000000001', 'Principal protection (0% floor)', false, 1),
  ('e1000006-0002-0001-0001-000000000003', 'd1000006-0002-0001-0001-000000000001', 'Tax-deferred growth', false, 2),
  ('e1000006-0002-0001-0001-000000000004', 'd1000006-0002-0001-0001-000000000001', 'Optional guaranteed income riders', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0003-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'An IUL policy with a chronic illness rider is often a better LTC solution for age 45-55 clients than traditional LTC insurance.', 'true_false',
  'True. Traditional LTC is use-it-or-lose-it. IUL with chronic illness rider provides LTC benefits if needed, death benefit if not, plus cash value — better economics for most clients in that age range.', 2, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0003-0001-0001-000000000001', 'd1000006-0003-0001-0001-000000000001', 'True', true, 0),
  ('e1000006-0003-0001-0001-000000000002', 'd1000006-0003-0001-0001-000000000001', 'False', false, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0004-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'For a client with a $200k pension and a wife who''ll outlive him by 10+ years, what strategy protects her income?', 'multiple_choice',
  'Pension Maximization: Take the single-life pension (higher monthly payout) and use the difference vs joint-life to buy life insurance. If he dies first, she has the death benefit for ongoing income. Often produces more total income than joint-life.', 3, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0004-0001-0001-000000000001', 'd1000006-0004-0001-0001-000000000001', 'Pension Maximization with life insurance', true, 0),
  ('e1000006-0004-0001-0001-000000000002', 'd1000006-0004-0001-0001-000000000001', 'Cash out the pension immediately', false, 1),
  ('e1000006-0004-0001-0001-000000000003', 'd1000006-0004-0001-0001-000000000001', 'Take 100% joint-life (no alternative)', false, 2),
  ('e1000006-0004-0001-0001-000000000004', 'd1000006-0004-0001-0001-000000000001', 'Refuse the pension', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0005-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'A business has 3 co-owners. If one dies, what prevents the surviving owners from ending up in business with the deceased owner''s spouse?', 'multiple_choice',
  'A buy-sell agreement funded with life insurance gives surviving owners the cash to buy out the deceased owner''s share from their estate. Without one, the spouse can inherit ownership — usually a disaster for everyone.', 4, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0005-0001-0001-000000000001', 'd1000006-0005-0001-0001-000000000001', 'A buy-sell agreement funded with life insurance', true, 0),
  ('e1000006-0005-0001-0001-000000000002', 'd1000006-0005-0001-0001-000000000001', 'Key person insurance', false, 1),
  ('e1000006-0005-0001-0001-000000000003', 'd1000006-0005-0001-0001-000000000001', 'An executive bonus plan', false, 2),
  ('e1000006-0005-0001-0001-000000000004', 'd1000006-0005-0001-0001-000000000001', 'A prenuptial agreement', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0006-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'How long should you retain suitability documentation after an advanced markets sale?', 'multiple_choice',
  'At least 7 years. Many states and carriers require longer. This includes suitability forms, fact-finders, illustrations, rationale, replacement forms, and disclosure acknowledgments.', 5, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0006-0001-0001-000000000001', 'd1000006-0006-0001-0001-000000000001', 'At least 7 years', true, 0),
  ('e1000006-0006-0001-0001-000000000002', 'd1000006-0006-0001-0001-000000000001', '1 year', false, 1),
  ('e1000006-0006-0001-0001-000000000003', 'd1000006-0006-0001-0001-000000000001', 'Until the client dies', false, 2),
  ('e1000006-0006-0001-0001-000000000004', 'd1000006-0006-0001-0001-000000000001', 'No retention required', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0007-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'When presenting an IUL or annuity illustration, what should you ALWAYS show alongside illustrated values?', 'multiple_choice',
  'You must always show guaranteed values alongside non-guaranteed illustrated values. Illustrated values are projections based on current rates — reality can be different. Showing only illustrated values is a compliance violation.', 6, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0007-0001-0001-000000000001', 'd1000006-0007-0001-0001-000000000001', 'Guaranteed (worst-case) values', true, 0),
  ('e1000006-0007-0001-0001-000000000002', 'd1000006-0007-0001-0001-000000000001', 'Best-case historical values only', false, 1),
  ('e1000006-0007-0001-0001-000000000003', 'd1000006-0007-0001-0001-000000000001', 'Only what the client wants to see', false, 2),
  ('e1000006-0007-0001-0001-000000000004', 'd1000006-0007-0001-0001-000000000001', 'Nothing else — illustrated values are enough', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0008-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Which product is typically NOT recommended for an insurance-only agent to sell without additional licensing?', 'multiple_choice',
  'Variable annuities are securities products requiring a Series 6 or 7 license. Insurance-only agents should stick to fixed annuities, fixed indexed annuities, and life insurance products.', 7, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0008-0001-0001-000000000001', 'd1000006-0008-0001-0001-000000000001', 'Variable Annuities', true, 0),
  ('e1000006-0008-0001-0001-000000000002', 'd1000006-0008-0001-0001-000000000001', 'Fixed Indexed Annuities', false, 1),
  ('e1000006-0008-0001-0001-000000000003', 'd1000006-0008-0001-0001-000000000001', 'Indexed Universal Life', false, 2),
  ('e1000006-0008-0001-0001-000000000004', 'd1000006-0008-0001-0001-000000000001', 'Whole Life', false, 3);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0009-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'The advanced markets business is primarily about maximum commissions.', 'true_false',
  'False. Advanced markets is about building long-term advisor relationships, solving real client problems, and maintaining the highest ethical standards. Chasing maximum commissions leads to compliance violations and destroyed reputations. The commissions follow from doing the right thing.', 8, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0009-0001-0001-000000000001', 'd1000006-0009-0001-0001-000000000001', 'True', false, 0),
  ('e1000006-0009-0001-0001-000000000002', 'd1000006-0009-0001-0001-000000000001', 'False', true, 1);

INSERT INTO public.training_quiz_questions (id, quiz_id, imo_id, question_text, question_type, explanation, sort_order, points)
VALUES ('d1000006-0010-0001-0001-000000000001', 'c1000001-0015-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'For a 60-year-old client nearing retirement with a CD maturing, what annuity is most appropriate?', 'multiple_choice',
  'A MYGA (Multi-Year Guaranteed Annuity) is the closest CD equivalent — guaranteed rate for a fixed term, tax-deferred. Better than a CD because of tax deferral and typically higher rates.', 9, 1);
INSERT INTO public.training_quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES
  ('e1000006-0010-0001-0001-000000000001', 'd1000006-0010-0001-0001-000000000001', 'Multi-Year Guaranteed Annuity (MYGA)', true, 0),
  ('e1000006-0010-0001-0001-000000000002', 'd1000006-0010-0001-0001-000000000001', 'Variable Annuity', false, 1),
  ('e1000006-0010-0001-0001-000000000003', 'd1000006-0010-0001-0001-000000000001', 'Whole Life Insurance', false, 2),
  ('e1000006-0010-0001-0001-000000000004', 'd1000006-0010-0001-0001-000000000001', 'Term Life Insurance', false, 3);

COMMIT;
