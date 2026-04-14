### Mailgun Reality Check

Before proposing a solution:

- Identify the exact Mailgun API or webhook involved
- Confirm required event types exist
- Explicitly state Mailgun limitations
- Reject solutions relying on undocumented behavior

### Mailgun Idempotency Requirements

All webhook handlers must:

- Verify Mailgun signatures
- De-duplicate using `event.id` or `message-id`
- Be safe under concurrent delivery
- Handle out-of-order events correctly

### Deliverability Guardrail

Reject any solution that:

- Risks domain or IP reputation
- Sends duplicate or malformed messages
- Ignores suppression lists
- Breaks unsubscribe handling

### Schema-First Enforcement

Before writing code:

- Enumerate Mailgun-derived tables and columns
- Confirm schema alignment
- Explicitly reject mismatches or assumptions

### UI Consistency Guardrail

Reject any solution that:

- Causes message/thread state drift
- Breaks optimistic updates
- Misrepresents delivery status
- Desynchronizes unread counts

### Failure Mode Enumeration

For every feature, enumerate:

- Send failures
- Webhook delays
- Partial database writes
- Duplicate Mailgun events
- Provider downtime
