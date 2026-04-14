-- Add comprehensive How To sections and items to the existing Close CRM Guide roadmap.
-- Roadmap ID: c89862f2-9021-478c-86e9-6b9dfaed9b2b
-- Existing sections (sort 0-4): Signup and Install, Close Cloner, How To Videos, How To Guides
-- New sections start at sort_order 5.

BEGIN;

-- ============================================================================
-- SECTION: Smart Views (sort 5)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES (
  'a1000001-0001-4000-8000-000000000001',
  'c89862f2-9021-478c-86e9-6b9dfaed9b2b',
  'Smart Views',
  'Smart Views are saved lead filters that dynamically update — the backbone of productive selling in Close.',
  5
);

-- Item 1: How To Create Smart Views
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000001-0001-4000-8000-000000000001',
  'a1000001-0001-4000-8000-000000000001',
  'How To Create Smart Views',
  'Learn to build dynamic saved filters that tell you exactly who to call, email, or follow up with.',
  true, true, 10, 0,
  '[
    {"id": "c1000001-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>What Are Smart Views?</h3><p>Smart Views are saved lead filters that appear in your Close sidebar. Think of them as living, breathing lists that automatically update based on criteria you set. When a lead''s status changes, a call is logged, or time passes — the Smart View adds or removes leads in real time.</p><p>Unlike static task lists that go stale, Smart Views are dynamic. They answer the two most important questions you face every day: <strong>Who should I contact next?</strong> And <strong>what should I say when I do?</strong></p>"}},
    {"id": "c1000001-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Creating Your First Smart View"}},
    {"id": "c1000001-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Step-by-Step: Creating a Smart View</h3><ol><li>Navigate to the <strong>Leads</strong> page in Close</li><li>Click <strong>Add Filter</strong> in the top-left area</li><li>Select filter criteria (status, activity, custom fields, etc.)</li><li>Combine multiple filters to narrow your list</li><li>Click <strong>Save as Smart View</strong> in the top-right</li><li>Name your Smart View and choose sharing settings (private or shared with org)</li></ol>"}},
    {"id": "c1000001-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "tip", "title": "Pro Tip", "body": "Start broad and refine. Build a Smart View with just one status filter first, then layer on activity and time-based filters as you learn what works for your workflow."}},
    {"id": "c1000001-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>Lead-Type vs Contact-Type Smart Views</h3><p>Close supports two types: <strong>Lead-based</strong> (filter by company/entity data) and <strong>Contact-based</strong> (filter by person data). You can tell them apart by the icon in your sidebar — a building icon for Leads, a person icon for Contacts.</p><p>For insurance sales, Lead Smart Views are typically more useful since your leads represent individual prospects or families.</p>"}},
    {"id": "c1000001-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "info", "title": "The Standard HQ Integration", "body": "The Standard HQ''s Close KPI Dashboard uses your Smart Views as filters for cross-reference reports and VM rate analysis. Every Smart View you create in Close becomes available as a filter dimension in your KPI widgets."}},
    {"id": "c1000001-0001-0001-0001-000000000007", "type": "external_link", "order": 6, "data": {"url": "https://help.close.com/docs/creating-smart-views", "label": "Close Help: Create a Smart View", "description": "Official Close documentation on creating and managing Smart Views"}}
  ]'::jsonb
);

-- Item 2: How To Build a Calling Smart View
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000001-0001-4000-8000-000000000002',
  'a1000001-0001-4000-8000-000000000001',
  'How To Build a Calling Smart View',
  'Create the perfect calling list — filter by status, call recency, and contact info for maximum dial efficiency.',
  true, true, 10, 1,
  '[
    {"id": "c1000002-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Building the Perfect Calling Smart View</h3><p>The most powerful use of Smart Views is building your daily calling list. A good calling Smart View answers two questions automatically: <strong>Should I call this person?</strong> And <strong>when was the last time I tried?</strong></p><p>The key insight: when a lead''s status changes or a call is logged, they automatically leave or enter your Smart View. Your list is always fresh — you never waste time dialing someone you just spoke with.</p>"}},
    {"id": "c1000002-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Building a Calling Smart View"}},
    {"id": "c1000002-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Step-by-Step</h3><ol><li><strong>Filter by status</strong> — only include statuses worth calling (Quoted, Follow-Up, Interested)</li><li><strong>Add a time filter</strong> — exclude leads called within the last 4 hours (inbound) or 2 days (outbound)</li><li><strong>Filter for phone numbers</strong> — add ''has phone number'' to avoid leads with no contact info</li><li><strong>Sort by priority</strong> — newest first for speed-to-lead, or oldest untouched for lead rot prevention</li><li><strong>Save and share</strong> — share with your team so everyone can use it with the Power Dialer</li></ol>"}},
    {"id": "c1000002-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "tip", "title": "Pro Tip", "body": "Add the filter Calls → Date Created → is not: Today if you don''t want to call anyone twice in one day. The Power Dialer works directly from Smart Views — once saved, just click the Call button at the top."}},
    {"id": "c1000002-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "success", "title": "Insurance Tip", "body": "Create separate calling Smart Views per product line. An agent dialing IUL prospects needs different talking points than one calling term life leads. Product-specific Smart Views help you stay in the right mental frame."}},
    {"id": "c1000002-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s Best Call Times widget analyzes your connect rates by hour and day of week. Use those insights to decide WHEN to start your Power Dialer sessions on your calling Smart Views."}},
    {"id": "c1000002-0001-0001-0001-000000000007", "type": "external_link", "order": 6, "data": {"url": "https://help.close.com/docs/creating-smart-views-for-calling", "label": "Close Help: Building a Calling Smart View", "description": "Official guide with filter examples for calling workflows"}}
  ]'::jsonb
);

-- Item 3: How To Avoid Lead Rot
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000001-0001-4000-8000-000000000003',
  'a1000001-0001-4000-8000-000000000001',
  'How To Avoid Lead Rot with Smart Views',
  'Build attention-needed Smart Views that surface leads at risk of going cold before it''s too late.',
  false, true, 8, 2,
  '[
    {"id": "c1000003-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>What Is Lead Rot?</h3><p>Lead rot happens when leads fall through the cracks — they sit in a status without being contacted, slowly going cold. Smart Views are your best defense.</p><p>Create <strong>attention-needed</strong> Smart Views that surface leads at risk of rotting. These views use time-based filters to find leads that haven''t been touched in too long.</p>"}},
    {"id": "c1000003-0001-0001-0001-000000000002", "type": "rich_text", "order": 1, "data": {"html": "<h3>Essential Lead Rot Smart Views</h3><ol><li><strong>No Activity in 7 Days</strong> — filter for active statuses where last activity date is more than 7 days ago</li><li><strong>New Leads - Untouched</strong> — leads created in the last 48 hours with zero communications</li><li><strong>Stale Quotes</strong> — leads in Quoted status with no activity in 14+ days</li><li><strong>Referral Ask</strong> — Active Policy leads 30-90 days old with no referral custom field set</li></ol><p>Review these Smart Views daily as part of your morning routine.</p>"}},
    {"id": "c1000003-0001-0001-0001-000000000003", "type": "callout", "order": 2, "data": {"variant": "warning", "title": "Speed-to-Lead Warning", "body": "In insurance, a lead not contacted within the first hour is dramatically less likely to convert. Your New Leads - Untouched Smart View should be the first thing you check every morning and after lunch."}},
    {"id": "c1000003-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s Follow-Up Gaps widget identifies these exact at-risk leads. It shows leads with the longest gaps since last contact, organized by status. Combined with Speed-to-Lead tracking, you''ll never let a hot lead go cold."}},
    {"id": "c1000003-0001-0001-0001-000000000005", "type": "external_link", "order": 4, "data": {"url": "https://help.close.com/docs/smart-view-tips-and-suggestions", "label": "Close Help: Avoiding Lead Rot", "description": "Tips for consolidating Smart Views and preventing leads from slipping away"}}
  ]'::jsonb
);

-- Item 4: Email & Workflow Smart Views
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000001-0001-4000-8000-000000000004',
  'a1000001-0001-4000-8000-000000000001',
  'How To Build Email & Workflow Smart Views',
  'Create Smart Views for bulk email sends and workflow enrollment that prevent duplicate messages.',
  false, true, 8, 3,
  '[
    {"id": "c1000004-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Smart Views for Email & Workflows</h3><p>When sending bulk emails or enrolling leads into Workflows, you need Smart Views that <strong>prevent duplicate sends</strong>. The key is excluding leads who have already received your message.</p><p>Close tracks which templates have been sent to which leads. Filter by ''has NOT received email template X'' to only see leads who haven''t gotten your outreach yet.</p>"}},
    {"id": "c1000004-0001-0001-0001-000000000002", "type": "rich_text", "order": 1, "data": {"html": "<h3>Step-by-Step</h3><ol><li>Start with the lead statuses eligible for your email/workflow</li><li>Add a filter to exclude leads already subscribed to the workflow</li><li>Add a template filter: Email → Template → is not: [Your Template Name]</li><li>Optionally limit the view to leads with email addresses</li><li>Save and use for bulk email sends or workflow enrollment</li></ol>"}},
    {"id": "c1000004-0001-0001-0001-000000000003", "type": "callout", "order": 2, "data": {"variant": "tip", "title": "Pro Tip", "body": "Start with 50-100 recipients and monitor your open/reply rates before scaling up. Close tracks template performance in the Sent Email Report."}},
    {"id": "c1000004-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "success", "title": "Insurance Tip", "body": "Build separate email Smart Views for each product line (life, health, P&C). A generic all-leads email blast will underperform compared to targeted outreach based on the product the lead inquired about."}},
    {"id": "c1000004-0001-0001-0001-000000000005", "type": "external_link", "order": 4, "data": {"url": "https://help.close.com/docs/smart-views-for-bulk-email-and-worfklows", "label": "Close Help: Bulk Email & Workflow Smart Views", "description": "Official tips for preventing duplicate sends"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION: Leads & Contacts (sort 6)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES (
  'a1000001-0002-4000-8000-000000000001',
  'c89862f2-9021-478c-86e9-6b9dfaed9b2b',
  'Leads & Contacts',
  'Master Close''s core data model — leads, contacts, statuses, and custom fields.',
  6
);

-- Item 1: How To Set Up Lead Statuses
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000002-0001-4000-8000-000000000001',
  'a1000001-0002-4000-8000-000000000001',
  'How To Set Up Lead Statuses for Insurance',
  'Define the stages of your insurance sales process with custom Lead Statuses.',
  true, true, 10, 0,
  '[
    {"id": "c1000005-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>What Lead Statuses Represent</h3><p>Lead Statuses describe a lead''s current relationship to your company. They''re the single most important organizational tool in Close because almost everything — Smart Views, reports, workflows, and pipeline tracking — is built on top of statuses.</p><p>Think of statuses as the stages in your sales funnel. When a lead progresses (or regresses), you update their status, and everything downstream updates automatically.</p>"}},
    {"id": "c1000005-0001-0001-0001-000000000002", "type": "rich_text", "order": 1, "data": {"html": "<h3>How To Create Lead Statuses</h3><ol><li>Go to <strong>Settings → Statuses &amp; Pipelines → Lead Statuses</strong></li><li>Click <strong>+ Add Status</strong></li><li>Type the status name and press Enter</li><li>Drag and drop statuses to reorder them</li><li>Click the pencil icon to rename, or trash to delete</li></ol>"}},
    {"id": "c1000005-0001-0001-0001-000000000003", "type": "video", "order": 2, "data": {"url": "", "platform": "youtube", "title": "Video: Setting Up Lead Statuses"}},
    {"id": "c1000005-0001-0001-0001-000000000004", "type": "rich_text", "order": 3, "data": {"html": "<h3>Recommended Insurance Statuses</h3><ol><li><strong>New Lead</strong> — just entered your system, not yet contacted</li><li><strong>Contacted</strong> — you''ve reached them and had an initial conversation</li><li><strong>Quoted</strong> — a quote has been presented</li><li><strong>Application Submitted</strong> — they''ve signed an application</li><li><strong>Underwriting</strong> — the application is in underwriting review</li><li><strong>Approved / Pending Issue</strong> — underwriting approved, waiting for policy</li><li><strong>Active Policy</strong> — policy is issued and in-force</li><li><strong>Declined</strong> — underwriting declined the application</li><li><strong>Not Interested</strong> — prospect declined to proceed after being quoted</li><li><strong>Lapsed</strong> — previously active policy that has lapsed</li><li><strong>DNC / Bad Contact</strong> — do not contact or invalid information</li></ol>"}},
    {"id": "c1000005-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "tip", "title": "Pro Tip", "body": "Start with high-level statuses and refine over time. Use a Product Type custom field instead of creating separate statuses per product. One Quoted status with a Product Type field (IUL, Term, Whole Life) keeps your list manageable."}},
    {"id": "c1000005-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "warning", "title": "Important", "body": "When you rename a status, all leads currently in that status are automatically updated. However, you''ll need to manually update any Smart View filter queries that reference the old status name."}},
    {"id": "c1000005-0001-0001-0001-000000000007", "type": "callout", "order": 6, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s AI Lead Heat scoring automatically classifies your lead statuses as rankable (worth scoring) or dead (excluded from scoring). Statuses like Active Policy, Declined, and DNC are auto-classified so they don''t pollute your AI Hot 100 list."}},
    {"id": "c1000005-0001-0001-0001-000000000008", "type": "external_link", "order": 7, "data": {"url": "https://help.close.com/docs/lead-statuses", "label": "Close Help: Lead Statuses", "description": "Official guide on defining and managing Lead Statuses"}}
  ]'::jsonb
);

-- Item 2: How To Use Custom Fields
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000002-0002-4000-8000-000000000001',
  'a1000001-0002-4000-8000-000000000001',
  'How To Use Custom Fields',
  'Store any additional data on leads, contacts, and opportunities — policy types, carrier names, premium amounts, and more.',
  true, true, 10, 1,
  '[
    {"id": "c1000006-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Understanding Custom Fields</h3><p>Custom Fields let you store additional data on Leads, Contacts, and Opportunities. They''re the key to powerful Smart View filtering and accurate reporting.</p><p><strong>Field scopes:</strong></p><ul><li><strong>Lead custom fields</strong> — company/entity-level (industry, source, policy type)</li><li><strong>Contact custom fields</strong> — person-level (date of birth, smoker status, DNC flag)</li><li><strong>Opportunity custom fields</strong> — deal-level (premium amount, carrier, policy number)</li></ul>"}},
    {"id": "c1000006-0001-0001-0001-000000000002", "type": "rich_text", "order": 1, "data": {"html": "<h3>Field Types</h3><ul><li><strong>Choices (single/multiple)</strong> — dropdown selections (e.g., Product Type: IUL, Term Life)</li><li><strong>Text</strong> — free-form text</li><li><strong>Number</strong> — numeric values with range filtering (e.g., Annual Premium: 2400)</li><li><strong>Date</strong> — date picker (e.g., Policy Renewal Date)</li><li><strong>User (single/multiple)</strong> — assign team members (e.g., Lead Owner)</li></ul>"}},
    {"id": "c1000006-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>How To Create a Custom Field</h3><ol><li>Go to <strong>Settings → Customizations → Custom Fields</strong></li><li>Choose the tab: Leads, Contacts, or Opportunities</li><li>Click <strong>+ Add Custom Field</strong></li><li>Enter the field name and select the type</li><li>For Choices fields, add your dropdown options</li><li>Click Save — the field is immediately available on all records</li></ol>"}},
    {"id": "c1000006-0001-0001-0001-000000000004", "type": "video", "order": 3, "data": {"url": "", "platform": "youtube", "title": "Video: Creating Custom Fields in Close"}},
    {"id": "c1000006-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "tip", "title": "Pro Tip", "body": "Use Choices fields instead of Text fields whenever possible. They''re searchable, filterable, and prevent data entry inconsistencies (e.g., IUL vs iul vs Indexed Universal Life)."}},
    {"id": "c1000006-0001-0001-0001-000000000006", "type": "rich_text", "order": 5, "data": {"html": "<h3>Recommended Insurance Custom Fields</h3><p><strong>Lead Fields:</strong> Product Type (Choices), Lead Source (Choices), Carrier (Choices), Annual Premium (Number), Coverage Amount (Number), Renewal Date (Date), Agent of Record (User)</p><p><strong>Contact Fields:</strong> Date of Birth (Date), Smoker Status (Choices), Health Class (Choices), Preferred Contact Method (Choices), Best Time to Call (Choices)</p><p><strong>Opportunity Fields:</strong> Policy Number (Text), Issue Date (Date), Effective Date (Date), Commission Rate (Number), Monthly Premium (Number)</p>"}},
    {"id": "c1000006-0001-0001-0001-000000000007", "type": "external_link", "order": 6, "data": {"url": "https://help.close.com/docs/custom-fields", "label": "Close Help: Custom Fields", "description": "Official documentation on all custom field types and usage"}}
  ]'::jsonb
);

-- Item 3: How To Import & Manage Leads
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000002-0003-4000-8000-000000000001',
  'a1000001-0002-4000-8000-000000000001',
  'How To Import & Manage Leads',
  'Bring your leads into Close from CSV files, email forwarding, or other CRMs.',
  true, true, 10, 2,
  '[
    {"id": "c1000007-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Importing Leads from CSV/Excel</h3><p>Close''s Lead Importer handles CSV and XLSX files. It''s the fastest way to bring in a batch of leads from a purchased lead list, an event spreadsheet, or a migration from another CRM.</p>"}},
    {"id": "c1000007-0001-0001-0001-000000000002", "type": "rich_text", "order": 1, "data": {"html": "<h3>Step-by-Step Import</h3><ol><li>Click your name in the top-right → <strong>Import data</strong></li><li>Upload your CSV or drag-and-drop the file</li><li>Map your spreadsheet columns to Close fields (Lead name, Contact name, Phone, Email, etc.)</li><li>Preview the import and fix any mapping issues</li><li>Click Import to bring the leads in</li></ol>"}},
    {"id": "c1000007-0001-0001-0001-000000000003", "type": "video", "order": 2, "data": {"url": "", "platform": "youtube", "title": "Video: Importing Leads from CSV"}},
    {"id": "c1000007-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "warning", "title": "Formatting Tips", "body": "Always use +1 country code prefix for US phone numbers (e.g., +18005551234). Use yyyy-mm-dd format for dates. Separate multiple emails with semicolons. Max file size is 15MB per upload."}},
    {"id": "c1000007-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>Lead Assignment</h3><p>Close handles lead assignment through a User-type custom field called <strong>Lead Owner</strong>. Once set up, every lead shows who owns it, and you can filter any Smart View or report by Lead Owner.</p><ol><li>Create a User (single) custom field called Lead Owner</li><li>Assign owners manually, via bulk edit, or via import</li><li>Use Zapier for round-robin or rule-based auto-assignment</li></ol>"}},
    {"id": "c1000007-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "success", "title": "Insurance Tip", "body": "If you receive leads via email from lead vendors (QuoteWizard, SmartFinancial, etc.), set up email forwarding rules to auto-forward to your Close secret address (Settings → Communication → Email → Secret Address). Zero manual entry."}},
    {"id": "c1000007-0001-0001-0001-000000000007", "type": "external_link", "order": 6, "data": {"url": "https://help.close.com/docs/importing-leads-from-file", "label": "Close Help: Importing Leads", "description": "Complete guide on the Close Lead Importer with field mapping"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION: Communication (sort 7)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES (
  'a1000001-0003-4000-8000-000000000001',
  'c89862f2-9021-478c-86e9-6b9dfaed9b2b',
  'Communication',
  'Master Close''s calling, email, and SMS features — the Power Dialer, templates, and bulk outreach.',
  7
);

-- Item 1: How To Use the Power Dialer
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000003-0001-4000-8000-000000000001',
  'a1000001-0003-4000-8000-000000000001',
  'How To Use the Power Dialer',
  'Auto-dial through Smart View lists to maximize call volume — the single biggest productivity tool for insurance agents.',
  true, true, 12, 0,
  '[
    {"id": "c1000008-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>What the Power Dialer Does</h3><p>The Power Dialer automatically calls through every lead in a Smart View, one after another, without you clicking into each lead. When one call ends, the next begins immediately. Between calls, you have time to take notes and update the lead.</p><p>This is the <strong>single biggest productivity tool</strong> for insurance agents who rely on outbound calling. Instead of manually finding the next lead, the dialer does it for you.</p>"}},
    {"id": "c1000008-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Starting a Power Dialer Session"}},
    {"id": "c1000008-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Running a Power Dialer Session</h3><ol><li>Navigate to your calling Smart View</li><li>Click the <strong>Call</strong> button at the top</li><li>The dialer starts calling the first lead automatically</li><li>When a call connects: talk, take notes, update the lead</li><li>When a call ends: the dialer auto-advances to the next lead</li><li>Click <strong>Pause</strong> to take a break, then <strong>Next Call</strong> to resume</li><li>Use <strong>Continue Calling</strong> to pick up where you left off if interrupted</li></ol>"}},
    {"id": "c1000008-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "tip", "title": "Pro Tip", "body": "Enable Call Recording and the Call Assistant before starting a session. The Call Assistant auto-transcribes your calls and generates notes, so you can focus on the conversation. New leads entering your Smart View are added to the queue automatically."}},
    {"id": "c1000008-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>Dialer Settings</h3><p><strong>Reduced Ring Time:</strong> By default, the dialer rings for 32 seconds (long enough for voicemail). Enable Reduced Ring Time to cut to 20 seconds for higher volume, fewer voicemails.</p><p><strong>Shared Smart Views:</strong> When multiple reps share the same calling Smart View, the Power Dialer automatically prevents them from calling the same lead. No coordination needed.</p>"}},
    {"id": "c1000008-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "success", "title": "Insurance Tip", "body": "For new internet leads, use Reduced Ring Time — speed matters more than voicemails. For aged leads or policy renewals, use the default 32 seconds so you can leave a personalized voicemail."}},
    {"id": "c1000008-0001-0001-0001-000000000007", "type": "callout", "order": 6, "data": {"variant": "info", "title": "The Standard HQ", "body": "Every call you make via the Power Dialer is captured by The Standard HQ''s Call Analytics widget. Connect rate, average duration, voicemail rate, and total dials are all tracked automatically — no manual logging needed."}},
    {"id": "c1000008-0001-0001-0001-000000000008", "type": "external_link", "order": 7, "data": {"url": "https://help.close.com/docs/using-the-power-dialer", "label": "Close Help: Power Dialer", "description": "Official guide on starting, pausing, and managing Power Dialer sessions"}}
  ]'::jsonb
);

-- Item 2: How To Create Email & SMS Templates
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000003-0002-4000-8000-000000000001',
  'a1000001-0003-4000-8000-000000000001',
  'How To Create Email & SMS Templates',
  'Build reusable templates with dynamic variables for personalized outreach at scale.',
  true, true, 10, 1,
  '[
    {"id": "c1000009-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Creating Email Templates</h3><p>Email templates let you write a message once and reuse it across all your leads. Combined with template variables, every email feels personal even when sent at scale.</p><ol><li>Go to <strong>Settings → Templates &amp; Snippets</strong></li><li>Click <strong>+ New Template</strong></li><li>Write your subject line (keep under 60 characters)</li><li>Write your body — use formatting toolbar for bold, links, etc.</li><li>Insert template variables using <strong>{{ curly braces }}</strong> syntax</li><li>Save with a clear, descriptive name</li></ol>"}},
    {"id": "c1000009-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Creating Email & SMS Templates"}},
    {"id": "c1000009-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Template Variables</h3><p>Close uses mustache syntax — double curly braces — to insert dynamic data:</p><ul><li><strong>{{ contact.first_name }}</strong> — the contact''s first name</li><li><strong>{{ contact.last_name }}</strong> — the contact''s last name</li><li><strong>{{ lead.display_name }}</strong> — the lead/company name</li><li><strong>{{ user.first_name }}</strong> — YOUR first name (the sender)</li><li><strong>{{ lead.custom.FIELD_NAME }}</strong> — any lead custom field value</li></ul>"}},
    {"id": "c1000009-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "tip", "title": "Pro Tip", "body": "Always use {{ contact.first_name }} instead of a generic Hi there. Personalized subject lines get 26% higher open rates. Test templates by sending to yourself first."}},
    {"id": "c1000009-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>SMS Templates</h3><p>SMS works the same but keep messages <strong>under 320 characters</strong>. SMS is a high-response channel — short, direct messages outperform longer ones.</p><p><strong>Important:</strong> A2P 10DLC registration is required for business SMS in the US. Complete registration in Close under Settings → Phone &amp; Voicemail.</p>"}},
    {"id": "c1000009-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "success", "title": "Insurance Tip", "body": "The highest-converting insurance email isn''t the quote — it''s the follow-up. Most prospects need 3-5 touches after receiving a quote before they act. Build a Workflow sequence that automatically follows up over 2-3 weeks."}},
    {"id": "c1000009-0001-0001-0001-000000000007", "type": "callout", "order": 6, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s AI Template Builder generates Close-compatible templates with these exact variables pre-inserted. Describe what you want and it builds the full template, ready to save to Close with one click."}},
    {"id": "c1000009-0001-0001-0001-000000000008", "type": "external_link", "order": 7, "data": {"url": "https://help.close.com/docs/email-configuration", "label": "Close Help: Email Configuration", "description": "Setting up email sync, templates, and sending options"}}
  ]'::jsonb
);

-- Item 3: How To Build Workflows (Sequences)
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000003-0003-4000-8000-000000000001',
  'a1000001-0003-4000-8000-000000000001',
  'How To Build Workflows (Sequences)',
  'Automate multi-step outreach with email, SMS, call reminders, and task steps over days or weeks.',
  true, true, 15, 2,
  '[
    {"id": "c1000010-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>What Workflows Are</h3><p>Workflows (sequences) are automated multi-step outreach campaigns. Define a series of steps — emails, SMS messages, call reminders, and tasks — with delays between them. When a lead is enrolled, Close executes each step on schedule.</p>"}},
    {"id": "c1000010-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Building a Multi-Step Workflow"}},
    {"id": "c1000010-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Creating a Workflow</h3><ol><li>Go to the <strong>Workflows</strong> section (left sidebar)</li><li>Click <strong>Create Workflow</strong></li><li>Name it clearly (e.g., ''New IUL Lead - 14 Day Nurture'')</li><li>Add your first step (usually an email)</li><li>Set the delay before the next step</li><li>Add subsequent steps (mix of email, SMS, call task)</li><li>Assign senders for each email/SMS step</li><li>Activate the workflow</li></ol>"}},
    {"id": "c1000010-0001-0001-0001-000000000004", "type": "rich_text", "order": 3, "data": {"html": "<h3>Enrolling Leads</h3><ul><li><strong>Individual:</strong> Open a lead → click Workflow icon → select → enroll</li><li><strong>Bulk:</strong> Create a Smart View → click ''...'' → Enroll in Workflow</li><li><strong>Automated:</strong> Use Zapier to auto-enroll when leads hit a certain status</li></ul><p>Each contact can only be in a specific workflow once.</p>"}},
    {"id": "c1000010-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "tip", "title": "Pro Tip", "body": "Front-load your workflows. The first 48 hours have the highest engagement. Send your strongest email + SMS on Day 1, follow up on Day 2, then space out subsequent touches over 1-2 weeks."}},
    {"id": "c1000010-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "success", "title": "Insurance Sequence Recipe", "body": "Proven pattern: Day 1 email + SMS, Day 2 call task, Day 4 email, Day 7 SMS, Day 10 call task, Day 14 final email. Multi-channel sequences outperform single-channel by 3-5x."}},
    {"id": "c1000010-0001-0001-0001-000000000007", "type": "callout", "order": 6, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s AI Template Builder can generate entire workflow sequences from a simple prompt. Describe what you want (e.g., new IUL lead follow-up over 2 weeks) and it builds the full multi-step sequence with email and SMS content, ready to save to Close."}},
    {"id": "c1000010-0001-0001-0001-000000000008", "type": "external_link", "order": 7, "data": {"url": "https://help.close.com/docs/onboarding-checklist-start-here", "label": "Close Help: Creating Workflows", "description": "Official onboarding guide including workflow creation"}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION: Pipeline & Scoring (sort 8)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES (
  'a1000001-0004-4000-8000-000000000001',
  'c89862f2-9021-478c-86e9-6b9dfaed9b2b',
  'Pipeline & Scoring',
  'Track deals through your pipeline and use AI scoring to prioritize the leads most likely to convert.',
  8
);

-- Item 1: How To Set Up Opportunities & Pipelines
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000004-0001-4000-8000-000000000001',
  'a1000001-0004-4000-8000-000000000001',
  'How To Set Up Opportunities & Pipelines',
  'Track deals from first contact to close — visualize your funnel, forecast revenue, and never lose track of a deal.',
  true, true, 12, 0,
  '[
    {"id": "c1000011-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Opportunities vs Lead Statuses</h3><p>While Lead Statuses track where a prospect is in your outreach process, <strong>Opportunities</strong> track where a deal is in your sales pipeline. A single Lead can have multiple Opportunities (e.g., life insurance + auto insurance).</p><p>A <strong>Pipeline</strong> is a named group of Opportunity Statuses. Statuses have types: <strong>Active</strong> (in progress), <strong>Won</strong> (closed successfully), or <strong>Lost</strong> (didn''t happen).</p>"}},
    {"id": "c1000011-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Setting Up Your Insurance Pipeline"}},
    {"id": "c1000011-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Insurance Pipeline Setup</h3><ol><li>Go to <strong>Settings → Statuses &amp; Pipelines → Opportunity Pipelines</strong></li><li>Create pipeline: <strong>Insurance Sales Pipeline</strong></li><li>Add Active statuses in order:<br>• Quote Requested (20% confidence)<br>• Quote Presented (40%)<br>• Application Submitted (60%)<br>• In Underwriting (80%)<br>• Approved / Pending Issue (95%)</li><li>Won status: <strong>Policy Issued</strong></li><li>Lost statuses: Declined by Underwriting, Prospect Withdrew, Went with Competitor</li></ol>"}},
    {"id": "c1000011-0001-0001-0001-000000000004", "type": "rich_text", "order": 3, "data": {"html": "<h3>Using the Pipeline View</h3><p>The Pipeline View is a visual drag-and-drop board showing all opportunities by status. Drag deals between columns to change status. Drag to the bottom to mark Won or Lost.</p><p>Filter by Smart View to see your team''s pipeline, or by User for individual rep views.</p>"}},
    {"id": "c1000011-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "info", "title": "The Standard HQ", "body": "The Standard HQ''s Opportunity Summary widget pulls directly from your Close pipeline data. Deal count, total value, win rate, average deal size, and sales velocity are all calculated automatically. The Lifecycle Velocity widget shows how long deals spend in each stage."}},
    {"id": "c1000011-0001-0001-0001-000000000006", "type": "external_link", "order": 5, "data": {"url": "https://help.close.com/docs/opportunity-statuses", "label": "Close Help: Opportunity Pipelines & Statuses", "description": "Official guide on creating and managing pipelines"}}
  ]'::jsonb
);

-- Item 2: How To Use AI Lead Scoring
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000004-0002-4000-8000-000000000001',
  'a1000001-0004-4000-8000-000000000001',
  'How To Use AI Lead Scoring',
  'Let The Standard HQ''s AI score and prioritize your leads 0-100 — focus on the prospects most likely to convert.',
  true, true, 10, 1,
  '[
    {"id": "c1000012-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>AI Lead Heat Scoring</h3><p>The Standard HQ scores every lead in your Close CRM from 0-100 using <strong>17 signals</strong>: call answer rate, email replies, SMS responses, engagement recency, inbound calls, opportunities, status velocity, and more.</p><p>Leads are classified into 5 heat levels: <strong>Hot, Warming, Neutral, Cooling, Cold</strong>. The top 100 hottest leads are auto-synced to an <strong>AI Hot 100 Smart View</strong> in your Close account daily at 7am EST.</p>"}},
    {"id": "c1000012-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: AI Lead Heat Scoring Overview"}},
    {"id": "c1000012-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>How It Works</h3><ol><li>Connect your Close API key to The Standard HQ (one-time setup)</li><li>AI scores all your leads automatically every 30 minutes</li><li>Scores are based on 17 signals — no manual input needed</li><li>The system learns from your outcomes (Won/Lost deals adjust scoring weights)</li><li>View your lead heat breakdown in the Close KPI Dashboard</li><li>Your AI Hot 100 Smart View in Close updates daily</li></ol>"}},
    {"id": "c1000012-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "tip", "title": "Customize Your Weights", "body": "You can customize the AI scoring weights in The Standard HQ''s Manage Weights panel. If speed-to-lead is your edge, increase Engagement Recency. If you work aged leads, decrease the Lead Age penalty."}},
    {"id": "c1000012-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>Insurance Prioritization Framework</h3><ul><li><strong>Tier 1 — Call NOW:</strong> AI Heat = Hot + New Lead or Quoted status</li><li><strong>Tier 2 — Call Today:</strong> AI Heat = Warming + any active status</li><li><strong>Tier 3 — Scheduled:</strong> AI Heat = Neutral + has opportunity</li><li><strong>Tier 4 — Nurture:</strong> AI Heat = Cooling → enroll in a Workflow</li><li><strong>Tier 5 — Archive:</strong> AI Heat = Cold + DNC/Bad Fit</li></ul>"}},
    {"id": "c1000012-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "warning", "title": "Speed Matters", "body": "A Hot lead contacted within 5 minutes converts at 4x the rate of one contacted after an hour. Make your AI Hot 100 Smart View the first thing you open every morning."}}
  ]'::jsonb
);

-- ============================================================================
-- SECTION: Integrations & Analytics (sort 9)
-- ============================================================================
INSERT INTO public.roadmap_sections (id, roadmap_id, title, description, sort_order)
VALUES (
  'a1000001-0005-4000-8000-000000000001',
  'c89862f2-9021-478c-86e9-6b9dfaed9b2b',
  'Integrations & Analytics',
  'Connect Close to your sales stack and measure what matters with built-in reports and The Standard HQ analytics.',
  9
);

-- Item 1: How To Connect Integrations
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000005-0001-4000-8000-000000000001',
  'a1000001-0005-4000-8000-000000000001',
  'How To Connect Integrations',
  'Set up API keys, Zapier automations, and connect Close to The Standard HQ for AI-powered analytics.',
  true, true, 10, 0,
  '[
    {"id": "c1000013-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Close API Keys</h3><p>API keys are the foundation for all integrations. To connect any external tool — including The Standard HQ — you need an API key.</p><ol><li>Go to <strong>Settings → Developer → + New API Key</strong></li><li>Name your key descriptively (e.g., The Standard HQ Integration)</li><li>Copy the key — you won''t see it again after closing the dialog</li><li>Store the key securely — treat it like a password</li></ol>"}},
    {"id": "c1000013-0001-0001-0001-000000000002", "type": "callout", "order": 1, "data": {"variant": "warning", "title": "Security Warning", "body": "Each API key has the same access as the user who created it. Never share your key with others or paste it into untrusted tools. If compromised, delete it immediately and create a new one."}},
    {"id": "c1000013-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>Connecting Close to The Standard HQ</h3><ol><li>Navigate to the Close KPI Dashboard in The Standard HQ</li><li>Click <strong>Connect Close CRM</strong> in the Setup Guide</li><li>Paste your Close API key</li><li>The system verifies your connection and pulls your organization metadata</li><li>Data sync begins immediately — KPI widgets populate within minutes</li><li>AI Lead Scoring starts its first run within 30 minutes</li></ol>"}},
    {"id": "c1000013-0001-0001-0001-000000000004", "type": "video", "order": 3, "data": {"url": "", "platform": "youtube", "title": "Video: Connecting Close to The Standard HQ"}},
    {"id": "c1000013-0001-0001-0001-000000000005", "type": "rich_text", "order": 4, "data": {"html": "<h3>Zapier Automations</h3><p>Popular Zaps for insurance agents:</p><ul><li>Google Form submission → Create Lead in Close</li><li>New Close Lead → Slack notification to team channel</li><li>Lead Status changes to Qualified → Create Opportunity</li><li>Facebook Lead Ad → Create Lead in Close</li><li>Workflow finished → Subscribe to next Workflow (chaining)</li></ul>"}},
    {"id": "c1000013-0001-0001-0001-000000000006", "type": "callout", "order": 5, "data": {"variant": "success", "title": "Insurance Tip", "body": "The highest-value Zapier integration for insurance agents is connecting lead vendors. When a new lead arrives from QuoteWizard or SmartFinancial, auto-create it in Close AND auto-enroll in your speed-to-lead workflow."}},
    {"id": "c1000013-0001-0001-0001-000000000007", "type": "external_link", "order": 6, "data": {"url": "https://help.close.com/docs/other-ways-to-get-your-data-into-close", "label": "Close Help: Integrations", "description": "Third-party integrations, API, and Zapier connections"}}
  ]'::jsonb
);

-- Item 2: How To Use Reporting & Analytics
INSERT INTO public.roadmap_items (id, section_id, title, summary, is_required, is_published, estimated_minutes, sort_order, content_blocks)
VALUES (
  'b1000005-0002-4000-8000-000000000001',
  'a1000001-0005-4000-8000-000000000001',
  'How To Use Reporting & Analytics',
  'Track activity, pipeline health, and sales performance with Close reports and The Standard HQ''s AI-powered dashboard.',
  false, true, 10, 1,
  '[
    {"id": "c1000014-0001-0001-0001-000000000001", "type": "rich_text", "order": 0, "data": {"html": "<h3>Close Built-In Reports</h3><ul><li><strong>Activity Overview:</strong> Total calls, emails, SMS, meetings per date range</li><li><strong>Activity Comparison:</strong> This week vs last week, this month vs last month</li><li><strong>Opportunity Funnel:</strong> Conversion rates between pipeline stages</li><li><strong>Sent Email Report:</strong> Open rates, reply rates per template</li><li><strong>Workflow Report:</strong> Step-by-step engagement metrics</li></ul><p>All reports are filterable by User, Smart View, Status, and Date. Export to CSV for further analysis.</p>"}},
    {"id": "c1000014-0001-0001-0001-000000000002", "type": "video", "order": 1, "data": {"url": "", "platform": "youtube", "title": "Video: Understanding Close Reports"}},
    {"id": "c1000014-0001-0001-0001-000000000003", "type": "rich_text", "order": 2, "data": {"html": "<h3>The Standard HQ: Beyond Built-In Reports</h3><p>The Standard HQ extends Close''s native reporting with AI-powered analytics:</p><ul><li><strong>Speed-to-Lead:</strong> How fast you contact new leads</li><li><strong>Contact Cadence:</strong> Average time between touches per lead</li><li><strong>Dial Attempts:</strong> How many calls to reach someone</li><li><strong>Follow-Up Gaps:</strong> Leads not touched in too long</li><li><strong>Best Call Times Heatmap:</strong> Connect rates by hour and day</li><li><strong>VM Rate by Smart View:</strong> Which views produce the most voicemails</li><li><strong>AI Lead Heat:</strong> 0-100 scoring with portfolio analysis</li></ul>"}},
    {"id": "c1000014-0001-0001-0001-000000000004", "type": "callout", "order": 3, "data": {"variant": "info", "title": "The Standard HQ", "body": "The prebuilt dashboard gives you 12 KPI widgets out of the box, plus custom dashboards with 21 widget types. All data is pulled directly from your Close CRM — no manual entry, no CSV exports, no spreadsheets."}},
    {"id": "c1000014-0001-0001-0001-000000000005", "type": "callout", "order": 4, "data": {"variant": "success", "title": "Insurance KPI", "body": "The biggest drop-off in insurance is usually between Quoted and Application Submitted. If your conversion here is below 30%, invest in better quote follow-up workflows. Track this in The Standard HQ''s Lifecycle Velocity widget."}},
    {"id": "c1000014-0001-0001-0001-000000000006", "type": "external_link", "order": 5, "data": {"url": "https://help.close.com/docs/opportunities-report", "label": "Close Help: Opportunity Reports", "description": "Using the Opportunity List and Pipeline View reports"}}
  ]'::jsonb
);

COMMIT;
