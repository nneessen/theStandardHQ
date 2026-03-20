# Codex Feature Skill Map

## Purpose

This document maps the available Codex skills, agents, and core tools to the major feature areas in this repository.

It exists to answer a practical question:

> When working in a given part of this codebase, what is the best default Codex capability to start with?

The goal is not to force every task into a single workflow. The goal is to reduce ambiguity, improve prompt quality, and make implementation and review more consistent across a large codebase.

This project is large enough that generic prompts such as "fix this bug" or "review this feature" are often too weak. They do not tell Codex what kind of risk to prioritize first:

- architecture drift
- stale TanStack Query cache behavior
- Supabase tenant isolation and RLS
- query performance
- public-surface security issues

This guide gives a default starting point for each major feature area so work begins with the right lens.

## What This Map Does

This map translates broad Codex capabilities into repo-specific defaults.

For example:

- `hierarchy` is primarily a tree and rollup problem, so `hierarchy-performance` is the best first fit.
- `underwriting`, `billing`, `reports`, and `commissions` are heavily database-shaped and tenant-sensitive, so `supabase-rls-rpc-hardening` is the best first fit.
- `dashboard`, `analytics`, `targets`, and `marketing` are query-heavy UI surfaces, so `react-tanstack-dataflow` is the best first fit.
- `admin`, `auth`, `settings`, `documents`, and `landing` expose more security and authorization risk, so `security-baseline` is the best first fit.
- `recruiting`, `workflows`, and `training-modules` span multiple layers and can easily accumulate mixed responsibilities, so `architecture-ddd-enforcement` is the best first fit.

This is a starting map, not a hard restriction. Many tasks will need more than one skill.

## Why This Helps

### For the User

- Improves future prompt quality by giving a better default framing for each feature area.
- Reduces back-and-forth because the likely risk class is identified up front.
- Makes code review more systematic by clarifying what should be examined first.
- Helps preserve architecture in a large repository by discouraging ad hoc fixes in the wrong layer.

### For Codex

- Reduces wrong turns during investigation.
- Makes it easier to choose whether to inspect cache behavior, RLS, query shape, or architectural boundaries first.
- Improves agent delegation choices by clarifying when discovery should happen before implementation.
- Produces more consistent implementation and review behavior across unrelated parts of the repo.

## How To Use This Guide

When opening work in a feature area:

1. Start with the default skill for that folder.
2. Add a second skill if the task clearly crosses concerns.
3. Use the `explorer` agent first if the area is unfamiliar or broad.
4. Use the `worker` agent only after ownership and write scope are clear.
5. Verify with the project-standard commands after non-trivial changes.

Good prompt examples:

- "Work in `src/features/underwriting`. Use `supabase-rls-rpc-hardening`. Check RPC shape, tenant scope, and aggregation behavior before changing UI."
- "Review `src/features/settings` with `security-baseline`. Focus on authz, unsafe inputs, and tenant leakage."
- "Refactor `src/features/recruiting` with `architecture-ddd-enforcement`. Preserve behavior and clean up layer boundaries."

## Default Feature Map

| Feature folder | Default skill | Why this is the default |
| --- | --- | --- |
| `admin` | `security-baseline` | Admin surfaces are high-risk for authorization mistakes and privilege leaks. |
| `analytics` | `react-tanstack-dataflow` | Analytics pages usually depend on scoped filters, cache keys, and careful invalidation. |
| `audit` | `security-baseline` | Audit trails are security-sensitive and should be reviewed for access control and data exposure. |
| `auth` | `security-baseline` | Authentication and authorization boundaries matter more than UI shape here. |
| `billing` | `supabase-rls-rpc-hardening` | Billing state is tenant-sensitive and often needs server-side guarantees and safe RPC/query design. |
| `business-tools` | `architecture-ddd-enforcement` | Broad utility surfaces benefit from strict layer boundaries and explicit ownership. |
| `chat-bot` | `security-baseline` | Public or semi-public automation features need security review before convenience-driven changes. |
| `commissions` | `supabase-rls-rpc-hardening` | Financial and rollup logic depends on correct, tenant-safe database access. |
| `comps` | `react-tanstack-dataflow` | Query-heavy UI with filters and derived results benefits most from disciplined data flow. |
| `contracting` | `architecture-ddd-enforcement` | Workflow-driven business logic tends to sprawl unless boundaries are enforced. |
| `dashboard` | `react-tanstack-dataflow` | Dashboards are especially prone to duplicated queries and stale-cache issues. |
| `documents` | `security-baseline` | Uploads, downloads, file access, and generated content need security-first handling. |
| `email` | `resend-email-module` | Email composition, delivery, and template handling fit the dedicated email skill best. |
| `expenses` | `supabase-rls-rpc-hardening` | Expense data is tenant-scoped and often summarized or reviewed through database queries. |
| `hierarchy` | `hierarchy-performance` | Tree traversal, rollups, org charts, and hierarchy caching are the dominant risks here. |
| `landing` | `security-baseline` | Public entry points need safe forms, safe redirects, and input validation. |
| `leaderboard` | `supabase-rls-rpc-hardening` | Rankings and scoped aggregations are best handled as secure, performance-aware database work. |
| `legal` | `architecture-ddd-enforcement` | Legal/business content should remain cleanly separated from application and infrastructure concerns. |
| `marketing` | `react-tanstack-dataflow` | Audience and campaign screens rely on predictable query and mutation behavior. |
| `messages` | `unified-messaging-domain` | Messaging benefits from explicit conversation/message state rules and provider separation. |
| `policies` | `supabase-rls-rpc-hardening` | Policy data typically needs secure querying, filtering, and schema-aware correctness. |
| `recruiting` | `architecture-ddd-enforcement` | This area spans workflows, forms, status transitions, and cross-feature logic. |
| `reports` | `supabase-rls-rpc-hardening` | Reporting is usually aggregation-heavy and sensitive to query shape, tenant scope, and performance. |
| `settings` | `security-baseline` | Settings surfaces often expose sensitive state, integrations, or privileged configuration. |
| `targets` | `react-tanstack-dataflow` | Goal and target tracking tends to be mutation-heavy and cache-sensitive. |
| `test` | `architecture-ddd-enforcement` | Test helpers should reflect real ownership and avoid hiding architectural problems. |
| `the-standard-team` | `architecture-ddd-enforcement` | Team-specific flows are still best kept within clean feature/service boundaries. |
| `training-hub` | `react-tanstack-dataflow` | Learner progress views and filters depend on stable query behavior. |
| `training-modules` | `architecture-ddd-enforcement` | A growing bounded context benefits from explicit boundaries early. |
| `underwriting` | `supabase-rls-rpc-hardening` | Rules, eligibility, and heavy filtering are database-sensitive and security-sensitive. |
| `workflows` | `architecture-ddd-enforcement` | Multi-step orchestration is where mixed responsibilities and side-effect leaks usually appear first. |

## Default Agent And Tool Usage

### Agents

- `explorer`: Use first for unfamiliar or broad code areas. Best for locating ownership, existing hooks, service boundaries, and current data flow.
- `worker`: Use after discovery when the implementation scope is bounded and the write set is clear.

### Core Tools

- Shell and `rg`: Use for codebase discovery, ownership tracing, and verification commands.
- `apply_patch`: Use for manual file edits.
- `npm run test`, `npm run typecheck`, `npm run build`: Use as the default verification stack after non-trivial work.

## Default Operating Rules

- If the task is query-heavy UI, start with `react-tanstack-dataflow`.
- If the task touches DB shape, RPCs, tenant isolation, or reporting, start with `supabase-rls-rpc-hardening`.
- If the task spans multiple layers or is structurally messy, start with `architecture-ddd-enforcement`.
- If the task touches auth, admin, public forms, content safety, or external integrations, start with `security-baseline`.
- If the task involves trees, rollups, or org structures, start with `hierarchy-performance`.

## Related Project Guidance

This guide complements the existing repo instructions:

- `AGENTS.md`
- `docs/BUILDER_MODE_IMPLEMENTATION_PROMPT.md`
- `docs/ADD_TO_PROMPT.md`
- `docs/CONTINUATION_MODE.md`

Those documents define the broader implementation, review, and continuation rules. This file is narrower: it helps decide which Codex capability is the best first fit for a given feature area.
