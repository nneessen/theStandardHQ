# The Standard HQ

A comprehensive Insurance Sales KPI, Recruiting, and Agency Management System built for insurance agencies to manage their entire operation - from recruiting new agents through tracking policies, commissions, and team performance.

## Overview

The Standard HQ is a full-featured platform designed specifically for insurance agencies and Independent Marketing Organizations (IMOs). It provides end-to-end management of:

- **Agent recruiting and onboarding** - Customizable pipelines with checklists, document collection, and automated workflows
- **Policy and commission tracking** - Complete lifecycle management from policy placement through commission earning
- **Team hierarchy and overrides** - Multi-level organizational structure with override commission calculations
- **Performance analytics** - Real-time KPIs, forecasting, and performance attribution
- **Business expense management** - Track, categorize, and budget operational expenses
- **Communications** - Integrated email and Slack messaging for team coordination

## Tech Stack

| Category   | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 19.1, TypeScript              |
| Build Tool | Vite                                |
| Routing    | TanStack Router                     |
| State/Data | TanStack Query                      |
| Forms      | TanStack Form, React Hook Form, Zod |
| Database   | Supabase (PostgreSQL)               |
| Styling    | Tailwind CSS v4                     |
| Components | Radix UI, shadcn/ui                 |
| Charts     | Recharts, Nivo                      |
| Email      | React Email, Mailgun                |
| Testing    | Vitest, Testing Library             |

## Features

### Dashboard & Analytics

- **KPI Dashboard** - At-a-glance view of key metrics including policies written, commissions earned, and team performance
- **Performance Metrics** - Track pace against goals with historical comparisons
- **Predictive Analytics** - Forecast future earnings based on current pipeline
- **Game Plan** - Actionable recommendations to hit monthly targets
- **Activity Feed** - Real-time updates on team and individual activity
- **PACE METRICS** - Real-time updates on user projections, and current metrics
- **Carriers & Products** - Breakdown of the various product types being sold with each carrier
- **Product Mix** - Displays the % of the types of products being sold
- **Policy Status** - Active vs Lapsed vs Cancelled Display
- **Premium By State** - Displays Premium Total by State
- **Client Segments** - Displays low, medium, and high value client metrics

### Policy Management

- **Policy Tracking** - Record and manage all insurance policies
- **Multi-carrier Support** - Track policies across multiple insurance carriers
- **Product Management** - Organize policies by product type (life, annuity, etc.)
- **Client Records** - Maintain client information linked to policies
- **Status Workflow** - Track policies from application through in-force status

### Commission System

- **Commission Tracking** - Automatic calculation based on policy premiums and contract levels
- **Advance Handling** - Track advanced commissions and their earning schedule
- **Chargeback Management** - Handle policy lapses and commission chargebacks
- **Earned vs Unearned** - Monitor earned and unearned commission balances
- **Override Commissions** - Calculate and distribute hierarchical overrides

### Recruiting Pipeline

- **Lead Capture** - Public-facing recruitment landing pages (`/join/[recruiter-id]`)
- **Leads Queue** - Manage incoming recruitment leads
- **Pipeline Templates** - Customizable recruiting phases and checklists
- **Automated Workflows** - Trigger actions based on pipeline progress
- **Document Collection** - Gather required documents from recruits
- **Interactive Checklists** - Videos, quizzes, acknowledgments, signatures
- **Communication Tools** - Integrated email for recruit outreach

### Agent Hierarchy

- **Org Chart** - Visual representation of organizational structure
- **Upline/Downline** - Manage hierarchical relationships between agents
- **Team Dashboard** - Aggregate metrics for team leaders
- **Downline Performance** - Track performance of agents in your downline
- **Invitations** - Send invitations to add agents to your downline

### Contracting & Onboarding

- **Carrier Contracts** - Track agent appointments with carriers
- **Writing Numbers** - Manage agent writing numbers per carrier
- **Document Management** - Store and track contract documents
- **Onboarding Phases** - Guide new agents through onboarding steps
- **Training Hub** - Training resources and progress tracking

### Expense Tracking

- **Expense Categories** - Organize expenses by business category
- **Budget Management** - Set and track expense budgets
- **Recurring Expenses** - Handle recurring business costs
- **Trend Analysis** - Visualize expense patterns over time
- **Category Breakdowns** - Pie charts and detailed breakdowns

### Reports

- **Executive Summary** - High-level performance overview
- **Agency Performance** - Agency-level metrics and comparisons
- **IMO Performance** - Organization-wide reporting
- **Scheduled Reports** - Automated report generation and delivery
- **Export Options** - Export reports in various formats

### Communications Hub

- **Email Integration** - Gmail OAuth integration for sending emails
- **Email Templates** - Reusable templates with variable substitution
- **Thread Management** - Threaded email conversations
- **Slack Integration** - Connect with Slack workspaces
- **Daily Sales Logs** - Slack-powered daily leaderboards

### Settings & Administration

- **User Management** - Create, edit, and manage user accounts
- **Role-Based Access** - Granular permissions system
- **Carrier Management** - Configure insurance carriers
- **Product Configuration** - Set up products and commission rates
- **Comp Guide** - Master commission rate schedule
- **Agency/IMO Setup** - Configure organizational entities
- **Alert Rules** - Custom performance alerts and notifications
- **Subscription/Billing** - Tiered feature access

## Architecture

```
/src
├── /features         # Domain features (self-contained modules)
│   ├── /analytics    # Analytics dashboards and visualizations
│   ├── /auth         # Authentication and authorization
│   ├── /commissions  # Commission tracking and calculations
│   ├── /contracting  # Agent contracting workflows
│   ├── /dashboard    # Main dashboard components
│   ├── /documents    # Document management
│   ├── /expenses     # Expense tracking
│   ├── /hierarchy    # Team hierarchy and overrides
│   ├── /messages     # Communications hub
│   ├── /policies     # Policy management
│   ├── /recruiting   # Recruiting pipeline
│   ├── /reports      # Reporting and analytics
│   ├── /settings     # Application settings
│   ├── /targets      # Goal setting
│   ├── /training-hub # Training management
│   └── /workflows    # Automation workflows
├── /components       # Reusable UI components
│   ├── /auth         # Authentication guards
│   ├── /layout       # Layout components
│   └── /ui           # Base UI primitives (shadcn)
├── /services         # Business logic and API access
├── /hooks            # Custom React hooks
├── /types            # TypeScript type definitions
├── /lib              # Utilities (date, currency, etc.)
├── /contexts         # React contexts
└── /routes           # TanStack Router routes
/supabase
└── /migrations       # SQL database migrations
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

With `VITE_USE_LOCAL=true`, `npm run dev` now starts the local API server, Vite, and `supabase functions serve` automatically so `supabase.functions.invoke(...)` calls work against Dockerized Supabase. `npm run dev:local` remains available as the explicit local-only command.

If you need local Supabase to mirror the current remote `auth`, `public`, and `storage` schemas exactly, run:

```bash
npm run supabase:clone-remote-schema
```

That command:

- dumps the remote `auth/public/storage` schema
- rebuilds the local `auth/public/storage` schemas from that dump
- copies `storage.buckets` rows and `supabase_migrations.schema_migrations`
- leaves application/auth/storage object data empty by design

It requires `REMOTE_DATABASE_URL` to be set in your local env.

To make that cloned schema usable for day-to-day local development, run the bootstrap immediately after:

```bash
npm run supabase:bootstrap-local-dev
```

That second step:

- copies remote reference/config tables that the app expects at runtime
- restores recruiting pipeline templates, phases, and checklist items
- preserves the exact copied storage buckets metadata from the schema clone
- writes local-safe `app_config` values so local never points back at the remote project
- creates deterministic local auth users for the super admin, an active agent, a trainer, and a contracting manager

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

| Command                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Start development server                       |
| `npm run dev:local`      | Start local API server, local edge functions, and Vite |
| `npm run supabase:functions` | Serve local Supabase Edge Functions      |
| `npm run supabase:start` | Start local Supabase via Docker                |
| `npm run supabase:stop`  | Stop local Supabase                            |
| `npm run supabase:status`| Show local Supabase status                     |
| `npm run supabase:clone-remote-schema` | Rebuild local `auth/public/storage` from the remote schema, buckets, and migration history |
| `npm run supabase:bootstrap-local-dev` | Seed local-safe runtime data and deterministic local auth users on top of the mirrored schema |
| `npm run supabase:sync-local-from-remote` | Run the exact schema clone, then bootstrap the usable local runtime |
| `npm run build`          | Build for production                           |
| `npm run preview`        | Preview production build                       |
| `npm run test`           | Run tests                                      |
| `npm run test:ui`        | Run tests with UI                              |
| `npm run lint`           | Lint code                                      |
| `npm run typecheck`      | Type check                                     |
| `npm run generate:types` | Generate TypeScript types from Supabase schema |
| `npm run email:dev`      | Start email template development server        |

## Database

For development, the recommended path is the local Supabase stack on Docker. The app now defaults to local Supabase in dev and will refuse to use a remote Supabase project unless you explicitly opt in with `VITE_ALLOW_REMOTE_SUPABASE_DEV=true`.

The application uses Supabase (PostgreSQL) with the following key entities:

- **user_profiles** - User accounts with roles, permissions, and hierarchy info
- **policies** - Insurance policies with carrier, product, and client associations
- **commissions** - Commission records with advance/earned tracking
- **agencies** - Agency entities within an IMO
- **imos** - Independent Marketing Organizations
- **carriers** - Insurance carriers
- **products** - Insurance products offered
- **comp_guide** - Commission rate schedules by contract level
- **recruits** - Recruiting pipeline candidates
- **pipeline_templates** - Customizable recruiting workflows
- **expenses** - Business expense records
- **user_emails** - Email communication records
- **notifications** - In-app notifications
- **alert_rules** - Custom alert configurations

### Migrations

Database migrations are stored in `/supabase/migrations/`. After schema changes:

```bash
npm run generate:types
```

This regenerates `src/types/database.types.ts` to keep TypeScript types in sync.

## User Roles

The system supports multiple user roles with granular permissions:

| Role                    | Description                                 |
| ----------------------- | ------------------------------------------- |
| **Super Admin**         | Full system access, IMO management          |
| **Admin**               | Agency-level administration                 |
| **Agency Owner**        | Manages agency and its agents               |
| **Agent**               | Standard licensed insurance agent           |
| **Trainer**             | Staff role for training new recruits        |
| **Contracting Manager** | Staff role for managing agent contracts     |
| **Recruit**             | Pre-licensed recruit in onboarding pipeline |

## Subscription Tiers

Features are gated by subscription tier:

- **Free** - Basic policy and commission tracking
- **Professional** - Adds hierarchy, recruiting, expenses
- **Enterprise** - Full feature access including reports, workflows, integrations

## Security

- Row-Level Security (RLS) enforced at database level
- JWT-based authentication via Supabase Auth
- Role-based access control with custom permissions
- Audit logging for sensitive operations
- Input validation with Zod schemas

## Development Guidelines

- **TypeScript** - Strict type checking required
- **Feature-based architecture** - Self-contained feature modules
- **TanStack Query** - All server state managed through queries
- **No mock data** - Production code connects to real data only
- **Functional components** - Hooks-based React components
- **shadcn/ui** - Consistent UI component library

## Deployment

The application deploys to Vercel with strict TypeScript checking:

```bash
npm run build  # Must pass with zero errors
```

## License

Proprietary - All rights reserved.

## Support

For issues and feature requests, please contact the development team.
