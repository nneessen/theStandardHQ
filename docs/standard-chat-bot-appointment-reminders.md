# Standard Chat Bot API: Appointment Reminders

## Context

The standard-chat-bot now supports **24-hour SMS appointment reminders**. When enabled, the system syncs upcoming calendar events (Calendly or Google Calendar) and automatically sends a reminder SMS to the lead 24 hours before their appointment. This feature uses existing agent endpoints — no new API routes are needed.

---

## Prerequisites

Before enabling reminders, the agent must have:

1. **Calendar connected** — Calendly or Google Calendar OAuth completed
2. **Close CRM connected** — needed to send the reminder SMS
3. **`botEnabled: true`** — bot must be active

If any prerequisite is missing, reminders will be enabled on the agent record but no reminders will actually fire until the connections are in place.

---

## 1. Enable Reminders (PATCH `/api/external/agents/:id`)

### Request Body

```json
{
  "remindersEnabled": true
}
```

### Expected Behavior

- Stores `remindersEnabled = true` on the agent record
- The cron system begins syncing calendar events and scheduling reminders for this agent
- Can be combined with other fields in the same PATCH call

### Disable Reminders

```json
{
  "remindersEnabled": false
}
```

When disabled, no new reminders are scheduled. Any already-sent reminders are unaffected.

---

## 2. Check Status (GET `/api/external/agents/:id`)

The `agent` object in the response includes the `remindersEnabled` field:

```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "...",
      "name": "...",
      "botEnabled": true,
      "remindersEnabled": false,
      // ... all existing fields ...
    },
    "connections": { ... }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `remindersEnabled` | `boolean` | `false` | Whether 24h SMS appointment reminders are active |

---

## 3. How It Works

The reminder system runs on two automated cron jobs:

| Cron Job | Interval | What It Does |
|----------|----------|--------------|
| `sync-calendar-appointments` | Every 15 minutes | Fetches upcoming events from the agent's connected calendar (Calendly or Google Calendar) and upserts them into the appointments table |
| `send-appointment-reminders` | Every 5 minutes | Checks for appointments starting in ~24 hours that haven't had a reminder sent yet, sends an SMS reminder to the lead |

### Flow

1. Agent connects calendar + Close CRM + enables reminders
2. `sync-calendar-appointments` cron picks up upcoming events and stores them as appointments
3. `send-appointment-reminders` cron finds appointments where `startAt` is ~24h from now and `reminderSentAt` is null
4. Sends a short SMS reminder via Close CRM (from the same phone number used in the conversation)
5. Marks `reminderSentAt` on the appointment to prevent duplicate sends

### Important Notes

- Reminders are only sent for appointments with status `confirmed` or `pending`
- The reminder message is AI-generated based on the lead's context (name, product type, appointment time)
- If the lead has no conversation (e.g., manually booked), the reminder is skipped
- Cancelled appointments do not receive reminders

---

## 4. No New Endpoints

This feature is entirely controlled through existing endpoints:

| Action | Endpoint | Field |
|--------|----------|-------|
| Enable/disable | `PATCH /api/external/agents/:id` | `remindersEnabled` |
| Check status | `GET /api/external/agents/:id` | `remindersEnabled` in response |

No new routes, webhooks, or authentication changes are required.

---

## How CommissionTracker Uses This

### Bot Config UI

1. Add a **"Appointment Reminders"** toggle to the Bot Configuration tab (alongside existing toggles like Follow-Up, Voice Follow-Up)
2. When toggled, call `PATCH /api/external/agents/:id` with `{ "remindersEnabled": true/false }`
3. Read the current state from `GET /api/external/agents/:id` → `agent.remindersEnabled`

### Suggested UI placement

Place the toggle in the "Follow-Up Settings" section since reminders are conceptually related to post-scheduling engagement. Label: **"Send appointment reminders"** with helper text: *"Automatically send an SMS reminder 24 hours before each appointment."*

---

## Checklist

- [ ] `PATCH /api/external/agents/:id` — accepts `remindersEnabled` boolean (already supported in standard-chat-bot)
- [ ] `GET /api/external/agents/:id` — returns `remindersEnabled` in agent object (already supported)
- [ ] Add toggle to Bot Configuration UI in commissionTracker
- [ ] Wire toggle to PATCH call via `chat-bot-api` edge function
- [ ] Read initial state from GET agent response to set toggle default
