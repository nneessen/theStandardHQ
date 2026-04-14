# Template Variables Guide

Step-by-step reference for the template variable system — how it works, how to add new variables, and the complete variable catalog.

---

## Architecture Overview

The template variable system uses a **shared-definition, dual-runtime** pattern. Variables are defined once in a canonical list and consumed by three independent execution contexts.

### Core Files

| File | Runtime | Purpose |
|------|---------|---------|
| `src/lib/templateVariables.ts` | Frontend (Vite/React) | Canonical definitions — types, keys, metadata, categories, preview values, and the `replaceTemplateVariables()` function |
| `supabase/functions/_shared/templateVariables.ts` | Edge (Deno) | Server-side key list + replacement logic. Kept in manual sync with the frontend file |

### Context-Building Files (where variables get real values)

| File | Context | Description |
|------|---------|-------------|
| `src/services/recruiting/pipelineAutomationService.ts` | Pipeline | `buildContext()` + `contextToRecord()` — populates variables for pipeline phase/checklist automations |
| `supabase/functions/process-workflow/index.ts` | Workflow | `buildTemplateVariables()` — populates variables for the workflow engine |
| `supabase/functions/process-automation-reminders/index.ts` | Pipeline (cron) | Inline context objects — populates variables for phase-stall, deadline, and password reminder automations |

### Data Flow

```
Template Author writes: "Hello {{recruit_first_name}}, welcome to {{company_name}}"
                                         |
                                         v
                            +---------------------------+
                            | Context builder populates |
                            | { recruit_first_name:     |
                            |   "Jane",                 |
                            |   company_name:            |
                            |   "The Standard HQ" }    |
                            +---------------------------+
                                         |
                                         v
                            replaceTemplateVariables()
                                         |
                                         v
                          "Hello Jane, welcome to The Standard HQ"
```

---

## The Three Contexts

Every template variable has a `contexts` array that declares where it is supported. This determines which variables appear in the template editor UI for a given feature.

### 1. `"pipeline"` — Pipeline Automations

**Trigger:** Recruit enters/exits a phase, completes a checklist item, stalls in a phase, or approaches a deadline.

**Runtime:** Frontend service (`pipelineAutomationService.ts`) for event-driven triggers; edge function (`process-automation-reminders`) for cron-driven triggers (phase stall, deadline approaching, password reminders).

**Data available:** Recruit profile, upline info, agency/IMO, phase/item details, calculated durations.

### 2. `"workflow"` — Workflow Engine

**Trigger:** Manual workflow run or scheduled execution.

**Runtime:** Edge function (`process-workflow/index.ts`).

**Data available:** Workflow owner profile, recipient profile (looked up by recipientId or recipientEmail), dates, workflow metadata, company info. Uses `initEmptyVariables()` to pre-fill all 47 keys with `""` so no raw `{{tags}}` appear in output.

### 3. `"email"` — Email Template Editor

**Trigger:** Composing or previewing email templates in the UI.

**Runtime:** Frontend only — preview values from `TEMPLATE_PREVIEW_VALUES` are used for the template editor preview. Actual replacement happens at send time in whichever context (pipeline or workflow) triggers the send.

---

## Adding a New Template Variable: Step-by-Step

### Step 1: Define the Variable in `src/lib/templateVariables.ts`

Add an entry to the `TEMPLATE_VARIABLES` array:

```typescript
{
  key: 'recruit_middle_name',
  description: 'Middle name of the recruit',
  category: 'Recruit Basic',
  preview: 'Marie',
  contexts: ['pipeline', 'workflow', 'email'],
},
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `key` | Yes | Snake_case identifier. This is what template authors type: `{{recruit_middle_name}}` |
| `description` | Yes | Shown in the variable picker UI |
| `category` | Yes | Groups variables in the picker. Use an existing category or create a new one |
| `preview` | Yes | Example value shown in the template editor preview |
| `contexts` | Yes | Array of `"workflow"`, `"pipeline"`, `"email"` — controls where the variable appears in the UI |
| `aliasFor` | No | If this is an alias for another key (e.g., `date_today` is an alias for `current_date`) |

**Derived constants update automatically** — `TEMPLATE_VARIABLE_KEYS` and `TEMPLATE_PREVIEW_VALUES` are computed from `TEMPLATE_VARIABLES`, so no extra step is needed.

### Step 2: Add the Key to `supabase/functions/_shared/templateVariables.ts`

Add the same key string to the `TEMPLATE_VARIABLE_KEYS` array:

```typescript
export const TEMPLATE_VARIABLE_KEYS = [
  // ... existing keys ...
  'recruit_middle_name',
] as const;
```

This file must stay in manual sync with the frontend. The edge function version also powers `initEmptyVariables()`, which returns a record with every key set to `""`.

### Step 3: Populate the Variable in Each Context

You must add the actual data-fetching and mapping in every context where the variable should work.

#### 3a. Pipeline Context (Frontend) — `src/services/recruiting/pipelineAutomationService.ts`

**Two changes required:**

1. Add the field to the `AutomationContext` interface:

```typescript
export interface AutomationContext {
  // ... existing fields ...
  recruitMiddleName?: string;
}
```

2. Add the mapping in the `contextToRecord()` function:

```typescript
function contextToRecord(context: AutomationContext): Record<string, string> {
  return {
    // ... existing mappings ...
    recruit_middle_name: context.recruitMiddleName || '',
  };
}
```

3. Populate the field in `buildContext()`:

```typescript
async buildContext(recruitId, phaseId, itemName): Promise<AutomationContext> {
  // ... existing query ...
  return {
    // ... existing fields ...
    recruitMiddleName: recruit.middle_name || '',
  };
}
```

If the data requires a new database column or join, update the Supabase query in `buildContext()` accordingly.

#### 3b. Workflow Context (Edge Function) — `supabase/functions/process-workflow/index.ts`

Add the population logic in `buildTemplateVariables()`:

```typescript
async function buildTemplateVariables(
  context: Record<string, unknown>,
  ownerProfile: any,
  supabase: any
): Promise<Record<string, string>> {
  const vars = initEmptyVariables(); // starts with all 47+ keys = ""

  // ... existing population ...

  // Add your new variable
  if (recipientProfile) {
    vars['recruit_middle_name'] = recipientProfile.middle_name || '';
  }

  return vars;
}
```

Since this function starts from `initEmptyVariables()`, your new key will default to `""` if not explicitly set — no raw tags in output.

#### 3c. Cron Context (Edge Function) — `supabase/functions/process-automation-reminders/index.ts`

If the variable is relevant to cron-triggered automations (phase stall, deadline, password reminders), add it to the inline context objects in the appropriate processing block:

```typescript
// Phase stall context
const context: Record<string, string> = {
  // ... existing keys ...
  recruit_middle_name: recruit.middle_name || '',
};
```

This file builds context objects inline (not via a shared builder), so each trigger type has its own context block to update.

### Step 4: Database Changes (If Needed)

If the variable requires a new column:

1. Create a migration:
   ```bash
   # Generate timestamp
   date +%Y%m%d%H%M%S

   # Create migration file
   # supabase/migrations/YYYYMMDDHHMMSS_add_recruit_middle_name.sql
   ```

2. Apply it using the migration runner (never raw psql):
   ```bash
   ./scripts/migrations/run-migration.sh supabase/migrations/YYYYMMDDHHMMSS_add_recruit_middle_name.sql
   ```

3. Regenerate types:
   ```bash
   npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
   ```

### Step 5: Verify End-to-End

1. **Type check:** `npm run build` — must pass with zero errors
2. **UI check:** Open the email template editor, select the appropriate context, and confirm the new variable appears in the variable picker with the correct description and preview value
3. **Pipeline test:** Create a pipeline automation that uses `{{recruit_middle_name}}` in its template. Trigger it (e.g., move a recruit to a new phase). Check the automation log for correct substitution
4. **Workflow test:** Create a workflow with a send_email action using the variable. Run the workflow (test mode). Check the workflow run results
5. **Edge cases:** Verify the variable renders as `""` (not as `{{recruit_middle_name}}`) when the data is null/missing

---

## Complete Variable Reference (47 Variables)

### Recruit Basic

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `recruit_name` | Full name of the recruit | pipeline, workflow, email | John Smith |
| `recruit_first_name` | First name of the recruit | pipeline, workflow, email | John |
| `recruit_last_name` | Last name of the recruit | pipeline, workflow, email | Smith |
| `recruit_email` | Email address of the recruit | pipeline, workflow, email | john@example.com |
| `recruit_phone` | Phone number of the recruit | pipeline, workflow, email | (555) 123-4567 |
| `recruit_status` | Current status of the recruit | workflow, email | Active |

### Recruit Location

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `recruit_city` | City of the recruit | pipeline, workflow, email | Dallas |
| `recruit_state` | State of the recruit | pipeline, workflow, email | TX |
| `recruit_zip` | ZIP code of the recruit | pipeline, workflow, email | 75201 |
| `recruit_address` | Full address of the recruit | pipeline, workflow, email | 123 Main St, Dallas, TX 75201 |

### Recruit Professional

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `recruit_contract_level` | Contract level of the recruit | pipeline, workflow, email | 80 |
| `recruit_npn` | NPN of the recruit | pipeline, workflow, email | 12345678 |
| `recruit_license_number` | License number of the recruit | pipeline, workflow, email | LIC-123456 |
| `recruit_license_expiration` | License expiration date | workflow, email | 12/31/2026 |
| `recruit_license_state` | State where recruit is licensed | pipeline, email | TX |
| `recruit_referral_source` | How the recruit was referred | workflow, email | Agent Referral |
| `contract_level` | Alias for recruit_contract_level | pipeline, email | 80 |

### Recruit Social

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `recruit_facebook` | Facebook profile URL | workflow, email | facebook.com/johnsmith |
| `recruit_instagram` | Instagram handle | workflow, email | @johnsmith |
| `recruit_website` | Personal website URL | workflow, email | johnsmith.com |

### Organization

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `company_name` | Company name | workflow, email | The Standard HQ |
| `agency_name` | Agency name | pipeline, email | Smith Insurance Group |
| `imo_name` | IMO name | pipeline, email | National Marketing Org |

### User/Owner

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `user_name` | Full name of the logged-in user | workflow, email | Jane Doe |
| `user_first_name` | First name of the logged-in user | workflow, email | Jane |
| `user_last_name` | Last name of the logged-in user | workflow, email | Doe |
| `user_email` | Email of the logged-in user | workflow, email | jane@example.com |

### Upline

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `upline_name` | Full name of the recruit's upline | pipeline, email | Sarah Johnson |
| `upline_first_name` | First name of the upline | pipeline, email | Sarah |
| `upline_email` | Email of the upline | pipeline, email | sarah@example.com |
| `upline_phone` | Phone number of the upline | pipeline, email | (555) 987-6543 |

### Pipeline

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `phase_name` | Current pipeline phase name | pipeline, email | Onboarding |
| `phase_description` | Description of the pipeline phase | pipeline, email | Initial onboarding process |
| `template_name` | Pipeline template name | pipeline, email | New Agent Pipeline |
| `item_name` | Checklist item name | pipeline, email | Submit Application |
| `checklist_items` | All checklist items | pipeline, email | Item 1, Item 2, Item 3 |

### Sender

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `sender_name` | Name of the email sender | email | Jane Doe |
| `recruiter_name` | Name of the recruiter | email | Jane Doe |

### Dates

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `current_date` | Today's date formatted | pipeline, workflow, email | Monday, January 15, 2026 |
| `date_today` | Alias for current_date | pipeline, workflow, email | Monday, January 15, 2026 |
| `date_tomorrow` | Tomorrow's date | workflow, email | Tuesday, January 16, 2026 |
| `date_next_week` | Date one week from today | workflow, email | Monday, January 22, 2026 |
| `date_current_month` | Current month name | workflow, email | January |
| `date_current_year` | Current year | workflow, email | 2026 |
| `deadline_date` | Deadline date for a task | pipeline, email | February 1, 2026 |

### Calculated

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `days_in_phase` | Days the recruit has been in current phase | pipeline, email | 14 |
| `days_since_signup` | Days since the recruit signed up | pipeline, email | 30 |

### Links

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `portal_link` | Link to the application portal | pipeline, workflow, email | https://app.thestandardhq.com |
| `app_url` | Application base URL | workflow, email | https://app.thestandardhq.com |

### Workflow

| Key | Description | Contexts | Preview |
|-----|-------------|----------|---------|
| `workflow_name` | Name of the executing workflow | workflow, email | Weekly Check-in |
| `workflow_run_id` | Unique ID of the workflow run | workflow | run_abc123 |

---

## Variable Syntax

Template authors use double-brace syntax:

```
{{variable_name}}
```

The replacement engine is:
- **Case-insensitive** — `{{Recruit_Name}}` works the same as `{{recruit_name}}`
- **Whitespace-tolerant** — `{{ recruit_name }}`, `{{recruit_name}}`, and `{{ recruit_name}}` all resolve
- **Single-brace backward compatible** (edge functions only) — `{recruit_name}` also works in server-side processing

---

## Context Population Coverage

Not every variable is populated in every context. This table shows which context builders actually set each variable.

| Populated By | Description |
|--------------|-------------|
| **Pipeline frontend** (`contextToRecord`) | Recruit basic/location/professional, agency/IMO, upline, phase/item info, `days_in_phase`, `days_since_signup`, `current_date`, `portal_link` |
| **Workflow engine** (`buildTemplateVariables`) | All 47 keys initialized to `""`. Actively sets: user/owner info, company name, all dates, workflow metadata, recruit profile (full), `app_url` |
| **Cron reminders** (inline context) | Minimal subset per trigger type. Phase stall: recruit basic + phase + upline + `days_in_phase`. Deadline: recruit basic + phase + item + upline. Password: user info + `hours_remaining` |

**Key difference:** The workflow engine uses `initEmptyVariables()` so unused variables render as empty strings. The pipeline and cron contexts do not — unused variables will appear as literal `{{variable_name}}` text if referenced in a template but not populated.

---

## Troubleshooting

### Variable appears as raw `{{variable_name}}` in output

- The variable key may not be populated in the executing context. Check the coverage table above.
- Verify the key is spelled correctly in both the template and the `TEMPLATE_VARIABLE_KEYS` array.
- If running in pipeline context, `contextToRecord()` must include a mapping for the key.

### Variable appears in UI picker but doesn't resolve at send time

- The variable is defined in `TEMPLATE_VARIABLES` but not populated in the context builder for that execution path. Add the population logic per Step 3 above.

### Variable works in workflow but not in pipeline (or vice versa)

- Each context has its own independent population logic. A variable must be explicitly mapped in each context builder where it should work. Check all three files in Step 3.

### New key not appearing in edge function processing

- The key was added to `src/lib/templateVariables.ts` but not to `supabase/functions/_shared/templateVariables.ts`. These files must be kept in manual sync.
