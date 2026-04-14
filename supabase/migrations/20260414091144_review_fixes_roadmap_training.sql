-- Corrective migration addressing code-review findings:
-- 1. Training module tenant scoping (restrict to The Standard only)
-- 2. Time-sensitive fact corrections (mileage rate, guaranty association amounts)
-- 3. Estimated duration mismatch
-- 4. Missing compliance disclaimer on Advanced Markets training content
-- 5. Documentation of the Close CRM Guide sort_order drift

BEGIN;

-- ============================================================================
-- 1. SCOPE ADVANCED MARKETS TRAINING TO THE STANDARD AGENCY
-- ============================================================================
-- NOTE: RLS on training_modules filters by imo_id only, NOT by agency_id.
-- Setting agency_id here is application-level intent and aligns with roadmap
-- scoping. True per-agent visibility is enforced via training_assignments
-- (only Standard agents should be assigned).
UPDATE public.training_modules
   SET agency_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       estimated_duration_minutes = 270,   -- was 240; lesson sum is 270
       updated_at = NOW()
 WHERE id = '93c1d2e3-f4a5-4b67-8901-cdef34567890';

-- ============================================================================
-- 2. FIX MILEAGE RATE CLAIM (RUNNING YOUR INSURANCE BUSINESS ROADMAP)
-- ============================================================================
-- Rich-text block at JSONB index 0 on the "Tax Deductions" roadmap item.
-- Replaces "$0.70/mile in 2026" (unverified) with year-neutral guidance.
UPDATE public.roadmap_items
   SET content_blocks = jsonb_set(
         content_blocks,
         '{0,data,html}',
         to_jsonb('<h3>Common Business Deductions</h3><p>Every dollar of legitimate business expense reduces your taxable income. At a 30% effective tax rate, a $100 deduction saves you $30 in taxes. This is why tracking expenses in The Standard HQ matters — it''s literally money in your pocket.</p><p><strong>Deductible business expenses for insurance agents:</strong></p><ul><li><strong>Lead purchases</strong> — Your biggest deduction. Every dollar spent on leads is deductible.</li><li><strong>Software subscriptions</strong> — The Standard HQ, Close CRM, quoting tools, Zoom, etc.</li><li><strong>Phone &amp; internet</strong> — Business portion of your cell phone and home internet</li><li><strong>Home office</strong> — Dedicated workspace in your home (percentage of rent/mortgage + utilities)</li><li><strong>Mileage / travel</strong> — Client meetings, carrier events, training. Use the current IRS standard mileage rate (check irs.gov each year — the rate changes annually)</li><li><strong>Licensing fees</strong> — State license renewals, continuing education courses</li><li><strong>E&amp;O insurance</strong> — Errors &amp; omissions coverage premiums</li><li><strong>Marketing</strong> — Business cards, website, social media ads, mailers</li><li><strong>Professional development</strong> — Industry conferences, coaching, courses</li><li><strong>Health insurance premiums</strong> — Self-employed individuals can deduct 100% of health insurance premiums</li></ul>'::text)
       ),
       updated_at = NOW()
 WHERE id = 'bb100006-0002-4000-8000-000000000001';

-- ============================================================================
-- 3. FIX GUARANTY ASSOCIATION CLAIM (ADVANCED MARKETS ROADMAP)
-- ============================================================================
-- Block at JSONB index 3 on "Handling Annuity Objections" item.
-- Replaces fixed "$250,000" with accurate range language.
UPDATE public.roadmap_items
   SET content_blocks = jsonb_set(
         content_blocks,
         '{3,data,html}',
         to_jsonb('<h3>Objection #4: "What if the insurance company fails?"</h3><p><strong>What they really mean:</strong> They''ve seen news stories about bank failures.</p><p><strong>The response:</strong> "Great question. Insurance companies are regulated at the state level with strict reserve requirements. On top of that, every state has a guaranty association that protects annuity holders. Coverage limits vary by state — typically $100,000 to $500,000 per contract, so your client should check their specific state''s limit. I only work with highly-rated carriers — this company has an A+ rating from A.M. Best. Your principal is as safe as it gets."</p>'::text)
       ),
       updated_at = NOW()
 WHERE id = 'cc200003-0002-4000-8000-000000000001';

-- ============================================================================
-- 4. FIX SAME CLAIM IN ADVANCED MARKETS TRAINING LESSON
-- ============================================================================
-- Single rich_text block in Lesson 5 contains all 5 objections; must preserve
-- objections 1-3 and 5 while correcting #4.
UPDATE public.training_lesson_content
   SET rich_text_content = '<h3>Objection #1: "I don''t want to lock my money up."</h3><p><strong>Response:</strong> "Most annuities allow 10% penalty-free withdrawals per year. Tell me more about what emergency scenarios you''re thinking of — let''s make sure we structure this so you have access to what you need."</p><h3>Objection #2: "Annuities have high fees."</h3><p><strong>Response:</strong> "You''re thinking of variable annuities — those can have 2-4% fees. Fixed and indexed annuities have no annual fees. The only cost is the income rider if you choose one, typically 0.8-1.2%, which is in line with mutual fund expenses."</p><h3>Objection #3: "I can get better returns in the market."</h3><p><strong>Response:</strong> "You''re right — over 30 years, the S&amp;P 500 averages 7-10%. But what if we hit a 2008-style crash the year you retire? You''d lose 40% right before you need the money. An annuity isn''t a replacement for growth investments — it''s insurance against sequence-of-returns risk."</p><h3>Objection #4: "What if the insurance company fails?"</h3><p><strong>Response:</strong> "Insurance companies are state-regulated with strict reserves. Every state has a guaranty association protecting annuity holders — coverage limits vary by state, typically $100,000 to $500,000 per contract. I only work with A+ rated carriers. Your principal is as safe as it gets."</p><h3>Objection #5: "I need to think about it."</h3><p><strong>Response:</strong> "Of course — is there a specific concern I haven''t addressed, or do you need to sleep on it? Who else needs to be part of this decision?" Then set the follow-up appointment before you leave.</p>',
       updated_at = NOW()
 WHERE id = 'b1000005-0001-0001-0001-000000000001';

-- ============================================================================
-- 5. ADD COMPLIANCE DISCLAIMER TO FIRST ADVANCED MARKETS LESSON
-- ============================================================================
-- Shift existing sort_orders up by 1, insert disclaimer at position 0.
-- No unique constraint on (lesson_id, sort_order) so bump is safe.
UPDATE public.training_lesson_content
   SET sort_order = sort_order + 1
 WHERE lesson_id = 'a1000001-0001-4000-8000-000000000001';

INSERT INTO public.training_lesson_content (
  id, lesson_id, imo_id, content_type, sort_order, title, rich_text_content
) VALUES (
  'b1000001-9999-0001-0001-000000000001',
  'a1000001-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'rich_text',
  0,
  'Important Notice: Education Only',
  '<div style="border-left: 4px solid #f59e0b; padding: 12px 16px; background: #fffbeb; margin: 16px 0; border-radius: 4px;"><p><strong>⚠ Agent Education Only — Do Not Copy to Client Materials</strong></p><p>This training contains illustrative examples, dollar amounts, tax figures, and product comparisons intended for <strong>agent education only</strong>. None of the numbers or projections should be copied directly into client presentations, marketing materials, or written recommendations.</p><p>When presenting to clients:</p><ul><li>Always use <strong>current carrier illustrations</strong> with both guaranteed and non-guaranteed values</li><li>Follow your agency''s approved compliance materials</li><li>Include all required state disclosures</li><li>Document suitability per NAIC Best Interest standards</li><li>Verify tax and regulatory figures against current IRS/state guidance</li></ul><p>This module builds your expertise so you can have better conversations with clients — not the script you deliver.</p></div>'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. DOCUMENT CLOSE CRM GUIDE SORT_ORDER DRIFT (TABLE COMMENT)
-- ============================================================================
COMMENT ON TABLE public.roadmap_sections IS
  'Roadmap section grouping. Note: migration 20260413162400 was edited after initial application to resolve a unique-constraint conflict on remote. Both environments converged to sort_order 5-9 for Close CRM Guide new sections. See 20260414091144 migration header for full context.';

COMMIT;
