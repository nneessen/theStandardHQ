-- Lead Drop feature: tracks bulk lead transfers between Close CRM accounts
-- sender selects leads from their Smart View → recipient receives leads + a new Smart View

-- ─── lead_drop_jobs ───────────────────────────────────────────────────────────
-- One row per drop action. Tracks overall progress and the resulting Smart View
-- created in the recipient's Close CRM.

create table lead_drop_jobs (
  id                       uuid        primary key default gen_random_uuid(),
  sender_user_id           uuid        not null references user_profiles(id),
  recipient_user_id        uuid        not null references user_profiles(id),
  smart_view_id            text        not null,
  smart_view_name          text        not null,
  lead_source_label        text        not null,
  sequence_id              text,                    -- Close sequence ID, null = no enrollment
  sequence_name            text,
  status                   text        not null default 'pending',
  -- status enum: pending | running | completed | failed
  total_leads              int         not null default 0,
  created_leads            int         not null default 0,
  failed_leads             int         not null default 0,
  recipient_smart_view_id  text,                    -- Close saved_search ID in recipient's CRM
  recipient_smart_view_name text,
  error_message            text,
  created_at               timestamptz not null default now(),
  completed_at             timestamptz
);

alter table lead_drop_jobs enable row level security;

-- Sender can insert their own jobs
create policy "lead_drop_jobs_insert" on lead_drop_jobs
  for insert with check (auth.uid() = sender_user_id);

-- Sender and recipient can read jobs they're involved in
create policy "lead_drop_jobs_select" on lead_drop_jobs
  for select using (
    auth.uid() = sender_user_id or auth.uid() = recipient_user_id
  );

-- Edge function (service role) can update job progress
create policy "lead_drop_jobs_update_service" on lead_drop_jobs
  for update using (true);

-- ─── lead_drop_results ────────────────────────────────────────────────────────
-- One row per lead processed in a drop job.
-- Tracks which source lead mapped to which destination lead, and any errors.

create table lead_drop_results (
  id               uuid        primary key default gen_random_uuid(),
  job_id           uuid        not null references lead_drop_jobs(id) on delete cascade,
  source_lead_id   text        not null,  -- Close lead ID from sender's CRM
  source_lead_name text,
  dest_lead_id     text,                  -- Close lead ID created in recipient's CRM
  status           text        not null,  -- created | failed | skipped
  error_message    text,
  created_at       timestamptz not null default now()
);

alter table lead_drop_results enable row level security;

-- Sender and recipient can see results for their jobs
create policy "lead_drop_results_select" on lead_drop_results
  for select using (
    exists (
      select 1 from lead_drop_jobs j
      where j.id = job_id
        and (auth.uid() = j.sender_user_id or auth.uid() = j.recipient_user_id)
    )
  );

-- Edge function (service role) can insert results during processing
create policy "lead_drop_results_insert_service" on lead_drop_results
  for insert with check (true);

-- ─── indexes ──────────────────────────────────────────────────────────────────

create index lead_drop_jobs_sender_idx    on lead_drop_jobs (sender_user_id, created_at desc);
create index lead_drop_jobs_recipient_idx on lead_drop_jobs (recipient_user_id, created_at desc);
create index lead_drop_results_job_idx    on lead_drop_results (job_id, created_at);
