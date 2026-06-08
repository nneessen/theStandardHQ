# Recruiting Subsystem — Architecture, Tenancy Model & June 2026 Overhaul

_Last updated: 2026-06-08_

This is the reference for the recruiting subsystem after the June 8, 2026 overhaul
(bug audit → wiring completion → readability/simplification redesign). It documents
the **two subsystems**, the **IMO tenancy model**, the **item-type ↔ runtime parity**,
the **automation trigger matrix**, the **public-page render decision tree**, and the
**security model** — plus the changes shipped and what remains.

## Two subsystems (don't conflate them)

1. **Onboarding pipeline** — admin builder (`src/features/recruiting/admin/*`) +
   recruit runtime (`components/PhaseChecklist.tsx`, `components/interactive/*`,
   `pages/MyRecruitingPipeline.tsx`). Data: `pipeline_templates` → `pipeline_phases`
   → `phase_checklist_items`; recruit progress in `recruit_phase_progress` etc.
2. **Public recruiting landing page** — AI builder (`components/RecruitingPageWizard.tsx`,
   `components/wizard/*`, `layouts/AiComposedLayout.tsx`, `layouts/blocks/*`,
   `lib/recruiting-design-spec.ts`) + public render & lead capture
   (`pages/PublicJoinPage.tsx`, `components/public/LeadInterestForm.tsx`).

Connected by the **automation/workflow engine** (`process-automation-reminders`,
`trigger-workflow-event`, `src/features/workflows/*`).

## IMO tenancy model (the create/edit correctness core)

Three distinct notions of "current IMO" must stay aligned:

- **App layer:** `useImo().effectiveImoId` — for a super-admin this follows the
  acting IMO (the sidebar switcher); for everyone else it's their home `imo_id`.
  `null` ⇒ "All IMOs" mode (super-admin only).
- **DB layer:** `get_effective_imo_id()` reads the acting IMO from
  `auth.users.raw_user_meta_data.acting_imo_id` (super-admin) or the user's home IMO.
- **RLS helper:** `super_admin_in_scope(row_imo_id)` =
  `is_super_admin() AND (get_effective_imo_id() IS NULL OR row_imo_id = get_effective_imo_id())`.
  Used in the consolidated `pipeline_templates_select_consolidated` policy and the
  super-admin UPDATE/DELETE policies — so a super-admin **already** sees/acts only within
  the acting IMO (or everything in All-IMOs mode). No separate "unconditional super-admin
  SELECT" policy exists.

### ⚠️ The create-context gotcha (root cause of mis-tenanted data)

A row is stamped with `effectiveImoId` at create time. If a super-admin creates while in
**Own-IMO** mode (acting IMO unset), `effectiveImoId` resolves to their **home** IMO — so
"The Standard" templates were silently stamped to the owner's home IMO (the dead **FFG**
IMO) instead of **Epic Life**. Guards added:
- The create dialog now shows **"Creating template for: &lt;IMO&gt;"** and **blocks Create in
  All-IMOs mode** (`PipelineTemplatesList.tsx`).
- React Query keys are scoped by `effectiveImoId` (`usePipeline.ts`) so switching IMO
  invalidates instead of serving stale cross-IMO data.
- `PipelineTemplateEntity`/`PipelineTemplate` carry `imo_id`; the admin list shows the owning
  IMO per row (super-admins).
- `PipelineTemplateRepository.setDefault()` scopes the `is_default=false` unset to the target
  row's `imo_id` (it previously cleared defaults across **all** IMOs).

### ⚠️ Verify recruiting DATA on PROD, not local

The original multi-agent audit measured the DB via `run-sql.sh` **without** sourcing
`REMOTE_DATABASE_URL`, so it hit the **local** DB and produced false claims ("Epic Life has
zero templates", "Epic Life = `2fd256e9…`"). Prod truth: Epic Life = `89514211-…`, and it
already had templates. **Always** target prod with
`source .env && DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh "…"` and
confirm the IPv6 `inet_server_addr()`.

## Pipeline: item-type ↔ runtime parity

The admin offers checklist item types; each must have a runtime renderer that honors its
config. Post-overhaul every configurable control does something:

| Item type | Runtime | Notable config now honored |
| --- | --- | --- |
| document_upload | upload + upline approve/reject | — (reject reason still uses `window.prompt`; TODO → Dialog) |
| task_completion / manual_approval | checkbox | — |
| training_module | embedded module | — |
| scheduling_booking | Book button | `custom_booking_url`/`booking_url` (NOT `integration_id`, which is unused) |
| video_embed | iframe | **`require_full_watch`** now gates completion |
| boolean_question / multiple_choice / text_response | inputs | — |
| acknowledgment | content + ack | **`content_type`** (document_url renders a link) + **`document_title`** |
| file_download | download + complete | **`require_download`** + **`minimum_review_time_seconds`** gates |
| external_link | open link | **`open_in_new_tab`** + **`expected_duration_minutes`** |
| quiz | quiz | **`time_limit_minutes`** countdown + **`show_correct_answers`** + `description` |
| carrier_contracting | contracting | — |

`automated_check` was **removed** from the admin dropdown — it had no runtime renderer (not in
`INTERACTIVE_ITEM_TYPES`, no special-case), so it was a type that did nothing (0 rows on prod).

## Automation trigger matrix

| Trigger | Fired by | Status |
| --- | --- | --- |
| `item_complete`, `item_approval_needed`, `phase_enter`, `phase_complete` | `checklistService` → `pipelineAutomationService.executeAutomation` at the event | wired (event-driven) |
| `phase_stall`, `item_deadline_approaching`, `password_reminder` | `process-automation-reminders` edge fn | **NOW wired** via daily `pg_cron` job (`0 13 * * *`); the edge fn was deployed but no cron invoked it. De-duped per day by `unique_daily_automation`. |

## Public page: render decision tree

`PublicJoinPage.tsx` resolves the recruiter by URL slug, then:

```
recruiting_page_settings.design_spec present?
  ├─ yes → validateDesignSpec(design_spec).spec   (re-validated on EVERY render)
  └─ no  → legacyThemeToSpec(theme)                (fallback for spec-less pages)
→ <AiComposedLayout spec={resolvedSpec} … />        (single source of truth for ALL pages)
```

The old `recruiterId === "the-standard"` → `NickCustomLayout` special-case was **removed**
(no account uses that slug; it silently ignored the builder). `NickCustomLayout` is deleted.

**Why `design_spec` was null for everyone on prod:** not a bug — the AI builder
(`generate-recruiting-design` edge fn) shipped 2026-06-07 and was simply unused; the persist
path is wired (`recruiting-validation.ts` whitelists `design_spec`, `brandingSettingsService`
upserts it, the wizard's `cleanBrandingInput` spreads it).

The wizard was simplified **7 → 4 steps** (Link / Design / Booking & contact / Review); the dead
"What visitors see" toggles were removed (the AI block model authors its own sections); labels
are now truthful (the page is live at slug-save — there is no publish gate).

## Security model (public surface)

- **No stored XSS:** `validateDesignSpec` sanitizes + coerces every field (allowlisted icons,
  hex colors, cleaned text) and is re-run on **every** public render; blocks render as React text.
- **Lead capture:** anon can only `INSERT` pending leads via `submit_recruiting_lead`
  (SECURITY DEFINER, owned by `postgres`). It resolves the recruiter from the slug (anon can't
  spoof `recruiter_id`/`imo_id`), verifies IMO active/not-revoked/approved, **requires TCPA
  consent** (rejects consent-less submissions), records consent verbatim to
  `communication_consent` (sms+email), and **rate-limits** per-recruiter (30/hr) + per-IP via
  `check_rate_limit`. Anon cannot read `recruiting_leads`.

## Routing / gating notes

- `/test-register/$token` (an unguarded debug component) was **removed** from the prod route tree.
- `PipelineAdminPage` lacks a `nav.recruiting_pipeline` UI permission guard. Data is already
  protected by RLS, so this is defense-in-depth only; **left as-is pending an owner decision**
  (adding it would block staff trainers who may legitimately use it).

## Changes shipped (2026-06-08) & open items

- **Migrations (prod):** `20260608090829` (lead-submit rate-limit + required TCPA),
  `20260608091228` (reminder cron), `20260608092247` (re-tenant The Standard pipelines FFG→Epic
  Life + set the 5-phase Non-Licensed pipeline as the Epic Life default; the prior Epic Life
  "templates" were empty shells).
- **Frontend (on `main`):** IMO create-context guards + scoped cache/entity; all dead config
  controls wired; builder authoritative (NickCustomLayout removed) + slug hydration-race fix;
  readability pass + wizard 7→4 + clone-as-primary + preview-overflow fix + dead-FeatureGate fix;
  `/test-register` removed.
- **Open:** document-reject `window.prompt` → Dialog (polish); `PipelineAdminPage` permission
  guard (owner decision); **`workflow_events` has no `imo_id`** → `trigger-workflow-event` matches
  workflows across tenants (medium-severity isolation gap; deferred — needs an edge-fn redeploy).
