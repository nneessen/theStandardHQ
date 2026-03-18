# Chat Bot Team Access API

This document covers the CommissionTracker-side APIs and service calls that the
current chat-bot feature uses, plus the exposed actions that are currently not
wired into the chat-bot UI.

It is intentionally broader than the original team-access scope because the
page now includes additional bot-configuration flows, dashboard tabs, and a
public aggregate analytics tab.

## Effective Access Rule

Use this rule in the UI when deciding whether usage should render as unlimited:

```ts
const effectiveUnlimitedAccess = hasTeamAccess || agent.billingExempt === true;
```

`hasTeamAccess` is the dynamic, current-team signal from `get_team_access`.
`agent.billingExempt` is the external platform/manual override signal returned
by `get_agent`.

## Current Tab -> API Coverage

| Tab | Audience | Current calls |
| --- | --- | --- |
| Subscription | Everyone with page access | Shared subscription services, not `chat-bot-api`; team/super-admin activation also calls `team_provision` |
| Setup Guide | Everyone | No API calls; static content |
| All Bots | Everyone | Public edge function `bot-collective-analytics` |
| Bot Configuration | Users with bot access | `get_agent`, `update_config`, integration status/connect/disconnect actions, `get_calendly_event_types`, `update_business_hours`, `get_calendar_health` |
| Conversations | Users with completed setup | `get_conversations`, `get_messages` |
| Appointments | Users with completed setup | `get_appointments` |
| Usage | Users with completed setup | `get_usage`; UI also uses `get_agent` + `get_team_access` to render unlimited state |
| My Analytics | Users with completed setup | `get_analytics`, `get_attributions`, `unlink_attribution` |
| Monitoring | Super-admin only | `get_monitoring` |

Notes:

- `All Bots` is not backed by `chat-bot-api`; it uses the separate public
  `bot-collective-analytics` edge function.
- `Monitoring` is only shown to super-admins in the current UI.
- `Setup Guide` is purely static.

## 1. User-Facing Edge Function: `chat-bot-api`

Endpoint:

```text
POST /functions/v1/chat-bot-api
```

Auth:

- Bearer user JWT
- Supabase client `invoke()` from the app

### Access / entitlement actions

#### `action: "get_team_access"`

Request:

```json
{
  "action": "get_team_access"
}
```

Response:

```json
{
  "hasTeamAccess": true
}
```

Meaning:

- `true` when the current user is actively on a team whose upline has an active
  `billing_exempt = true` bot.
- This is the dynamic, current-team entitlement check used by the normal agent
  UI.

#### `action: "team_provision"`

Request:

```json
{
  "action": "team_provision"
}
```

Success response shapes:

```json
{
  "success": true,
  "agentId": "uuid"
}
```

```json
{
  "success": true,
  "agentId": "uuid",
  "alreadyProvisioned": true,
  "upgradedToTeamAccess": false
}
```

```json
{
  "success": true,
  "agentId": "uuid",
  "alreadyProvisioned": true,
  "upgradedToTeamAccess": true
}
```

Notes:

- Intended for active exempt-team members.
- Re-syncs `billingExempt = true` onto an already-provisioned external bot if
  needed.
- The current backend gate checks actual exempt-team membership, not
  `isSuperAdmin`.

#### `action: "get_agent"`

Request:

```json
{
  "action": "get_agent"
}
```

Response shape:

```json
{
  "id": "uuid",
  "name": "Andrew Engel",
  "botEnabled": true,
  "timezone": "America/New_York",
  "isActive": true,
  "createdAt": "2026-03-05T00:22:51.525Z",
  "autoOutreachLeadSources": [],
  "allowedLeadStatuses": [],
  "calendlyEventTypeSlug": null,
  "leadSourceEventTypeMappings": [],
  "companyName": null,
  "jobTitle": null,
  "bio": null,
  "yearsOfExperience": null,
  "residentState": null,
  "nonResidentStates": null,
  "specialties": null,
  "website": null,
  "location": null,
  "businessHours": null,
  "responseSchedule": null,
  "remindersEnabled": false,
  "billingExempt": true,
  "dailyMessageLimit": null,
  "maxMessagesPerConversation": null,
  "connections": {
    "close": { "connected": false },
    "calendly": { "connected": false },
    "google": { "connected": false }
  }
}
```

Notes:

- This is the main bot-configuration payload used by the setup wizard and full
  configuration tab.
- `billingExempt` is treated as an effective flag. The edge function combines
  the local `chat_bot_agents.billing_exempt` signal with `get_team_access`.
- The current setup UI also depends on:
  - `companyName`
  - `jobTitle`
  - `bio`
  - `yearsOfExperience`
  - `residentState`
  - `nonResidentStates`
  - `specialties`
  - `website`
  - `location`
  - `businessHours`
  - `responseSchedule`
  - `remindersEnabled`
  - `dailyMessageLimit`
  - `maxMessagesPerConversation`

#### `action: "get_usage"`

Request:

```json
{
  "action": "get_usage"
}
```

Response shape:

```json
{
  "leadsUsed": 5,
  "leadLimit": 0,
  "periodStart": "2026-03-01T00:00:00.000Z",
  "periodEnd": "2026-04-01T00:00:00.000Z",
  "tierName": "Team"
}
```

Notes:

- Team/unlimited users should be rendered as unlimited regardless of historical
  free-plan subscription rows.
- The usage UI shows engaged lead count only for exempt users; it does not
  render `x / y`.

### Bot configuration / integrations

#### `action: "update_config"`

Request shape accepted by the current UI:

```json
{
  "action": "update_config",
  "name": "Andrew Engel",
  "botEnabled": true,
  "timezone": "America/New_York",
  "autoOutreachLeadSources": ["Sitka Life"],
  "allowedLeadStatuses": ["Attempting Contact"],
  "calendlyEventTypeSlug": "intro-call",
  "leadSourceEventTypeMappings": [
    { "leadSource": "Sitka Life", "eventTypeSlug": "intro-call" }
  ],
  "companyName": "FFG",
  "jobTitle": "Agent",
  "bio": "Independent insurance agent.",
  "yearsOfExperience": 7,
  "residentState": "TX",
  "nonResidentStates": ["OK", "NM"],
  "specialties": ["Final Expense"],
  "website": "https://example.com",
  "location": "Dallas, TX",
  "remindersEnabled": true,
  "responseSchedule": {
    "timezoneMode": "lead",
    "days": []
  },
  "dailyMessageLimit": null,
  "maxMessagesPerConversation": null
}
```

Typical response:

```json
{
  "success": true
}
```

Notes:

- This is the main write path for the Bot Configuration tab and the setup
  wizard.
- The UI currently uses it for:
  - enabling/disabling the bot
  - timezone updates
  - lead source updates
  - lead status updates
  - appointment reminder toggle
  - agent profile updates
  - response schedule updates
  - Calendly lead-source mapping updates

#### `action: "connect_close"`

Request:

```json
{
  "action": "connect_close",
  "apiKey": "api_xxx"
}
```

Response:

```json
{
  "success": true
}
```

#### `action: "disconnect_close"`

Request:

```json
{
  "action": "disconnect_close"
}
```

Response:

```json
{
  "success": true
}
```

#### `action: "get_close_status"`

Response:

```json
{
  "connected": true,
  "orgName": "org_123"
}
```

or

```json
{
  "connected": false
}
```

#### `action: "get_calendly_auth_url"`

Request:

```json
{
  "action": "get_calendly_auth_url",
  "returnUrl": "https://app.example.com/chat-bot?tab=setup"
}
```

Response:

```json
{
  "url": "https://auth.calendly.com/..."
}
```

#### `action: "disconnect_calendly"`

Request:

```json
{
  "action": "disconnect_calendly"
}
```

Response:

```json
{
  "success": true
}
```

#### `action: "get_calendly_status"`

Response:

```json
{
  "connected": true,
  "eventType": "Connected",
  "userName": "Andrew Engel",
  "userEmail": "andrew@example.com"
}
```

or

```json
{
  "connected": false
}
```

#### `action: "get_calendly_event_types"`

Response:

```json
[
  {
    "uri": "https://api.calendly.com/event_types/...",
    "name": "Intro Call",
    "slug": "intro-call",
    "duration": 30,
    "active": true,
    "locations": [{ "kind": "phone" }]
  }
]
```

#### `action: "get_calendar_health"`

Response:

```json
{
  "healthy": true,
  "eventType": {
    "name": "Intro Call",
    "slug": "intro-call",
    "duration": 30,
    "locationKind": "phone",
    "schedulingUrl": "https://calendly.com/..."
  },
  "issues": []
}
```

Notes:

- Used only when a calendar provider is connected.
- The UI tolerates this endpoint being unavailable.

#### `action: "get_google_auth_url"`

Request:

```json
{
  "action": "get_google_auth_url",
  "returnUrl": "https://app.example.com/chat-bot?tab=setup"
}
```

Response:

```json
{
  "url": "https://accounts.google.com/..."
}
```

#### `action: "get_google_status"`

Response:

```json
{
  "connected": true,
  "calendarId": "primary",
  "userEmail": "andrew@example.com"
}
```

or

```json
{
  "connected": false
}
```

#### `action: "disconnect_google"`

Request:

```json
{
  "action": "disconnect_google"
}
```

Response:

```json
{
  "success": true
}
```

#### `action: "update_business_hours"`

Request:

```json
{
  "action": "update_business_hours",
  "businessHours": {
    "days": [1, 2, 3, 4, 5],
    "startTime": "09:00",
    "endTime": "17:00"
  }
}
```

Response:

```json
{
  "success": true
}
```

Notes:

- This is only used for Google Calendar scheduling rules.
- Calendly scheduling rules use `update_config` via
  `leadSourceEventTypeMappings`.

### Dashboard data actions

#### `action: "get_conversations"`

Request:

```json
{
  "action": "get_conversations",
  "page": 1,
  "limit": 20,
  "status": "active",
  "search": "clifford"
}
```

Response:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

#### `action: "get_messages"`

Request:

```json
{
  "action": "get_messages",
  "conversationId": "conv_123",
  "page": 1,
  "limit": 50
}
```

Response:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

#### `action: "get_appointments"`

Request:

```json
{
  "action": "get_appointments",
  "page": 1,
  "limit": 20
}
```

Response:

```json
{
  "data": [
    {
      "id": "appt_123",
      "leadName": "Jane Smith",
      "scheduledAt": "2026-03-18T14:00:00.000Z",
      "endAt": "2026-03-18T14:30:00.000Z",
      "status": "scheduled",
      "source": "bot",
      "createdAt": "2026-03-17T12:00:00.000Z",
      "eventUrl": "https://calendly.com/...",
      "reminder24hSentAt": null,
      "reminder1hSentAt": null,
      "reminder15mSentAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

Notes:

- The edge function normalizes several external appointment shapes into the
  frontend contract above.

#### `action: "get_analytics"`

Request:

```json
{
  "action": "get_analytics",
  "from": "2026-02-16",
  "to": "2026-03-17"
}
```

Response:

```json
{
  "conversations": {
    "total": 0,
    "byStatus": {},
    "byChannel": {},
    "avgMessagesPerConvo": 0,
    "suppressionRate": 0,
    "staleRate": 0
  },
  "engagement": {
    "responseRate": 0,
    "multiTurnRate": 0,
    "avgFirstResponseMin": 0,
    "avgObjectionCount": 0,
    "hardNoRate": 0
  },
  "appointments": {
    "total": 0,
    "bookingRate": 0,
    "showRate": 0,
    "cancelRate": 0,
    "avgDaysToAppointment": 0
  },
  "timeline": []
}
```

Notes:

- If the external analytics API is missing or down, the edge function returns an
  empty analytics shell instead of failing hard.

#### `action: "get_attributions"`

Request:

```json
{
  "action": "get_attributions",
  "from": "2026-02-16",
  "to": "2026-03-17"
}
```

Response shape:

```json
[
  {
    "id": "uuid",
    "policy_id": "uuid",
    "attribution_type": "bot_assisted",
    "match_method": "auto_phone",
    "confidence_score": 1,
    "lead_name": "Jane Smith",
    "conversation_started_at": "2026-03-01T12:00:00.000Z",
    "external_conversation_id": "conv_123",
    "external_appointment_id": null,
    "created_at": "2026-03-17T12:00:00.000Z",
    "policies": {
      "id": "uuid",
      "policy_number": "ABC123",
      "monthly_premium": 120,
      "annual_premium": 1440,
      "effective_date": "2026-03-15",
      "status": "active",
      "clients": {
        "name": "Jane Smith"
      }
    }
  }
]
```

Notes:

- This endpoint is backed by Supabase tables, not the external bot API.
- The current analytics tab always shows the attribution table even if
  `get_analytics` is unavailable.

#### `action: "unlink_attribution"`

Request:

```json
{
  "action": "unlink_attribution",
  "attributionId": "uuid"
}
```

Response:

```json
{
  "success": true
}
```

### Bot-related actions not driven by the current chat-bot page

#### `action: "check_attribution"`

Request:

```json
{
  "action": "check_attribution",
  "policyId": "uuid"
}
```

Typical responses:

```json
{
  "matched": true,
  "attributionType": "bot_converted",
  "matchMethod": "auto_phone",
  "confidence": 1
}
```

```json
{
  "matched": false,
  "reason": "no_match"
}
```

Notes:

- This is **not** called from a chat-bot tab.
- It is triggered from policy creation so a newly created policy can be
  auto-linked to an existing bot conversation.

#### `action: "link_attribution"`

Request:

```json
{
  "action": "link_attribution",
  "policyId": "uuid",
  "conversationId": "conv_123",
  "appointmentId": "appt_123",
  "leadName": "Jane Smith"
}
```

Response:

```json
{
  "success": true
}
```

Notes:

- A hook exists for this action, but no current chat-bot UI component calls it.
- Manual unlink is wired; manual link is not.

#### `action: "get_monitoring"`

Request:

```json
{
  "action": "get_monitoring"
}
```

Response:

```json
{
  "botStatus": {},
  "activity24h": {},
  "activity7d": {},
  "conversion": {},
  "errorIndicators": {},
  "followUp": {},
  "jobHealth": {}
}
```

Notes:

- This is currently only surfaced through the super-admin-only `Monitoring` tab.
- It is still per-agent monitoring for the current user's bot, not system-wide
  monitoring.

#### `action: "get_status"`

Request:

```json
{
  "action": "get_status"
}
```

Notes:

- Exposed by `chat-bot-api`.
- Not currently called anywhere in the frontend.

#### `action: "get_system_health"`

Request:

```json
{
  "action": "get_system_health"
}
```

Notes:

- Exposed by `chat-bot-api`.
- Not currently called anywhere in the frontend.
- This is the closest existing API surface to a true super-admin/system-wide
  monitoring view, but the current UI does not use it.

## 2. Public Edge Function: `bot-collective-analytics`

Endpoint:

```text
POST /functions/v1/bot-collective-analytics
```

Auth:

- No JWT required
- Used by the `All Bots` tab

Request:

```json
{
  "from": "2026-02-16",
  "to": "2026-03-17"
}
```

Response shape:

```json
{
  "activeBots": 42,
  "totalConversations": 847,
  "totalAppointments": 156,
  "totalAttributions": 98,
  "botConverted": 55,
  "botAssisted": 43,
  "totalPremium": 123456,
  "bookingRate": 18.4,
  "conversionRate": 11.57,
  "timeline": []
}
```

Notes:

- This function combines external aggregate bot metrics with local
  `bot_policy_attributions` and `policies` data.
- It is not role-specific; all users who can open the page can hit it.

## 3. Internal Service-Role Function: `chat-bot-provision`

Endpoint:

```text
POST /functions/v1/chat-bot-provision
```

Auth:

- Service role only
- Used by backend/subscription flows, not by end-user clients

Current callers:

- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/manage-subscription-items/index.ts`

### `action: "provision"`

Common paid-tier request shape:

```json
{
  "action": "provision",
  "userId": "uuid",
  "tierId": "starter"
}
```

Common billing-exempt request shape:

```json
{
  "action": "provision",
  "userId": "uuid",
  "billingExempt": true
}
```

Typical success response:

```json
{
  "success": true,
  "agentId": "uuid"
}
```

or

```json
{
  "success": true,
  "agentId": "uuid",
  "alreadyProvisioned": true
}
```

### `action: "update_tier"`

Request:

```json
{
  "action": "update_tier",
  "userId": "uuid",
  "tierId": "growth"
}
```

Response:

```json
{
  "success": true,
  "leadLimit": 150
}
```

Notes:

- Used by subscription lifecycle flows when the addon tier changes.

### `action: "deprovision"`

Request:

```json
{
  "action": "deprovision",
  "userId": "uuid"
}
```

Response:

```json
{
  "success": true
}
```

Notes:

- Supported by `chat-bot-provision`.
- Not currently called by the chat-bot page.
- Subscription-delete deprovisioning is currently handled directly inside
  `stripe-webhook`, not by invoking this action.

### `action: "set_billing_exempt"`

Request:

```json
{
  "action": "set_billing_exempt",
  "userId": "88791683-be7d-4ea7-8b62-b0d9cf905a85",
  "billingExempt": true
}
```

Response:

```json
{
  "success": true
}
```

Use this when you want to explicitly grant or revoke unlimited access for a
specific user without requiring a paid subscription.

Notes:

- This is the documented way to grant full access without Stripe.
- It is not currently called by the chat-bot page UI.

## 4. External Bot Platform API

Base URL:

```text
https://api-production-de66.up.railway.app
```

Key external endpoints currently hit from CommissionTracker:

- `POST /api/external/agents`
- `GET /api/external/agents/:id`
- `PATCH /api/external/agents/:id`
- `POST /api/external/agents/:id/connections/close`
- `DELETE /api/external/agents/:id/connections/close`
- `GET /api/external/agents/:id/connections/close`
- `GET /api/external/agents/:id/calendly/authorize`
- `DELETE /api/external/agents/:id/connections/calendly`
- `GET /api/external/agents/:id/connections/calendly`
- `GET /api/external/agents/:id/calendly/event-types`
- `GET /api/external/agents/:id/calendar-health`
- `GET /api/external/agents/:id/google/authorize`
- `GET /api/external/agents/:id/connections/google`
- `DELETE /api/external/agents/:id/connections/google`
- `GET /api/external/agents/:id/conversations`
- `GET /api/external/agents/:id/conversations/:conversationId/messages`
- `GET /api/external/agents/:id/appointments`
- `GET /api/external/agents/:id/usage`
- `GET /api/external/agents/:id/analytics`
- `GET /api/external/agents/:id/conversations/search`
- `GET /api/external/agents/:id/monitoring`
- `GET /api/external/monitoring/system`
- `GET /api/external/analytics/aggregate`
- `POST /api/external/agents/:id/deprovision`

## 5. What The Current Chat-Bot Feature Does Not Hit

### Active agent UI does hit

- `get_team_access`
- `team_provision`
- `get_agent`
- `update_config`
- `connect_close`
- `disconnect_close`
- `get_close_status`
- `get_calendly_auth_url`
- `disconnect_calendly`
- `get_calendly_status`
- `get_calendly_event_types`
- `get_calendar_health`
- `get_google_auth_url`
- `get_google_status`
- `disconnect_google`
- `update_business_hours`
- `get_conversations`
- `get_messages`
- `get_appointments`
- `get_usage`
- `get_analytics`
- `get_attributions`
- `unlink_attribution`
- `bot-collective-analytics`

### Bot-related APIs that exist but are not hit from the chat-bot tabs

- `check_attribution`
  - Used elsewhere during policy creation.
- `link_attribution`
  - Hook exists, but no current UI component calls it.
- `get_status`
  - Exposed, but unused.
- `get_system_health`
  - Exposed, but unused.
- `chat-bot-provision.deprovision`
  - Supported, but not called by the page UI.
- `chat-bot-provision.set_billing_exempt`
  - Manual/admin path only.

## 6. Super-Admin Specific Notes

- The current page treats `isSuperAdmin` as having bot access and shows the
  same free/team-style activation path as exempt-team members.
- The only extra chat-bot tab a super-admin gets today is `Monitoring`, and it
  calls `get_monitoring`.
- The current UI does **not** call `get_system_health`, so there is no true
  system-wide/super-admin bot-health dashboard yet.

Important mismatch:

- `ChatBotPage` and `ChatBotLanding` treat super-admins as eligible for free
  activation.
- `chat-bot-api` `team_provision` currently authorizes only actual exempt-team
  membership.
- Result: a super-admin who is not also on an exempt team can be shown an
  activate button that still returns `403`.

## Recommended Usage in CommissionTracker

1. Use `get_team_access` for dynamic current-team entitlement.
2. Use `get_agent` for bot config plus the platform/manual `billingExempt`
   signal.
3. Render unlimited usage when `hasTeamAccess || agent.billingExempt === true`.
4. Use `team_provision` to activate or repair a current exempt-team member's
   bot.
5. Use `set_billing_exempt` for explicit admin-managed grants outside the paid
   subscription flow.
6. Use `bot-collective-analytics` for the public `All Bots` tab.
7. If a super-admin should have a true no-subscription activation path, either:
   - grant them an active exempt bot via `set_billing_exempt`, or
   - add an explicit super-admin bypass path instead of relying on
     `team_provision`.
