# The Standard HQ

A comprehensive Insurance Sales KPI, Recruiting, and Agency Management System built for insurance agencies to manage their entire operation — from recruiting new agents through tracking policies, commissions, and team performance.

## Overview

The Standard HQ is a full-featured internal platform designed for insurance agencies and Independent Marketing Organizations (IMOs). It provides end-to-end management of:

- **Agent recruiting and onboarding** — Customizable pipelines with checklists, document collection, and automated workflows
- **Policy and commission tracking** — Complete lifecycle management from policy placement through commission earning
- **Team hierarchy and overrides** — Multi-level organizational structure with override commission calculations
- **Performance analytics** — Real-time KPIs, forecasting, and performance attribution
- **Underwriting** — Carrier guide parsing, rule engine, and AI-assisted coverage builder
- **Business expense management** — Track, categorize, and budget operational expenses
- **Communications** — Integrated email and Slack messaging for team coordination
- **Training** — Structured training modules, quizzes, and progress tracking

## Tech Stack

| Category   | Technology                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | React 19.1, TypeScript                          |
| Build Tool | Vite 6                                          |
| Routing    | TanStack Router                                 |
| State/Data | TanStack Query                                  |
| Forms      | TanStack Form, React Hook Form, Zod             |
| Database   | Supabase (PostgreSQL)                           |
| Styling    | Tailwind CSS v3                                 |
| Components | Radix UI, shadcn/ui                             |
| Charts     | Recharts, Nivo                                  |
| Email      | React Email, Mailgun                            |
| Testing    | Vitest, Testing Library                         |

## Features

### Dashboard & Analytics

- **KPI Dashboard** — At-a-glance metrics: policies written, commissions earned, team performance
- **Performance Metrics** — Pace tracking against goals with historical comparisons
- **PACE Metrics** — Real-time user projections and current period metrics
- **Predictive Analytics** — Forecast future earnings based on current pipeline
- **Game Plan** — Actionable recommendations to hit monthly targets
- **Activity Feed** — Real-time team and individual activity updates
- **Carriers & Products** — Breakdown of product types per carrier
- **Product Mix** — Percentage breakdown of product types being sold
- **Policy Status** — Active vs Lapsed vs Cancelled visualization
- **Premium By State** — Premium totals mapped by state
- **Client Segments** — Low, medium, and high-value client metrics

### Policy Management

- **Policy Tracking** — Record and manage all insurance policies
- **Multi-carrier Support** — Track policies across multiple insurance carriers
- **Product Management** — Organize policies by product type (life, annuity, etc.)
- **Client Records** — Maintain client information linked to policies
- **Status Workflow** — Track policies from application through in-force status

### Commission System

- **Commission Tracking** — Automatic calculation based on policy premiums and contract levels
- **Advance Handling** — Track advanced commissions and their earning schedule
- **Chargeback Management** — Handle policy lapses and commission chargebacks
- **Earned vs Unearned** — Monitor earned and unearned commission balances
- **Override Commissions** — Calculate and distribute hierarchical overrides

### Recruiting Pipeline

- **Lead Capture** — Public-facing recruitment landing pages (`/join/[recruiter-id]`)
- **Leads Queue** — Manage incoming recruitment leads
- **Pipeline Templates** — Customizable recruiting phases and checklists
- **Automated Workflows** — Trigger actions based on pipeline progress
- **Document Collection** — Gather required documents from recruits
- **Interactive Checklists** — Videos, quizzes, acknowledgments, signatures
- **Communication Tools** — Integrated email for recruit outreach

### Agent Hierarchy & Team

- **Org Chart** — Visual representation of organizational structure
- **Upline/Downline** — Manage hierarchical relationships between agents
- **The Standard Team** — Writing numbers, agent detail views, and upline contract management
- **Team Dashboard** — Aggregate metrics for team leaders
- **Invitations** — Send invitations to add agents to your downline
- **Leaderboard** — Live team performance rankings

### Underwriting

- **Carrier Guide Parsing** — Upload and parse carrier underwriting guides (text + PaddleOCR)
- **Rule Engine** — Visual DSL for defining underwriting acceptance rules
- **Coverage Builder** — AI-assisted wizard matching clients against carrier criteria
- **Product Lookup** — Query accepted conditions and exclusions per carrier/product

### Contracting & Onboarding

- **Carrier Contracts** — Track agent appointments with carriers
- **Writing Numbers** — Manage agent writing numbers per carrier
- **Document Management** — Store and track contract documents
- **Onboarding Phases** — Guide new agents through onboarding steps
- **Agent Roadmap** — Structured milestone and goal roadmap for agents

### Training

- **Training Hub** — Browse and assign training resources
- **Training Modules** — Structured courses with lessons and quizzes
- **Progress Tracking** — Per-agent completion and quiz score tracking
- **Content Blocks** — Rich text, video, and quiz content authoring

### Business Tools

- **Financial Statement Parsing** — Paddle Parser API integration for document extraction
- **Expense Tracking** — Expense categories, budgets, recurring costs, trend analysis

### Reports

- **Executive Summary** — High-level performance overview
- **Agency Performance** — Agency-level metrics and comparisons
- **IMO Performance** — Organization-wide reporting
- **Scheduled Reports** — Automated report generation and delivery

### Communications Hub

- **Email Integration** — Gmail OAuth integration for sending emails
- **Email Templates** — Reusable templates with variable substitution
- **Thread Management** — Threaded email conversations
- **Slack Integration** — Connect Slack workspaces for daily sales logs and notifications
- **Channel Orchestration** — Multi-channel notification routing

### Settings & Administration

- **User Management** — Create, edit, and manage user accounts
- **Role-Based Access** — Granular permissions system
- **Carrier Management** — Configure insurance carriers
- **Product Configuration** — Set up products and commission rates
- **Comp Guide** — Master commission rate schedule
- **Agency/IMO Setup** — Configure organizational entities
- **Alert Rules** — Custom performance alerts and notifications
- **Audit Log** — System-wide audit trail for sensitive operations
- **Billing** — Subscription management (admin-gated; no self-serve)

## Architecture

```
/src
├── /features              # Domain features (self-contained modules)
│   ├── /admin             # Admin tooling and user management
│   ├── /agent-roadmap     # Agent milestone and goal roadmap
│   ├── /analytics         # Analytics dashboards and visualizations
│   ├── /audit             # Audit log viewer
│   ├── /auth              # Authentication and authorization
│   ├── /billing           # Subscription and billing management
│   ├── /business-tools    # Financial document tools (Paddle Parser)
│   ├── /channel-orchestration # Multi-channel notification routing
│   ├── /chat-bot          # Internal chat assistant
│   ├── /close-ai-builder  # Close CRM AI integrations
│   ├── /close-kpi         # Close CRM KPI dashboards
│   ├── /close-lead-drop   # Close CRM lead drop workflows
│   ├── /commissions       # Commission tracking and calculations
│   ├── /comps             # Compensation guide management
│   ├── /contracting       # Agent contracting workflows
│   ├── /dashboard         # Main dashboard components
│   ├── /documents         # Document management
│   ├── /email             # Email composition and templates
│   ├── /expenses          # Expense tracking
│   ├── /hierarchy         # Team hierarchy and overrides
│   ├── /landing           # Public landing and recruiting pages
│   ├── /leaderboard       # Team performance leaderboard
│   ├── /legal             # Terms of service and legal pages
│   ├── /marketing         # Marketing and campaign tools
│   ├── /messages          # Communications hub
│   ├── /policies          # Policy management
│   ├── /recruiting        # Recruiting pipeline
│   ├── /reports           # Reporting and analytics
│   ├── /settings          # Application settings
│   ├── /targets           # Goal setting
│   ├── /the-standard-team # Writing numbers and team agent views
│   ├── /training-hub      # Training resource browser
│   ├── /training-modules  # Structured course authoring and delivery
│   ├── /underwriting      # Carrier guides, rule engine, coverage builder
│   ├── /voice-agent       # Voice agent tooling
│   └── /workflows         # Automation workflows
├── /components            # Reusable UI components
│   ├── /auth              # Authentication guards
│   ├── /layout            # Layout components
│   └── /ui                # Base UI primitives (shadcn)
├── /services              # Business logic and API access
├── /hooks                 # Custom React hooks
├── /types                 # TypeScript type definitions
├── /lib                   # Utilities (date, currency, etc.)
├── /contexts              # React contexts
└── /routes                # TanStack Router routes
/supabase
└── /migrations            # SQL database migrations
/scripts
└── /migrations            # Migration runner scripts (use these — see below)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for cloud) or Docker (for local)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd theStandardHQ
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # Safe default: local Supabase via Docker
   VITE_USE_LOCAL=true
   VITE_ALLOW_REMOTE_SUPABASE_DEV=false

   # Local Supabase defaults from `supabase start`
   VITE_LOCAL_SUPABASE_URL=http://127.0.0.1:54321
   VITE_LOCAL_SUPABASE_ANON_KEY=your-local-anon-key

   # Remote Supabase is opt-in only
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-remote-anon-key

   # Admin email (auto-approved on signup)
   VITE_ADMIN_EMAIL=admin@example.com

   # Local database
   DB_HOST=localhost
   DB_PORT=54322
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASS=postgres
   ```

4. Start local Supabase:
   ```bash
   npm run supabase:start
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

With `VITE_USE_LOCAL=true`, `npm run dev` starts the local API server, Vite, and `supabase functions serve` automatically so `supabase.functions.invoke(...)` calls work against Dockerized Supabase. `npm run dev:local` remains available as the explicit local-only command.

If you need local Supabase to mirror the current remote `auth`, `public`, and `storage` schemas exactly, run:

```bash
npm run supabase:clone-remote-schema
```

That command:

- Dumps the remote `auth/public/storage` schema
- Rebuilds the local schemas from that dump
- Copies `storage.buckets` rows and `supabase_migrations.schema_migrations`
- Leaves application/auth/storage object data empty by design

It requires `REMOTE_DATABASE_URL` to be set in your local env.

To make the cloned schema usable for day-to-day local development, run the bootstrap immediately after:

```bash
npm run supabase:bootstrap-local-dev
```

That step:

- Copies remote reference/config tables the app expects at runtime
- Restores recruiting pipeline templates, phases, and checklist items
- Preserves copied storage bucket metadata from the schema clone
- Writes local-safe `app_config` values so local never points at the remote project
- Creates deterministic local auth users for super admin, active agent, trainer, and contracting manager

For the full one-shot rebuild, use:

```bash
npm run supabase:sync-local-from-remote
```

If you intentionally need a remote Supabase project in development, set:

```env
VITE_USE_LOCAL=false
VITE_ALLOW_REMOTE_SUPABASE_DEV=true
```

### Available Scripts

| Command                                   | Description                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Start development server (local Supabase by default)                                           |
| `npm run dev:local`                       | Start local API server, local edge functions, and Vite explicitly                             |
| `npm run supabase:functions`              | Serve local Supabase Edge Functions                                                            |
| `npm run supabase:start`                  | Start local Supabase via Docker                                                                |
| `npm run supabase:stop`                   | Stop local Supabase                                                                            |
| `npm run supabase:status`                 | Show local Supabase status                                                                     |
| `npm run supabase:clone-remote-schema`    | Rebuild local `auth/public/storage` from the remote schema, buckets, and migration history    |
| `npm run supabase:bootstrap-local-dev`    | Seed local-safe runtime data and deterministic local auth users on top of the mirrored schema |
| `npm run supabase:sync-local-from-remote` | Run schema clone then bootstrap in one step                                                    |
| `npm run build`                           | Build for production                                                                           |
| `npm run preview`                         | Preview production build                                                                       |
| `npm run test`                            | Run tests                                                                                      |
| `npm run test:ui`                         | Run tests with UI                                                                              |
| `npm run lint`                            | Lint code                                                                                      |
| `npm run typecheck`                       | Type check                                                                                     |
| `npm run generate:types`                  | Generate TypeScript types from Supabase schema                                                 |
| `npm run email:dev`                       | Start email template development server                                                        |

## Database

For development, the recommended path is the local Supabase stack on Docker. The app defaults to local Supabase in dev and refuses to use a remote Supabase project unless you explicitly opt in with `VITE_ALLOW_REMOTE_SUPABASE_DEV=true`.

### Key Entities

- **user_profiles** — User accounts with roles, permissions, and hierarchy info
- **policies** — Insurance policies with carrier, product, and client associations
- **commissions** — Commission records with advance/earned tracking
- **agencies** — Agency entities within an IMO
- **imos** — Independent Marketing Organizations
- **carriers** — Insurance carriers
- **products** — Insurance products offered
- **comp_guide** — Commission rate schedules by contract level
- **recruits** — Recruiting pipeline candidates
- **pipeline_templates** — Customizable recruiting workflows
- **expenses** — Business expense records
- **user_emails** — Email communication records
- **notifications** — In-app notifications
- **alert_rules** — Custom alert configurations
- **underwriting_guides** — Parsed carrier underwriting guides
- **underwriting_rule_sets / underwriting_rules** — Rule engine definitions
- **training_modules / training_lessons** — Structured training content

### Migrations

**Always use the migration runner script — never run `psql` directly.**

```bash
# Apply a migration
./scripts/migrations/run-migration.sh supabase/migrations/YYYYMMDDHHMMSS_name.sql

# Run an arbitrary query
./scripts/migrations/run-sql.sh "SELECT * FROM users;"

# Interactive psql
./scripts/migrations/run-sql.sh --interactive

# Generate a timestamp for a new migration filename
date +%Y%m%d%H%M%S

# Verify migration tracking
./scripts/migrations/verify-tracking.sh
```

The runner script tracks every applied migration, records function versions, and **blocks downgrades** — preventing older migrations from silently overwriting newer functions. Direct `psql` usage bypasses these safeguards and has caused production incidents.

After any schema change, regenerate TypeScript types:

```bash
npm run generate:types
```

Apply every migration to **both local and remote**:

```bash
# Local
./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql

# Remote
source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql
```

## User Roles

| Role                    | Description                                  |
| ----------------------- | -------------------------------------------- |
| **Super Admin**         | Full system access, IMO management           |
| **Admin**               | Agency-level administration                  |
| **Agency Owner**        | Manages agency and its agents                |
| **Agent**               | Standard licensed insurance agent            |
| **Trainer**             | Staff role for training new recruits         |
| **Contracting Manager** | Staff role for managing agent contracts      |
| **Recruit**             | Pre-licensed recruit in onboarding pipeline  |

## Subscription & Billing

Feature access is gated by subscription plan. Plans are configured in the database and managed by super-admins. Self-serve subscription changes are disabled; billing changes require admin action.

## Security

- Row-Level Security (RLS) enforced at database level for all business data
- JWT-based authentication via Supabase Auth
- Role-based access control with custom permissions
- `get_effective_imo_id()` is the canonical IMO scope function — never returns NULL for non-super-admins
- SECURITY DEFINER RPCs are audited; service-role functions are restricted to internal edge functions
- Audit logging for sensitive operations
- Input validation with Zod schemas

## Development Guidelines

- **TypeScript** — Strict type checking required; `npm run build` must pass with zero errors
- **Feature-based architecture** — Self-contained feature modules
- **TanStack Query** — All server state managed through queries
- **No mock data** — Production code connects to real data only
- **Functional components** — Hooks-based React components
- **shadcn/ui** — Consistent UI component library
- **Migration runner** — Always use `./scripts/migrations/run-migration.sh`, never raw `psql`

## Deployment

The application deploys to Vercel from the `main` branch. Never use `vercel --prod` from the CLI (it can upload local `.env` values into the bundle). Use git push → Vercel auto-deploy.

```bash
npm run build  # Must pass with zero errors before merging
```

## License

Proprietary — All rights reserved.

## Support

For issues and feature requests, please contact the development team.
