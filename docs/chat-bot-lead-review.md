# Chat Bot Lead Review

Use the review command when you need a fast diagnosis for a Close lead ID, bot
conversation ID, phone number, or lead name.

## Commands

```bash
npm run bot:review -- --lead-id <closeLeadId>
npm run bot:review -- --conversation-id <conversationId>
npm run bot:review -- --lead-phone <phone> --lead-name "<lead name>"
npm run bot:review -- --lead-id <closeLeadId> --json
npm run bot:review -- --lead-id <closeLeadId> --improve
npm run bot:review -- --lead-id <closeLeadId> --improve --save
npm run bot:review:recent -- --since-hours 24 --save --mode improve
```

## What It Checks

- Active chat bot agent resolution
- Bot config and runtime status
- Usage/lead-limit blockers
- Matching conversation lookup
- Message timeline and outbound/inbound counts
- Heuristics for likely causes such as:
  - no conversation found
  - bot disabled
  - Close disconnected
  - lead limit reached
  - conversation suppressed or paused
  - no outbound response
  - negative lead reply
  - queue backlog or state mismatch

## Output Modes

- Default: diagnostic report for debugging what happened
- `--improve`: handoff brief for a new Codex conversation focused on improving
  prompt/policy/state handling
- `--json`: machine-readable output
- `--save`: persist the structured review into `chat_bot_conversation_reviews`
  after applying [20260318102000_add_chat_bot_conversation_reviews.sql](/Users/nickneessen/projects/commissionTracker/supabase/migrations/20260318102000_add_chat_bot_conversation_reviews.sql)

## Batch Review

Use the recent batch command to review many conversations from the last N hours.

```bash
npm run bot:review:recent -- --since-hours 24 --save --mode improve
```

This is intended to power recurring review automation and prevent you from
manually re-running single-lead reviews for every case.

## Current Limitation

The current bot-platform API does not expose Close lead source/status for an
arbitrary lead ID. If no conversation exists, source/status mismatch can only
be inferred, not proven, from this repo alone.
