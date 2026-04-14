-- "Running Your Insurance Business" roadmap.
-- Teaches new insurance agents to think like business owners:
-- revenue, expenses, ROI, taxes, cash flow, retention, and scaling.

BEGIN;

-- ============================================================================
-- ROADMAP TEMPLATE
-- ============================================================================
INSERT INTO public.roadmap_templates (id, agency_id, title, description, is_published, is_default, sort_order, created_by)
VALUES (
  '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Running Your Insurance Business',
  'You''re not an employee — you''re a business owner. Learn to track revenue, manage expenses, calculate ROI, plan for taxes, and scale your insurance practice into a real business.',
  true, false, 10,
  'd0d3edea-af6d-4990-80b8-1765ba829896'
);

-- ============================================================================
-- SECTION 0: Business Owner Mindset
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0001-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Business Owner Mindset',
  'The most important shift you''ll make: from employee thinking to business owner thinking.',
  0);

-- 0.1 The 1099 vs W-2 Reality
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100001-0001-4000-8000-000000000001', 'aa100001-0001-4000-8000-000000000001',
  'The 1099 vs W-2 Reality',
  'Understand what it really means to be an independent contractor — nobody is withholding taxes, providing benefits, or guaranteeing your income.',
  true, true, 10, 0,
  '[
    {"id":"cc100101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>You Are Not an Employee</h3><p>As an insurance agent, you are a <strong>1099 independent contractor</strong>. This is fundamentally different from every W-2 job you''ve ever had. Here''s what that means in practice:</p><ul><li><strong>No tax withholding</strong> — every dollar you earn hits your bank account untouched. The IRS still expects their cut, and they want it quarterly.</li><li><strong>No employer-provided benefits</strong> — health insurance, retirement contributions, paid time off? That''s all on you now.</li><li><strong>No guaranteed paycheck</strong> — you eat what you kill. Zero production means zero income. There is no salary floor.</li><li><strong>No one managing your schedule</strong> — freedom is great until discipline disappears. You set your own hours, which means you can also set zero hours.</li></ul>"}},
    {"id":"cc100101-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"The #1 New Agent Mistake","body":"Treating commission checks like W-2 paychecks. When you get a $3,000 advance commission, that is NOT $3,000 of spending money. After taxes (~30%), potential chargebacks, and business expenses, your actual take-home might be $1,500-1,800. If you spend the full $3,000, you will end up owing money."}},
    {"id":"cc100101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Mindset Shift</h3><p>Stop saying <em>\"I sell insurance.\"</em> Start saying <em>\"I run an insurance business.\"</em></p><p>That one sentence changes everything. A person who sells insurance waits for leads and hopes for sales. A person who runs an insurance business tracks metrics, manages cash flow, invests in growth, and makes strategic decisions about where to spend time and money.</p><p>Every successful agent you see — the ones earning $200k, $500k, $1M+ — they all made this shift. They treat their practice like a business with revenue, expenses, profit margins, and a growth plan.</p>"}},
    {"id":"cc100101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Action Item","body":"Open a separate business checking account THIS WEEK if you haven''t already. All commission deposits go into the business account. You pay yourself a consistent amount from it. This single habit prevents more financial disasters than any other."}},
    {"id":"cc100101-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: The 1099 Reality — What Every New Agent Must Understand"}}
  ]'::jsonb
);

-- 0.2 Setting Up Your Business Entity
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100001-0002-4000-8000-000000000001', 'aa100001-0001-4000-8000-000000000001',
  'Setting Up Your Business Entity',
  'LLC, EIN, business banking — the legal and financial foundation of your insurance practice.',
  true, true, 8, 1,
  '[
    {"id":"cc100201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Your Business Foundation</h3><p>Before you write your first policy, set up the legal and financial infrastructure for your business. This protects you personally, simplifies taxes, and makes you look professional.</p>"}},
    {"id":"cc100201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Setup Checklist</h3><ol><li><strong>Form an LLC</strong> — Separates your personal assets from business liabilities. File in your home state. Cost: $50-500 depending on state. (See the ''Start an LLC'' roadmap for step-by-step instructions.)</li><li><strong>Get an EIN</strong> — Your business''s Social Security number. Free from the IRS website. Takes 5 minutes. (See the ''Apply for EIN'' roadmap.)</li><li><strong>Open a Business Bank Account</strong> — Use your LLC name and EIN. Keep it 100% separate from personal finances.</li><li><strong>Get a Business Credit Card</strong> — Puts all business expenses in one place. Easier to track, easier to deduct.</li><li><strong>Set Up Accounting</strong> — QuickBooks Self-Employed ($15/month), Wave (free), or at minimum a dedicated spreadsheet.</li></ol>"}},
    {"id":"cc100201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Existing Roadmaps","body":"We have dedicated roadmaps for ''Start an LLC'' and ''Apply for EIN'' with detailed step-by-step instructions. Complete those roadmaps alongside this one — they cover the specific filing process for each."}},
    {"id":"cc100201-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Don''t Skip This","body":"Operating without an LLC means your personal assets (home, car, savings) are exposed if you''re ever sued. It also makes taxes more complicated. Spend the $100-300 to set up an LLC before your first commission check arrives."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 1: Understanding Your Numbers
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0002-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Understanding Your Numbers',
  'Revenue, expenses, profit — if you don''t know these numbers, you''re flying blind.',
  1);

-- 1.1 Revenue, Expenses & Profit
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100002-0001-4000-8000-000000000001', 'aa100001-0002-4000-8000-000000000001',
  'Revenue, Expenses & Profit — Know Your Numbers',
  'The three numbers that determine whether your insurance business survives or dies.',
  true, true, 12, 0,
  '[
    {"id":"cc100301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Only Three Numbers That Matter</h3><p>Every business in the world comes down to three numbers. Your insurance practice is no different:</p><ul><li><strong>Revenue</strong> = Total gross commissions received (advance + renewal + override)</li><li><strong>Expenses</strong> = Everything you spend to run the business (leads, software, phone, travel, licensing, E&O insurance, marketing)</li><li><strong>Profit</strong> = Revenue minus Expenses. This is what you actually take home — <em>before taxes</em>.</li></ul>"}},
    {"id":"cc100301-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"The Uncomfortable Truth","body":"Most new insurance agents operate at a LOSS for their first 3-6 months. They spend $2,000/month on leads but only earn $1,500 in commissions. If you don''t track these numbers, you won''t even realize you''re losing money until your bank account is empty."}},
    {"id":"cc100301-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Real Example: Monthly P&L</h3><p>Here''s what a typical new agent''s first few months might look like:</p><p><strong>Month 3 — Still Ramping:</strong></p><ul><li>Revenue: $4,200 (3 policies issued, avg $1,400 commission)</li><li>Expenses: $1,800 leads + $200 software + $150 phone + $100 gas = <strong>$2,250</strong></li><li>Profit: $4,200 - $2,250 = <strong>$1,950</strong></li><li>Set aside for taxes (28%): <strong>$546</strong></li><li>Actual take-home: <strong>$1,404</strong></li></ul><p><strong>Month 12 — Hitting Stride:</strong></p><ul><li>Revenue: $12,500 (8 policies + renewals starting)</li><li>Expenses: $2,500 leads + $200 software + $150 phone + $100 gas = <strong>$2,950</strong></li><li>Profit: $12,500 - $2,950 = <strong>$9,550</strong></li><li>Set aside for taxes (28%): <strong>$2,674</strong></li><li>Actual take-home: <strong>$6,876</strong></li></ul>"}},
    {"id":"cc100301-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"The Key Metric: Profit Margin","body":"Profit margin = Profit ÷ Revenue × 100. A healthy insurance agent runs at 60-75% profit margin once ramped. If you''re below 50%, your expenses are too high relative to production. If you''re below 30%, something is seriously wrong — usually lead spend without enough conversion."}},
    {"id":"cc100301-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: Understanding Your Insurance Business P&L"}}
  ]'::jsonb
);

-- 1.2 Tracking with The Standard HQ
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100002-0002-4000-8000-000000000001', 'aa100001-0002-4000-8000-000000000001',
  'Tracking Your Numbers with The Standard HQ',
  'Use the platform''s built-in tools to monitor revenue, expenses, and profitability in real time.',
  true, true, 8, 1,
  '[
    {"id":"cc100401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Your Built-In Business Dashboard</h3><p>The Standard HQ gives you everything you need to track your business numbers without spreadsheets:</p><ul><li><strong>Dashboard</strong> — Real-time commission totals, policy counts, and target progress</li><li><strong>Analytics</strong> — Commission pipeline, carrier breakdowns, pace metrics, forecasting</li><li><strong>Expenses</strong> — Categorized expense tracking with lead purchase ROI</li><li><strong>Reports</strong> — Custom date ranges, drill-down data, CSV export for your CPA</li></ul>"}},
    {"id":"cc100401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Weekly Business Review Routine</h3><p>Set aside 30 minutes every Monday morning:</p><ol><li>Check your <strong>Dashboard</strong> — are you on pace for your monthly target?</li><li>Review <strong>Expenses</strong> — what did you spend on leads last week? Any new subscriptions?</li><li>Check <strong>Analytics → Commission Pipeline</strong> — how much is pending vs. earned?</li><li>Calculate your weekly profit: commissions received minus expenses logged</li><li>Adjust your plan: need more dials? Better lead source? Cut an underperforming expense?</li></ol>"}},
    {"id":"cc100401-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"Log expenses as they happen, not at the end of the month. The Standard HQ''s expense feature supports recurring entries for subscriptions and templates for common costs. Set up your recurring expenses once and they auto-log every month."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 2: Lead ROI & Cost Per Acquisition
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0003-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Lead ROI & Cost Per Acquisition',
  'Your lead spend is your biggest controllable expense. Know exactly what you''re getting for every dollar.',
  2);

-- 2.1 Calculating Cost Per Acquisition
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100003-0001-4000-8000-000000000001', 'aa100001-0003-4000-8000-000000000001',
  'Calculating Your Cost Per Acquisition (CPA)',
  'The single most important number for evaluating whether your lead spend is making or losing money.',
  true, true, 12, 0,
  '[
    {"id":"cc100501-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Is CPA?</h3><p><strong>Cost Per Acquisition (CPA)</strong> = Total lead spend ÷ Number of policies issued from those leads.</p><p>This tells you exactly how much it costs you to acquire one new client. If your CPA is higher than your average first-year commission, <strong>you are losing money on every sale.</strong></p>"}},
    {"id":"cc100501-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>CPA Calculation Example</h3><p><strong>Scenario:</strong> You buy 100 leads from a vendor at $15 each = $1,500 total spend.</p><ul><li>You contact all 100 leads</li><li>You quote 30 of them</li><li>You close 5 policies</li><li><strong>CPA = $1,500 ÷ 5 = $300 per client acquired</strong></li></ul><p>Now the question: does that $300 CPA make sense?</p><ul><li>If your average first-year commission is $1,200 → <strong>CPA is 25% of revenue. Great ROI.</strong></li><li>If your average first-year commission is $400 → <strong>CPA is 75% of revenue. Barely profitable.</strong></li><li>If your average first-year commission is $250 → <strong>CPA exceeds commission. You''re losing money.</strong></li></ul>"}},
    {"id":"cc100501-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"The Lead Spend Trap","body":"New agents often buy more and more leads thinking volume will fix their numbers. But if your conversion rate is 3% and your CPA already exceeds your commission, buying 200 leads instead of 100 just doubles your losses. Fix conversion first, then scale spend."}},
    {"id":"cc100501-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Track CPA by Source","body":"Different lead vendors and types have wildly different CPAs. Track them separately in The Standard HQ''s expense feature using categories per vendor. You might find that Vendor A costs $20/lead but converts at 8% (CPA = $250) while Vendor B costs $10/lead but converts at 2% (CPA = $500). The cheap leads cost you more per client."}},
    {"id":"cc100501-0001-0001-0001-000000000005","type":"video","order":4,"data":{"url":"","platform":"youtube","title":"Video: Calculating and Tracking Your Lead ROI"}}
  ]'::jsonb
);

-- 2.2 Aged vs Real-Time Leads
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100003-0002-4000-8000-000000000001', 'aa100001-0003-4000-8000-000000000001',
  'Aged Leads vs Real-Time Leads — The ROI Math',
  'Understanding the cost-quality tradeoff between cheap aged leads and expensive real-time leads.',
  false, true, 8, 1,
  '[
    {"id":"cc100601-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Two Lead Categories</h3><p><strong>Real-Time Leads ($15-50+/lead):</strong> Fresh prospects who just filled out a form. They''re expecting a call. Speed-to-lead is critical — contact within 5 minutes for best results. Higher cost, higher conversion rate (typically 5-10%).</p><p><strong>Aged Leads ($1-5/lead):</strong> Prospects who inquired weeks or months ago. They may or may not still be interested. Much cheaper but much lower conversion rate (typically 1-3%). Requires volume and persistence.</p>"}},
    {"id":"cc100601-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Math Comparison</h3><p><strong>Real-Time Strategy:</strong></p><ul><li>Buy 50 leads at $25 each = $1,250</li><li>Convert 4 (8% rate) at $1,200 avg commission = $4,800 revenue</li><li>CPA = $312. Profit = $3,550. <strong>ROI = 284%</strong></li></ul><p><strong>Aged Lead Strategy:</strong></p><ul><li>Buy 500 leads at $2 each = $1,000</li><li>Convert 8 (1.6% rate) at $1,200 avg commission = $9,600 revenue</li><li>CPA = $125. Profit = $8,600. <strong>ROI = 860%</strong></li></ul><p><strong>The catch:</strong> Aged leads require 5-10x more dials to reach someone. That''s hours of your time. Your effective hourly rate on aged leads might be lower even though the ROI looks better on paper.</p>"}},
    {"id":"cc100601-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"The Smart Strategy","body":"Use BOTH. Real-time leads for your prime calling hours (speed-to-lead matters). Aged leads for your secondary calling sessions (Power Dialer through high volume). Track CPA on each separately using The Standard HQ expenses. Kill any source where CPA exceeds 40% of your average commission."}},
    {"id":"cc100601-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"info","title":"The Standard HQ Tracking","body":"Log each lead vendor as a separate expense category. The Standard HQ''s analytics shows your production by lead source (if you tag policies), letting you calculate true CPA per vendor. The Close KPI Dashboard''s AI Lead Heat scoring also helps you prioritize which leads to call first."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 3: Commission Economics
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0004-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Commission Economics',
  'Understand how insurance commissions actually work — advances, chargebacks, renewals, and overrides.',
  3);

-- 3.1 Advance vs As-Earned Commissions
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100004-0001-4000-8000-000000000001', 'aa100001-0004-4000-8000-000000000001',
  'Advance vs As-Earned Commissions',
  'How commission payments work in insurance — and why that big check isn''t really all yours.',
  true, true, 10, 0,
  '[
    {"id":"cc100701-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Two Ways You Get Paid</h3><p><strong>Advance Commissions (most common for life/health):</strong> You receive a large upfront payment when the policy is issued — typically 75-115% of the first year''s annual premium. Example: Client pays $200/month ($2,400/year) at 100% advance → you receive ~$2,400 when the policy issues.</p><p><strong>As-Earned Commissions:</strong> You receive smaller monthly payments as the client makes each premium payment. Same $200/month policy at 100% as-earned → you receive ~$200/month for 12 months.</p>"}},
    {"id":"cc100701-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"The Chargeback Risk","body":"Advance commissions come with a catch: if the policy lapses within the chargeback period (typically 9-12 months), you OWE BACK a prorated portion of that advance. If a client cancels at month 3, you might owe back 75% of the advance. This is real money coming out of your future commission checks. This is why advance commissions are NOT free money — they are essentially a loan against future premium payments."}},
    {"id":"cc100701-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>The Cash Flow Implications</h3><p><strong>Advance:</strong> Feels great — big checks early. But if chargebacks hit, your income swings wildly. You need a cash reserve to absorb chargebacks.</p><p><strong>As-Earned:</strong> Slower start, but predictable monthly income. No chargeback risk (you only get paid what the client actually paid). Builds like a snowball — after 12 months of writing business, you have dozens of policies paying you monthly.</p>"}},
    {"id":"cc100701-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Strategy","body":"Most new agents start with advance commissions because they need cash flow. That''s fine — just set aside 10-15% of every advance check in a chargeback reserve fund. As your book grows and renewal income stabilizes, consider switching some business to as-earned for the predictability."}}
  ]'::jsonb
);

-- 3.2 Renewals & Overrides
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100004-0002-4000-8000-000000000001', 'aa100001-0004-4000-8000-000000000001',
  'Renewal Commissions & Override Income',
  'Where real wealth is built — recurring revenue from renewals and passive income from overrides.',
  true, true, 10, 1,
  '[
    {"id":"cc100801-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Renewal Commissions: Your Snowball</h3><p>After the first year, most insurance policies pay a <strong>renewal commission</strong> — typically 2-10% of the annual premium, paid every year the policy stays in force. This is recurring revenue you earn for doing nothing (as long as the client keeps paying).</p><p><strong>The math is powerful:</strong> Write 50 policies in your first year at $2,400 avg premium and 5% renewal rate. In Year 2, you earn $6,000 in renewals before you even make a single new sale. By Year 5 with consistent production, renewals alone could be $20,000-30,000/year.</p>"}},
    {"id":"cc100801-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Override Commissions: The Multiplier</h3><p>Override commissions are what you earn on your <strong>downline agents''</strong> production. When you recruit and develop agents, you earn a percentage of everything they write — on top of their commission.</p><p><strong>The agency building math:</strong></p><ul><li>You have 5 agents in your downline</li><li>Each writes $10,000/month in premium</li><li>Your override rate is 10%</li><li>Your override income: 5 × $10,000 × 10% = <strong>$5,000/month passive</strong></li></ul><p>This is why the top earners in insurance are agency builders, not solo producers. The leverage is enormous.</p>"}},
    {"id":"cc100801-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"The Standard HQ Tracking","body":"The Standard HQ''s Team & Hierarchy section tracks your override earnings by downline agent. The Analytics dashboard shows your commission breakdown: personal production vs. overrides vs. renewals. Watch renewals grow over time — that''s your business becoming self-sustaining."}},
    {"id":"cc100801-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Long Game Thinking","body":"The agents who build real wealth prioritize client retention (renewals) and agent development (overrides) over maximizing personal production alone. A $500k/year agent who writes everything personally has a job. A $500k/year agent earning $200k in overrides and $100k in renewals has a business."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 4: Cash Flow Management
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0005-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Cash Flow Management',
  'Insurance income is lumpy. Learn to manage the feast-and-famine cycle.',
  4);

-- 4.1 Building a Cash Reserve
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100005-0001-4000-8000-000000000001', 'aa100001-0005-4000-8000-000000000001',
  'Managing Cash Flow & Building a Reserve',
  'Handle the feast-and-famine cycle of insurance income without going broke.',
  true, true, 10, 0,
  '[
    {"id":"cc100901-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Insurance Income Is Lumpy</h3><p>You will have $10,000 months and $2,000 months. Policies take 4-6 weeks to issue after submission. Chargebacks can hit randomly. You might close 5 deals in one week and zero the next three weeks. This is normal — but if you don''t manage it, it''ll destroy you financially.</p>"}},
    {"id":"cc100901-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Cash Flow System</h3><ol><li><strong>Separate your accounts</strong> — Business checking for all commissions in, personal checking for your \"salary\" out. Never mix them.</li><li><strong>Build a 3-month reserve</strong> — Before you feel comfortable, have 3 months of living expenses saved in your business account. This is your chargeback buffer and slow-month insurance.</li><li><strong>Pay yourself consistently</strong> — Pick a bi-weekly or monthly amount. Even if you earned $15,000 this month, pay yourself your set amount. The excess stays in the business account for lean months and taxes.</li><li><strong>Set aside taxes immediately</strong> — Every commission deposit: move 25-30% to a separate tax savings account. Don''t touch it. It''s the IRS''s money, not yours.</li><li><strong>Set aside chargeback reserve</strong> — Move 10% of advance commissions to a chargeback fund. You''ll need it.</li></ol>"}},
    {"id":"cc100901-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"The Commission Delay","body":"You write a policy today. It goes to underwriting (1-4 weeks). It gets approved and issues (1-2 weeks). The carrier processes your commission (1-2 weeks). Total: you might not see money for 4-8 weeks after the sale. Plan your cash flow accordingly — you''re always living on last month''s production."}},
    {"id":"cc100901-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"The 50/30/20 Rule for Agents","body":"When a commission check hits: 30% → tax savings, 10% → chargeback reserve, 10% → business growth (leads, tools), 50% → your personal pay. Adjust the ratios as your income stabilizes, but always pay taxes and chargebacks FIRST."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 5: Tax Planning
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0006-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Tax Planning for 1099 Agents',
  'The IRS doesn''t care that you''re new. Know your obligations or pay the penalty.',
  5);

-- 5.1 Quarterly Taxes & Self-Employment Tax
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100006-0001-4000-8000-000000000001', 'aa100001-0006-4000-8000-000000000001',
  'Quarterly Estimated Taxes & Self-Employment Tax',
  'You owe taxes four times a year, and they''re higher than you think.',
  true, true, 12, 0,
  '[
    {"id":"cc101001-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>No Withholding = Your Problem</h3><p>As a W-2 employee, your employer withholds taxes from every paycheck. As a 1099 contractor, <strong>nobody withholds anything</strong>. You are responsible for estimating and paying your own taxes quarterly.</p><p><strong>Quarterly due dates:</strong></p><ul><li>Q1: April 15</li><li>Q2: June 15</li><li>Q3: September 15</li><li>Q4: January 15 (of the following year)</li></ul><p>Miss these deadlines and you''ll owe <strong>penalties and interest</strong> on top of what you owe.</p>"}},
    {"id":"cc101001-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"Self-Employment Tax: The Shock","body":"On top of income tax, you owe self-employment tax: 15.3% (12.4% Social Security + 2.9% Medicare) on your net self-employment income. As a W-2 employee, your employer paid half of this. Now you pay ALL of it. On $80,000 net income, that''s $12,240 in self-employment tax alone — before a single dollar of income tax."}},
    {"id":"cc101001-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>How Much to Set Aside</h3><p>The safe rule: <strong>25-30% of every commission check</strong> goes straight into a dedicated tax savings account.</p><p><strong>Example breakdown for $80,000 annual net income (single filer):</strong></p><ul><li>Self-employment tax (15.3%): ~$12,240</li><li>Federal income tax (~15% effective after deductions): ~$12,000</li><li>State income tax (varies, 0-10%): ~$3,200</li><li><strong>Total tax burden: ~$27,440 (34% of gross)</strong></li></ul><p>Your quarterly estimated payment would be approximately <strong>$6,860</strong>.</p>"}},
    {"id":"cc101001-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"File Quarterly with IRS Form 1040-ES","body":"Use Form 1040-ES to calculate and pay quarterly estimates. You can pay online at irs.gov/payments. Set calendar reminders 2 weeks before each deadline. Better to slightly overpay (you get a refund) than underpay (you get penalties)."}}
  ]'::jsonb
);

-- 5.2 Common Deductions
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100006-0002-4000-8000-000000000001', 'aa100001-0006-4000-8000-000000000001',
  'Tax Deductions Every Agent Should Take',
  'Reduce your taxable income with legitimate business deductions — the more you track, the more you save.',
  true, true, 10, 1,
  '[
    {"id":"cc101101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Common Business Deductions</h3><p>Every dollar of legitimate business expense reduces your taxable income. At a 30% effective tax rate, a $100 deduction saves you $30 in taxes. This is why tracking expenses in The Standard HQ matters — it''s literally money in your pocket.</p><p><strong>Deductible business expenses for insurance agents:</strong></p><ul><li><strong>Lead purchases</strong> — Your biggest deduction. Every dollar spent on leads is deductible.</li><li><strong>Software subscriptions</strong> — The Standard HQ, Close CRM, quoting tools, Zoom, etc.</li><li><strong>Phone & internet</strong> — Business portion of your cell phone and home internet</li><li><strong>Home office</strong> — Dedicated workspace in your home (percentage of rent/mortgage + utilities)</li><li><strong>Mileage / travel</strong> — Client meetings, carrier events, training (IRS standard rate: $0.70/mile in 2026)</li><li><strong>Licensing fees</strong> — State license renewals, continuing education courses</li><li><strong>E&O insurance</strong> — Errors & omissions coverage premiums</li><li><strong>Marketing</strong> — Business cards, website, social media ads, mailers</li><li><strong>Professional development</strong> — Industry conferences, coaching, courses</li><li><strong>Health insurance premiums</strong> — Self-employed individuals can deduct 100% of health insurance premiums</li></ul>"}},
    {"id":"cc101101-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"tip","title":"The Standard HQ as Your Tax Book","body":"Log every business expense in The Standard HQ''s Expenses feature. At tax time, export to CSV and hand it to your CPA. This beats scrambling through bank statements in March. Set up recurring expenses for subscriptions so they auto-log monthly."}},
    {"id":"cc101101-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"Get a CPA","body":"Do NOT do your own taxes as a 1099 insurance agent — at least not in your first year. A CPA who understands independent contractors will easily save you more in deductions than they charge in fees (typically $300-800 for a Schedule C filing). Ask your upline for a recommendation."}},
    {"id":"cc101101-0001-0001-0001-000000000004","type":"video","order":3,"data":{"url":"","platform":"youtube","title":"Video: Tax Deductions for Insurance Agents"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 6: Business Planning & Goal Setting
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0007-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Business Planning & Goal Setting',
  'Work backwards from your income goal and build an activity plan to get there.',
  6);

-- 6.1 Working Backwards from Your Income Goal
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100007-0001-4000-8000-000000000001', 'aa100001-0007-4000-8000-000000000001',
  'Working Backwards from Your Income Goal',
  'Turn a dollar amount into a daily activity plan you can actually execute.',
  true, true, 10, 0,
  '[
    {"id":"cc101201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Reverse-Engineer Your Goal</h3><p>Don''t just say \"I want to make $100,000 this year.\" Break it down into actions you control:</p><p><strong>The Math (example):</strong></p><ul><li><strong>Annual goal:</strong> $100,000</li><li><strong>Monthly:</strong> $8,333</li><li><strong>Average commission per policy:</strong> $1,400</li><li><strong>Policies needed per month:</strong> 6</li><li><strong>Close rate:</strong> 15% of quotes</li><li><strong>Quotes needed per month:</strong> 40</li><li><strong>Contact-to-quote rate:</strong> 30%</li><li><strong>Contacts needed per month:</strong> 133</li><li><strong>Dials-to-contact rate:</strong> 25%</li><li><strong>Dials needed per month:</strong> 533</li><li><strong>Working days per month:</strong> 22</li><li><strong>Dials needed per day: ~25</strong></li></ul><p>Suddenly \"$100k\" becomes \"25 dials a day.\" That''s manageable. That''s actionable. That''s a plan.</p>"}},
    {"id":"cc101201-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"tip","title":"Use The Standard HQ Targets","body":"Set your monthly income target in the Targets feature. The dashboard will show your pace — are you on track, ahead, or behind? The Analytics page breaks it down further with daily and weekly pace metrics so you can course-correct in real time."}},
    {"id":"cc101201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Activity-Based Goals > Outcome Goals","body":"You can''t control whether a prospect says yes. But you CAN control how many dials you make, how many quotes you send, and how many follow-ups you complete. Focus on activity goals that you can execute daily. The outcomes follow."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 7: Scaling Your Business
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0008-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Scaling Your Business',
  'From solo producer to agency builder — the four phases of insurance business growth.',
  7);

-- 7.1 The Four Phases
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100008-0001-4000-8000-000000000001', 'aa100001-0008-4000-8000-000000000001',
  'The Four Phases of Building an Insurance Business',
  'Understand where you are now and where you''re heading — solo producer, book builder, recruiter, agency owner.',
  true, true, 12, 0,
  '[
    {"id":"cc101301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Phase 1: Solo Producer (Months 1-12)</h3><p>Your only job: <strong>learn to sell and survive</strong>. Every hour should be spent on the phone, in front of prospects, or studying product knowledge. Don''t think about recruiting yet. Don''t build systems. Just sell.</p><p><strong>Key metrics:</strong> Dials per day, appointments per week, policies per month, personal income.</p>"}},
    {"id":"cc101301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Phase 2: Building Your Book (Months 6-24)</h3><p>As you accumulate active policies, <strong>renewal income starts building</strong>. Focus shifts to client retention — the clients you keep are worth more than the clients you chase. Start getting referrals instead of buying every lead.</p><p><strong>Key metrics:</strong> Persistency rate (% of policies still in force), renewal income, referrals received, chargeback rate.</p>"}},
    {"id":"cc101301-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Phase 3: Recruiting (Months 12-36)</h3><p>Once you can consistently sell, you have something to teach. <strong>Start recruiting agents into your downline</strong>. Override commissions begin. Your income is no longer limited to your personal production hours.</p><p><strong>Key metrics:</strong> Agents recruited, agents producing, override income, team production.</p>"}},
    {"id":"cc101301-0001-0001-0001-000000000004","type":"rich_text","order":3,"data":{"html":"<h3>Phase 4: Agency Building (Year 3+)</h3><p>At this stage, you''re building <strong>systems</strong> — training programs, recruiting funnels, team workflows. Your income comes from a mix of personal production, overrides, and renewals. The business runs with or without you on the phone.</p><p><strong>Key metrics:</strong> Team size, team retention, total agency production, passive income ratio (override + renewal income as % of total).</p>"}},
    {"id":"cc101301-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"tip","title":"Where Are You?","body":"Be honest about which phase you''re in. Most new agents try to jump to Phase 3 (recruiting) before mastering Phase 1 (selling). You can''t teach what you haven''t done. Master personal production first, then leverage it through team building."}},
    {"id":"cc101301-0001-0001-0001-000000000006","type":"callout","order":5,"data":{"variant":"info","title":"The Standard HQ Tracks It All","body":"Each phase has dedicated tools: Policies & Analytics (Phase 1-2), Recruiting Pipeline (Phase 3), Team Hierarchy & Override Tracking (Phase 4). The Leaderboard creates competition across all phases, and the Agent Roadmap guides your team through onboarding."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 8: Client Retention & Lifetime Value
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0009-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Client Retention & Lifetime Value',
  'A client retained is worth 5-10x more than a client acquired. Protect your book.',
  8);

-- 8.1 Lifetime Value & The Referral Engine
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100009-0001-4000-8000-000000000001', 'aa100001-0009-4000-8000-000000000001',
  'Client Lifetime Value & Building a Referral Engine',
  'One happy client can be worth $10,000+ over their lifetime. Protect and multiply that value.',
  true, true, 12, 0,
  '[
    {"id":"cc101401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Lifetime Value of an Insurance Client</h3><p>A single insurance client is worth far more than their first-year commission:</p><ul><li><strong>First-year commission:</strong> $1,400 (example)</li><li><strong>Renewal commissions (years 2-20):</strong> $120/year × 19 years = $2,280</li><li><strong>Cross-sell opportunities:</strong> Life → disability → annuity → auto → home = $3,000+ additional</li><li><strong>Referrals:</strong> Average satisfied client refers 2-3 people over time = $2,800-4,200</li><li><strong>Total Lifetime Value: $9,480-10,880</strong></li></ul><p>Now compare that to the $300 CPA you spent to acquire them. <strong>That''s a 30x+ return.</strong> This is why retention matters more than acquisition.</p>"}},
    {"id":"cc101401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The 30-60-90 Day Follow-Up System</h3><p>Client retention starts immediately after policy issuance:</p><ol><li><strong>Day 30:</strong> Call to check in. \"How are you feeling about the policy? Any questions about your coverage or payments?\" This prevents buyer''s remorse cancellations.</li><li><strong>Day 60:</strong> Email or text with value — a relevant article, market update, or tip related to their policy type. Shows you''re thinking of them beyond the sale.</li><li><strong>Day 90:</strong> Call to ask for referrals. \"You''ve had your policy for a few months now. Is there anyone in your life — family, friends, coworkers — who might benefit from the same type of protection?\" This is the golden window for referrals.</li></ol>"}},
    {"id":"cc101401-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Automate It","body":"Build this 30-60-90 sequence as a Close CRM Workflow. Enroll every new client automatically when their policy status changes to ''Active Policy.'' The workflow sends the touchpoints on schedule — you just need to show up for the calls. Use the AI Template Builder to generate the email and SMS content."}},
    {"id":"cc101401-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"success","title":"The Referral Flywheel","body":"The ultimate goal: replace paid leads with referrals. A mature insurance agent gets 40-60% of new business from referrals. These leads cost $0, close at 3-5x the rate of cold leads, and have higher lifetime value because they come in pre-sold by someone who trusts you. Every client interaction is a referral opportunity."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 9: Tools & Systems
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('aa100001-0010-4000-8000-000000000001', '71a0b2c3-d4e5-4f67-8901-abcdef123456',
  'Tools & Systems for Your Business',
  'The technology stack that runs your insurance practice — and how to use it.',
  9);

-- 9.1 Your Business Operating System
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('bb100010-0001-4000-8000-000000000001', 'aa100001-0010-4000-8000-000000000001',
  'Your Business Technology Stack',
  'The essential tools every insurance agent needs — and how they fit together.',
  true, true, 10, 0,
  '[
    {"id":"cc101501-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Insurance Agent Tech Stack</h3><p>You don''t need 20 tools. You need the right 5-6, used well:</p><ul><li><strong>The Standard HQ</strong> — Your business operating system. Policies, commissions, expenses, analytics, reports, recruiting, training, and team management. This is your single source of truth.</li><li><strong>Close CRM</strong> — Your lead management and outreach platform. Where you dial, email, text, and track every prospect interaction. (See the Close CRM Guide roadmap.)</li><li><strong>Bitwarden</strong> — Password manager for all your accounts. You''ll have 20+ logins within your first month. (See the Bitwarden roadmap.)</li><li><strong>Accounting Software</strong> — QuickBooks Self-Employed ($15/month) or Wave (free) for formal bookkeeping. The Standard HQ''s expenses feature handles day-to-day tracking, but your CPA will want accounting software for tax filing.</li><li><strong>Calendar</strong> — Google Calendar or Outlook, connected to Close CRM. Schedule calls, appointments, and follow-ups.</li></ul>"}},
    {"id":"cc101501-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How They Connect</h3><p>The beauty of this stack is that the tools talk to each other:</p><ol><li>A lead comes in via Close CRM (from your lead vendor or website)</li><li>You call, email, and text through Close (all activity tracked)</li><li>The Standard HQ''s AI scores the lead and tells you who to prioritize</li><li>You write a policy and log it in The Standard HQ (feeds dashboard, analytics, leaderboard)</li><li>Commission data flows into your reports</li><li>Expenses are tracked alongside revenue for true P&L visibility</li><li>At tax time, export everything to your CPA</li></ol>"}},
    {"id":"cc101501-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Start Simple","body":"Don''t overwhelm yourself with tools in your first week. Get The Standard HQ, Close CRM, and Bitwarden set up. Everything else can come later as your business grows. Complete the ''Getting Started'' sections of each roadmap first — they''re designed to get you operational in under an hour."}},
    {"id":"cc101501-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Avoid Tool Hopping","body":"New agents love buying new software. Every shiny tool feels like progress. It''s not. Master the core tools before adding anything. A CRM you use daily beats five tools you barely touch. The Standard HQ + Close CRM covers 90% of what you need."}}
  ]'::jsonb
);

COMMIT;
