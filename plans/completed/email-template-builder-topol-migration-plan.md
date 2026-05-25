# Email Template Builder Migration Plan (TOPOL)

## 1) Goal

Replace the current custom block builder with TOPOL Plugin to deliver a more professional, easier-to-use email authoring experience while preserving the current send pipeline (`body_html` + Mailgun/Gmail edge functions).

## 2) Current State (Repo-Specific)

1. Authoring uses a custom DnD block builder and custom HTML renderer:
`src/features/email/components/block-builder/*`
2. Templates are persisted in `public.email_templates` using:
`body_html`, `body_text`, `blocks`, `is_block_template` (see `src/types/database.types.ts`).
3. Sends consume compiled HTML (`body_html`) in edge functions:
`supabase/functions/send-email/index.ts`, `supabase/functions/send-automated-email/index.ts`, `supabase/functions/process-workflow/index.ts`, `supabase/functions/process-bulk-campaign/index.ts`.
4. Builder is used in:
`src/features/marketing/components/templates/TemplateEditorDialog.tsx`
`src/features/marketing/components/campaigns/CampaignWizard.tsx`
`src/features/training-hub/components/EmailTemplatesTab.tsx`

## 3) Target Architecture

1. Keep `body_html` as the contract for all outbound sends (no send-path rewrite).
2. Add provider-aware editor metadata to templates:
`editor_provider` + `editor_document` (TOPOL JSON payload).
3. Introduce an editor abstraction in UI:
`EmailTemplateEditor` (provider switch via feature flag).
4. Run legacy and TOPOL editors in parallel during rollout.
5. Migrate users and templates gradually; keep rollback to legacy one-toggle away.

## 4) Proposed Data Contract Changes

### 4.1 DB migration

Add columns to `public.email_templates`:

1. `editor_provider text not null default 'legacy_blocks'`
2. `editor_document jsonb null`
3. `editor_version integer not null default 1`

Add check constraint:

1. `editor_provider in ('legacy_blocks', 'topol')`

Notes:

1. Keep existing `blocks` and `is_block_template` for backward compatibility.
2. Do not remove legacy fields until migration completion + cooldown period.

### 4.2 Type updates

Update:

1. `src/types/database.types.ts` (regenerate after migration)
2. `src/types/email.types.ts` with:
`type EmailEditorProvider = "legacy_blocks" | "topol"`
`editor_provider`, `editor_document`, `editor_version`

## 5) Service Layer Changes

Update `src/features/email/services/emailTemplateService.ts`:

1. Preserve current behavior for legacy templates.
2. For TOPOL templates:
store `editor_provider = "topol"`.
store `editor_document` (TOPOL JSON).
store compiled `body_html` and `body_text`.
3. Keep `blocksToHtml` usage only for `legacy_blocks`.
4. Add normalization helper:
`normalizeTemplateForEditor(template)` returning provider-specific edit payload.

## 6) UI Integration Plan

### 6.1 New abstraction

Create:

1. `src/features/email/components/template-editor/EmailTemplateEditor.tsx`

Responsibilities:

1. Choose implementation by `editor_provider` + env feature flag.
2. Expose one common event contract:
`onChange({ html, subject, provider, document, legacyBlocks? })`

### 6.2 TOPOL adapter

Create:

1. `src/features/email/components/template-editor/TopolTemplateEditor.tsx`

Use official React package:

1. `@topol.io/editor-react`

Core config:

1. `authorize.apiKey` from env (`VITE_TOPOL_API_KEY`)
2. `authorize.userId` from authenticated app user id
3. `mergeTags` generated from `TEMPLATE_VARIABLES` (email context)
4. `smartMergeTags.syntax` set to `{{` / `}}` to preserve current placeholder format
5. `onSave` callback persists `html` + `json`

### 6.3 Existing screens to migrate

Swap direct `EmailBlockBuilder` usage to abstraction in:

1. `src/features/marketing/components/templates/TemplateEditorDialog.tsx`
2. `src/features/marketing/components/campaigns/CampaignWizard.tsx`
3. `src/features/training-hub/components/EmailTemplatesTab.tsx`

### 6.4 Feature flag

Add:

1. `VITE_EMAIL_EDITOR_PROVIDER=legacy_blocks|topol`

Behavior:

1. Flag controls default provider for new templates.
2. Existing template `editor_provider` always wins on edit.

## 7) Merge Tags and Personalization

1. Keep existing token syntax `{{variable}}` to avoid send-time replacement changes.
2. Build TOPOL merge tag groups from `src/lib/templateVariables.ts`.
3. Keep runtime replacement untouched (`replaceTemplateVariables` + edge functions).
4. Validate that preview/demo values use canonical keys (`recruit_first_name`, etc.), not ad-hoc keys (`first_name`).

## 8) Rollout Phases

### Phase 0: Procurement and sandbox setup (0.5-1 day)

1. Create TOPOL API key locked to allowed app domains.
2. Add env vars in local/staging/prod.
3. Confirm plan-level features required for your use case.

### Phase 1: Foundation and schema (1 day)

1. Create Supabase migration for `editor_provider/editor_document/editor_version`.
2. Regenerate DB types.
3. Add TS model changes.

### Phase 2: Service compatibility (1 day)

1. Add provider-aware create/update/get logic.
2. Add unit tests for legacy + topol flows.

### Phase 3: TOPOL editor adapter (2-3 days)

1. Implement `TopolTemplateEditor`.
2. Implement merge tag mapping and save callbacks.
3. Wire to feature flag.

### Phase 4: Screen migration (1-2 days)

1. Move 3 editor surfaces to `EmailTemplateEditor`.
2. Keep legacy fallback path.

### Phase 5: QA and staged rollout (2 days)

1. Template CRUD regression.
2. Variable replacement regression.
3. Send regression through both `send-email` and `send-automated-email`.
4. Rendering checks in Gmail/Outlook/Apple Mail.
5. Enable in staging for internal users, then canary in production.

### Phase 6: Legacy deprecation (after 2-4 weeks stable)

1. Disable legacy for new templates.
2. Keep legacy edit mode read-only or behind admin toggle.
3. Plan archival/removal of legacy builder code.

## 9) Effort Estimate

1. Engineering implementation: 7-10 working days.
2. QA + email client verification: 2-3 working days.
3. Optional template redesign pass (marketing quality uplift): 3-5 working days.

## 10) Risks and Mitigations

1. Risk: template rendering shifts between legacy and TOPOL.
Mitigation: keep `body_html` as send source and run side-by-side QA with golden templates.
2. Risk: merge tag mismatch.
Mitigation: enforce canonical variable keys from shared source (`templateVariables.ts`) and add regression tests.
3. Risk: lock-in to one editor vendor.
Mitigation: maintain `EmailTemplateEditor` abstraction and provider field in DB.
4. Risk: feature limits by TOPOL plan.
Mitigation: validate required features (custom file manager, multilingual, loop blocks) before production rollout.

## 11) Acceptance Criteria

1. Users can create/edit/save TOPOL templates in all 3 current editor surfaces.
2. Saved template sends successfully via existing send functions with no send-path changes.
3. Variable replacement keeps current `{{key}}` behavior.
4. Legacy templates remain editable/safe during transition.
5. Feature flag can rollback all new editing to legacy without DB rollback.

## 12) Recommended Immediate Next Steps

1. Approve TOPOL as vendor and start trial in staging.
2. Implement Phase 1 + Phase 2 in one PR (schema + service compatibility).
3. Implement Phase 3 + Phase 4 in a second PR behind `VITE_EMAIL_EDITOR_PROVIDER`.
4. Run Phase 5 QA checklist before broad enablement.

## 13) External References

1. TOPOL React package: https://www.npmjs.com/package/@topol.io/editor-react
2. TOPOL callbacks: https://docs.topol.io/guide/callbacks.html
3. TOPOL load/save flow: https://docs.topol.io/guide/how-to-load-and-save-template.html
4. TOPOL plugin callable methods: https://docs.topol.io/reference/topol-plugin.html
5. TOPOL merge tags + custom syntax: https://docs.topol.io/guide/merge-tags.html
6. TOPOL pricing: https://topol.io/tariff-plugin/
