-- "Warm Lead Operations Rollout" agent roadmap.
-- 90-day operational rollout: baseline -> speed-to-lead -> cadence -> show-rate -> aged leads -> continuous improvement.
-- Cross-linked to the "Warm Lead Mastery for Life Insurance Agents" training module.

BEGIN;

-- ============================================================================
-- ROADMAP TEMPLATE
-- ============================================================================
INSERT INTO public.roadmap_templates (id, agency_id, title, description, is_published, is_default, sort_order, created_by)
VALUES (
  'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Warm Lead Operations Rollout',
  'A 90-day operational rollout for taking your warm-lead workflow from "agents call when they get to it" to "every fresh lead contacted in under 5 minutes, 8+ touch cadence enforced, and show rate above 75%." Sequenced by dependency: baseline first, then infrastructure, then discipline, then optimization.',
  true, false, 12,
  'd0d3edea-af6d-4990-80b8-1765ba829896'
);

-- ============================================================================
-- SECTION 0: Baseline (Week 1)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0001-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 0 — Baseline (Week 1)',
  'You can''t prove ROI on any change without a pre-state. Capture every metric before changing anything.',
  0);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300001-0001-4000-8000-000000000001', 'bb300001-0001-4000-8000-000000000001',
  'Capture the Baseline Scorecard',
  'Pull the seven metrics that every later phase will be measured against. Per-agent and agency-wide.',
  true, true, 90, 0,
  '[
    {"id":"dd300001-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Baseline First</h3><p>The most common rollout failure is changing 5 things at once and being unable to attribute the lift. Before you change anything, measure where you are. The seven metrics below become your scorecard for the rest of the program.</p>"}},
    {"id":"dd300001-0001-0001-0001-000000000002","type":"rich_text","order":1,"data":{"html":"<h3>The Seven Baseline Metrics</h3><ol><li><strong>Time-to-first-dial on fresh leads</strong> (median across the last 100 leads)</li><li><strong>Attempts per lead before close-out</strong> (avg across last 100)</li><li><strong>Contact rate</strong> — % of leads ever spoken to</li><li><strong>Appointment book rate</strong> — appts ÷ contacted leads</li><li><strong>Show rate</strong> — showed ÷ booked</li><li><strong>Close rate</strong> — closed ÷ presented</li><li><strong>Cost per acquired policy</strong> — broken out by lead source</li></ol>"}},
    {"id":"dd300001-0001-0001-0001-000000000003","type":"callout","order":2,"data":{"variant":"tip","title":"Per-Agent and Agency-Wide","body":"Capture both. Per-agent reveals who needs which lessons. Agency-wide is what you''ll report on quarterly. Without per-agent baseline, you can''t target coaching."}},
    {"id":"dd300001-0001-0001-0001-000000000004","type":"callout","order":3,"data":{"variant":"warning","title":"Tooling Audit","body":"Document what dialer, CRM, and SMS platform each agent uses. Are they integrated, or are agents copy-pasting? Speed-to-lead infrastructure (Phase 1) depends on knowing what to integrate. Skip this audit and you''ll discover three agents on three different stacks halfway through Phase 1."}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300001-0002-4000-8000-000000000001', 'bb300001-0001-4000-8000-000000000001',
  'Complete the Warm Lead Mindset Lesson',
  'Every agent reads Lesson 1 of the training module before Phase 1 begins.',
  true, true, 20, 1,
  '[
    {"id":"dd300002-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Mindset Comes First</h3><p>The infrastructure changes in Phase 1+ won''t stick if agents don''t internalize the persistence math. The training module''s Lesson 1 (~12 minutes) covers the three numbers, the failure mode, and the 30-day relationship model. Mandatory completion before Phase 1 launch.</p>"}},
    {"id":"dd300002-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"/my-training","label":"Open My Training Page","description":"Find the \"Warm Lead Mastery for Life Insurance Agents\" module → Lesson 1: The Warm Lead Mindset"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 1: Speed-to-Lead Infrastructure (Weeks 2-3)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0002-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 1 — Speed-to-Lead Infrastructure (Weeks 2-3)',
  'Highest-leverage single change. 9-21x conversion lift on fresh leads. Build the webhook -> SMS -> dial workflow.',
  1);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300002-0001-4000-8000-000000000001', 'bb300001-0002-4000-8000-000000000001',
  'Wire the Lead Vendor Webhook',
  'Eliminate manual lead uploads. Webhook from every lead vendor directly into the CRM so the clock starts in seconds, not hours.',
  true, true, 120, 0,
  '[
    {"id":"dd300003-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Goal</h3><p>The instant a prospect submits a form on your lead vendor''s site, a webhook should fire to your CRM. Manual CSV uploads guarantee you''ll be #3 to call instead of #1.</p><p>For each lead vendor: locate their webhook documentation, generate a webhook URL on your CRM side, and configure the integration. Most vendors support this — if yours doesn''t, switch vendors.</p>"}},
    {"id":"dd300003-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"Preserve TCPA Consent","body":"Make sure the lead vendor''s webhook includes the consent capture timestamp and consent language URL. This is your liability shield if a TCPA complaint ever lands. Without preserved consent metadata, every SMS you send is legally exposed."}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300002-0002-4000-8000-000000000001', 'bb300001-0002-4000-8000-000000000001',
  'Build the 10-Second Auto-SMS',
  'Configure the CRM to fire an SMS to every fresh lead within 10 seconds of the webhook landing.',
  true, true, 60, 1,
  '[
    {"id":"dd300004-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Template</h3><p><em>Hi [Name], it''s [Agent Name] with [Agency]. Got your request — calling you in 60 seconds from [###]. If you can''t talk, just text back a better time.</em></p><p>Configure as an automation triggered by the lead webhook. SMS must use a 10DLC-registered number for deliverability. Test end-to-end with a real number before going live.</p>"}},
    {"id":"dd300004-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"/my-training","label":"Training reference: Speed-to-Lead lesson","description":"My Training → Warm Lead Mastery → Lesson 3: Speed-to-Lead — full script and workflow"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300002-0003-4000-8000-000000000001', 'bb300001-0002-4000-8000-000000000001',
  'Round-Robin Routing to the Power Dialer',
  'Eliminate the "I''ll get to it later" queue. Lead lands -> available agent rings within 60 seconds.',
  true, true, 90, 2,
  '[
    {"id":"dd300005-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Goal</h3><p>From webhook to ringing in the agent''s headset: 60 seconds. Configure your dialer to:</p><ul><li>Round-robin among available agents (or first-available)</li><li>If no agent available, route to a backup or auto-fire a \"calling you in 5 min\" SMS</li><li>Never let a fresh lead sit in a static queue</li></ul>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300002-0004-4000-8000-000000000001', 'bb300001-0002-4000-8000-000000000001',
  'Speed-to-Lead Drill (Live Practice)',
  'Each agent processes 5 mock fresh leads end-to-end. Goal: every one under 5 minutes, ideally under 60 seconds.',
  true, true, 30, 3,
  '[
    {"id":"dd300006-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Drill</h3><p>Have a manager or peer submit 5 test leads through the live workflow. Time end-to-end. Any agent above 5 minutes on more than 1 of 5 attempts needs another round of training before going live.</p>"}},
    {"id":"dd300006-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"success","title":"Phase 1 Exit Criteria","body":"Avg time-to-first-dial &lt; 5 min on 80%+ of fresh leads, measured over the next 7 days. If you''re not hitting it, do not advance to Phase 2 — diagnose and fix first."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 2: Cadence Discipline (Weeks 4-6)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0003-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 2 — Cadence Discipline (Weeks 4-6)',
  'Speed gets the first call. Cadence captures the 60-80% who buy after Day 60. Build the 8-12 touch sequence template and enforce it.',
  2);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300003-0001-4000-8000-000000000001', 'bb300001-0003-4000-8000-000000000001',
  'Build the 30-Day Cadence Template in CRM',
  'Encode the 8-12 touch sequence as an automated cadence in your CRM. Phone, SMS, and email steps pre-loaded.',
  true, true, 120, 0,
  '[
    {"id":"dd300007-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Sequence</h3><p>Configure the cadence to fire automatically when a lead enters \"active\" status. Include all 11 touches from the training module''s Lesson 7 — Day 0, 0+30min, 1, 2, 3, 5, 7, 10, 14, 21, 30.</p><p>Pre-load every email and SMS template. Pre-script every voicemail. Don''t leave the agent to write each one — they won''t.</p>"}},
    {"id":"dd300007-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"/my-training","label":"Training reference: 30-Day Cadence lesson","description":"My Training → Warm Lead Mastery → Lesson 7: The 30-Day Cadence — full table + breakup email script"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300003-0002-4000-8000-000000000001', 'bb300001-0003-4000-8000-000000000001',
  'Voicemail Drop Integration',
  'Pre-recorded voicemail drops fire on attempts 3, 7, and 12. Saves agents 3+ minutes per lead and keeps you top-of-mind.',
  true, true, 60, 1,
  '[
    {"id":"dd300008-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Voicemail Drops Matter</h3><p>Voicemail drops have a 92% open rate and 96% listen rate. Insurance campaigns see 10-20% callback rates. The catch: TCPA treatment of ringless voicemail is contested — only use on leads with prior express consent (your form-fill leads have this; cold lists do not).</p><p>Record three short scripts (one per attempt) and configure the dialer to drop them automatically.</p>"}},
    {"id":"dd300008-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"warning","title":"Keep Drops Under 30 Seconds","body":"Best practice for callback rate. Reference the form they filled out, give your name and number, give one reason to call back. That''s it."}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300003-0003-4000-8000-000000000001', 'bb300001-0003-4000-8000-000000000001',
  'Lead Status Enforcement',
  'Block agents from closing out a lead as "no contact" until 6+ attempts are logged. Discipline at the system level, not the willpower level.',
  true, true, 30, 2,
  '[
    {"id":"dd300009-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why System-Level Enforcement</h3><p>Every agent in your agency knows they \"should\" run cadence. Half of them won''t, because the path of least resistance is to close out the lead and move on. Make that path impossible at the CRM level.</p><p>Configure your CRM so a lead cannot be marked as \"lost — no contact\" unless 6+ touch attempts are logged in the activity timeline. If an agent objects, ask them to show you the data on agents who close after 2 attempts.</p>"}},
    {"id":"dd300009-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"tip","title":"Audit Weekly","body":"For the first month after rollout, audit every closed-out lead weekly. Look for patterns of agents skipping touches. Most cadence rollouts fail in week 3 when discipline drops — weekly audit prevents drift."}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300003-0004-4000-8000-000000000001', 'bb300001-0003-4000-8000-000000000001',
  'Script Role-Play Sessions',
  'Each agent role-plays the fresh, aged, and mailer scripts (training Lesson 5) with a manager or peer. Recordings reviewed.',
  true, true, 45, 3,
  '[
    {"id":"dd300010-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Drill</h3><p>Schedule 30 minutes per agent. Run all three openers (fresh, aged, mailer). Listen for: pace, confidence, no apologetic tone, immediate transition to qualifying questions. Record and review.</p><p>Most new agents fail on the aged script because they instinctively apologize. Catch this in role-play, not in front of real prospects.</p>"}},
    {"id":"dd300010-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"success","title":"Phase 2 Exit Criteria","body":"Avg attempts per lead ≥ 6 before any close-out, measured over the next 14 days. If you''re below, your cadence enforcement isn''t working — fix the CRM rule."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 3: Appointment Show-Rate Ops (Weeks 7-9)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0004-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 3 — Appointment Show-Rate Ops (Weeks 7-9)',
  'You''re booking more appointments now (Phase 2 effect). The leak shifts to no-shows. Plug it.',
  3);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300004-0001-4000-8000-000000000001', 'bb300001-0004-4000-8000-000000000001',
  'Single Calendar Tool for the Whole Agency',
  'Eliminate calendar fragmentation. Calendly, Acuity, or your CRM''s native calendar — pick one and standardize.',
  true, true, 60, 0,
  '[
    {"id":"dd300011-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Single Calendar</h3><p>If three agents use three different calendar tools, you can''t enforce booking-window rules, you can''t auto-fire reminders, and you can''t measure show rate consistently. Pick one. Make it mandatory.</p>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300004-0002-4000-8000-000000000001', 'bb300001-0004-4000-8000-000000000001',
  'Auto-SMS Reminders at 24hr and 1hr',
  'Cuts no-shows by 29-39%. Configure once, runs forever.',
  true, true, 30, 1,
  '[
    {"id":"dd300012-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Templates</h3><p><strong>24hr:</strong> <em>Hi [Name]! Reminder we have a [time] call tomorrow about your [coverage type] options. Reply YES to confirm or RESCHEDULE if needed.</em></p><p><strong>1hr:</strong> <em>Heads up [Name] — we''re on for [time] today (in 1 hour). Talk soon!</em></p><p>Configure both as automated SMS in your calendar tool or CRM.</p>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300004-0003-4000-8000-000000000001', 'bb300001-0004-4000-8000-000000000001',
  'Morning-Of Personal SMS Discipline',
  'NOT automated. Each agent personally texts each appointment between 8-10am the day-of. Lifts show rate 5-7 points.',
  true, true, 30, 2,
  '[
    {"id":"dd300013-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Manual</h3><p>Automated reminders work — but a personal SMS in the agent''s actual voice beats automated by 5-7 percentage points. The prospect can tell the difference. The 30 seconds per appointment compounds: on 5 daily appointments, that''s 50+ extra appointments per year.</p><p>Build it into the agent''s morning routine. Coffee at 8am, send personal SMS at 8:30am, ready for the day.</p>"}},
    {"id":"dd300013-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"/my-training","label":"Training reference: Booking & Show Rate lesson","description":"My Training → Warm Lead Mastery → Lesson 9: Booking & Show-Rate Mastery — script templates"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300004-0004-4000-8000-000000000001', 'bb300001-0004-4000-8000-000000000001',
  'No-Show Recovery Auto-Flow',
  'Within 5 minutes of a missed appt, system auto-fires a friendly reschedule SMS. Recovers ~30-40% of no-shows.',
  true, true, 30, 3,
  '[
    {"id":"dd300014-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Template</h3><p><em>Hey [Name] — looks like we missed each other for our [time] call. Want to grab a quick 15 min later today or tomorrow? Just reply with what works.</em></p><p>Friendly, no guilt-trip. Configure to fire 5 minutes after the calendar-recorded appointment time if no notes/disposition has been logged.</p>"}},
    {"id":"dd300014-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"success","title":"Phase 3 Exit Criteria","body":"Show rate &gt; 75% by end of Week 9, &gt; 80% by end of Week 12. If you''re below, audit which step is being skipped — it''s usually the personal morning-of SMS."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 4: Aged Lead Profit Engine (Weeks 10-12)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0005-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 4 — Aged Lead Profit Engine (Weeks 10-12)',
  'With fresh-lead workflow tight, aged leads become a high-ROI bolt-on. +150% net ROI when run with discipline.',
  4);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300005-0001-4000-8000-000000000001', 'bb300001-0005-4000-8000-000000000001',
  'Establish Aged Lead Vendor Relationship',
  'Open accounts with 1-2 aged-lead vendors. Contract terms, pricing tiers, age-bucket availability.',
  true, true, 90, 0,
  '[
    {"id":"dd300015-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Vendor Selection</h3><p>Common aged-lead vendors: Aged Lead Store, Benepath, Datalot, NextGen Leads. Compare on: per-lead price by age bucket, lead quality (filters available), contact-info accuracy, exclusivity (most aged leads are non-exclusive).</p><p>Open with 1 vendor. Run a 50-lead test batch. Calculate cost per acquired policy. Then decide whether to expand or switch.</p>"}},
    {"id":"dd300015-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"https://agedleadstore.com/aged-lead-roi-for-insurance/","label":"Aged Lead ROI Guide","description":"Industry pricing data and conversion benchmarks by age bucket"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300005-0002-4000-8000-000000000001', 'bb300001-0005-4000-8000-000000000001',
  'Build a Separate Cadence Template for Aged Leads',
  'Same 8-12 touch structure as fresh, but with the aged-lead opening script wired in. Different SMS templates, different voicemails.',
  true, true, 60, 1,
  '[
    {"id":"dd300016-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Separate</h3><p>The opening script is fundamentally different — never reference the form, never apologize, ask \"still looking?\" instead. If you reuse the fresh-lead cadence, agents will accidentally use the wrong opener and tank conversion.</p><p>Clone the fresh-lead cadence in your CRM. Replace every script template with the aged-lead variants from training Lesson 5. Tag the cadence \"Aged Leads — DO NOT USE FOR FRESH.\"</p>"}},
    {"id":"dd300016-0001-0001-0001-000000000002","type":"external_link","order":1,"data":{"url":"/my-training","label":"Training reference: Opening Scripts lesson","description":"My Training → Warm Lead Mastery → Lesson 5: Opening Script — Fresh vs Aged vs Mailer"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300005-0003-4000-8000-000000000001', 'bb300001-0005-4000-8000-000000000001',
  'Aged-Lead Dashboard: CPP by Age Bucket',
  'Track cost per acquired policy separately for 30-90 day, 91-365 day, and fresh-lead buckets. CPP is what matters, not raw conversion.',
  true, true, 60, 2,
  '[
    {"id":"dd300017-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Metric That Matters</h3><p>Conversion rate alone makes aged leads look bad. Cost per acquired policy makes them look great. Build a dashboard that shows BOTH — and trains agents to optimize for CPP, not conversion %.</p><p>Update your reporting (CRM dashboard or BI tool) to break out:</p><ul><li>Spend by lead source × age bucket</li><li>Policies written by lead source × age bucket</li><li>CPP = spend ÷ policies</li><li>Net commission - lead spend = profit by source</li></ul>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300005-0004-4000-8000-000000000001', 'bb300001-0005-4000-8000-000000000001',
  'Apply the 60/40 Budget Allocation',
  'Allocate 60% of aged-lead spend to 30-90 day age (better contact rate), 40% to 91-365 day (volume play).',
  true, true, 30, 3,
  '[
    {"id":"dd300018-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Mix</h3><p>Don''t buy all aged leads at the same age. The 60/40 split balances contact rate (newer leads) with volume (older, cheaper leads) and keeps your CPP optimal.</p><p>Reassess monthly based on actual CPP by bucket. If 91-365 day is outperforming, shift the mix.</p>"}},
    {"id":"dd300018-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"success","title":"Phase 4 Exit Criteria","body":"Aged-lead CPP at or below fresh-lead CPP after 60 days of operation. If aged is more expensive, your cadence on aged leads is too short — agents are giving up too early on lower-conversion leads."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION 5: Continuous Improvement (Week 13+)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES ('bb300001-0006-4000-8000-000000000001', 'b5e6f708-0203-4405-8607-08090a0b0c0d',
  'Phase 5 — Continuous Improvement (Week 13+)',
  'Weekly scorecards, monthly recording reviews, quarterly script refresh. Trend lines on every Phase 0 baseline metric.',
  5);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300006-0001-4000-8000-000000000001', 'bb300001-0006-4000-8000-000000000001',
  'Weekly Agency Scorecard',
  'Every Monday: speed, attempts, contact rate, show rate, close rate, CPP — per agent and agency-wide. Trend vs prior week + vs Phase 0 baseline.',
  true, true, 30, 0,
  '[
    {"id":"dd300019-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>The Cadence</h3><p>Same metrics from Phase 0, run weekly forever. Most rollouts gain ground for 6 weeks then drift back to the mean — weekly scorecard is what prevents drift.</p><p>Distribute every Monday. Discuss in team meeting. Coach the bottom-quartile agent on the metric they''re weakest on.</p>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300006-0002-4000-8000-000000000001', 'bb300001-0006-4000-8000-000000000001',
  'Monthly Recording Review Cohort',
  'Top performers share their best calls. Bottom performers get coaching on specific objection patterns.',
  true, true, 60, 1,
  '[
    {"id":"dd300020-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Recordings Matter</h3><p>Most coaching is done off second-hand reports — \"I think I did okay on that call.\" Recordings reveal what actually happened. Top agents almost always have specific habits (pace, listening ratio, objection-handling phrases) that are teachable. Surface them.</p><p>Pull 3 recordings per agent per month. Discuss in a monthly cohort call. The agent learns, the team learns.</p>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300006-0003-4000-8000-000000000001', 'bb300001-0006-4000-8000-000000000001',
  'Quarterly Script & Cadence Refresh',
  'Every quarter, review which scripts and cadence steps are converting and which aren''t. Update.',
  true, true, 90, 2,
  '[
    {"id":"dd300021-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>What to Look At</h3><ul><li>Which cadence step has the highest reply rate? (Often the breakup email — confirm it''s still firing.)</li><li>Which objections come up most often? (Update objection-handling guidance accordingly.)</li><li>Which lead source has the highest CPP? (Consider killing it.)</li><li>Which time-of-day is performing best? (Tell agents to lean into it.)</li></ul><p>Quarterly is the right cadence — too frequent and you''re churning templates without enough data; too rare and you miss seasonal/market shifts.</p>"}}
  ]'::jsonb
);

INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES ('cc300006-0004-4000-8000-000000000001', 'bb300001-0006-4000-8000-000000000001',
  'Lead Source ROI Ranking',
  'Rank every lead source by CPP and net commission per dollar spent. Kill the bottom 20% quarterly.',
  true, true, 60, 3,
  '[
    {"id":"dd300022-0001-0001-0001-000000000001","type":"rich_text","order":0,"data":{"html":"<h3>Why Ruthless Beats Diversified</h3><p>Most agencies spend across 6-10 lead sources because \"diversification.\" In reality, 2-3 sources usually drive 80% of the profit. The bottom sources eat agent time at low conversion. Rank quarterly. Kill the worst 20%. Reallocate to the top 20%.</p>"}},
    {"id":"dd300022-0001-0001-0001-000000000002","type":"callout","order":1,"data":{"variant":"success","title":"Year-1 Targets","body":"By end of Year 1, vs Phase 0 baseline: time-to-first-dial &lt;5 min on 90%+ of fresh leads. Attempts per lead avg 8+. Contact rate +25-40%. Show rate 80%+. Close rate +15-25%. Cost per policy -20-30%. If you hit half of these, the rollout was a success."}}
  ]'::jsonb
);

COMMIT;
