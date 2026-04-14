# Documentation

Living technical documentation for the Commission Tracker project. System-wide rules (migrations, types, naming, architecture) live in the root `CLAUDE.md`, not here.

## Architecture

- [User creation flow](architecture/user-creation-flow.md)
- [Multi-tenant data isolation](architecture/multi-tenant-data-isolation.md)
- [Underwriting wizard architecture](underwriting-wizard-architecture.md)

## Features

- Carrier acceptance rules — [v2](features/carrier-acceptance-rules-v2.md) · [v2 redesign](features/carrier-acceptance-rules-v2-redesign.md) *(see Notes — canonical version unclear)*
- [Carrier rule generation design](features/rule-generation-design.md)
- [Custom domains](features/custom-domains.md)
- [Document extraction overview](document-extraction-overview.md)
- [Inbound funnel (lead gen)](leadGen/inbound-funnel.md)
- [Slack policy notifications](slack-policy-notification-system.md) · [routing](slack-notification-routing.md)
- [Subscription tiers](subscription-tiers/doc.md)
- [Voice agent — self-serve contract](voice-agent-self-serve-contract.md) · [implementation guide](voice-agent-implementation-guide.md)
- [Voice agent backend gap](features/voice-agent/backend/standard-chat-bot-voice-backend-gap.md)
- Chat bot — [team access API](chat-bot-team-access-api.md) · [appointment reminders](standard-chat-bot-appointment-reminders.md) · [response schedule](standard-chat-bot-response-schedule.md) · [billing exempt](standard-chat-bot-billing-exempt.md) · [requirements](standard-chat-bot-requirements.md) · [voice verification](standard-chat-bot-voice-verification-prompt.md)
- [Blocked lead statuses](blocked-lead-statuses-feature.md)
- [Agent carrier contract management](agent-carrier-contract-management.md)

## Guides (how-to)

- [Code review](guides/code-review.md)
- [Component styling](guides/component-styling.md) · [Full styling guide](guides/styling-guide.md) · [Refactor inline styles](guides/refactor-inline-styles-guide.md)
- [TanStack Query patterns](guides/tanstack-query.md)
- [Instagram API setup](guides/instagram-api-setup.md)
- [Radix scroll-in-popover workaround](guides/radix-scroll-in-popover.md)

## Reference

- [External API reference](reference/external-api-reference.md)
- [Retell API inventory](reference/retell-api-complete-inventory.md)
- [Retell setup](reference/retell-setup.md)
- [Voice agent prompt template](reference/voice-agent-prompt-template.md)
- [Template variables](reference/template-variables.md)
- [Feature/skill map](reference/feature-skill-map.md)

## Audits & reviews

See [`audits/`](audits/) — security audits, performance audits, billing audits, UW wizard assessments, misc reviews. Status banners on individual files indicate resolved vs. open.

## System prompts (AI workflow templates)

See [`system-prompts/`](system-prompts/) — templates for code review, continuation mode, builder mode, domain-specific architects.

## Handoffs (active)

Root-level `handoff-*.md` and `*-handoff.md` files track live feature handoffs currently being executed. Examples:

- [Retell voice provision](handoff-standard-chat-bot-voice-provision.md)
- [Voice clone API](handoff-standard-chat-bot-voice-clone-api.md) · [scripts](handoff-standard-chat-bot-voice-clone-scripts.md) · [customization](handoff-voice-clone-scripts-customization.md)
- [Retell feature gaps](handoff-standard-chat-bot-retell-feature-gaps.md)
- [Standard HQ voice agent retell handoff](standard-hq-voice-agent-retell-handoff.md)
- [Bot playground](bot-playground-handoff.md)
- [Voice agent sidebar](voice-agent-sidebar-handoff.md)
- [Chat bot lead review](chat-bot-lead-review.md)

## UW Wizard

- [Knowledge doc](uw-wizard/uw-wizard-knowledge-doc.md) *(see Notes — overlaps with architecture doc)*
- [Production runbook](uw-wizard/uw-wizard-production-runbook.md)
- [Upgrade TODO](uw-wizard-upgrade-todo.md) — active plan

## Rate fetcher scripts

See [`scripts/`](scripts/) — documentation for `fexFetcher`, `iulFetcher`, `iulTransamericaFetcher`, `termFetcher`, and the overall `rate-fetching-cpt` approach.

## Email templates

See [`email-templates/README.md`](email-templates/README.md) — transactional email HTML templates (verify, reset, change, invite, magic link, reauth, SMS bot announcement).

## Planning TODOs

See [`todo/`](todo/) — short-lived planning docs (addon editor redesign, Stripe billing remediation continuation).

## Archive

See [`archive/`](archive/) — completed/stalled campaigns, closed-bug post-mortems. Each subfolder has a `STATUS.md` explaining state and retention rationale.

Current contents:
- `archive/rpc-removal-2026-02/` — **PARTIAL campaign** (12 of 77 functions dropped; 65 remaining)
- `archive/closed-bugs/` — resolved bug handoffs
- `archive/migration-audit-2026-01/` — resolved migration-naming audit

---

## Notes / known overlaps

- **Duplicate UW Wizard architecture docs**: [`underwriting-wizard-architecture.md`](underwriting-wizard-architecture.md) (547 lines) and [`uw-wizard/uw-wizard-knowledge-doc.md`](uw-wizard/uw-wizard-knowledge-doc.md) (711 lines) overlap heavily. Not consolidated in this cleanup; flagged for a future pass.
- **Canonical carrier-acceptance-rules**: unclear which of [v2](features/carrier-acceptance-rules-v2.md) vs [v2-redesign](features/carrier-acceptance-rules-v2-redesign.md) is current. Needs product-owner input.
- **RPC removal campaign**: 65 of 77 planned function drops were never executed. If resuming, start at [`archive/rpc-removal-2026-02/STATUS.md`](archive/rpc-removal-2026-02/STATUS.md).
