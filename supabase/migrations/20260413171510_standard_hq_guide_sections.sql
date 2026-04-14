-- Comprehensive guide content for The Standard HQ Guide roadmap.
-- Roadmap ID: 038b71d7-8e94-401f-b7e5-85b6bbeeb265
-- 14 sections, ~48 items covering every feature in the platform.

BEGIN;

-- ============================================================================
-- SECTION 1: Getting Started (sort 0)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0001-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Getting Started', 'Set up your account, navigate the platform, and understand the basics.', 0);

-- 1.1 Create Your Account
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000001-0001-4000-8000-000000000001', 'd1000001-0001-4000-8000-000000000001',
  'Create Your Account', 'Sign up, get approved, and log in to The Standard HQ for the first time.', true, true, 5, 0,
  '[
    {"id":"f1010101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Creating Your Account</h3><p>The Standard HQ is an invitation-based platform. You''ll receive an invite link from your upline or agency admin. Click the link and follow the registration steps.</p>"}},
    {"id":"f1010101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Creating Your Standard HQ Account"}},
    {"id":"f1010101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Step-by-Step</h3><ol><li>Click your invite link or navigate to the platform URL</li><li>Enter your name, email, and create a password</li><li>Verify your email address by clicking the confirmation link</li><li>Wait for admin approval — you''ll receive a notification when approved</li><li>Log in and explore the dashboard</li></ol>"}},
    {"id":"f1010101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"info","title":"Pending Approval","body":"After registration, your account enters a pending state. Your agency admin will review and approve your account. While pending, you can access limited features like your recruiting pipeline and settings."}}
  ]'::jsonb
);

-- 1.2 Navigate the Dashboard
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000001-0002-4000-8000-000000000001', 'd1000001-0001-4000-8000-000000000001',
  'Navigate the Dashboard', 'Understand the main dashboard layout — KPI cards, quick actions, and navigation.', true, true, 5, 1,
  '[
    {"id":"f1010201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Your Dashboard at a Glance</h3><p>The Dashboard is your home base. It shows your key performance indicators (KPIs) at a glance — policies written, commissions earned, target progress, and recent activity. Everything updates in real time from your data.</p>"}},
    {"id":"f1010201-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Dashboard Tour"}},
    {"id":"f1010201-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Navigation</h3><p>The left sidebar organizes everything into sections:</p><ul><li><strong>Main</strong> — Dashboard, Analytics, Targets, Reports</li><li><strong>Business</strong> — Policies, Expenses, Team, Licensing</li><li><strong>Growth</strong> — Recruiting, Leaderboard</li><li><strong>Connect</strong> — Messages (email, SMS, Slack)</li><li><strong>Tools</strong> — Underwriting, Close CRM, AI Tools, Business Tools</li><li><strong>Training</strong> — My Training, Agent Roadmap</li></ul><p>Click any item to navigate. The sidebar collapses on mobile for a clean experience.</p>"}},
    {"id":"f1010201-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Pin your most-used features by visiting them frequently — the sidebar remembers your navigation patterns and surfaces what you use most."}}
  ]'::jsonb
);

-- 1.3 Set Up Your Profile
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000001-0003-4000-8000-000000000001', 'd1000001-0001-4000-8000-000000000001',
  'Set Up Your Profile', 'Configure your personal profile, contact info, and preferences.', true, true, 5, 2,
  '[
    {"id":"f1010301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Your Profile Settings</h3><p>Navigate to <strong>Settings</strong> (gear icon at the bottom of the sidebar) to configure your profile. A complete profile helps your team identify you and ensures communications are sent correctly.</p>"}},
    {"id":"f1010301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>What to Set Up</h3><ol><li><strong>Profile Info</strong> — Full name, phone number, profile photo</li><li><strong>Email</strong> — Connect your Gmail or Outlook for email sync</li><li><strong>Agency</strong> — Verify your agency affiliation is correct</li><li><strong>Notifications</strong> — Configure email and Slack notification preferences</li><li><strong>Theme</strong> — Choose light or dark mode</li></ol>"}},
    {"id":"f1010301-0001-0001-0001-000000000003","type":"video","order":2,"data":{"url":"","platform":"youtube","title":"Video: Setting Up Your Profile"}},
    {"id":"f1010301-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Connect your email account early. Once connected, The Standard HQ can send emails on your behalf and sync your communication history — critical for the Messages hub and email templates."}}
  ]'::jsonb
);

-- 1.4 Understand Subscription Plans
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000001-0004-4000-8000-000000000001', 'd1000001-0001-4000-8000-000000000001',
  'Understand Subscription Plans', 'Learn about Free, Pro, and Team plan tiers and what features each unlocks.', false, true, 5, 3,
  '[
    {"id":"f1010401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Plan Tiers</h3><p>The Standard HQ offers three subscription tiers, each unlocking more features:</p><ul><li><strong>Free</strong> — Dashboard KPIs, basic policy tracking, comp guide (view-only), basic targets</li><li><strong>Pro</strong> — Full analytics, expenses, team hierarchy, recruiting (basic), email messaging, leaderboard, reports export</li><li><strong>Team</strong> — Everything in Pro plus Close CRM integration, AI Template Builder, advanced recruiting with custom pipelines, SMS/Slack messaging, training modules, override commissions, downline reports</li></ul>"}},
    {"id":"f1010401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Managing Your Subscription</h3><ol><li>Navigate to <strong>Billing</strong> (at the bottom of the sidebar)</li><li>View your current plan and features</li><li>Upgrade or downgrade at any time</li><li>Add-ons can be purchased separately for specific premium features</li></ol>"}},
    {"id":"f1010401-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Owner Downline Benefit","body":"Agents in the owner''s direct downline hierarchy may receive complimentary access to premium features like Close KPI Dashboard and AI Template Builder. Check with your upline to see if this applies to you."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 2: Policies & Daily Sales Log (sort 1)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0002-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Policies & Daily Sales Log', 'Track every policy you write — new business, renewals, and status changes.', 1);

-- 2.1 How To Log a New Policy
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000002-0001-4000-8000-000000000001', 'd1000001-0002-4000-8000-000000000001',
  'How To Log a New Policy', 'Add a new policy to your daily sales log with all the key details.', true, true, 8, 0,
  '[
    {"id":"f1020101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Daily Sales Log</h3><p>The Policies page is your daily sales log — the central place to track every policy you write. Each entry captures the essential details: client name, carrier, product, premium, submit date, and status.</p><p>This data feeds into your dashboard KPIs, commission tracking, reports, analytics, and leaderboard. <strong>Accurate policy logging is the foundation of everything else in The Standard HQ.</strong></p>"}},
    {"id":"f1020101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Logging a New Policy"}},
    {"id":"f1020101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Step-by-Step</h3><ol><li>Navigate to <strong>Policies</strong> in the sidebar</li><li>Click <strong>+ Add Policy</strong> (or use the Quick Action button)</li><li>Fill in the required fields: Client name, Carrier, Product, Premium amount</li><li>Set the Submit Date and Status (Submitted, Approved, Issued, etc.)</li><li>Add optional details: Policy number, commission rate, notes</li><li>Click Save — the policy appears in your log and updates your KPIs</li></ol>"}},
    {"id":"f1020101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Log policies as soon as you submit them, not when they issue. This keeps your daily sales log accurate and gives your upline real-time visibility into pipeline activity. You can update the status later as the policy progresses."}},
    {"id":"f1020101-0001-0001-0001-000000000005","type":"callout","order":4,"data":{"variant":"warning","title":"Important","body":"Each policy number must be unique. If you get an error about a duplicate policy number, check if the policy already exists in your log — it may have been entered by another agent in your hierarchy."}}
  ]'::jsonb
);

-- 2.2 How To Track Policy Status
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000002-0002-4000-8000-000000000001', 'd1000001-0002-4000-8000-000000000001',
  'How To Track Policy Status', 'Update policy statuses as they progress through underwriting and issuance.', true, true, 5, 1,
  '[
    {"id":"f1020201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Policy Lifecycle</h3><p>Policies progress through several statuses as they move from submission to issuance. Keeping statuses up-to-date ensures accurate reporting and commission tracking.</p><ul><li><strong>Submitted</strong> — Application sent to carrier</li><li><strong>Approved</strong> — Underwriting approved</li><li><strong>Issued</strong> — Policy is active and in-force</li><li><strong>Declined</strong> — Underwriting declined</li><li><strong>Withdrawn</strong> — Client or agent withdrew the application</li><li><strong>Lapsed</strong> — Policy lapsed after issuance</li></ul>"}},
    {"id":"f1020201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Updating a Policy</h3><ol><li>Find the policy in your Policies list (use search or filters)</li><li>Click the policy to open its details</li><li>Update the status dropdown</li><li>Add the policy number once issued</li><li>Adjust the commission amount if it changed during underwriting</li><li>Save your changes</li></ol>"}},
    {"id":"f1020201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"Use the status filters on the Policies page to quickly see all pending applications, all issued policies, or all declines. This is the fastest way to do your weekly pipeline review."}}
  ]'::jsonb
);

-- 2.3 How To Handle Chargebacks
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000002-0003-4000-8000-000000000001', 'd1000001-0002-4000-8000-000000000001',
  'How To Handle Chargebacks', 'Track commission chargebacks when policies lapse or cancel.', false, true, 5, 2,
  '[
    {"id":"f1020301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Are Chargebacks?</h3><p>A chargeback occurs when a previously paid commission is clawed back because the policy lapsed, was cancelled, or was replaced within the chargeback period. Most carriers have a 12-month chargeback window.</p><p>The Standard HQ tracks chargebacks alongside your commissions so you always know your true net earnings.</p>"}},
    {"id":"f1020301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Logging a Chargeback</h3><ol><li>Find the original policy in your Policies list</li><li>Update the policy status to <strong>Lapsed</strong> or <strong>Cancelled</strong></li><li>The chargeback amount will be calculated based on the original commission</li><li>Chargebacks appear in your commission reports with negative amounts</li></ol>"}},
    {"id":"f1020301-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"Prevention is Key","body":"The best way to handle chargebacks is to prevent them. Follow up with clients at 30, 60, and 90 days after policy issue to ensure they''re happy and payments are current. Use a Workflow sequence in Close CRM to automate these check-ins."}}
  ]'::jsonb
);

-- 2.4 First Seller Naming
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000002-0004-4000-8000-000000000001', 'd1000001-0002-4000-8000-000000000001',
  'First Seller Naming', 'Understand how first seller attribution works for policies in your organization.', false, true, 5, 3,
  '[
    {"id":"f1020401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Is First Seller?</h3><p>First Seller naming determines which agent gets credit for a policy on the daily sales log. This affects leaderboard rankings, reporting, and how policies roll up in team analytics.</p><p>When a policy is logged, the system identifies the First Seller based on your agency''s configuration — typically the agent who entered the policy or the agent assigned as the writing agent.</p>"}},
    {"id":"f1020401-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"info","title":"How It Works","body":"Your admin configures First Seller naming rules for the agency. In most setups, the agent who logs the policy is automatically set as the First Seller. If you need to reassign credit, contact your agency admin."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 3: Commissions & Compensation (sort 2)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0003-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Commissions & Compensation', 'Track your earnings, understand commission rates, and view your comp guide.', 2);

-- 3.1 How To Track Commissions
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000003-0001-4000-8000-000000000001', 'd1000001-0003-4000-8000-000000000001',
  'How To Track Commissions', 'View your earned, pending, and charged-back commissions across all policies.', true, true, 8, 0,
  '[
    {"id":"f1030101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Commission Tracking</h3><p>Every policy you log in The Standard HQ automatically calculates the associated commission based on your carrier commission rates. Your dashboard shows total commissions earned, pending commissions on submitted policies, and net after chargebacks.</p>"}},
    {"id":"f1030101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Understanding Commission Tracking"}},
    {"id":"f1030101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Where to Find Commission Data</h3><ul><li><strong>Dashboard</strong> — Quick KPI cards showing total commissions this month/year</li><li><strong>Analytics</strong> — Detailed commission pipeline, trends, and breakdowns by carrier/product</li><li><strong>Reports</strong> — Full commission reports with drill-down capability and export</li><li><strong>Team/Hierarchy</strong> — Override commissions from your downline</li></ul>"}},
    {"id":"f1030101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Commission amounts are calculated from the premium and your commission rate for that carrier/product. Make sure your carrier commission rates are set up correctly in the Comp Guide — inaccurate rates mean inaccurate earnings."}}
  ]'::jsonb
);

-- 3.2 How To Use the Comp Guide
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000003-0002-4000-8000-000000000001', 'd1000001-0003-4000-8000-000000000001',
  'How To Use the Comp Guide', 'View carrier commission rates, product details, and compensation structures.', true, true, 8, 1,
  '[
    {"id":"f1030201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Comp Guide</h3><p>The Comp Guide is your reference for commission rates across all carriers and products. It shows what percentage you earn on each product type, helping you compare carriers and make informed product recommendations to clients.</p>"}},
    {"id":"f1030201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How to Access</h3><ol><li>The Comp Guide is accessible from your dashboard or the Tools section</li><li>Browse by carrier to see all their products and rates</li><li>Compare rates across carriers for the same product type</li><li>View your specific contract level rates (these may differ from street-level rates)</li></ol>"}},
    {"id":"f1030201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Rate Accuracy","body":"Commission rates in the Comp Guide are set by your agency admin based on your carrier contracts. If you believe a rate is incorrect, contact your upline or agency admin to verify your contract level."}}
  ]'::jsonb
);

-- 3.3 Override Commissions
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000003-0003-4000-8000-000000000001', 'd1000001-0003-4000-8000-000000000001',
  'Override Commissions', 'Understand how override commissions work for agents with downline teams.', false, true, 5, 2,
  '[
    {"id":"f1030301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What Are Override Commissions?</h3><p>Override commissions are the percentage you earn on your downline agents'' production. When an agent in your downline writes a policy, you earn an override on top of their commission — this is how agency building generates passive income.</p><p>The Standard HQ automatically calculates and tracks your overrides based on your hierarchy position and override rates.</p>"}},
    {"id":"f1030301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Viewing Overrides</h3><ol><li>Navigate to <strong>Team</strong> in the sidebar</li><li>Click the <strong>Overrides</strong> tab</li><li>See override earnings broken down by downline agent</li><li>View override rates per carrier/product</li></ol>"}},
    {"id":"f1030301-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Team Plan Feature","body":"Override commission tracking requires the Team subscription plan. Upgrade from the Billing page to unlock full hierarchy and override tracking."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 4: Targets & Goals (sort 3)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0004-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Targets & Goals', 'Set income targets and track your progress against your goals.', 3);

-- 4.1 How To Set Income Targets
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000004-0001-4000-8000-000000000001', 'd1000001-0004-4000-8000-000000000001',
  'How To Set Income Targets', 'Define monthly and annual income goals to track your progress.', true, true, 5, 0,
  '[
    {"id":"f1040101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Setting Your Targets</h3><p>The Targets page lets you set monthly income goals. Once set, your dashboard shows progress bars and pace metrics so you always know if you''re on track, ahead, or behind.</p>"}},
    {"id":"f1040101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Setting Income Targets"}},
    {"id":"f1040101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Step-by-Step</h3><ol><li>Navigate to <strong>Targets & Goals</strong> in the sidebar</li><li>Set your monthly income target (e.g., $10,000/month)</li><li>The system calculates what you need per week and per day to hit your goal</li><li>Historical averages help you set realistic targets based on past performance</li><li>Track your progress on the dashboard with visual progress bars</li></ol>"}},
    {"id":"f1040101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Set your target slightly above your comfort zone — 10-20% higher than your average. This creates healthy pressure without being unrealistic. The Analytics page shows your pace metrics to tell you if you''re trending to hit your goal."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 5: Reports & Analytics (sort 4)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0005-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Reports & Analytics', 'Analyze your performance with dashboards, reports, and forecasting tools.', 4);

-- 5.1 How To Use the Analytics Dashboard
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000005-0001-4000-8000-000000000001', 'd1000001-0005-4000-8000-000000000001',
  'How To Use the Analytics Dashboard', 'Deep-dive into your performance data with visualizations, pace metrics, and trend analysis.', true, true, 10, 0,
  '[
    {"id":"f1050101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Analytics Dashboard</h3><p>Analytics goes deeper than the main dashboard. It provides visualizations of your production trends, carrier and product breakdowns, geographic analysis, commission pipeline, and forecasting models.</p>"}},
    {"id":"f1050101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Analytics Dashboard Tour"}},
    {"id":"f1050101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Key Analytics Views</h3><ul><li><strong>Pace Metrics</strong> — Are you on track to hit your target? Daily/weekly/monthly pace</li><li><strong>Carrier Breakdown</strong> — Production by carrier with trends over time</li><li><strong>Product Mix</strong> — What products are you writing most? Revenue by product type</li><li><strong>Commission Pipeline</strong> — Pending vs earned vs projected commissions</li><li><strong>Forecasting</strong> — AI-powered predictions based on your historical patterns</li><li><strong>Game Plan</strong> — Recommendations for how to hit your targets based on current pace</li></ul>"}},
    {"id":"f1050101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Check your pace metrics every Monday morning. If your weekly pace is below target, you know to increase activity early in the week rather than scrambling on Friday."}}
  ]'::jsonb
);

-- 5.2 How To Generate Reports
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000005-0002-4000-8000-000000000001', 'd1000001-0005-4000-8000-000000000001',
  'How To Generate Reports', 'Build custom reports with drill-down analytics and export to CSV.', true, true, 8, 1,
  '[
    {"id":"f1050201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Report Generation</h3><p>The Reports page lets you build custom performance reports filtered by date range, carrier, product, agent, and more. Reports include drill-down capability — click any metric to see the underlying policies and transactions.</p>"}},
    {"id":"f1050201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Step-by-Step</h3><ol><li>Navigate to <strong>Reports</strong> in the sidebar</li><li>Select your date range (this month, last quarter, custom range)</li><li>Apply filters: carrier, product, status, agent</li><li>View the report with summary KPIs and detailed data tables</li><li>Click any row to drill down into the underlying data</li><li>Export to CSV for use in spreadsheets or external tools</li></ol>"}},
    {"id":"f1050201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Scheduled Reports","body":"Set up scheduled reports to automatically generate and email reports on a recurring basis — weekly production summaries, monthly commission reports, or quarterly reviews. Configure in Reports → Scheduled."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 6: Team & Hierarchy (sort 5)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0006-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Team & Hierarchy', 'Manage your downline, view your org chart, and track team performance.', 5);

-- 6.1 How To View Your Org Chart
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000006-0001-4000-8000-000000000001', 'd1000001-0006-4000-8000-000000000001',
  'How To View Your Org Chart', 'See your full agency hierarchy — upline, downline, and where you fit.', true, true, 5, 0,
  '[
    {"id":"f1060101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Org Chart</h3><p>Navigate to <strong>Team → Org Chart</strong> to see a visual tree of your agency hierarchy. You''ll see your upline above you and your downline below. Each node shows the agent''s name, role, and production metrics.</p>"}},
    {"id":"f1060101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Exploring Your Org Chart"}},
    {"id":"f1060101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Team Dashboard Views</h3><ul><li><strong>Org Chart</strong> — Visual hierarchy tree</li><li><strong>Downlines</strong> — List view of all agents in your downline with production stats</li><li><strong>Agent Detail</strong> — Click any agent to see their full profile, policies, and performance</li><li><strong>Manage</strong> — Admin tools for restructuring hierarchy (admin-only)</li></ul>"}}
  ]'::jsonb
);

-- 6.2 Downline Performance
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000006-0002-4000-8000-000000000001', 'd1000001-0006-4000-8000-000000000001',
  'Downline Performance Reports', 'Track your downline agents'' production, activity, and growth.', false, true, 5, 1,
  '[
    {"id":"f1060201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Monitoring Your Team</h3><p>The Downlines tab shows every agent in your hierarchy with key metrics: policies written, commissions earned, activity level, and growth trends. This is essential for agency builders who need to coach and motivate their team.</p>"}},
    {"id":"f1060201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>What to Look For</h3><ul><li><strong>Production trends</strong> — Is each agent''s output growing, flat, or declining?</li><li><strong>Activity gaps</strong> — Who hasn''t logged a policy in 2+ weeks?</li><li><strong>Top performers</strong> — Who''s crushing it and can mentor others?</li><li><strong>New agent ramp</strong> — Are recently recruited agents getting to their first sale?</li></ul>"}},
    {"id":"f1060201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Agency Building Tip","body":"Review your downline performance weekly. The #1 predictor of agent retention is early production — if a new agent hasn''t written a policy in their first 30 days, they need immediate coaching and support."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 7: Recruiting Pipeline (sort 6)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0007-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Recruiting Pipeline', 'Manage your recruiting pipeline from lead to licensed agent.', 6);

-- 7.1 How To Manage Your Pipeline
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000007-0001-4000-8000-000000000001', 'd1000001-0007-4000-8000-000000000001',
  'How To Manage Your Recruiting Pipeline', 'Track recruiting candidates through customizable pipeline stages.', true, true, 10, 0,
  '[
    {"id":"f1070101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Recruiting Pipeline</h3><p>The recruiting pipeline tracks prospective agents from initial contact through licensing and onboarding. Each recruit moves through stages (phases) that your agency defines — from ''Interested'' to ''Licensed & Appointed.''</p>"}},
    {"id":"f1070101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Managing Your Recruiting Pipeline"}},
    {"id":"f1070101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Pipeline Features</h3><ul><li><strong>Custom Phases</strong> — Define your own recruiting stages that match your process</li><li><strong>Phase Checklists</strong> — Required tasks per phase (background check, pre-licensing, etc.)</li><li><strong>Auto-Advancement</strong> — Recruits auto-advance when all checklist items are complete</li><li><strong>Recruit Detail</strong> — Full profile with notes, documents, and communication history</li><li><strong>Slack Notifications</strong> — Get notified when recruits advance or complete milestones</li></ul>"}},
    {"id":"f1070101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"The most successful recruiters follow up within 24 hours of every phase transition. When a recruit completes pre-licensing, immediately reach out to schedule their exam. Momentum matters."}}
  ]'::jsonb
);

-- 7.2 Public Recruiting Landing Page
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000007-0002-4000-8000-000000000001', 'd1000001-0007-4000-8000-000000000001',
  'Public Recruiting Landing Page', 'Share your personal recruiting link to attract new agent candidates.', false, true, 5, 1,
  '[
    {"id":"f1070201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Your Recruiting Link</h3><p>Every agent gets a personalized recruiting landing page. Share this link on social media, in emails, or in person. When someone fills out the form, they automatically enter your recruiting pipeline as a lead.</p>"}},
    {"id":"f1070201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How It Works</h3><ol><li>Your unique link is: <strong>/join/[your-recruiter-id]</strong></li><li>Share it anywhere — social media, email signatures, business cards</li><li>Prospects fill out a short interest form</li><li>They appear in your <strong>Leads Queue</strong> automatically</li><li>Review leads and move promising candidates into your pipeline</li></ol>"}},
    {"id":"f1070201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"Add your recruiting link to your email signature and all social media profiles. Passive recruiting works — people find you when they''re ready to make a career change."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 8: Communication Hub (sort 7)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0008-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Communication Hub', 'Send emails, SMS, and manage all your communications from one place.', 7);

-- 8.1 How To Send Emails
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000008-0001-4000-8000-000000000001', 'd1000001-0008-4000-8000-000000000001',
  'How To Send Emails from The Standard HQ', 'Compose, send, and track emails directly from the Messages hub.', true, true, 8, 0,
  '[
    {"id":"f1080101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Messages Hub</h3><p>The Messages section is your unified communication center. Send and receive emails, view threads, use templates, and track opens — all without leaving The Standard HQ.</p>"}},
    {"id":"f1080101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Sending Emails from The Standard HQ"}},
    {"id":"f1080101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Step-by-Step</h3><ol><li>Navigate to <strong>Messages</strong> in the sidebar</li><li>Click <strong>Compose</strong> to start a new email</li><li>Enter recipients, subject, and body</li><li>Use the template picker to insert pre-built templates</li><li>Attach files if needed</li><li>Send — the email goes from your connected email account</li></ol>"}},
    {"id":"f1080101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Connect Your Email First","body":"You must connect your Gmail or Outlook account in Settings → Integrations before you can send emails. Without a connected account, the compose button will prompt you to set up email sync."}}
  ]'::jsonb
);

-- 8.2 Slack Integration
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000008-0002-4000-8000-000000000001', 'd1000001-0008-4000-8000-000000000001',
  'Slack Integration', 'Connect Slack for real-time notifications — new policies, recruiting updates, and team activity.', false, true, 5, 1,
  '[
    {"id":"f1080201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Slack Notifications</h3><p>Connect your Slack workspace to receive real-time notifications when important events happen — new policies logged, recruits advancing, leaderboard updates, and more.</p>"}},
    {"id":"f1080201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Setting Up Slack</h3><ol><li>Go to <strong>Settings → Integrations → Slack</strong></li><li>Click <strong>Connect to Slack</strong></li><li>Authorize The Standard HQ in your Slack workspace</li><li>Choose which channels to receive different notification types</li><li>Configure which events trigger notifications</li></ol>"}},
    {"id":"f1080201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"Set up a dedicated #sales-wins channel for policy notifications. There''s nothing more motivating for a team than seeing sales roll in throughout the day. It creates healthy competition and celebrates wins publicly."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 9: Training & Development (sort 8)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0009-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Training & Development', 'Complete training modules, take quizzes, and track your learning progress.', 8);

-- 9.1 How To Complete Training Modules
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000009-0001-4000-8000-000000000001', 'd1000001-0009-4000-8000-000000000001',
  'How To Complete Training Modules', 'Work through your assigned training modules with video content and quizzes.', true, true, 8, 0,
  '[
    {"id":"f1090101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>My Training</h3><p>Navigate to <strong>My Training</strong> in the sidebar to see all your assigned training modules. Each module contains lessons with video content, reading material, and quizzes to test your knowledge.</p>"}},
    {"id":"f1090101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Completing Training Modules"}},
    {"id":"f1090101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>How Training Works</h3><ol><li>Open <strong>My Training</strong> to see your module list</li><li>Click a module to start — lessons play in order</li><li>Watch videos, read content, and absorb the material</li><li>Take the quiz at the end of each lesson</li><li>Your progress is tracked and visible to your trainer</li><li>Complete all required modules to finish your training program</li></ol>"}},
    {"id":"f1090101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Don''t rush through training just to check the box. The agents who invest time in training content consistently outperform those who skip it. Take notes and apply what you learn immediately."}}
  ]'::jsonb
);

-- 9.2 How To Submit Presentations
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000009-0002-4000-8000-000000000001', 'd1000001-0009-4000-8000-000000000001',
  'How To Submit Presentations', 'Record and submit weekly presentation videos for trainer review.', false, true, 5, 1,
  '[
    {"id":"f1090201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Presentation Submissions</h3><p>Some training programs require weekly presentation recordings. You record yourself presenting a topic (product knowledge, sales pitch, objection handling) and submit it for your trainer to review.</p>"}},
    {"id":"f1090201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How to Submit</h3><ol><li>Go to <strong>My Training → Presentations</strong></li><li>Click <strong>Record New Presentation</strong></li><li>Record your video using your webcam</li><li>Review the recording and submit when satisfied</li><li>Your trainer will review and provide feedback</li></ol>"}},
    {"id":"f1090201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"Practice your presentation 2-3 times before recording. The best agents treat these as rehearsals for real client conversations. Your trainer''s feedback is gold — take it seriously."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 10: Underwriting Tools (sort 9)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0010-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Underwriting Tools', 'Use Quick Quote and the UW Wizard to find the right products for your clients.', 9);

-- 10.1 How To Use Quick Quote
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000010-0001-4000-8000-000000000001', 'd1000001-0010-4000-8000-000000000001',
  'How To Use Quick Quote', 'Get instant premium estimates for basic insurance quotes.', true, true, 5, 0,
  '[
    {"id":"f1100101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Quick Quote</h3><p>Quick Quote gives you instant premium estimates without going through the full underwriting process. Enter basic client info (age, gender, health class, coverage amount) and get ballpark premiums across multiple carriers instantly.</p>"}},
    {"id":"f1100101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Using Quick Quote"}},
    {"id":"f1100101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>When to Use Quick Quote</h3><ul><li>During a first call when a prospect asks ''how much would it cost?''</li><li>Comparing carriers side-by-side for a specific client profile</li><li>Qualifying prospects — can they afford the coverage they want?</li><li>Preparing for a presentation with multiple options</li></ul>"}},
    {"id":"f1100101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Estimates Only","body":"Quick Quote provides estimates, not guaranteed premiums. Actual premiums depend on full underwriting. Always tell clients that quotes are approximate and subject to underwriting review."}}
  ]'::jsonb
);

-- 10.2 How To Use the UW Wizard
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000010-0002-4000-8000-000000000001', 'd1000001-0010-4000-8000-000000000001',
  'How To Use the Underwriting Wizard', 'Walk through detailed underwriting analysis to find the best carrier for your client''s health profile.', false, true, 8, 1,
  '[
    {"id":"f1100201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Underwriting Wizard</h3><p>The UW Wizard goes beyond Quick Quote — it analyzes your client''s specific health conditions, medications, and lifestyle factors to recommend the best carrier. Different carriers have different underwriting guidelines, and the wizard matches your client to the most favorable options.</p>"}},
    {"id":"f1100201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How It Works</h3><ol><li>Navigate to <strong>UW Wizard</strong> in the Tools section</li><li>Enter client demographics (age, gender, state)</li><li>Add health conditions and medications</li><li>The wizard analyzes carrier acceptance criteria</li><li>Get ranked recommendations: which carriers will likely approve, at what health class</li><li>Use the results to place your client with the best carrier</li></ol>"}},
    {"id":"f1100201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"The UW Wizard is your competitive advantage. Most agents guess which carrier to use. You can show clients exactly why you chose a specific carrier — the wizard''s analysis gives you data-backed recommendations that build trust."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 11: AI & Automation Tools (sort 10)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0011-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'AI & Automation Tools', 'Leverage AI-powered tools for Close CRM analytics, lead scoring, template generation, and more.', 10);

-- 11.1 Close KPI Dashboard
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000011-0001-4000-8000-000000000001', 'd1000001-0011-4000-8000-000000000001',
  'Close KPI Dashboard', 'Monitor your Close CRM performance with 21 widget types — calls, emails, pipeline, and AI scoring.', true, true, 10, 0,
  '[
    {"id":"f1110101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Close KPI Dashboard</h3><p>The Close KPI Dashboard connects to your Close CRM account and surfaces analytics that Close doesn''t offer natively. It includes 12 prebuilt widgets plus the ability to build custom dashboards with 21 widget types.</p>"}},
    {"id":"f1110101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Close KPI Dashboard Tour"}},
    {"id":"f1110101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Prebuilt Dashboard Widgets</h3><ul><li><strong>Total Leads & New Leads</strong> — Lead count and growth</li><li><strong>Speed-to-Lead</strong> — How fast you contact new leads</li><li><strong>Status Distribution</strong> — Leads by current status</li><li><strong>Call Analytics</strong> — Volume, duration, connect rate, VM rate</li><li><strong>Best Call Times</strong> — Connect rate heatmap by hour and day</li><li><strong>Contact Cadence</strong> — Time between touches per lead</li><li><strong>Dial Attempts</strong> — Calls needed to reach someone</li><li><strong>Follow-Up Gaps</strong> — Leads at risk of going cold</li><li><strong>Opportunity Funnel</strong> — Pipeline conversion rates</li><li><strong>Cross-Reference Matrix</strong> — Smart View × Status patterns</li></ul>"}},
    {"id":"f1110101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"info","title":"Setup Required","body":"Connect your Close API key in the Close KPI Dashboard → Setup tab. Data syncs every 15 minutes for KPI widgets and every 30 minutes for AI Lead Scoring."}}
  ]'::jsonb
);

-- 11.2 AI Template Builder
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000011-0002-4000-8000-000000000001', 'd1000001-0011-4000-8000-000000000001',
  'AI Template Builder', 'Generate Close CRM email templates, SMS templates, and multi-step workflows from a simple prompt.', true, true, 8, 1,
  '[
    {"id":"f1110201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>AI-Powered Template Generation</h3><p>The AI Template Builder uses Claude AI to generate professional email templates, SMS messages, and multi-step workflow sequences for your Close CRM. Describe what you want in plain English, and the AI builds it — complete with personalization variables and insurance-specific language.</p>"}},
    {"id":"f1110201-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Using the AI Template Builder"}},
    {"id":"f1110201-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>What You Can Generate</h3><ul><li><strong>Email Templates</strong> — Subject line + body with {{ contact.first_name }} variables</li><li><strong>SMS Templates</strong> — Short messages under 320 characters</li><li><strong>Workflow Sequences</strong> — Multi-step email + SMS campaigns over days/weeks</li></ul><h3>How to Use</h3><ol><li>Navigate to <strong>AI Template Builder</strong> in the Tools section</li><li>Choose a tab: Email, SMS, or Workflow</li><li>Describe what the template should accomplish</li><li>Set tone, length, and audience</li><li>Click <strong>Generate with AI</strong></li><li>Edit the result if needed, then <strong>Save to Close</strong></li></ol>"}},
    {"id":"f1110201-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Be specific in your prompt. Instead of ''follow-up email,'' try ''follow-up email for an IUL prospect who received a quote 3 days ago and hasn''t responded, emphasizing the tax-free retirement income benefit.'' The more context you give, the better the output."}}
  ]'::jsonb
);

-- 11.3 AI Lead Heat Scoring
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000011-0003-4000-8000-000000000001', 'd1000001-0011-4000-8000-000000000001',
  'AI Lead Heat Scoring', 'AI scores every lead 0-100 using 17 signals — focus on the hottest leads first.', true, true, 8, 2,
  '[
    {"id":"f1110301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>How AI Lead Scoring Works</h3><p>The Standard HQ automatically scores every lead in your Close CRM from 0-100 using <strong>17 signals</strong>. The system runs every 30 minutes and classifies leads into 5 heat levels: <strong>Hot, Warming, Neutral, Cooling, Cold</strong>.</p><p>Your top 100 leads are synced to an <strong>AI Hot 100 Smart View</strong> in Close daily at 7am EST.</p>"}},
    {"id":"f1110301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The 17 Signals</h3><p><strong>Engagement (27 pts):</strong> Call answer rate, email reply rate, SMS response rate, engagement recency</p><p><strong>Behavioral (25 pts):</strong> Inbound calls (strongest buying signal), quote requested, email engagement, appointments</p><p><strong>Temporal (20 pts):</strong> Lead age, time since last touch, time in current status, status velocity</p><p><strong>Pipeline (13 pts):</strong> Has opportunity, opportunity value</p><p><strong>Penalties (up to -20 pts):</strong> Consecutive no-answers, straight to VM, bad status, stagnation</p>"}},
    {"id":"f1110301-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Customize Your Weights","body":"Open the Manage Weights panel in the Close KPI Dashboard to tune signal importance. If speed-to-lead is your edge, increase Engagement Recency. If you work aged leads, decrease the Lead Age penalty. The system learns from your outcomes (won/lost) and auto-adjusts over time."}},
    {"id":"f1110301-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Speed Matters","body":"A Hot lead contacted within 5 minutes converts at 4x the rate of one contacted after an hour. Make your AI Hot 100 Smart View in Close the first thing you open every morning."}}
  ]'::jsonb
);

-- 11.4 Chat Bot & Voice Agent
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000011-0004-4000-8000-000000000001', 'd1000001-0011-4000-8000-000000000001',
  'Chat Bot & AI Voice Agent', 'Deploy an AI chat bot for lead qualification and a voice agent that sounds like you.', false, true, 8, 3,
  '[
    {"id":"f1110401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>AI Chat Bot</h3><p>The chat bot handles initial lead qualification and conversation 24/7. It integrates with your Close CRM to create and update leads automatically. When a lead is ready to talk to a human, the bot hands off to you.</p>"}},
    {"id":"f1110401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>AI Voice Agent</h3><p>The voice agent takes it further — it can make and receive calls using a cloned version of your voice. Set up business-hours routing to switch between your cloned voice and a stock voice after hours.</p><h3>Voice Clone Setup</h3><ol><li>Navigate to <strong>AI Voice Agent</strong> in Tools</li><li>Start the voice cloning wizard</li><li>Record voice samples as prompted</li><li>Wait for processing (takes a few minutes)</li><li>Test your cloned voice and publish when ready</li></ol>"}},
    {"id":"f1110401-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Availability","body":"Chat Bot and Voice Agent features are currently available for The Standard agency agents. These are premium features that may require additional phone number purchases."}}
  ]'::jsonb
);

-- 11.5 Channel Orchestration
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000011-0005-4000-8000-000000000001', 'd1000001-0011-4000-8000-000000000001',
  'Channel Orchestration', 'Route incoming leads across SMS, voice, and email channels with automated rules.', false, true, 5, 4,
  '[
    {"id":"f1110501-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Multi-Channel Routing</h3><p>Channel Orchestration lets you define rules for how incoming leads are handled across channels. Set up SMS-first escalation, voice-first for high-value leads, or business-hours routing that switches channels based on time of day.</p>"}},
    {"id":"f1110501-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Starter Templates</h3><ul><li><strong>SMS-First Escalation</strong> — Text first, call if no response</li><li><strong>Voice-First High Value</strong> — Call immediately for premium leads</li><li><strong>Business Hours Routing</strong> — Voice during hours, SMS after hours</li><li><strong>Multi-Channel Blitz</strong> — Hit every channel in the first hour</li></ul>"}},
    {"id":"f1110501-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Pro Tip","body":"The Multi-Channel Blitz template works best for internet leads. Within the first hour: SMS immediately, call at 5 min, email at 15 min, second call at 30 min. This dramatically increases your connect rate."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 12: Business Tools & Expenses (sort 11)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0012-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Business Tools & Expenses', 'Track business expenses, parse financial statements, and manage your business metrics.', 11);

-- 12.1 How To Track Expenses
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000012-0001-4000-8000-000000000001', 'd1000001-0012-4000-8000-000000000001',
  'How To Track Expenses', 'Log and categorize your business expenses with templates and recurring entries.', true, true, 8, 0,
  '[
    {"id":"f1120101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Expense Tracking</h3><p>The Expenses page helps you track all your business costs — lead purchases, software subscriptions, marketing spend, travel, and more. Accurate expense tracking is essential for understanding your true profitability and for tax preparation.</p>"}},
    {"id":"f1120101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Tracking Business Expenses"}},
    {"id":"f1120101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Features</h3><ul><li><strong>Expense Categories</strong> — Organize by type (leads, marketing, office, travel, etc.)</li><li><strong>Recurring Expenses</strong> — Set up monthly subscriptions that auto-log</li><li><strong>Templates</strong> — Save common expense types for quick entry</li><li><strong>Lead Purchases</strong> — Special tracking for lead vendor costs with ROI calculation</li></ul>"}},
    {"id":"f1120101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Pro Tip","body":"Track your lead purchase costs religiously. The #1 metric for insurance agents buying leads is cost-per-acquisition (CPA) — total lead spend divided by policies issued. If your CPA exceeds your first-year commission, you''re losing money on those leads."}}
  ]'::jsonb
);

-- 12.2 Financial Statement Parser
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000012-0002-4000-8000-000000000001', 'd1000001-0012-4000-8000-000000000001',
  'Financial Statement Parser', 'Upload financial statements and let AI extract and analyze the key metrics.', false, true, 5, 1,
  '[
    {"id":"f1120201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>AI-Powered Financial Analysis</h3><p>The Business Tools section includes a financial statement parser that uses AI to extract key metrics from uploaded documents. Upload a P&L statement, income statement, or commission statement and get structured data back — revenue, expenses, margins, and trends.</p>"}},
    {"id":"f1120201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>How to Use</h3><ol><li>Navigate to <strong>Business Tools</strong> in the sidebar</li><li>Upload a financial document (PDF, image, or spreadsheet)</li><li>The AI extracts key financial data</li><li>Review the parsed results and make corrections if needed</li><li>Use the insights to understand your business health</li></ol>"}},
    {"id":"f1120201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"info","title":"Availability","body":"Business Tools is available for agents at The Standard. Team tier subscribers and owner downline agents get complimentary access."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 13: Settings & Integrations (sort 12)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0013-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Settings & Integrations', 'Configure your profile, connect email accounts, manage carrier contracts, and handle billing.', 12);

-- 13.1 Profile & Agency Settings
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000013-0001-4000-8000-000000000001', 'd1000001-0013-4000-8000-000000000001',
  'Profile & Agency Settings', 'Configure your personal profile, agency affiliation, and platform preferences.', true, true, 5, 0,
  '[
    {"id":"f1130101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Settings Overview</h3><p>The Settings page (gear icon, bottom of sidebar) is organized into tabs:</p><ul><li><strong>Profile</strong> — Name, email, phone, photo, password</li><li><strong>Agency</strong> — Your agency affiliation and configuration</li><li><strong>Integrations</strong> — Gmail, Outlook, Slack, Instagram, Close CRM connections</li><li><strong>Carriers</strong> — Your carrier contracts and compliance status</li></ul>"}},
    {"id":"f1130101-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"tip","title":"Priority Setup","body":"The three most important settings to configure first: (1) Connect your email account (Gmail/Outlook), (2) Connect Slack for notifications, (3) Connect Close CRM for the KPI dashboard. These integrations unlock the most value from the platform."}}
  ]'::jsonb
);

-- 13.2 Carrier Contracts
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000013-0002-4000-8000-000000000001', 'd1000001-0013-4000-8000-000000000001',
  'Carrier Contracts & Compliance', 'View your carrier appointment status and manage contracting requirements.', false, true, 5, 1,
  '[
    {"id":"f1130201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Carrier Contracts</h3><p>The Contracting section tracks your carrier appointments — which carriers you''re licensed and appointed with, your contract level, and any pending compliance requirements.</p>"}},
    {"id":"f1130201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>What''s Tracked</h3><ul><li><strong>Appointment Status</strong> — Active, Pending, Expired for each carrier</li><li><strong>Contract Level</strong> — Your commission tier with each carrier</li><li><strong>Compliance Items</strong> — E&O insurance, background check, anti-money laundering training</li><li><strong>Request New Contracts</strong> — Submit requests to get appointed with additional carriers</li></ul>"}}
  ]'::jsonb
);

-- 13.3 Licensing & Writing Numbers
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000013-0003-4000-8000-000000000001', 'd1000001-0013-4000-8000-000000000001',
  'Licensing & Writing Numbers', 'Track your state licenses and carrier writing numbers across all states.', false, true, 5, 2,
  '[
    {"id":"f1130301-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>State Licensing & Writing Numbers</h3><p>Navigate to <strong>Licensing</strong> in the Business section to manage your state licenses and writing numbers. This is your central reference for which states you''re licensed in and your carrier-specific writing numbers for each state.</p>"}},
    {"id":"f1130301-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Tabs</h3><ul><li><strong>Writing Numbers</strong> — Your carrier writing/agent numbers by state</li><li><strong>State Licenses</strong> — License status, expiration dates, and renewal tracking</li></ul>"}},
    {"id":"f1130301-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"warning","title":"Keep Licenses Current","body":"Expired licenses mean you can''t sell in that state. Set calendar reminders 60 days before each license expiration to start the renewal process. Most state renewals require continuing education credits."}}
  ]'::jsonb
);

-- 13.4 Billing & Subscription
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000013-0004-4000-8000-000000000001', 'd1000001-0013-4000-8000-000000000001',
  'Billing & Subscription Management', 'Manage your subscription plan, add-ons, payment methods, and billing history.', false, true, 5, 3,
  '[
    {"id":"f1130401-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Billing</h3><p>Navigate to <strong>Billing</strong> (bottom of sidebar) to manage your subscription. View your current plan, upgrade/downgrade tiers, manage payment methods, and review billing history.</p>"}},
    {"id":"f1130401-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Available Actions</h3><ul><li><strong>View Current Plan</strong> — See which features are included in your tier</li><li><strong>Upgrade/Downgrade</strong> — Switch plans at any time (prorated)</li><li><strong>Add-Ons</strong> — Purchase individual premium features without upgrading the full plan</li><li><strong>Payment Methods</strong> — Add or update credit card / payment info</li><li><strong>Billing History</strong> — Download past invoices</li></ul>"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 14: Leaderboard & Gamification (sort 13)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('d1000001-0014-4000-8000-000000000001', '038b71d7-8e94-401f-b7e5-85b6bbeeb265', 'Leaderboard & Gamification', 'Compete with your team and celebrate wins with the agency leaderboard.', 13);

-- 14.1 How the Leaderboard Works
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000014-0001-4000-8000-000000000001', 'd1000001-0014-4000-8000-000000000001',
  'How the Leaderboard Works', 'See where you rank against your team — track production, policies, and premium volume.', true, true, 5, 0,
  '[
    {"id":"f1140101-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Leaderboard</h3><p>The Leaderboard ranks agents by production metrics — policies written, premium volume, and commission earned. It updates in real time as policies are logged, creating healthy competition and motivating your team.</p>"}},
    {"id":"f1140101-0001-0001-0001-000000000002","type":"video","order":1,"data":{"url":"","platform":"youtube","title":"Video: Leaderboard Overview"}},
    {"id":"f1140101-0001-0001-0001-000000000003","type":"rich_text","order":2,"data":{"html":"<h3>Leaderboard Features</h3><ul><li><strong>Real-Time Rankings</strong> — Updates as policies are logged</li><li><strong>Multiple Metrics</strong> — Toggle between policies, premium, and commissions</li><li><strong>Time Periods</strong> — View daily, weekly, monthly, or annual standings</li><li><strong>Slack Integration</strong> — Leaderboard updates posted to your team''s Slack channel</li></ul>"}},
    {"id":"f1140101-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"tip","title":"Motivation Tip","body":"The psychology is simple: public recognition drives performance. When you see your name climbing the leaderboard, it creates momentum. When you see a teammate pulling ahead, it lights a fire. Embrace the competition."}}
  ]'::jsonb
);

-- 14.2 Slack Leaderboard Integration
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('e1000014-0002-4000-8000-000000000001', 'd1000001-0014-4000-8000-000000000001',
  'Slack Leaderboard Integration', 'Push leaderboard updates to Slack for real-time team visibility.', false, true, 5, 1,
  '[
    {"id":"f1140201-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Leaderboard in Slack</h3><p>When Slack is connected, The Standard HQ can automatically post leaderboard updates to a channel of your choice. New policy logs trigger real-time updates showing the agent''s name, the sale, and their current ranking.</p>"}},
    {"id":"f1140201-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>Setting Up Slack Leaderboard</h3><ol><li>Ensure Slack is connected in <strong>Settings → Integrations → Slack</strong></li><li>Navigate to the <strong>Leaderboard</strong> page</li><li>Configure which Slack channel receives leaderboard updates</li><li>Choose update frequency and format</li><li>Optionally name your leaderboard for team identity</li></ol>"}},
    {"id":"f1140201-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"success","title":"Team Culture","body":"Teams that celebrate wins publicly retain agents 2x longer than teams that don''t. The Slack leaderboard creates a culture of recognition that keeps agents engaged and motivated day after day."}}
  ]'::jsonb
);

COMMIT;
