# External API Reference

Machine-to-machine API for the **commissionTracker** integration. All endpoints are prefixed with `/api/external/` and require API key authentication.

**Base URL (production):** `https://api-production-de66.up.railway.app`

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Codes](#error-codes)
- [Agents](#agents)
  - [Provision Agent](#provision-agent)
  - [Get Agent](#get-agent)
  - [Update Agent](#update-agent)
  - [Get Agent Status](#get-agent-status)
  - [Deprovision Agent](#deprovision-agent)
- [Connections](#connections)
  - [Connect Close](#connect-close)
  - [Get Close Connection](#get-close-connection)
  - [Disconnect Close](#disconnect-close)
  - [Get Lead Statuses](#get-lead-statuses)
  - [Get Calendly OAuth URL](#get-calendly-oauth-url)
  - [Get Calendly Connection](#get-calendly-connection)
  - [Disconnect Calendly](#disconnect-calendly)
  - [Get Google Calendar OAuth URL](#get-google-calendar-oauth-url)
  - [Get Google Calendar Connection](#get-google-calendar-connection)
  - [Disconnect Google Calendar](#disconnect-google-calendar)
- [Calendly Event Types](#calendly-event-types)
- [Calendar Health](#calendar-health)
- [Conversations](#conversations)
  - [List Conversations](#list-conversations)
  - [Get Conversation Messages](#get-conversation-messages)
  - [Search Conversations](#search-conversations)
- [Appointments](#appointments)
  - [List Appointments](#list-appointments)
- [Usage](#usage)
  - [Get Usage](#get-usage)
- [Analytics](#analytics)
  - [Per-Agent Analytics](#per-agent-analytics)
  - [Aggregate Analytics](#aggregate-analytics)
- [Monitoring](#monitoring)
  - [Per-Agent Monitoring](#per-agent-monitoring)
  - [System Health](#system-health)
- [Special Fields Reference](#special-fields-reference)

---

## Authentication

All external API routes require the `X-API-Key` header.

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Static API key matching the `EXTERNAL_API_KEY` environment variable on the server. Minimum 32 characters. |

The key is compared using timing-safe equality to prevent timing attacks.

**Error responses:**

| Scenario | Status | Error Code |
|----------|--------|------------|
| `EXTERNAL_API_KEY` env var not set on server | `503` | `INTERNAL` |
| Header missing or not a string | `401` | `UNAUTHORIZED` |
| Key does not match | `401` | `UNAUTHORIZED` |

---

## Response Format

### Success

All successful responses use this wrapper:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

The `meta` field is optional and used for pagination metadata when applicable.

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

The `details` field is optional. For validation errors, it contains the Zod `flatten()` output with `fieldErrors` and `formErrors`.

---

## Error Codes

### Service Error Codes

These map from internal service errors to HTTP statuses:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | `404` | Resource does not exist |
| `CONFLICT` | `409` | Resource already exists or state conflict |
| `VALIDATION` | `422` | Input validation failed |
| `UNAUTHORIZED` | `401` | Authentication failed |
| `INTERNAL` | `500` | Internal server error |

### Additional Error Codes

| Code | HTTP Status | Context |
|------|-------------|---------|
| `CONFIG` | `503` | Server-side integration not configured (e.g., Calendly) |
| `AUTH_EXPIRED` | `401` | OAuth token has expired; reconnection needed |
| `UPSTREAM_ERROR` | `502` | Call to third-party API (Close, Calendly) failed |

---

## Agents

### Provision Agent

Creates a new agent or returns an existing one if `externalRef` already exists (idempotent).

```http
POST /api/external/agents
```

**Request Body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `externalRef` | `string` | Yes | -- | Unique external identifier (commissionTracker `user_id`). 1-255 chars. |
| `name` | `string` | Yes | -- | Display name. 1-255 chars. |
| `timezone` | `string` | No | `America/New_York` | IANA timezone identifier. |
| `leadLimit` | `integer` | Conditional | -- | Monthly lead limit. **Required when `billingExempt` is not `true`.** Must be positive. Matched against active billing plans to assign subscription. |
| `billingExempt` | `boolean` | No | `false` | When `true`, agent bypasses all billing checks -- no subscription needed, no lead limit enforced. Designed for team members. |

**Validation:** If `billingExempt` is `false` (or omitted) and `leadLimit` is not provided, a `422` validation error is returned.

**Response (existing agent -- 200):**

```json
{
  "success": true,
  "data": {
    "agentId": "uuid",
    "slug": "bot-abc12345",
    "isNew": false
  }
}
```

**Response (new agent -- 201):**

```json
{
  "success": true,
  "data": {
    "agentId": "uuid",
    "slug": "bot-abc12345",
    "isNew": true
  }
}
```

**Slug generation:** The slug is auto-generated as `bot-{first 8 chars of externalRef}`. Collisions are resolved by appending `-1`, `-2`, etc., up to 50 attempts.

**Billing plan assignment:** When not billing-exempt, the system matches `leadLimit` against active billing plans. If no plan matches, a default plan is assigned.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `422` | `VALIDATION` | Invalid input or missing `leadLimit` when not billing-exempt |
| `409` | `CONFLICT` | Slug collision after 50 attempts (extremely unlikely) |

---

### Get Agent

Returns full agent configuration, connection statuses, and current usage.

```http
GET /api/external/agents/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string (UUID)` | Agent ID |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "uuid",
      "name": "Agent Name",
      "slug": "bot-abc12345",
      "timezone": "America/New_York",
      "isActive": true,
      "botEnabled": false,
      "systemPrompt": null,
      "autoOutreachLeadSources": [],
      "allowedLeadStatuses": [],
      "introMessageTemplate": null,
      "phoneStateMappings": [],
      "calendlyEventTypeSlug": null,
      "leadSourceEventTypeMappings": [],
      "contactCardTemplateId": null,
      "followUpEnabled": true,
      "followUpDelayMinutes": 120,
      "crmType": "close",
      "externalRef": "ct-user-id",
      "companyName": null,
      "jobTitle": null,
      "bio": null,
      "calendarEventNotes": null,
      "yearsOfExperience": null,
      "residentState": null,
      "nonResidentStates": null,
      "specialties": null,
      "website": null,
      "location": null,
      "businessHours": null,
      "responseSchedule": null,
      "billingExempt": false,
      "remindersEnabled": false,
      "dailyMessageLimit": null,
      "maxMessagesPerConversation": null,
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    },
    "connections": {
      "close": { "...connection object or null..." },
      "calendly": { "...connection object or null..." },
      "google": { "...connection object or null..." }
    },
    "usage": {
      "leadCount": 12,
      "leadLimit": 50,
      "periodStart": "2026-03-01T00:00:00.000Z",
      "periodEnd": "2026-04-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Agent does not exist |

---

### Update Agent

Partially updates agent configuration. All fields are optional. Only provided fields are changed.

```http
PATCH /api/external/agents/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string (UUID)` | Agent ID |

**Request Body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name. 1-255 chars. |
| `botEnabled` | `boolean` | Enable/disable the bot. |
| `systemPrompt` | `string \| null` | Custom system prompt override. |
| `autoOutreachLeadSources` | `string[]` | Lead sources that trigger proactive outbound SMS. |
| `allowedLeadStatuses` | `string[]` | Close lead statuses the bot will respond to. |
| `introMessageTemplate` | `string \| null` | Template for outbound intro messages. |
| `timezone` | `string` | IANA timezone identifier. |
| `leadLimit` | `integer` | Monthly lead limit. Changes the billing plan to match. |
| `calendlyEventTypeSlug` | `string \| null` | Calendly event type slug for booking. |
| `leadSourceEventTypeMappings` | `array` | Per-lead-source event type mappings (see below). |
| `companyName` | `string \| null` | Agent's company name. Max 255 chars. |
| `jobTitle` | `string \| null` | Agent's job title. Max 255 chars. |
| `bio` | `string \| null` | Agent bio. Max 1000 chars. |
| `yearsOfExperience` | `integer \| null` | Years of experience. 0-100. |
| `residentState` | `string \| null` | Two-letter state code (auto-uppercased). |
| `nonResidentStates` | `string[] \| null` | Array of two-letter state codes. |
| `specialties` | `string[] \| null` | Agent specialties. |
| `website` | `string \| null` | Agent website URL. Max 500 chars. Must be valid URL. |
| `location` | `string \| null` | Agent location. Max 255 chars. |
| `contactCardTemplateId` | `string \| null` | Contact card template ID. Max 255 chars. |
| `followUpEnabled` | `boolean` | Enable/disable stale lead follow-up. |
| `followUpDelayMinutes` | `integer` | Minutes before follow-up. 15-1440. |
| `remindersEnabled` | `boolean` | Enable/disable 24h SMS appointment reminders. |
| `businessHours` | `object \| null` | Business hours configuration (see below). |
| `responseSchedule` | `object \| null` | Bot response window and same-day booking rules (see below). |
| `billingExempt` | `boolean` | Toggle billing exemption. See [Special Fields](#special-fields-reference). |
| `dailyMessageLimit` | `integer \| null` | Daily outbound message cap. 1-10000. `null` = system default (500). |
| `maxMessagesPerConversation` | `integer \| null` | Max messages per conversation. 1-500. `null` = system default (50). |

**`leadSourceEventTypeMappings` shape:**

```json
[
  { "leadSource": "Sitka Life", "eventTypeSlug": "mortgage-protection-call" },
  { "leadSource": "GOAT Realtime Veterans", "eventTypeSlug": "veteran-consultation" }
]
```

Duplicate lead sources (case-insensitive) are rejected.

**`businessHours` shape:**

```json
{
  "days": [1, 2, 3, 4, 5],
  "startTime": "09:00",
  "endTime": "17:00"
}
```

- `days`: Array of integers 0-6 (0=Sunday, 6=Saturday). Must have at least one day. Deduplicated and sorted automatically.
- `startTime` / `endTime`: `HH:mm` format (24-hour). `startTime` must be before `endTime`.

**`responseSchedule` shape:**

```json
{
  "days": [
    {
      "day": 6,
      "responsesEnabled": true,
      "responseStartTime": "09:00",
      "responseEndTime": "17:00",
      "sameDayBookingEnabled": true,
      "sameDayBookingCutoffTime": "15:00"
    },
    {
      "day": 0,
      "responsesEnabled": false,
      "sameDayBookingEnabled": false
    }
  ]
}
```

- `day`: Integer `0-6` (`0=Sunday`, `6=Saturday`). Each day may appear only once.
- `responsesEnabled`: If `false`, the bot defers automated responses to the next enabled day.
- `responseStartTime` / `responseEndTime`: `HH:mm` format in the lead's local timezone.
- `sameDayBookingEnabled`: If `false`, the bot will not offer or confirm same-day appointments for that day.
- `sameDayBookingCutoffTime`: Optional `HH:mm` cutoff after which same-day booking is blocked, even if the bot may still respond later in the day.
- Omitted days fall back to backend defaults: responses allowed `08:00-20:30`, same-day booking allowed until `20:30`.

**`leadLimit` behavior:** When `leadLimit` is provided, the system finds an active billing plan with a matching lead limit and swaps the agent's subscription to that plan. If no plan matches, a warning is logged but no error is returned.

**Response (200):** Returns the full updated agent object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Agent does not exist |
| `422` | `VALIDATION` | Invalid input |

---

### Get Agent Status

Lightweight status check for provisioning and connection state.

```http
GET /api/external/agents/:id/status
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "isActive": true,
    "botEnabled": false,
    "closeConnected": true,
    "calendlyConnected": false,
    "googleConnected": true,
    "calendarProvider": "google",
    "subscriptionStatus": "active"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `isActive` | `boolean` | Whether the agent is active (not deprovisioned). |
| `botEnabled` | `boolean` | Whether the bot is enabled and processing messages. |
| `closeConnected` | `boolean` | Whether a Close CRM connection exists. |
| `calendlyConnected` | `boolean` | Whether a Calendly connection exists. |
| `googleConnected` | `boolean` | Whether a Google Calendar connection exists. |
| `calendarProvider` | `string \| null` | `"calendly"`, `"google"`, or `null`. |
| `subscriptionStatus` | `string` | `"active"` or `"none"`. |

---

### Deprovision Agent

Gracefully deactivates an agent: disables the bot, disconnects all integrations (Close webhook deregistration, Close connection removal, calendar disconnection), cancels the subscription, and marks the agent as inactive. Idempotent -- calling on an already-deprovisioned agent returns success.

```http
POST /api/external/agents/:id/deprovision
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "deprovisioned": true,
    "agentId": "uuid"
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Agent does not exist |

---

## Connections

### Connect Close

Connects a Close CRM API key to the agent. Validates the key, encrypts and stores it, and registers a webhook subscription for inbound events.

```http
POST /api/external/agents/:id/connections/close
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | `string` | Yes | Close.io API key. Min 1 char. |

**Response (201):**

Returns the created connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `422` | `VALIDATION` | Invalid input |
| `500` | Configuration error code | Server-side webhook URL not configured |
| `502` | Upstream error code | Close API rejected the key or webhook registration failed |

---

### Get Close Connection

```http
GET /api/external/agents/:id/connections/close
```

**Response (200):** Returns the connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Close connection exists for this agent |

---

### Disconnect Close

Deregisters the upstream Close webhook, removes the webhook subscription record, and deletes the Close connection.

```http
DELETE /api/external/agents/:id/connections/close
```

**Response (200):** Returns the removed connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Close connection exists |
| `502` | `UPSTREAM_ERROR` | Failed to deregister the webhook with Close.io |

---

### Get Lead Statuses

Fetches the actual lead statuses from the connected Close CRM organization.

```http
GET /api/external/agents/:id/lead-statuses
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "statuses": [
      { "id": "stat_abc123", "label": "New" },
      { "id": "stat_def456", "label": "Contacted" }
    ]
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Close connection / API key found |
| `502` | `UPSTREAM_ERROR` | Close API call failed |

---

### Get Calendly OAuth URL

Returns a Calendly OAuth authorization URL. Redirect the user to this URL to initiate the OAuth flow.

```http
GET /api/external/agents/:id/calendly/authorize
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnUrl` | `string` | No | URL to redirect the user to after OAuth completes. Must be an allowlisted origin with HTTPS (HTTP allowed for localhost in development). |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "url": "https://auth.calendly.com/oauth/authorize?client_id=...&state=..."
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Agent does not exist |
| `400` | `VALIDATION` | `returnUrl` is not an allowlisted origin |
| `422` | `VALIDATION` | Calendly OAuth not configured on the server |

---

### Get Calendly Connection

```http
GET /api/external/agents/:id/connections/calendly
```

**Response (200):** Returns the Calendly connection object. Does not trigger a token refresh (Calendly refresh tokens are single-use).

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Calendly connection exists |

---

### Disconnect Calendly

```http
DELETE /api/external/agents/:id/connections/calendly
```

**Response (200):** Returns the removed connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Calendly connection exists |

---

### Get Google Calendar OAuth URL

Returns a Google OAuth authorization URL for Calendar access.

```http
GET /api/external/agents/:id/google/authorize
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnUrl` | `string` | No | URL to redirect the user to after OAuth completes. Must be an allowlisted origin. |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=..."
  }
}
```

**Scopes requested:** `calendar.readonly`, `calendar.events`

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Agent does not exist |
| `400` | `VALIDATION` | `returnUrl` is not an allowlisted origin |
| `422` | `VALIDATION` | Google Calendar OAuth not configured on the server |

---

### Get Google Calendar Connection

```http
GET /api/external/agents/:id/connections/google
```

**Response (200):** Returns the Google Calendar connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Google Calendar connection exists |

---

### Disconnect Google Calendar

```http
DELETE /api/external/agents/:id/connections/google
```

**Response (200):** Returns the removed connection object.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No Google Calendar connection exists |

---

## Calendly Event Types

Lists active Calendly event types for an agent's connected Calendly account.

```http
GET /api/external/agents/:id/calendly/event-types
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "uri": "https://api.calendly.com/event_types/...",
      "name": "30 Minute Call",
      "slug": "30-minute-call",
      "duration": 30,
      "active": true
    }
  ]
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `503` | `CONFIG` | Calendly not configured on the server |
| `400` | `VALIDATION` | No Calendly user linked to this connection |
| `401` | `AUTH_EXPIRED` | Calendly authorization has expired; reconnection needed |
| `404` | `NOT_FOUND` | No calendar connection exists for this agent |

---

## Calendar Health

Performs a health check on the agent's connected calendar (supports both Calendly and Google Calendar). Validates the connection, authentication, event type configuration, and availability.

```http
GET /api/external/agents/:id/calendar-health
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "healthy": true,
    "provider": "calendly",
    "eventType": {
      "name": "30 Minute Call",
      "slug": "30-minute-call",
      "duration": 30,
      "locationKind": "outbound_call",
      "schedulingUrl": "https://calendly.com/user/30-minute-call"
    },
    "issues": []
  }
}
```

When issues are detected, `healthy` is `false` if any issue has severity `"error"`. Issues with severity `"warning"` do not mark the calendar as unhealthy.

**Issue object:**

```json
{
  "code": "no_availability",
  "severity": "warning",
  "message": "No available time slots in the next 7 days",
  "action": "Check your Calendly availability settings and ensure you have open hours."
}
```

**Issue codes:**

| Code | Severity | Description |
|------|----------|-------------|
| `no_connection` | `error` | No calendar connected or no account linked |
| `no_config` | `error` | Calendar provider not configured on server |
| `auth_expired` | `error` | OAuth authorization expired |
| `no_event_types` | `error` | No active event types in Calendly |
| `slug_not_found` | `error` | Configured event type slug not found in Calendly |
| `api_error` | `error` | Failed to fetch event types from API |
| `no_availability` | `warning` | No open slots in the next 7 days |
| `no_location` | `warning` | Event type has no location configured |
| `ask_invitee_location` | `warning` | Event type uses "Ask Invitee" location (may cause booking issues) |
| `availability_check_failed` | `warning` | Could not verify availability |

For Google Calendar, `eventType` is always `null` (Google Calendar does not use event types).

---

## Conversations

### List Conversations

Returns paginated conversations for an agent. Supports filtering by status and free-text search. Automatically enriches missing lead names from Close CRM on the first access.

```http
GET /api/external/agents/:id/conversations
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | `1` | Page number (1-based). |
| `limit` | `integer` | `20` | Items per page. Max 100. |
| `status` | `string` | -- | Filter by status: `open`, `awaiting_reply`, `scheduling`, `scheduled`, `closed`, `stale`. |
| `search` | `string` | -- | Free-text search (matched against lead name/phone). |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "closeLeadId": "lead_abc123",
      "leadName": "John Doe",
      "leadPhone": "+18591234567",
      "status": "open",
      "channel": "sms",
      "localPhone": "+18005551234",
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-03-01T14:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### Get Conversation Messages

Returns paginated messages for a specific conversation. Includes a cross-tenant guard: the conversation must belong to the specified agent.

```http
GET /api/external/agents/:id/conversations/:conversationId/messages
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string (UUID)` | Agent ID |
| `conversationId` | `string (UUID)` | Conversation ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | `1` | Page number. |
| `limit` | `integer` | `20` | Items per page. Max 100. |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "direction": "inbound",
      "body": "Hi, I got your message about mortgage protection",
      "channel": "sms",
      "createdAt": "2026-03-01T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "..." }
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Conversation does not exist or does not belong to this agent |

---

### Search Conversations

Search conversations by lead name and/or phone number. At least one of `leadName` or `leadPhone` is required.

```http
GET /api/external/agents/:id/conversations/search
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `leadName` | `string` | At least one required | Partial name match (case-insensitive). Multi-word queries also match on the last name alone. |
| `leadPhone` | `string` | At least one required | Phone number match. Non-digit characters are stripped for comparison. |
| `from` | `string` | No | ISO-8601 date/datetime. Only return conversations created on or after this date. |

**Response (200):**

Returns up to 50 results, sorted by most recent first. Includes the latest appointment ID per lead if one exists.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "leadName": "John Doe",
      "leadPhone": "+18591234567",
      "appointmentId": "uuid-or-null",
      "startedAt": "2026-03-01T12:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `422` | `VALIDATION` | Neither `leadName` nor `leadPhone` provided |

---

## Appointments

### List Appointments

Returns paginated appointments for an agent.

```http
GET /api/external/agents/:id/appointments
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | `1` | Page number. |
| `limit` | `integer` | `20` | Items per page. Max 100. |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "closeLeadId": "lead_abc123",
      "status": "confirmed",
      "startAt": "2026-03-05T14:00:00.000Z",
      "endAt": "2026-03-05T14:30:00.000Z",
      "calendarEventId": "calendly-event-uri",
      "createdAt": "2026-03-01T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "..." }
  }
}
```

Appointment statuses: `pending`, `confirmed`, `cancelled`, `no_show`, `completed`.

---

## Usage

### Get Usage

Returns current billing period usage for an agent: lead count, lead limit, and period dates.

```http
GET /api/external/agents/:id/usage
```

**Response (200 -- active subscription):**

```json
{
  "success": true,
  "data": {
    "leadCount": 12,
    "leadLimit": 50,
    "periodStart": "2026-03-01T00:00:00.000Z",
    "periodEnd": "2026-04-01T00:00:00.000Z"
  }
}
```

**Response (200 -- no subscription):**

```json
{
  "success": true,
  "data": {
    "leadCount": 0,
    "leadLimit": 0,
    "periodStart": null,
    "periodEnd": null
  }
}
```

---

## Analytics

### Per-Agent Analytics

Returns comprehensive analytics for a single agent within a date range.

```http
GET /api/external/agents/:agentId/analytics
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | `string` | 30 days before `to` | ISO-8601 date or datetime. Inclusive start. |
| `to` | `string` | Start of tomorrow (UTC) | ISO-8601 date or datetime. Exclusive end. Date-only values are pushed to start of the next day to include the full day. |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "conversations": {
      "total": 150,
      "byStatus": {
        "active": 25,
        "completed": 100,
        "stale": 25
      },
      "byChannel": {
        "sms": 140,
        "web": 10
      },
      "avgMessagesPerConvo": 6.3,
      "suppressionRate": 0.0133,
      "staleRate": 0.1667
    },
    "engagement": {
      "responseRate": 0.72,
      "multiTurnRate": 0.65,
      "avgFirstResponseMin": 2.3,
      "avgObjectionCount": 0.8,
      "hardNoRate": 0.05
    },
    "appointments": {
      "total": 30,
      "bookingRate": 0.2,
      "showRate": 0.85,
      "cancelRate": 0.1,
      "avgDaysToAppointment": 1.5
    },
    "timeline": [
      {
        "date": "2026-03-01",
        "conversations": 5,
        "appointments": 1,
        "conversions": 1
      }
    ]
  }
}
```

**Field descriptions:**

| Field | Description |
|-------|-------------|
| `conversations.byStatus.active` | Conversations in `open`, `awaiting_reply`, or `scheduling` status |
| `conversations.byStatus.completed` | Conversations in `scheduled` or `closed` status |
| `conversations.suppressionRate` | Ratio of suppressed conversations to total (0-1) |
| `conversations.staleRate` | Ratio of stale conversations to total (0-1) |
| `engagement.responseRate` | Ratio of conversations where the lead replied (0-1) |
| `engagement.multiTurnRate` | Ratio of conversations with more than 2 messages (0-1) |
| `engagement.avgFirstResponseMin` | Average minutes between first inbound and first outbound message |
| `engagement.hardNoRate` | Ratio of conversations with a hard "no" from the lead (0-1) |
| `appointments.bookingRate` | Appointments / total conversations (0-1) |
| `appointments.showRate` | Completed appointments / total appointments (0-1) |
| `appointments.cancelRate` | Cancelled appointments / total appointments (0-1) |
| `appointments.avgDaysToAppointment` | Average days between conversation creation and appointment start |
| `timeline[].conversions` | Same as `appointments` (integer count) |

---

### Aggregate Analytics

Cross-agent aggregate analytics. Returns data across **all** agents. Tenant isolation is provided by the API key -- each commissionTracker deployment uses its own key.

```http
GET /api/external/analytics/aggregate
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | `string` | 30 days before `to` | ISO-8601 date or datetime. |
| `to` | `string` | Start of tomorrow (UTC) | ISO-8601 date or datetime. |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalConversations": 500,
    "totalAppointments": 80,
    "bookingRate": 0.16,
    "byStatus": {
      "open": 30,
      "awaiting_reply": 15,
      "scheduling": 10,
      "scheduled": 50,
      "closed": 370,
      "stale": 25
    },
    "timeline": [
      {
        "date": "2026-03-01",
        "conversations": 20,
        "appointments": 3,
        "conversions": 3
      }
    ]
  }
}
```

---

## Monitoring

### Per-Agent Monitoring

Real-time health dashboard data for a single agent. Includes activity windows, job queue health, conversion metrics, error indicators, follow-up stats, and connection status.

```http
GET /api/external/agents/:agentId/monitoring
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "agentId": "uuid",
    "timestamp": "2026-03-06T15:00:00.000Z",
    "botStatus": {
      "isActive": true,
      "botEnabled": true,
      "closeConnected": true,
      "calendlyConnected": true,
      "followUpEnabled": true
    },
    "activity24h": {
      "period": "24h",
      "newConversations": 5,
      "inboundMessages": 20,
      "outboundMessages": 18,
      "responseRate": 0.9,
      "avgResponseTimeMin": 1.5
    },
    "activity7d": {
      "period": "7d",
      "newConversations": 30,
      "inboundMessages": 150,
      "outboundMessages": 140,
      "responseRate": 0.88,
      "avgResponseTimeMin": 2.1
    },
    "jobHealth": {
      "pendingJobs": 2,
      "activeJobs": 1,
      "failedJobs24h": 0
    },
    "conversion": {
      "totalConversations7d": 30,
      "totalAppointments7d": 6,
      "bookingRate7d": 0.2
    },
    "errorIndicators": {
      "newStale24h": 1,
      "newSuppressed24h": 0,
      "hardNoRate7d": 0.03
    },
    "followUp": {
      "followUpsSent7d": 10,
      "followUpsConverted7d": 4,
      "followUpEffectiveness7d": 0.4
    }
  }
}
```

**Field descriptions:**

| Field | Description |
|-------|-------------|
| `activity*.responseRate` | Ratio of conversations with inbound messages that got an outbound reply |
| `activity*.avgResponseTimeMin` | Average minutes from first inbound to first outbound message |
| `jobHealth.pendingJobs` | pgboss jobs in `created` state for this agent (last 7 days) |
| `jobHealth.activeJobs` | pgboss jobs currently being processed |
| `jobHealth.failedJobs24h` | pgboss jobs that failed in the last 24 hours |
| `errorIndicators.newStale24h` | Conversations that went stale in the last 24 hours |
| `errorIndicators.newSuppressed24h` | Conversations suppressed in the last 24 hours |
| `errorIndicators.hardNoRate7d` | Ratio of conversations with a hard "no" in the last 7 days |
| `followUp.followUpsConverted7d` | Follow-up messages sent where the lead subsequently replied (not stale) |
| `followUp.followUpEffectiveness7d` | Converted / sent ratio (0-1) |

---

### System Health

System-wide health check for the commissionTracker admin/status page. Returns database, job queue, throughput, process, and agent counts.

```http
GET /api/external/monitoring/system
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "timestamp": "2026-03-06T15:00:00.000Z",
    "status": "healthy",
    "database": {
      "connected": true,
      "latencyMs": 2.5
    },
    "jobQueue": {
      "running": true,
      "totalPending": 3,
      "totalActive": 1,
      "totalFailed24h": 0,
      "queueBreakdown": [
        {
          "queue": "process-close-webhook",
          "pending": 2,
          "active": 1,
          "failed24h": 0
        },
        {
          "queue": "check-conversation-followup",
          "pending": 1,
          "active": 0,
          "failed24h": 0
        }
      ]
    },
    "process": {
      "uptimeSeconds": 86400,
      "memoryUsageMb": {
        "rss": 180.5,
        "heapUsed": 95.2,
        "heapTotal": 130.0
      },
      "nodeVersion": "v22.12.0"
    },
    "throughput": {
      "messagesLastHour": 25,
      "messagesLast24h": 300,
      "conversationsLast24h": 15
    },
    "agents": {
      "totalAgents": 10,
      "activeAgents": 8,
      "botEnabledAgents": 6
    }
  }
}
```

**Overall status values:**

| Status | Condition |
|--------|-----------|
| `healthy` | Database connected, job queue running, failed jobs <= 10, DB latency <= 500ms |
| `degraded` | Database connected and job queue running, but failed jobs > 10 or DB latency > 500ms |
| `unhealthy` | Database disconnected or job queue not running |

---

## Special Fields Reference

### `billingExempt`

When `true`, the agent bypasses all billing checks:

- No subscription is created during provisioning.
- No lead limit is enforced.
- Usage tracking still records data but limits are not applied.
- Designed for team members and internal accounts.

### `dailyMessageLimit`

Safety cap on outbound messages per day for an agent.

| Value | Behavior |
|-------|----------|
| `null` | Uses system default (500 messages/day) |
| `1-10000` | Custom daily limit |

### `maxMessagesPerConversation`

Safety cap on total messages (inbound + outbound) within a single conversation.

| Value | Behavior |
|-------|----------|
| `null` | Uses system default (50 messages) |
| `1-500` | Custom per-conversation limit |

### Pagination

All paginated endpoints accept:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | `integer` | `1` | -- | Page number (1-based, positive) |
| `limit` | `integer` | `20` | `100` | Items per page |

Pagination metadata is returned in the `meta.pagination` field:

```json
{
  "page": 1,
  "limit": 20,
  "totalItems": 45,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

### Conversation Statuses

| Status | Description |
|--------|-------------|
| `open` | Active conversation, bot is engaged |
| `awaiting_reply` | Bot sent a message, waiting for lead response |
| `scheduling` | Lead expressed interest in scheduling, booking in progress |
| `scheduled` | Appointment successfully booked |
| `closed` | Conversation ended naturally |
| `stale` | Lead stopped responding after follow-up attempts |

### Appointment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Appointment created, not yet confirmed |
| `confirmed` | Appointment confirmed |
| `cancelled` | Appointment cancelled |
| `no_show` | Lead did not attend |
| `completed` | Appointment completed successfully |
