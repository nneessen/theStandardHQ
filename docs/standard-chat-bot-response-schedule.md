# CommissionTracker Bot Response Schedule API

This backend change does not add a brand-new route. It extends the existing agent configuration APIs with a new optional field:

- `responseSchedule`

Use this to control:

- when the bot is allowed to send automated responses
- whether same-day booking is allowed on a given day
- the cutoff time after which the bot must stop offering or confirming same-day appointments

## External API Routes

CommissionTracker should use these existing external routes:

- `GET /api/external/agents/:id`
- `PATCH /api/external/agents/:id`

`GET` returns the saved `responseSchedule`.

`PATCH` accepts `responseSchedule` updates.

## Field Shape

```json
{
  "responseSchedule": {
    "days": [
      {
        "day": 6,
        "responsesEnabled": true,
        "responseStartTime": "09:00",
        "responseEndTime": "15:00",
        "sameDayBookingEnabled": true,
        "sameDayBookingCutoffTime": "15:00"
      }
    ]
  }
}
```

## Day Mapping

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

## Day Rule Fields

Each item in `responseSchedule.days` supports:

- `day`: integer `0..6`
- `responsesEnabled`: boolean
- `responseStartTime`: `HH:mm` 24-hour local time
- `responseEndTime`: `HH:mm` 24-hour local time
- `sameDayBookingEnabled`: boolean
- `sameDayBookingCutoffTime`: `HH:mm` 24-hour local time, or `null`

## Semantics

The schedule is evaluated in the lead's timezone when available. If the lead has no valid timezone, the agent timezone is used.

If `responseSchedule` is omitted or `null`, the backend uses defaults:

- responses allowed every day from `08:00` to `20:30`
- same-day booking allowed every day until `20:30`

If a specific day is omitted from `responseSchedule.days`, that day also falls back to the same defaults.

If `responsesEnabled` is `false` for a day:

- the bot will not send automated intro/follow-up/reply/voice actions that day
- the backend reschedules the action to the next enabled day at that day's `responseStartTime`

If `sameDayBookingEnabled` is `false` for a day:

- the bot will not offer same-day appointments on that day
- the backend will also block same-day booking server-side even if a lead asks for it directly

If `sameDayBookingCutoffTime` is set:

- the bot may still respond after that time if `responseEndTime` is later
- but it will stop offering and confirming same-day appointments once the cutoff is reached

If `sameDayBookingCutoffTime` is `null`:

- the backend uses that day's `responseEndTime` as the same-day cutoff

## Validation Rules

- `responseStartTime` must be earlier than `responseEndTime` when `responsesEnabled` is `true`
- `day` values must be unique inside `responseSchedule.days`
- time fields must be valid `HH:mm`

## Example: Saturday 3pm Same-Day Cutoff, Sunday Disabled

```json
{
  "responseSchedule": {
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
}
```

Behavior:

- Saturday at `2:30pm`: bot can still respond and can still offer same-day
- Saturday at `3:00pm` or later: bot can still respond until `5:00pm`, but cannot offer or confirm same-day
- Sunday: bot will not send automated responses; work is deferred to the next enabled day

## PATCH Example

```http
PATCH /api/external/agents/:id
X-API-Key: your-api-key
Content-Type: application/json
```

```json
{
  "responseSchedule": {
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
}
```

## PATCH Success Response

The route returns the full updated agent object. Relevant fragment:

```json
{
  "success": true,
  "data": {
    "id": "agent-uuid",
    "name": "Agent Name",
    "timezone": "America/New_York",
    "responseSchedule": {
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
          "responseStartTime": "08:00",
          "responseEndTime": "20:30",
          "sameDayBookingEnabled": false,
          "sameDayBookingCutoffTime": null
        }
      ]
    }
  }
}
```

Note: if CommissionTracker sends explicit values, those values are stored and returned. Omitted day fields are defaulted by validation before persistence.

## GET Example

```http
GET /api/external/agents/:id
X-API-Key: your-api-key
```

Relevant response fragment:

```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "agent-uuid",
      "timezone": "America/New_York",
      "responseSchedule": {
        "days": [
          {
            "day": 6,
            "responsesEnabled": true,
            "responseStartTime": "09:00",
            "responseEndTime": "17:00",
            "sameDayBookingEnabled": true,
            "sameDayBookingCutoffTime": "15:00"
          }
        ]
      }
    }
  }
}
```

## Clearing Custom Schedule

Send `null` to clear the custom schedule and revert to backend defaults:

```json
{
  "responseSchedule": null
}
```

## Backend Enforcement Summary

The backend now enforces this schedule in:

- lead-created intro scheduling
- AI reply SMS scheduling
- follow-up scheduling
- voice follow-up scheduling
- availability shown to the AI
- booking confirmation, so blocked same-day appointments cannot be confirmed accidentally
