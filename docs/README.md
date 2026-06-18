# Documentation

Living technical documentation for the Commission Tracker project. System-wide rules (migrations, types, naming, architecture) live in the root `CLAUDE.md`, not here.

## Architecture

- [User creation flow](architecture/user-creation-flow.md)
- [Multi-tenant data isolation](architecture/multi-tenant-data-isolation.md)
- [Underwriting wizard architecture](underwriting-wizard-architecture.md)

## Features

- Carrier acceptance rules — [v2](features/carrier-acceptance-rules-v2.md) · [v2 redesign](features/carrier-acceptance-rules-v2-redesign.md) _(see Notes — canonical version unclear)_
- [Carrier rule generation design](features/rule-generation-design.md)
- [Custom domains](features/custom-domains.md)
- [Document extraction overview](document-extraction-overview.md)
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
- [Template variables](reference/template-variables.md)
- [Feature/skill map](reference/feature-skill-map.md)

## Audits & reviews

See [`audits/`](audits/) — security audits, performance audits, billing audits, UW wizard assessments, misc reviews. Status banners on individual files indicate resolved vs. open.

## System prompts (AI workflow templates)

See [`system-prompts/`](system-prompts/) — templates for code review, continuation mode, builder mode, domain-specific architects.

## Handoffs (active)

Root-level `handoff-*.md` and `*-handoff.md` files track live feature handoffs currently being executed. Examples:

## Email templates

See [`email-templates/README.md`](email-templates/README.md) — transactional email HTML templates (verify, reset, change, invite, magic link, reauth, SMS bot announcement).

## Planning TODOs

See [`todo/`](todo/) — short-lived planning docs (addon editor redesign, Stripe billing remediation continuation).

## Archive

See [`archive/`](archive/) — completed/stalled campaigns, closed-bug post-mortems. Each subfolder has a `STATUS.md` explaining state and retention rationale.

## Notes / known overlaps
