# Close API — Verified Schema (for close-ai-builder)

Captured from live API testing on 2026-04-07 against production Close org
`orga_EoYT3qlJ3nVuOT0M01ftlet88gYevSIRjCWjA5em6DJ`. Don't trust the public
developer docs alone — they're incomplete on several critical fields. This
file is the authoritative reference for the edge function's types.

## Base

- **Base URL**: `https://api.close.com/api/v1`
- **Auth**: HTTP Basic `btoa(`${apiKey}:`)` (empty password)
- **Content-Type**: `application/json`

## Email Template — `POST /email_template/`

**Request (minimum fields):**
```json
{
  "name": "string",              // REQUIRED
  "subject": "string",           // REQUIRED
  "body": "string",              // REQUIRED — one string, NOT body_html/body_text
  "is_shared": true,             // optional, defaults false. See "is_shared hard requirement" below
  "attachments": []              // optional
}
```

**Full response shape:**
```json
{
  "id": "tmpl_XXXX",
  "name": "...",
  "subject": "...",
  "body": "...",
  "is_shared": true,
  "is_archived": false,
  "attachments": [],
  "bcc": [],
  "cc": [],
  "organization_id": "orga_XXXX",
  "created_by": "user_XXXX",
  "updated_by": "user_XXXX",
  "date_created": "2026-04-07T19:35:48.955000+00:00",
  "date_updated": "2026-04-07T19:35:48.955000+00:00",
  "last_used_at": "2026-04-07T19:35:48.952507",
  "last_used_by": "user_XXXX",
  "last_used_type": "create",
  "unsubscribe_link_id": null
}
```

**Variable substitution**: Mustache-style, e.g. `{{ contact.first_name }}`,
`{{ lead.display_name }}`. Confirmed accepted in both `subject` and `body`.

## SMS Template — `POST /sms_template/`

**Request (minimum fields):**
```json
{
  "name": "string",              // REQUIRED
  "text": "string",              // message body
  "is_shared": true              // HARD requirement if used in sequences
}
```

**Full response shape:**
```json
{
  "id": "smstmpl_XXXX",
  "name": "...",
  "text": "...",
  "is_shared": true,
  "status": "active",
  "attachments": [],
  "organization_id": "orga_XXXX",
  "owned_by": "user_XXXX",
  "created_by": "user_XXXX",
  "updated_by": "user_XXXX",
  "date_created": "2026-04-07T19:35:58.276506",
  "date_updated": "2026-04-07T19:35:58.276506",
  "last_used_at": "2026-04-07T19:35:58.272990",
  "last_used_by": "user_XXXX",
  "last_used_type": "create"
}
```

Note the `owned_by` field (not present on email templates) and `status: "active"`.

## Sequence — `POST /sequence/`

**Called "Sequences" in the API, "Workflows" in the Close UI and error messages.**
Our user-facing UI should use "Workflow" to match the Close UI.

**Request (minimum fields):**
```json
{
  "name": "string",                         // REQUIRED
  "timezone": "America/Los_Angeles",        // REQUIRED — missing this returns
                                            //   {"field-errors": {"timezone": "This field is required."}}
  "steps": [                                // REQUIRED, non-empty
    {
      "step_type": "email",                 // "email" | "sms" (both verified live)
      "delay": 0,                           // seconds SINCE THE PREVIOUS STEP (NOT from start)
      "email_template_id": "tmpl_XXXX",     // required if step_type == email
      "threading": "new_thread"             // "new_thread" | "old_thread". Only on email steps.
    },
    {
      "step_type": "sms",
      "delay": 172800,                      // 2 days AFTER the previous step (not from start)
      "sms_template_id": "smstmpl_XXXX"     // required if step_type == sms
    }
  ]
}
```

**IMPORTANT — step delay semantics (corrected 2026-04-07):**
Close's `delay` field is **relative to the previous step**, not absolute from
sequence start. Despite the values we observed in the simple 2-step POST test
being compatible with either interpretation, Nick confirmed from his own Close
usage that entering "6 days" on a step schedules it 6 days after the previous
message, not 6 days after enrollment. The edge function's `handleSaveSequence`
converts the AI's absolute "Day N" numbers to relative per-step delays at save
time using:

```
delay_i = (day_i - day_{i-1}) * 86400     for i > 0
delay_0 = (day_0 - 1) * 86400             (Day 1 = immediate enrollment = 0)
```

**Full response shape:**
```json
{
  "id": "seq_XXXX",
  "name": "...",
  "timezone": "America/Los_Angeles",
  "status": "active",                       // default
  "schedule": null,                         // inline schedule object (nullable)
  "schedule_id": null,                      // reference to a saved schedule (nullable)
  "trigger_query": null,                    // Smart View query for auto-enroll (Phase 2)
  "allow_manual_enrollment": true,          // default
  "organization_id": "orga_XXXX",
  "owner_id": "user_XXXX",
  "created_by_id": "user_XXXX",
  "updated_by_id": "user_XXXX",
  "date_created": "2026-04-07T19:36:12.232458",
  "date_updated": "2026-04-07T19:36:12.232465",
  "steps": [
    {
      "id": "seqstep_XXXX",
      "step_type": "email",
      "delay": 0,
      "email_template_id": "tmpl_XXXX",
      "sms_template_id": null,              // always present, nullable
      "threading": "new_thread",
      "required": true,                     // defaults true
      "step_allowed_delay": null,           // optional per-step jitter window
      "created_by_id": "user_XXXX",
      "updated_by_id": "user_XXXX",
      "date_created": "...",
      "date_updated": "..."
    },
    {
      "id": "seqstep_XXXX",
      "step_type": "sms",
      "delay": 172800,
      "email_template_id": null,            // always present, nullable
      "sms_template_id": "smstmpl_XXXX",
      "threading": null,                    // SMS steps have no threading
      "required": true,
      "step_allowed_delay": null,
      "created_by_id": "user_XXXX",
      "updated_by_id": "user_XXXX",
      "date_created": "...",
      "date_updated": "..."
    }
  ]
}
```

## Critical constraints discovered

### 1. `is_shared: true` is REQUIRED for any template used in a sequence

Exact error when referencing a private template in a sequence:
```json
{
  "errors": [
    "Template \"tmpl_XXXX\" cannot be used in Workflows because it is not shared."
  ],
  "field-errors": {}
}
```

**Implication for edge function**: Every template we create via `save_email_template`
or `save_sms_template` MUST set `is_shared: true`. No user-facing toggle.

### 2. `timezone` is required on sequences

Missing it returns:
```json
{
  "errors": [],
  "field-errors": {
    "timezone": "This field is required."
  }
}
```

**Implication**: Default to the user's profile timezone; fall back to
`"America/Los_Angeles"` if missing. Always include it in the save payload.

### 3. Step delays are ABSOLUTE from sequence start

A step with `delay: 172800` (2 days) runs 2 days after the sequence starts,
not 2 days after the previous step. Sequential-delay math in the UI
(`Day 1 → Day 3 → Day 7`) must convert to cumulative seconds at save time.

### 4. SMS step fields

- `step_type: "sms"` is the enum value (confirmed).
- Populate `sms_template_id`, leave `email_template_id` null.
- Do NOT send `threading` — Close returns `null` for it on SMS steps.
- `required` defaults to `true`, omit it.

### 5. Template delete ordering

You cannot delete a shared template while any sequence references it.
Delete the sequence first, then the template. Close returns HTTP 400 with
no body (or partial body) when this happens.

## Deferred for Phase 2

- **`trigger_query`** — Close stores a Smart View query string on the sequence
  itself for auto-enrollment. This is the "trigger" field Nick asked about.
  Needs a Smart View picker UI + query serializer. Not in Phase 1.
- **`schedule_id`** — References org-level schedule objects (business-hour
  windows) created separately. Phase 1 leaves as `null` (sequence runs anytime
  respecting Close's default send windows).
- **`step_allowed_delay`** — Per-step jitter window. Advanced editor only.

## Example payloads

See `supabase/functions/close-ai-builder/close/examples/` for canonical
request/response pairs captured during verification.
