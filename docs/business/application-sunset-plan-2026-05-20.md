# Application Sunset Plan

Date: 2026-05-20
Owner: Nick / super-admin
Status: Draft

## Purpose

This document outlines a professional, low-risk plan for shutting down the application for all users, with special handling for the small set of paid FFG/IMO users and a controlled export path for user data.

The goals are:

- notify users clearly and early
- stop billing cleanly
- provide self-service exports of user data
- move the product into read-only mode before final shutdown
- reduce legal, operational, and reputational risk
- preserve an admin-only control path for managing the sunset

## Current business context

- Estimated paid users: about 8
- Remaining users: free users
- Reason for shutdown: no longer sustainable to maintain and operate solo
- Desired shutdown date: end of June 2026

## Recommended timeline

Because today is 2026-05-20, the shutdown should be handled as a staged sunset rather than a same-day hard stop.

### Phase 1: Announcement and preparation

Target window: 2026-05-20 through 2026-05-31

- finalize user messaging
- identify all paid users and confirm subscription status
- stop any future renewals that would extend beyond 2026-06-30
- build and test export functionality
- add in-app banner and shutdown notice
- add super-admin sunset controls

### Phase 2: Notice period

Target window: 2026-06-01 through 2026-06-15

- email all users about the shutdown
- send a more direct message to paid users
- show persistent in-app notice with dates and export instructions
- encourage all users to export their data before read-only mode starts

### Phase 3: Read-only mode

Target date: 2026-06-16

- move the app into read-only mode for all non-super-admin users
- allow sign-in, viewing, and export
- block new policies, new recruits, new users, and other data creation
- block edits and deletes unless explicitly allowed for super-admin

### Phase 4: Service shutdown

Target date: 2026-06-30

- end normal application operation
- optionally keep a short export-only grace period if needed
- disable features that imply continued service or support

### Optional Phase 5: Export-only grace window

Suggested end date: 2026-07-15

- allow limited login only for export/download
- no data mutation
- no onboarding or billing flows
- support only for export issues

## User communication plan

### Paid users

Paid users should receive the most careful handling.

Actions:

- send a direct email announcement
- follow up personally where appropriate
- confirm the last billing date
- provide clear export instructions
- provide a support contact for export help

Required message points:

- the application is shutting down on 2026-06-30
- the application will no longer be maintained or operated after that date
- users should export their data before the cutoff
- billing will not continue past the shutdown date
- support will be limited to shutdown and export help

### Free users

Free users can be handled with:

- email notice
- in-app banner
- export prompt

### Tone guidance

Communication should be factual, calm, and professional. Do not over-explain. Do not imply a future maintenance commitment after the shutdown date unless that is actually planned.

## Billing handling

Main rule: no one should be charged for service beyond 2026-06-30.

Actions:

- identify all active paid subscriptions
- cancel renewals effective on or before the shutdown date
- review whether any user has already paid for service extending past 2026-06-30
- if so, decide whether to issue a prorated refund or other accommodation
- document final billing actions for each paid account

## Data export requirements

Each user should be able to download an Excel workbook containing their data.

Suggested workbook tabs:

- `Policies`
- `Clients`
- `Recruits`
- `Users`
- `Commissions` if applicable
- `README` with export timestamp, account context, and notes

Requirements:

- export must be scoped to the requesting user and their authorized tenant/org data
- export format should be `.xlsx`
- export should be easy to trigger from a popup, banner, or account notice
- export should continue working during read-only mode

## Product behavior during sunset

### Before read-only mode

- show a persistent shutdown banner
- show export reminders
- show exact dates in UI copy

### During read-only mode

Allow:

- sign-in
- view existing records
- export/download data

Block for non-super-admin:

- add policy
- add recruit
- add user
- add client where applicable
- edit or delete records unless there is a specific exception
- onboarding and invitation flows

### After final shutdown

One of these end states should be selected:

1. export-only mode for a short grace period
2. full maintenance page / disabled app

The app already has a hard environment-driven maintenance mode that can be used for the final state, but it is too blunt for the earlier sunset phases.

## Recommended implementation in this repo

This repo already has useful building blocks:

- hard maintenance mode in `src/index.tsx`
- `exceljs` support for `.xlsx` generation
- singleton settings patterns in existing Supabase migrations
- super-admin checks already used across the app

### Recommended new settings model

Add a dedicated sunset settings table, for example `sunset_settings`, with fields such as:

- `status` (`inactive`, `announced`, `read_only`, `export_only`, `disabled`)
- `shutdown_date`
- `read_only_date`
- `export_deadline`
- `banner_message`
- `support_email`
- `send_exports_enabled`
- `activated_by`
- `activated_at`
- `updated_at`

This should be a singleton-style settings table, readable by authenticated users and writable only by super-admin.

### Recommended admin controls

Add a super-admin-only Sunset Control page with actions such as:

- send announcement email to all users
- send paid-user announcement email
- enable shutdown banner
- enable export prompt
- switch app to read-only mode
- switch app to export-only mode
- mark shutdown complete

This control page should also show:

- current sunset status
- paid user count
- email delivery status if tracked
- export counts if tracked

### Recommended technical enforcement

Do not rely only on UI disabling.

Enforcement should happen in two layers:

1. UI layer
- hide or disable creation/edit actions
- show clear explanation text

2. backend/data layer
- block write operations for non-super-admin users when sunset mode is `read_only` or later
- preserve export/read access

Write blocking should cover at minimum:

- policies
- recruits
- user creation/invites
- client creation where applicable
- other mutation-heavy workflows that imply continued service

## Audit and tracking

Maintain logs for:

- when the sunset workflow was activated
- what status the app is currently in
- which users were emailed
- which users exported data
- who changed settings
- when billing was stopped

This reduces confusion if a user later claims they were not informed or could not retrieve data.

## Legal and compliance caution

Before promising deletion dates or retention behavior, confirm:

- whether policy/client data must be retained for any legal or business reason
- whether any contracts or terms require notice or a retention period
- whether any regulator, IMO, or carrier expectations apply

This plan is operational guidance only and is not legal advice.

## Suggested announcement draft

Subject: Important: Application shutdown on June 30, 2026

Body:

I’m writing to let you know that this application will be discontinued and shut down on June 30, 2026. After that date, it will no longer be maintained or operated.

Before shutdown, you will be able to export your data, including policy, client, and recruit records, in Excel format. Please complete your export before the stated cutoff date.

Your subscription will not renew for service beyond June 30, 2026. If you need help exporting your data, please contact [support email].

Thank you for your support. This decision was made because the platform is no longer sustainable for me to maintain and operate alone.

## Recommended order of execution

1. finalize this plan
2. identify paid users and billing exposure
3. build and test export flow
4. build sunset settings and super-admin controls
5. send user notices
6. switch to read-only mode on 2026-06-16
7. complete shutdown on 2026-06-30

## Implementation notes for later

When development starts, prefer these concrete deliverables:

- Supabase migration for `sunset_settings`
- super-admin UI for managing sunset state
- multi-sheet workbook export service
- global sunset banner / popup
- backend write guards for non-super-admin users
- email workflow for all-user announcement and paid-user announcement
