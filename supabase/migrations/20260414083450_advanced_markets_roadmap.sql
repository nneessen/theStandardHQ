-- "Advanced Markets" roadmap.
-- Teaches insurance agents how to move upmarket into annuities, IUL,
-- Infinite Banking Concept, long-term care, estate planning, and reset
-- appointments with existing clients.

BEGIN;

-- ============================================================================
-- ROADMAP TEMPLATE
-- ============================================================================
INSERT INTO public.roadmap_templates (id, agency_id, title, description, is_published, is_default, sort_order, created_by)
VALUES (
  '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Advanced Markets',
  'Move upmarket from term life into annuities, IUL, Infinite Banking, long-term care, and estate planning. Learn to reset appointments with existing clients and become the advisor they trust to protect what they''ve built.',
  true, false, 11,
  'd0d3edea-af6d-4990-80b8-1765ba829896'
);

-- ============================================================================
-- SECTION 0: Why Advanced Markets Matter
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0001-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Why Advanced Markets Matter',
  'The income opportunity, the client benefit, and the business moat of advanced markets.',
  0);

-- 0.1 The Advanced Markets Opportunity
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200001-0001-4000-8000-000000000001', 'bb200001-0001-4000-8000-000000000001',
  'The Advanced Markets Opportunity',
  'Why top earners in insurance stop selling term and start protecting wealth.',
  true, true, 10, 0,
  '[
    {"id":"dd200101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Commission Math</h3><p>Let''s start with the numbers that matter. Here''s the typical commission comparison:</p><ul><li><strong>Term Life Policy:</strong> $50/month premium × $1,200 annual × 80% advance = <strong>$960 commission</strong></li><li><strong>Whole Life Policy:</strong> $300/month premium × $3,600 annual × 80% advance = <strong>$2,880 commission</strong></li><li><strong>Indexed Universal Life:</strong> $500/month premium × $6,000 annual × 90% advance = <strong>$5,400 commission</strong></li><li><strong>Fixed Indexed Annuity:</strong> $100,000 single premium × 6% commission = <strong>$6,000 commission</strong></li><li><strong>Large Annuity Case:</strong> $500,000 single premium × 6% commission = <strong>$30,000 commission</strong></li></ul><p>One good annuity case can equal 30+ term policies. And the client acquisition cost is often lower because advanced market clients come from <em>your existing book of business</em>.</p>"}},
    {"id":"dd200101-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"tip","title":"The Efficiency Win","body":"A term-only agent spends 8 hours dialing leads to write one $1,000 case. An advanced markets agent spends 2 hours in a review appointment with an existing client to write a $6,000 annuity case. Same client base, 6x the income, a quarter of the time. This is leverage."}},
    {"id":"dd200101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Client Benefit</h3><p>This isn''t just about your commissions. Advanced market products solve real problems basic term insurance can''t:</p><ul><li><strong>Term life</strong> replaces income if you die — but does nothing if you live.</li><li><strong>Annuities</strong> guarantee you won''t outlive your money in retirement.</li><li><strong>IUL</strong> provides tax-free retirement income plus a death benefit.</li><li><strong>Whole life / IBC</strong> builds cash value you can access throughout your life.</li><li><strong>LTC / living benefits</strong> protect against the #1 wealth destroyer: long-term care costs.</li></ul><p>Your clients need all of these. If you don''t offer them, someone else will — and they''ll take the rest of the relationship with them.</p>"}},
    {"id":"dd200101-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The Business Moat</h3><p>Term life is commoditized. Anyone with a license can compare Quotacy or Haven Life. You compete on price and lose.</p><p>Advanced markets is <strong>relationship-based</strong>. You win because the client trusts you to understand their complete picture — their business, their taxes, their family, their retirement goals. This is why top advanced markets producers have <strong>90%+ client retention</strong> and get 40-60% of new business from referrals.</p>"}},
    {"id":"dd200101-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: The Advanced Markets Opportunity for Life Insurance Agents"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 1: The Mindset Shift
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0002-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'The Mindset Shift — From Sales to Advising',
  'The conversation framework that separates advisors from salespeople.',
  1);

-- 1.1 From Pitching to Fact-Finding
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200002-0001-4000-8000-000000000001', 'bb200001-0002-4000-8000-000000000001',
  'From Pitching to Fact-Finding',
  'Stop trying to sell products. Start uncovering problems that products happen to solve.',
  true, true, 12, 0,
  '[
    {"id":"dd200201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Core Shift</h3><p>Term life sales is <strong>product-first</strong>: \"Let me show you how affordable coverage is.\"</p><p>Advanced markets is <strong>problem-first</strong>: \"Help me understand your situation so I can recommend what makes sense for you.\"</p><p>You''re not a product pusher. You''re a problem-solver. The product comes AFTER you understand the problem.</p>"}},
    {"id":"dd200201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Fact-Finder Framework</h3><p>Every advanced markets appointment should gather answers to these questions before you mention any product:</p><ol><li><strong>Family & Dependents:</strong> Who depends on your income? Spouse, kids, parents, others?</li><li><strong>Income & Occupation:</strong> What do you do? How stable is the income? W-2 or self-employed?</li><li><strong>Assets:</strong> Home equity, retirement accounts (401k, IRA, Roth), savings, investments, business ownership?</li><li><strong>Liabilities:</strong> Mortgage balance, student loans, credit cards, business debt?</li><li><strong>Current Insurance:</strong> What do you have — life, health, disability, LTC? Where? How much?</li><li><strong>Retirement Plans:</strong> When do you want to retire? What will you need monthly?</li><li><strong>Concerns:</strong> What keeps you up at night financially?</li><li><strong>Goals:</strong> Legacy for kids? Paying for college? Charitable giving?</li></ol>"}},
    {"id":"dd200201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Listening > Talking","body":"In a good fact-finder, the client talks 70-80% of the time. Your job is to ask good questions and take notes. When you recommend a product, it should feel like a natural conclusion — not a pitch. Most new agents talk too much. Shut up and listen."}},
    {"id":"dd200201-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The Magic Questions</h3><p>These three questions unlock advanced market conversations:</p><ol><li>\"<strong>If something happened to you tomorrow, would your family be okay financially?</strong>\" (Identifies life insurance / income replacement gaps)</li><li>\"<strong>When you retire, what do you want your monthly income to look like — and where will it come from?</strong>\" (Identifies annuity / retirement income gaps)</li><li>\"<strong>If you or your spouse needed long-term care, how would you pay for it without destroying your savings?</strong>\" (Identifies LTC / living benefits gaps)</li></ol><p>Most clients have NEVER been asked these questions. When you ask them — genuinely, with curiosity — you become something rare: someone who actually cares about their situation.</p>"}},
    {"id":"dd200201-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"success","title":"The Outcome","body":"When you do this right, clients often say: \"Nobody has ever explained this to me before\" or \"I wish my financial advisor would talk to me like this.\" That''s the moment you''ve become their advisor. The products follow naturally from there."}},
    {"id":"dd200201-0001-0001-0001-000000000006","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: The Advanced Markets Fact-Finder Framework"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 2: Annuities Mastery
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0003-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Annuities Mastery',
  'The most lucrative product category in insurance — and the most misunderstood.',
  2);

-- 2.1 Annuity Types
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200003-0001-4000-8000-000000000001', 'bb200001-0003-4000-8000-000000000001',
  'Annuity Types — When to Use Each',
  'Fixed, Fixed Indexed, Immediate, and Deferred — knowing which product fits which client.',
  true, true, 15, 0,
  '[
    {"id":"dd200301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Is an Annuity?</h3><p>An annuity is a contract between a client and an insurance carrier. The client gives the carrier a lump sum (or series of payments). In return, the carrier provides guaranteed growth, guaranteed income, or both. Annuities are fundamentally about <strong>transferring risk</strong> from the client to the carrier — specifically market risk and longevity risk (the risk of outliving your money).</p>"}},
    {"id":"dd200301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Four Main Annuity Types</h3><p><strong>1. Fixed Annuities (MYGAs)</strong></p><ul><li>Multi-Year Guaranteed Annuities — like a CD but better</li><li>Guaranteed fixed interest rate for a set term (3, 5, 7, 10 years)</li><li>Tax-deferred growth</li><li>Typical rates: 5-6% in current environment</li><li><strong>Best for:</strong> Conservative clients, CD alternative, short-term guaranteed growth</li></ul><p><strong>2. Fixed Indexed Annuities (FIAs)</strong></p><ul><li>Principal guaranteed (zero market risk)</li><li>Growth linked to a market index (S&P 500, Nasdaq, etc.) via participation rates, caps, or spreads</li><li>Typical caps: 6-10% per year; typical floor: 0% (you can''t lose money)</li><li>Often includes income riders for guaranteed lifetime income</li><li><strong>Best for:</strong> Clients who want market participation without downside risk, retirement income planning</li></ul><p><strong>3. Immediate Annuities (SPIAs)</strong></p><ul><li>Single Premium Immediate Annuity — client gives a lump sum, carrier starts paying income immediately (within 12 months)</li><li>Converts principal into a guaranteed income stream for life (or period certain)</li><li>No cash value after purchase — it''s pure income</li><li><strong>Best for:</strong> Retirees who need immediate guaranteed income</li></ul><p><strong>4. Deferred Annuities</strong></p><ul><li>Client pays now, income starts later (5-20+ years)</li><li>Money grows tax-deferred during deferral period</li><li>Can include income riders (GLWB, GMWB) for guaranteed future income</li><li><strong>Best for:</strong> Pre-retirees building retirement income</li></ul>"}},
    {"id":"dd200301-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"What About Variable Annuities?","body":"Variable annuities (VAs) require a securities license (Series 6 or 7) to sell. Most insurance-only agents skip VAs and focus on fixed and fixed indexed products, which offer most of the same benefits without the market downside risk. Unless you''re securities-licensed, stick with FIAs."}},
    {"id":"dd200301-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Matching Products to Clients</h3><ul><li><strong>Age 50, saving for retirement, hates market risk:</strong> Fixed Indexed Annuity with income rider</li><li><strong>Age 65, just retired, needs income now:</strong> Immediate Annuity or FIA with turned-on income rider</li><li><strong>Age 55, has a maturing CD:</strong> Multi-Year Guaranteed Annuity (MYGA)</li><li><strong>Age 70, worried about leaving money behind:</strong> Annuity with death benefit rider or Legacy Annuity</li></ul>"}},
    {"id":"dd200301-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: Annuity Types Explained"}}
  ]'::jsonb
);

-- 2.2 Handling Annuity Objections
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200003-0002-4000-8000-000000000001', 'bb200001-0003-4000-8000-000000000001',
  'Handling the Top 5 Annuity Objections',
  'What clients say, what they actually mean, and how to respond without being defensive.',
  true, true, 12, 1,
  '[
    {"id":"dd200401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Objection #1: \"I don''t want to lock my money up.\"</h3><p><strong>What they really mean:</strong> They''re afraid of losing access to their savings if an emergency happens.</p><p><strong>The response:</strong> \"That''s a great concern. Most annuities allow 10% penalty-free withdrawals per year. And most people who buy annuities aren''t planning to touch the principal anyway — the whole point is to grow it tax-deferred and create guaranteed income later. Tell me more about what emergency scenarios you''re thinking of — let''s make sure we structure this so you have access to what you need.\"</p>"}},
    {"id":"dd200401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Objection #2: \"Annuities have high fees.\"</h3><p><strong>What they really mean:</strong> They read something on a Suze Orman blog or heard Dave Ramsey bash annuities.</p><p><strong>The response:</strong> \"You''re thinking of variable annuities — those can have 2-4% in annual fees. Fixed and indexed annuities have no annual fees. The only cost is the income rider if you choose one, typically 0.8-1.2%, which is in line with what mutual funds charge. Let me show you the fee structure on this specific product.\" Then pull up the illustration.</p>"}},
    {"id":"dd200401-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Objection #3: \"I can get better returns in the market.\"</h3><p><strong>What they really mean:</strong> They don''t understand the role of an annuity. They''re comparing to an S&P 500 fund.</p><p><strong>The response:</strong> \"You''re absolutely right — over a 30-year period, the S&P 500 has averaged 7-10%. But what happens if we hit a 2008-style crash the year you retire? You''d lose 40% right before you need the money. An annuity isn''t a replacement for your growth investments — it''s insurance against sequence-of-returns risk. It guarantees a portion of your retirement income regardless of what happens in the market. Would you want 100% of your retirement dependent on the market, or would having some guaranteed income make you sleep better?\"</p>"}},
    {"id":"dd200401-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Objection #4: \"What if the insurance company fails?\"</h3><p><strong>What they really mean:</strong> They''ve seen news stories about bank failures.</p><p><strong>The response:</strong> \"Great question. Insurance companies are regulated at the state level with strict reserve requirements. On top of that, every state has a guaranty association that protects annuity holders up to $250,000 (varies by state) if a carrier fails. I only work with highly-rated carriers — this company has an A+ rating from A.M. Best. Your principal is as safe as it gets.\"</p>"}},
    {"id":"dd200401-0001-0001-0001-000000000005","type":"rich_text","order":4,"data":{"html":"<h3>Objection #5: \"I need to think about it.\"</h3><p><strong>What they really mean:</strong> Usually one of three things — (a) I don''t fully understand this, (b) I need to talk to my spouse, or (c) I''m not ready to commit.</p><p><strong>The response:</strong> \"Of course — this is a big decision and you should think it through. Can I ask — is there a specific concern I haven''t addressed, or is it more about wanting to sleep on it? And who else needs to be part of this decision? Let''s set up a follow-up so we can address any remaining questions together.\" <em>Then actually set the follow-up appointment before you leave.</em></p>"}},
    {"id":"dd200401-0001-0001-0001-000000000006","type":"callout","order":5,"data":{"variant":"tip","title":"The Standard HQ Follow-Up","body":"Use the AI Template Builder to generate a post-appointment email that recaps the conversation, addresses any remaining concerns, and confirms the next appointment. Clients who receive a personalized follow-up email within 24 hours close at 3x the rate of those who don''t."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 3: Indexed Universal Life (Advanced)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0004-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Indexed Universal Life — The Advanced Play',
  'IUL isn''t just a death benefit product — it''s a tax-free retirement income strategy.',
  3);

-- 3.1 IUL as a Retirement Tool (LIRP)
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200004-0001-4000-8000-000000000001', 'bb200001-0004-4000-8000-000000000001',
  'IUL as a Retirement Tool — The LIRP Strategy',
  'Life Insurance Retirement Plans use IUL to create tax-free income that beats 401(k)s for high earners.',
  true, true, 15, 0,
  '[
    {"id":"dd200501-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Is a LIRP?</h3><p>A <strong>LIRP (Life Insurance Retirement Plan)</strong> is an IUL policy structured specifically for tax-free retirement income. Instead of optimizing for death benefit, you optimize for cash accumulation. Done correctly, a LIRP provides:</p><ul><li>Market-linked growth with 0% downside floor</li><li>Tax-free growth (no 1099s, no capital gains)</li><li>Tax-free retirement income via policy loans</li><li>Tax-free death benefit to heirs</li><li>No contribution limits (unlike 401k/IRA)</li><li>No required minimum distributions (RMDs)</li><li>Creditor protection in most states</li></ul>"}},
    {"id":"dd200501-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Key Structural Elements</h3><p>To create a proper LIRP, you must:</p><ol><li><strong>Minimize the death benefit</strong> — use the lowest death benefit allowed while still qualifying as life insurance (not a MEC)</li><li><strong>Maximize the premium</strong> — fund up to the MEC limit for 5-7 years</li><li><strong>Use an Increasing Death Benefit (Option B)</strong> during funding years, then switch to Level (Option A) to maximize cash growth</li><li><strong>Use no-lapse guarantee or overloan protection riders</strong> to prevent policy failure in retirement</li><li><strong>Choose a carrier with strong index options and reasonable caps/participation rates</strong></li></ol>"}},
    {"id":"dd200501-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"MEC Danger","body":"A Modified Endowment Contract (MEC) loses the tax benefits of life insurance. If a client over-funds a policy in the first 7 years, it becomes a MEC and loans become taxable. Always run MEC-compliant illustrations and leave 10% buffer room. Most carriers have automatic MEC protection but don''t rely on it — verify."}},
    {"id":"dd200501-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The Math — A Real LIRP Example</h3><p><strong>Client:</strong> 40-year-old, healthy, high-income professional ($200k+)</p><ul><li><strong>Premium:</strong> $25,000/year for 7 years = $175,000 total outlay</li><li><strong>Death benefit:</strong> $1,100,000 (minimum to qualify)</li><li><strong>Expected cash value at age 65:</strong> ~$650,000-750,000 (illustrated at 6.5% assumed crediting rate)</li><li><strong>Tax-free retirement income age 65-90:</strong> ~$60,000-75,000/year</li><li><strong>Remaining death benefit at death:</strong> ~$400,000+</li></ul><p>Compare to a taxable brokerage account at the same contribution: similar accumulation but with capital gains taxes on withdrawals, no death benefit, no creditor protection, and full market risk.</p>"}},
    {"id":"dd200501-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"tip","title":"Who Is This For?","body":"LIRPs work best for people who max out their 401(k)/IRA, are in high tax brackets (24%+), and want tax-free retirement income. Not ideal for young agents who need cheap term or for low-income clients. Think: doctors, attorneys, business owners, high-income professionals age 35-55."}},
    {"id":"dd200501-0001-0001-0001-000000000006","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: Structuring an IUL as a LIRP"}}
  ]'::jsonb
);

-- 3.2 Living Benefits
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200004-0002-4000-8000-000000000001', 'bb200001-0004-4000-8000-000000000001',
  'Living Benefits & Accelerated Death Benefits',
  'How modern IUL policies let clients access their death benefit while they''re still alive.',
  true, true, 10, 1,
  '[
    {"id":"dd200601-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Are Living Benefits?</h3><p>Modern permanent life insurance (IUL, WL, UL) often includes <strong>accelerated death benefit riders</strong> that let clients access their death benefit while they''re still alive if they experience a qualifying health event. This turns life insurance into an all-purpose protection product.</p>"}},
    {"id":"dd200601-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Three Main Types</h3><ul><li><strong>Terminal Illness Rider:</strong> Diagnosed with a life expectancy of 24 months or less. Can access up to 50-100% of the death benefit tax-free.</li><li><strong>Chronic Illness Rider:</strong> Unable to perform 2+ Activities of Daily Living (bathing, dressing, eating, toileting, transferring, continence) OR severe cognitive impairment. Can access a portion of the death benefit to pay for care.</li><li><strong>Critical Illness Rider:</strong> Diagnosed with heart attack, stroke, cancer, or other listed conditions. Access a lump sum to cover medical costs, lost income, or anything else.</li></ul>"}},
    {"id":"dd200601-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Why This Changes the Sales Conversation</h3><p>Old framing: \"Life insurance pays out when you die.\"</p><p>New framing: \"This policy protects you if you die early, if you get sick, if you can''t work, or if you need long-term care. You can access the benefit while you''re alive. Most life insurance policies 20 years ago didn''t have this — today''s products do.\"</p><p>This is how you address the #1 objection to life insurance: <em>\"I don''t see the benefit because I won''t be around to enjoy it.\"</em> With living benefits, they absolutely might.</p>"}},
    {"id":"dd200601-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"The Self-Insurance LTC Play","body":"For younger clients (age 40-55), a properly structured IUL with chronic illness rider can be a better LTC solution than traditional LTC insurance. Why? If they never need LTC, they keep the cash value and death benefit. Traditional LTC is use-it-or-lose-it. IUL with living benefits is use-it OR pass-it-down."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 4: Infinite Banking Concept (IBC)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0005-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Infinite Banking Concept (IBC)',
  'Overfunded whole life as a personal banking system — controversial, misunderstood, and powerful when done right.',
  4);

-- 4.1 What Is IBC?
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200005-0001-4000-8000-000000000001', 'bb200001-0005-4000-8000-000000000001',
  'What Is Infinite Banking and Who It''s For',
  'Nelson Nash''s concept of using overfunded whole life insurance as a personal banking system.',
  true, true, 15, 0,
  '[
    {"id":"dd200701-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Concept</h3><p><strong>Infinite Banking Concept (IBC)</strong> was developed by R. Nelson Nash and published in his 2000 book <em>Becoming Your Own Banker</em>. The core idea: use a properly-structured dividend-paying whole life insurance policy as a personal banking system.</p><p>Instead of borrowing from banks, credit unions, or credit cards, you borrow against your policy''s cash value. You pay the loan back to yourself (with interest) rather than to a third-party lender. Over decades, you capture the interest you would have paid to banks and keep it in your own family''s wealth.</p>"}},
    {"id":"dd200701-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How the Policy Is Structured</h3><p>The policy isn''t a standard whole life policy. It''s specifically designed for cash accumulation using the <strong>10/90 rule</strong>:</p><ul><li><strong>~10% Base Premium</strong> — buys the death benefit, lowest allowable</li><li><strong>~90% Paid-Up Additions (PUAs)</strong> — adds cash value and paid-up coverage</li><li><strong>PUA Rider</strong> — required to super-fund the policy</li><li><strong>Term Rider</strong> — often added to allow larger PUAs without MEC issues</li></ul><p>Result: a policy with fast-growing cash value (often 60-70% of premium in year 1, 85-95% by year 5) that you can borrow against.</p>"}},
    {"id":"dd200701-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>How the Banking Works</h3><ol><li>Fund the policy with after-tax dollars</li><li>Cash value grows tax-deferred with guaranteed dividends (mutual carriers)</li><li>When you need money — car purchase, investment, business capital — you take a <strong>policy loan</strong> against your cash value</li><li>The cash value <em>still earns dividends</em> while you''re using the loan money (this is the magic)</li><li>You pay the loan back on your own schedule (or not at all — but interest accrues)</li><li>At death, any unpaid loan is subtracted from the death benefit</li></ol><p>Over 30-40 years, you''ve been your own bank — never paying interest to outside lenders, and building a tax-free legacy.</p>"}},
    {"id":"dd200701-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Who IBC Is For","body":"IBC works best for: (1) High-income earners ($150k+) who have maxed out other tax-advantaged accounts, (2) Business owners who frequently need capital, (3) Real estate investors who borrow often, (4) Anyone who wants a long-term (20+ year) wealth strategy and values control. It does NOT work for people who need cheap insurance or short-term returns."}},
    {"id":"dd200701-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"warning","title":"Be Honest About the Tradeoffs","body":"IBC isn''t magic. First-year cash value is typically 60-70% of premium — you ARE losing money in year 1. Break-even is usually year 5-8. IRR over 30 years is typically 4-6% — solid but not spectacular. Do NOT oversell this as \"better than the stock market\" — that''s a compliance red flag and it''s not accurate. IBC is about control, liquidity, tax efficiency, and legacy — not maximum returns."}},
    {"id":"dd200701-0001-0001-0001-000000000006","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: Infinite Banking Concept Explained Honestly"}}
  ]'::jsonb
);

-- 4.2 IBC Misconceptions
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200005-0002-4000-8000-000000000001', 'bb200001-0005-4000-8000-000000000001',
  'Correcting IBC Misconceptions (Ethically)',
  'What gets oversold about IBC and how to present it honestly.',
  false, true, 10, 1,
  '[
    {"id":"dd200801-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Misconception #1: \"You get infinite returns\"</h3><p><strong>The truth:</strong> The name is aspirational, not literal. You''re not getting infinite returns. You''re earning dividends (typically 4-6% net) on cash value that grows tax-deferred, while using that same cash value as collateral for loans. The \"infinite\" refers to the concept of being your own bank indefinitely — not mathematical infinity.</p>"}},
    {"id":"dd200801-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Misconception #2: \"Your money earns double interest\"</h3><p><strong>The truth:</strong> This is a common sales pitch and it''s misleading. The reality is that your cash value continues to earn dividends while you have a loan against it. That''s valuable, but it''s not \"double interest.\" The carrier charges you loan interest that offsets much of the dividend. The net benefit is real but modest — typically 1-2% net arbitrage, not \"double.\"</p>"}},
    {"id":"dd200801-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Misconception #3: \"It beats the stock market\"</h3><p><strong>The truth:</strong> Over 30 years, the S&P 500 has returned 9-10% annualized. A well-structured IBC policy returns 4-6% IRR. IBC does NOT beat the market on pure returns. It wins on tax efficiency, liquidity, guaranteed growth, death benefit, and creditor protection — not raw ROI. Selling it as a market-beater is dishonest and will damage trust when clients figure it out.</p>"}},
    {"id":"dd200801-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Misconception #4: \"Everyone should do this\"</h3><p><strong>The truth:</strong> IBC requires significant long-term capital commitment. A properly-funded IBC policy typically requires $10,000+/year in premiums for decades. It''s wrong for someone making $60k who needs affordable term coverage. It''s right for someone making $250k who has maxed 401(k)/IRA and wants a long-term wealth vehicle. Match the client to the strategy.</p>"}},
    {"id":"dd200801-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"success","title":"The Honest Presentation","body":"\"IBC isn''t magic and it''s not for everyone. It''s a long-term wealth strategy that gives you control, tax efficiency, liquidity, and a death benefit. It works best if you have 20+ years, can commit significant premiums, and value guarantees over maximum returns. Let me show you whether it makes sense for your situation.\" This honest approach builds trust and sells better than hype."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 5: Wealth Protection & Estate Planning
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0006-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Wealth Protection & Estate Planning',
  'How life insurance protects businesses, pays estate taxes, and creates multi-generational legacies.',
  5);

-- 5.1 Legacy Planning with Life Insurance
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200006-0001-4000-8000-000000000001', 'bb200001-0006-4000-8000-000000000001',
  'Legacy Planning with Life Insurance',
  'Use permanent life insurance to create guaranteed tax-free wealth transfer across generations.',
  true, true, 10, 0,
  '[
    {"id":"dd200901-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Legacy Opportunity</h3><p>Life insurance is the only asset that guarantees a tax-free lump sum to heirs. Stocks get capital gains. IRAs get income tax. Real estate gets inheritance and sale costs. Life insurance death benefits are <strong>federal income tax-free</strong> and generally estate-tax-free (when properly structured).</p>"}},
    {"id":"dd200901-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Common Legacy Strategies</h3><ul><li><strong>Pension Maximization:</strong> Client has a pension. If they take the single-life option (higher monthly payment) and use the difference to buy life insurance, the surviving spouse gets the death benefit AND the client got more monthly income.</li><li><strong>IRA Legacy:</strong> Client has a $500k IRA they''ll never spend. Use RMDs to pay premiums on a life insurance policy, creating a tax-free legacy instead of taxable IRA inheritance.</li><li><strong>Charitable Remainder Trust:</strong> Client donates appreciated assets to CRT, gets income stream, and uses income to fund life insurance to replace the asset value for heirs.</li><li><strong>Stretch Alternative:</strong> Post-SECURE Act, non-spouse beneficiaries must drain inherited IRAs in 10 years. Life insurance provides a tax-free alternative without the 10-year window.</li></ul>"}},
    {"id":"dd200901-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Estate Tax Considerations","body":"The federal estate tax exemption is $13.99M per person in 2025 ($27.98M per couple) — very few clients exceed this. But several states have much lower thresholds (MA and OR: $1-2M; NY: $7M). Additionally, the federal exemption is scheduled to sunset in 2026, dropping back to ~$7M. For high net worth clients, Irrevocable Life Insurance Trusts (ILITs) remove the death benefit from the taxable estate."}},
    {"id":"dd200901-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The ILIT — When and Why</h3><p>An <strong>Irrevocable Life Insurance Trust (ILIT)</strong> owns the life insurance policy instead of the insured. Benefits:</p><ul><li>Death benefit is outside the taxable estate (saves 40% federal estate tax on amounts above exemption)</li><li>Creditor protection for the death benefit</li><li>Control over how heirs receive the money (trust terms can dictate distributions)</li></ul><p><strong>Downside:</strong> The insured can''t change the policy or access cash value once it''s in the trust. Requires an attorney to set up ($2-5k). Only makes sense for estates above or near the exemption threshold.</p>"}},
    {"id":"dd200901-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"warning","title":"Team With an Estate Attorney","body":"For any client with significant net worth ($2M+), estate planning requires coordination with an estate attorney. Your role is to provide the insurance product. The attorney structures the trust and tax strategy. Never try to practice law or give specific tax advice — refer to professionals and collaborate."}}
  ]'::jsonb
);

-- 5.2 Business Protection
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200006-0002-4000-8000-000000000001', 'bb200001-0006-4000-8000-000000000001',
  'Business Protection — Key Person, Buy-Sell, and Executive Bonus',
  'Life insurance strategies for business owners and their companies.',
  true, true, 10, 1,
  '[
    {"id":"dd201001-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Key Person Insurance</h3><p>The business owns a life insurance policy on a key employee (often a founder, top salesperson, or critical executive). If that person dies, the business receives the death benefit to cover lost revenue, recruit a replacement, and weather the disruption.</p><p><strong>Sales pitch to the business owner:</strong> \"If your top salesperson died tomorrow, what would happen to your revenue? Key person insurance gives the business $500k-$2M+ in cash to keep operating while you find a replacement. The business pays the premium (it''s a business expense), owns the policy, and receives the benefit.\"</p>"}},
    {"id":"dd201001-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Buy-Sell Agreements</h3><p>When a business has multiple owners, a buy-sell agreement dictates what happens if one dies, becomes disabled, or wants to exit. The agreement is funded with life insurance so the surviving owners have immediate cash to buy out the deceased owner''s share from their family.</p><p><strong>Two main structures:</strong></p><ul><li><strong>Cross-purchase:</strong> Each owner personally owns a policy on every other owner. Best for 2-3 owners. Gets complicated with more.</li><li><strong>Entity purchase (stock redemption):</strong> The business owns a policy on each owner. Simpler for multi-owner businesses.</li></ul><p>Without a buy-sell, surviving owners can end up in business with their deceased partner''s spouse — which is usually a disaster.</p>"}},
    {"id":"dd201001-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Executive Bonus (Section 162 Plans)</h3><p>The business pays life insurance premiums on behalf of a key executive as additional compensation. The executive owns the policy personally. The business gets a tax deduction for the bonus payment; the executive pays income tax on the bonus but owns a valuable permanent life insurance policy with cash value they can use in retirement.</p><p><strong>Pitch:</strong> \"This is a way to give your top executive a benefit that doesn''t show up in the 401(k) or health insurance — a personally-owned life insurance policy with significant cash value. The company deducts the bonus. The executive gets a retirement asset they keep even if they leave.\"</p>"}},
    {"id":"dd201001-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Business Owners Are Gold","body":"Business owners are the highest-value advanced market prospects. They have cash flow, tax problems, succession concerns, and key-person risk. A single business owner client can generate $10-30k in first-year commissions across multiple products: term or permanent life (personal), key person (business), buy-sell (business), executive bonus, and eventually retirement planning."}},
    {"id":"dd201001-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: Business Insurance Strategies"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 6: Long-Term Care & Living Benefits
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0007-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Long-Term Care & Living Benefits',
  'The #1 threat to retirement wealth isn''t the market — it''s long-term care costs.',
  6);

-- 6.1 The LTC Crisis
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200007-0001-4000-8000-000000000001', 'bb200001-0007-4000-8000-000000000001',
  'The LTC Crisis and Modern Solutions',
  'Why 70% of Americans will need long-term care, and how insurance products have evolved to solve it.',
  true, true, 12, 0,
  '[
    {"id":"dd201101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Numbers</h3><ul><li><strong>70%</strong> of Americans 65+ will need some form of long-term care</li><li><strong>$108,000/year</strong> — average cost of a private room in a nursing home (2024 data)</li><li><strong>$60,000/year</strong> — average cost of an in-home care aide (44 hours/week)</li><li><strong>2.4 years</strong> — average duration of long-term care needed</li><li><strong>Total lifetime LTC cost for a typical American: $250,000-$400,000+</strong></li></ul><p>Medicare does NOT cover long-term care beyond 100 days in a skilled nursing facility. Medicaid requires near-total asset depletion to qualify. Most families pay out of pocket — which means depleting retirement accounts, selling homes, and bankrupting the surviving spouse.</p>"}},
    {"id":"dd201101-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Three Solutions</h3><p><strong>1. Traditional LTC Insurance (declining)</strong></p><ul><li>Standalone policy that pays for LTC expenses</li><li>Use-it-or-lose-it — if you never need care, the premiums are gone</li><li>Premiums can (and often do) increase over time</li><li>Most carriers have exited the market; limited options remain</li></ul><p><strong>2. Hybrid Life/LTC Products (current standard)</strong></p><ul><li>Permanent life insurance with LTC rider</li><li>If you need LTC, you access a portion of the death benefit</li><li>If you don''t need LTC, your beneficiaries get the death benefit</li><li>Cash value grows over time</li><li><strong>Best of both worlds:</strong> never \"lose\" the premium</li></ul><p><strong>3. Life Insurance with Chronic Illness Riders</strong></p><ul><li>Standard permanent life insurance (IUL or WL) with chronic illness rider</li><li>Qualifies if unable to perform 2+ ADLs or cognitive impairment</li><li>Accelerate portion of death benefit to pay for care</li><li>Often INCLUDED at no extra cost (vs rider fee for hybrid LTC)</li></ul>"}},
    {"id":"dd201101-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"The Modern Sales Approach","body":"For clients age 45-65, lead with IUL or WL with chronic illness riders. It''s cheaper than traditional LTC, never lose-it-or-lose-it, and provides death benefit, cash value, and LTC protection in one product. Only recommend standalone LTC for clients who specifically want maximum LTC benefits and are over 65."}},
    {"id":"dd201101-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The Conversation</h3><p><em>\"I want to ask you a tough question. If you or [spouse] needed long-term care — nursing home, assisted living, or in-home help — how would you pay for it? [pause] Most people assume Medicare covers it. It doesn''t. The average cost is over $100,000 a year, and the average stay is 2+ years. That means a $250,000+ hit to your retirement savings, usually right when you can least afford it.</em></p><p><em>Here''s what I''d recommend: instead of paying for a separate LTC policy that you lose if you never need care, we can build LTC protection into a life insurance policy you''re already considering. If you need care, you access the money. If you don''t, your family gets the death benefit. Either way, your money isn''t wasted.\"</em></p>"}},
    {"id":"dd201101-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: Solving the Long-Term Care Problem"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 7: The Reset Appointment
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0008-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'The Reset Appointment — Re-Engaging Existing Clients',
  'Your existing book is a goldmine. Learn to go back and protect what your clients have built.',
  7);

-- 7.1 Why Existing Clients Are Your Best Prospects
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200008-0001-4000-8000-000000000001', 'bb200001-0008-4000-8000-000000000001',
  'Why Existing Clients Are Your Best Advanced Market Prospects',
  'The math on why going back to your book is 10x more efficient than buying leads.',
  true, true, 10, 0,
  '[
    {"id":"dd201201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Existing Client Advantage</h3><p>Let''s compare new leads vs existing clients for advanced market sales:</p><table><thead><tr><th>Metric</th><th>New Lead</th><th>Existing Client</th></tr></thead><tbody><tr><td>Acquisition cost</td><td>$200-500 CPA</td><td>$0</td></tr><tr><td>Trust level</td><td>Zero — you''re a stranger</td><td>High — you already helped them</td></tr><tr><td>Appointment set rate</td><td>10-20%</td><td>50-70%</td></tr><tr><td>Close rate on advanced products</td><td>5-15%</td><td>30-50%</td></tr><tr><td>Average case size</td><td>$1,200 commission</td><td>$3,000-8,000 commission</td></tr></tbody></table><p>A single reset appointment with a qualified existing client is worth 10-20 cold calls. And you can do them during your slow hours between other activities.</p>"}},
    {"id":"dd201201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Who to Target First</h3><p>Not every existing client is a good advanced market candidate. Prioritize:</p><ol><li><strong>Clients age 45-65</strong> — In prime advanced markets age for annuities, IUL, and LTC</li><li><strong>Clients with term life</strong> — Ripe for conversion to permanent or additional permanent coverage</li><li><strong>Clients who''ve had a life change</strong> — Marriage, kids, home purchase, career promotion, business start</li><li><strong>Clients with old policies (5+ years)</strong> — Their needs have likely changed</li><li><strong>Clients in higher income brackets</strong> — Can afford larger premium commitments</li><li><strong>Business owners</strong> — Multiple product needs (personal, business, key person, buy-sell)</li></ol>"}},
    {"id":"dd201201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Using Smart Views to Find Them","body":"In Close CRM, build Smart Views for reset candidates: Status = Active Policy AND Policy Issue Date > 2 years ago AND (Age 45-65 OR Custom Field ''Business Owner'' = Yes). This surfaces your best candidates automatically. See the Close CRM Guide roadmap''s Smart Views section."}},
    {"id":"dd201201-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Frequency: The Annual Review</h3><p>Every client should get an annual review appointment. This isn''t a sales pitch — it''s a service your clients expect. A proper annual review:</p><ul><li>Revisits the client''s current situation (job, family, health, finances)</li><li>Reviews their existing policies and confirms they still fit</li><li>Identifies new needs that have emerged</li><li>Updates beneficiaries and contact info</li><li>Opens the door for additional products when appropriate</li></ul><p>If you do 5 annual reviews per week, you''ll have <strong>260 reset appointments per year</strong> with clients who already trust you. That''s your pipeline right there.</p>"}}
  ]'::jsonb
);

-- 7.2 The Reset Appointment Script
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200008-0002-4000-8000-000000000001', 'bb200001-0008-4000-8000-000000000001',
  'The Reset Appointment Script',
  'Word-for-word frameworks for opening, running, and closing a review appointment.',
  true, true, 12, 1,
  '[
    {"id":"dd201301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Opening Call / Text</h3><p><strong>Phone script:</strong></p><p><em>\"Hey [Client Name], it''s [Your Name] from [Agency]. I''m calling because it''s been about [X years] since we set up your life insurance policy, and I make it a practice to check in with all my clients once a year to make sure the coverage still fits. A lot can change in a year — new jobs, new kids, paying off debt, health changes. I''d love to grab 20-30 minutes with you to review where things are at. Do you have time next Tuesday afternoon or Thursday evening?\"</em></p><p><strong>Text/email script:</strong></p><p><em>\"Hey [Name], hope you''re doing well! It''s been [X years] since we set up your policy, and I like to check in with clients annually to make sure everything''s still on track. A lot can change in a year — quick 20-min review? I have Tue 2pm or Thu 6pm open.\"</em></p>"}},
    {"id":"dd201301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Appointment Opening</h3><p><em>\"Thanks for making time. Before we look at your current policy, I want to ask a few questions about what''s changed since we last talked. Is that okay? [Yes.]\"</em></p><p>Then run through the fact-finder questions from Section 1 — family, income, assets, liabilities, retirement plans, concerns. Write down everything. Take notes in front of them — it signals that you''re listening.</p>"}},
    {"id":"dd201301-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Transition to Current Policy</h3><p><em>\"Okay, so based on what you''ve told me, here''s what''s changed: [summarize]. Now let''s look at what you have in place today. Your current policy is [details]. Does that still match where your life is now, or do you think we need to make some changes?\"</em></p><p>Then — based on what they told you — start exploring gaps:</p><ul><li>\"You mentioned retirement is 15 years out. What''s your plan for generating income you can''t outlive?\" (Annuity opening)</li><li>\"You mentioned your business has grown. Have you thought about what happens to the business if something happens to you?\" (Buy-sell / key person)</li><li>\"You mentioned your aging parents. Have you considered what long-term care costs could do to your retirement savings?\" (LTC opening)</li></ul>"}},
    {"id":"dd201301-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>The Close (Setting the Next Appointment)</h3><p>Rarely will a reset appointment close on the first meeting for advanced products — these require illustrations and follow-up. The goal is to set the next appointment:</p><p><em>\"Based on what we talked about, I want to put together some options for [specific need]. Let me pull illustrations and run some numbers. Can we get together again next [day] at [time] to go through what I find? I''ll email you a summary of today and what I''m looking into.\"</em></p><p>Then actually send the email within 24 hours. Use the AI Template Builder in The Standard HQ to generate a recap email that references specific things from the conversation.</p>"}},
    {"id":"dd201301-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"tip","title":"Practice Until It''s Natural","body":"These scripts work when they don''t sound like scripts. Practice them out loud until you''ve internalized the framework — then make them your own. The worst thing you can do is read them robotically. Role-play with your upline or in the Training Hub''s presentation feature before using them on real clients."}},
    {"id":"dd201301-0001-0001-0001-000000000006","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: The Reset Appointment — Full Walkthrough"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 8: Prospecting for Advanced Markets
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0009-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Prospecting for Advanced Markets',
  'Finding and qualifying new prospects who can benefit from advanced market products.',
  8);

-- 8.1 The Ideal Prospect Profile
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200009-0001-4000-8000-000000000001', 'bb200001-0009-4000-8000-000000000001',
  'The Ideal Advanced Markets Prospect',
  'Who to target, where to find them, and how to qualify them quickly.',
  true, true, 10, 0,
  '[
    {"id":"dd201401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Demographics Sweet Spot</h3><p>Advanced market products work for specific life stages and financial profiles:</p><ul><li><strong>Age 45-65:</strong> The sweet spot. Old enough to have wealth to protect, young enough to benefit from long-term strategies. Thinking about retirement. Kids often launched.</li><li><strong>Household Income $100k+:</strong> Can afford premium commitments. Has tax problems that advanced markets solve.</li><li><strong>Owns a home:</strong> Stable, rooted, long-term thinker</li><li><strong>Has retirement accounts:</strong> Understands tax-deferred growth. Already saving.</li><li><strong>Business owner or professional:</strong> High income, tax problems, succession concerns</li></ul>"}},
    {"id":"dd201401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Three Target Groups</h3><p><strong>1. Pre-Retirees (Age 50-65)</strong></p><p>Top concerns: running out of money in retirement, market crash before retirement, LTC costs, leaving something for kids/grandkids. Products: annuities, FIA with income riders, hybrid LTC, permanent life for legacy.</p><p><strong>2. Business Owners (Age 35-60)</strong></p><p>Top concerns: business continuity, succession, tax mitigation, key person risk, retirement funding outside the business. Products: buy-sell agreements, key person, executive bonus (162), LIRP/IUL, annuities for retirement income.</p><p><strong>3. High-Income Professionals (Age 35-55)</strong></p><p>Top concerns: tax burden, maxing retirement savings, disability protection, legacy planning. Products: LIRP/IUL, disability insurance, permanent life with PUAs, estate planning.</p>"}},
    {"id":"dd201401-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Where to Find Them</h3><ul><li><strong>Your existing book</strong> — start here (see Section 7)</li><li><strong>Referrals from existing clients</strong> — ask after every good appointment</li><li><strong>Centers of Influence (COIs)</strong> — CPAs, attorneys, real estate agents who serve your target market</li><li><strong>Chamber of Commerce / BNI</strong> — local business owner networks</li><li><strong>LinkedIn</strong> — search by job title, industry, location</li><li><strong>Seminars</strong> — Social Security seminars, retirement planning workshops</li><li><strong>Internet leads</strong> — segmented for retirement/annuity interest (higher cost but higher intent)</li></ul>"}},
    {"id":"dd201401-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"The COI Strategy","body":"A single CPA with 200+ business owner clients can send you referrals for years. Build relationships with 5-10 CPAs, estate attorneys, and real estate agents in your area. Buy them coffee quarterly. Show them how you can help their clients (and send them referrals back). This is the most underutilized prospecting strategy for advanced markets."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 9: Product Illustrations & Client Presentations
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0010-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Product Illustrations & Client Presentations',
  'How to present complex products in a way clients actually understand.',
  9);

-- 9.1 Reading and Explaining Illustrations
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200010-0001-4000-8000-000000000001', 'bb200001-0010-4000-8000-000000000001',
  'How to Read and Explain Illustrations',
  'Simplify 30-page carrier illustrations into a 5-minute client-friendly explanation.',
  true, true, 12, 0,
  '[
    {"id":"dd201501-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Illustration Problem</h3><p>A typical IUL or annuity illustration is 20-40 pages of dense, jargon-filled tables and charts. No client reads them cover to cover. Your job is to <strong>translate</strong> the key information into language your client understands.</p>"}},
    {"id":"dd201501-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The 5 Pages That Matter</h3><p>Every illustration has the same key pages — just find them:</p><ol><li><strong>Cover/Summary Page:</strong> Product name, insured info, premium, death benefit</li><li><strong>Guaranteed Values Column:</strong> The worst-case-scenario numbers. What the client gets if everything goes wrong.</li><li><strong>Non-Guaranteed/Illustrated Values:</strong> What the carrier projects based on assumed interest rates or index performance.</li><li><strong>Narrative Summary:</strong> Plain-English explanation of how the product works (carriers include this for compliance).</li><li><strong>Income or Distribution Page (for LIRP/retirement products):</strong> How much income the client can take, and for how long.</li></ol><p>These 5 pages tell 95% of the story. The rest is compliance disclosure.</p>"}},
    {"id":"dd201501-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Client Presentation Framework</h3><p>Use the <strong>3-Column Presentation</strong>:</p><table><thead><tr><th>Premium</th><th>Guaranteed</th><th>Illustrated (Expected)</th></tr></thead><tbody><tr><td>$10,000/yr</td><td>$180,000 cash value at age 65</td><td>$410,000 cash value at age 65</td></tr><tr><td>for 10 years</td><td>$18,000/yr income</td><td>$38,000/yr income</td></tr><tr><td>($100k total)</td><td>tax-free from 65-85</td><td>tax-free from 65-85</td></tr></tbody></table><p>\"Here''s what you''re guaranteed — the worst case scenario. And here''s what the carrier''s history suggests is realistic. Reality will be somewhere between these two numbers. Even if we hit the guaranteed number, you''ve tripled your money. If we hit the illustrated number, you''ve quadrupled it.\"</p>"}},
    {"id":"dd201501-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Compliance Guardrails","body":"Never say illustrated values ARE what the client will get. They''re projections. Use language like \"based on the carrier''s projections,\" \"illustrated at the current rate,\" \"non-guaranteed.\" The regulatory default is that you should always show guaranteed values alongside illustrated. If you oversell non-guaranteed returns, you''re creating compliance exposure and breaking trust when reality falls short."}},
    {"id":"dd201501-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"tip","title":"The \"Good, Better, Best\" Framework","body":"When presenting IUL or annuity options, show THREE versions: a minimum option, a moderate option, and an optimal option. Clients rarely choose the cheapest or the most expensive — they usually pick the middle. The three-option format also prevents a \"yes/no\" binary decision, replacing it with \"which one\" — a much easier close."}},
    {"id":"dd201501-0001-0001-0001-000000000006","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: Presenting Illustrations Like a Pro"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 10: Carrier Selection for Advanced Markets
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0011-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Carrier Selection for Advanced Markets',
  'Choosing the right carrier for each strategy — not all carriers are equal in advanced markets.',
  10);

-- 10.1 Matching Carriers to Strategies
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200011-0001-4000-8000-000000000001', 'bb200001-0011-4000-8000-000000000001',
  'Matching Carriers to Advanced Market Strategies',
  'Different carriers excel at different products. Know who to use for what.',
  true, true, 10, 0,
  '[
    {"id":"dd201601-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Not All Carriers Are Equal</h3><p>In term life, most major carriers are roughly interchangeable — price and underwriting drive the choice. In advanced markets, carriers specialize. Using the wrong carrier for a strategy is the #1 mistake new advanced markets agents make.</p>"}},
    {"id":"dd201601-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>By Strategy — General Guidelines</h3><p><strong>For Infinite Banking (overfunded whole life):</strong></p><ul><li>Must be a <strong>mutual company</strong> (dividend-paying)</li><li>Strong dividend history over 30+ years</li><li>PUA rider with minimal fees</li><li>Non-direct-recognition dividend policy (so policy loans don''t reduce dividends)</li><li>Top carriers in this space: MassMutual, Guardian, Penn Mutual, Ohio National, New York Life</li></ul><p><strong>For IUL (LIRP/retirement income):</strong></p><ul><li>Strong index options and competitive caps/participation rates</li><li>Allows high PUA funding / loose MEC limits</li><li>Good living benefits riders</li><li>Top carriers: Nationwide, National Life, F&G, Allianz, Pacific Life, North American</li></ul><p><strong>For Fixed Indexed Annuities:</strong></p><ul><li>Strong income rider (GLWB) with high roll-up rates</li><li>Good index options (S&P 500, Nasdaq, volatility-controlled indices)</li><li>Reasonable surrender schedule</li><li>Top carriers: Athene, Allianz, Nationwide, F&G, American Equity, Security Benefit</li></ul>"}},
    {"id":"dd201601-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Wholesaler Relationship</h3><p>Every carrier has a <strong>wholesaler / internal representative</strong> who works with agents. A good wholesaler is gold — they can:</p><ul><li>Run illustrations for you</li><li>Help you structure complex cases</li><li>Answer product questions quickly</li><li>Give you access to carrier training and resources</li><li>Advocate for you during underwriting</li></ul><p>Build relationships with 3-5 wholesalers at your top carriers. Take their calls. Go to their events. When you have a tough case, they''ll help you win it.</p>"}},
    {"id":"dd201601-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"info","title":"The Standard HQ Comp Guide","body":"Use The Standard HQ''s Comp Guide to compare commission rates across carriers for each product type. Your IMO/agency has negotiated specific contracts with each carrier — make sure you know your contract level and which carriers pay best for your focus products."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 11: Compliance, Ethics & Suitability
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb200001-0012-4000-8000-000000000001', '82b1c2d3-e4f5-4a67-8901-bcdef2345678',
  'Compliance, Ethics & Suitability',
  'The regulatory requirements and ethical responsibilities of advanced markets selling.',
  11);

-- 11.1 Suitability and Best Interest
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc200012-0001-4000-8000-000000000001', 'bb200001-0012-4000-8000-000000000001',
  'Suitability, Best Interest, and Compliance',
  'The rules that govern advanced markets sales — and why ignoring them can end your career.',
  true, true, 12, 0,
  '[
    {"id":"dd201701-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Suitability — The Legal Standard</h3><p><strong>Suitability</strong> means the product you recommend must be <em>suitable</em> for the client based on their age, income, net worth, risk tolerance, financial goals, and other factors. Every state has suitability requirements for annuities. Most states have adopted the NAIC Suitability in Annuity Transactions Model Regulation.</p><p><strong>What this means in practice:</strong></p><ul><li>You must collect and document client financial information before recommending annuities</li><li>Your recommendation must be appropriate given that information</li><li>You must document the basis for your recommendation</li><li>The client must sign a suitability form confirming the product matches their needs</li></ul>"}},
    {"id":"dd201701-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Best Interest — The Higher Standard</h3><p>Many states have adopted the <strong>NAIC Best Interest</strong> standard (updated 2020), which goes beyond suitability. It requires:</p><ul><li><strong>Care obligation:</strong> Know the products you sell and the client''s situation</li><li><strong>Disclosure obligation:</strong> Disclose all material conflicts of interest (including commissions)</li><li><strong>Conflict of interest obligation:</strong> Identify and mitigate conflicts</li><li><strong>Documentation obligation:</strong> Document the basis for recommendations</li></ul><p>The practical effect: you must act in the client''s best interest, not just recommend a \"suitable\" product that maximizes your commission.</p>"}},
    {"id":"dd201701-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"Compliance Red Flags","body":"Things that will get you fined, sued, or de-licensed: (1) Recommending annuities to clients who need liquidity, (2) Replacement sales without documenting the financial benefit to the client, (3) Misrepresenting non-guaranteed illustrations as guaranteed, (4) Selling products the client clearly can''t afford, (5) Pressuring seniors into fast decisions, (6) Inadequate fact-finding and documentation."}},
    {"id":"dd201701-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Required Documentation</h3><p>For every advanced markets sale, you should have a file containing:</p><ol><li>Completed suitability form with client''s financial information</li><li>Needs analysis or fact-finder</li><li>Written rationale for your recommendation</li><li>Illustration signed by the client</li><li>Any replacement forms (Form 1035 for annuity exchanges, replacement notices)</li><li>Copy of the application</li><li>Client acknowledgment of material disclosures</li></ol><p>Keep these files for <strong>at least 7 years</strong>. Many states and carriers require longer.</p>"}},
    {"id":"dd201701-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"tip","title":"Use The Standard HQ for Document Management","body":"Upload compliance documents to your client''s record in The Standard HQ. Having everything in one place protects you if a client ever complains or files a suitability challenge. The few minutes of documentation per sale can save your license."}},
    {"id":"dd201701-0001-0001-0001-000000000006","type":"rich_text","order":4,"data":{"html":"<h3>The Ethical Bottom Line</h3><p>Your reputation is your most valuable asset. Sell products that genuinely help clients. Disclose commissions when asked. Never pressure. Never misrepresent. Never sell something you wouldn''t recommend to your own parents.</p><p>Advanced markets is a long-game business. One ethical violation can end a career that took 15 years to build. Do it right. The money will come.</p>"}},
    {"id":"dd201701-0001-0001-0001-000000000007","type":"video","order":5,"data":{"url":"","platform":"youtube","title":"Video: Compliance and Ethics in Advanced Markets"}}
  ]'::jsonb
);

COMMIT;
