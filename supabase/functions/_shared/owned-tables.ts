// ============================================================================
// Owned-Tables Registry — single source of truth for the platform-sunset flow.
// ============================================================================
// CRITICAL INVARIANT (prevents silent data loss):
//   The set of tables the WIPE removes MUST be a superset of the set the EXPORT
//   includes. If the wipe deletes a table the export omits, a user permanently
//   loses data they believed they downloaded. The parity unit test asserts
//   `export ⊆ wipe` and that every owner column actually exists in the catalog.
//
// Consumed by:
//   - generate-user-export-bundle  (export === true rows -> sheets/CSVs)
//   - wipe_user_business_data       (every row + CASCADE children)
//
// Derived empirically from the live catalog (information_schema + pg_constraint
// FK delete actions referencing public.user_profiles). See the sunset plan.
// ============================================================================

export type WipeMode =
  // CASCADE FK to user_profiles: removed automatically when the profile row is
  // deleted. Listed for export/manifest completeness; no explicit DELETE needed.
  | "cascade"
  // No cascade (user_id-only table, or NO ACTION owner): wipe must DELETE
  // explicitly, BEFORE the user_profiles row is removed.
  | "explicit";

export interface OwnedTable {
  /** public.<table> */
  table: string;
  /** column identifying the owning user */
  ownerColumn: string;
  /** include in the user's downloadable export bundle */
  export: boolean;
  /** human label for the export sheet / CSV file (only when export === true) */
  sheet?: string;
  /** how the wipe removes the rows */
  wipe: WipeMode;
  /** rows live in Supabase Storage at {ownerColumn}/... — wipe must also purge the bucket */
  storageBucket?: string;
  /** notes for maintainers */
  note?: string;
}

// ---------------------------------------------------------------------------
// EXPORTED + WIPED — user-facing business records.
// ---------------------------------------------------------------------------
export const EXPORTED_TABLES: OwnedTable[] = [
  // Core sales
  {
    table: "policies",
    ownerColumn: "user_id",
    export: true,
    sheet: "Policies",
    wipe: "explicit",
  },
  {
    table: "clients",
    ownerColumn: "user_id",
    export: true,
    sheet: "Clients",
    wipe: "explicit",
  },
  {
    table: "commissions",
    ownerColumn: "user_id",
    export: true,
    sheet: "Commissions",
    wipe: "explicit",
    note: "user_id has NO FK to user_profiles -> does NOT cascade; MUST delete explicitly or financial rows orphan",
  },
  {
    table: "override_commissions",
    ownerColumn: "base_agent_id",
    export: true,
    sheet: "Override Commissions",
    wipe: "cascade",
    note: "owned by the producing (base) agent",
  },
  // Expenses & leads
  {
    table: "expenses",
    ownerColumn: "user_id",
    export: true,
    sheet: "Expenses",
    wipe: "explicit",
  },
  {
    table: "expense_templates",
    ownerColumn: "user_id",
    export: true,
    sheet: "Expense Templates",
    wipe: "explicit",
  },
  {
    table: "user_expense_categories",
    ownerColumn: "user_id",
    export: true,
    sheet: "Expense Categories",
    wipe: "explicit",
  },
  {
    table: "lead_purchases",
    ownerColumn: "user_id",
    export: true,
    sheet: "Lead Purchases",
    wipe: "explicit",
  },
  // Production logs
  {
    table: "daily_sales_logs",
    ownerColumn: "first_seller_id",
    export: true,
    sheet: "Daily Sales",
    wipe: "explicit",
    note: "first_seller_id is SET NULL on profile delete; wipe explicitly for a clean record",
  },
  // Contracts & credentials
  {
    table: "carrier_contracts",
    ownerColumn: "agent_id",
    export: true,
    sheet: "Carrier Contracts",
    wipe: "cascade",
    note: "agent_id CASCADE; created_by is a NO-ACTION actor ref",
  },
  {
    table: "carrier_contract_requests",
    ownerColumn: "recruit_id",
    export: true,
    sheet: "Carrier Contract Requests",
    wipe: "cascade",
    note: "recruit_id CASCADE; created_by/updated_by are NO-ACTION actor refs",
  },
  {
    table: "agent_contracts",
    ownerColumn: "agent_id",
    export: true,
    sheet: "Contracts",
    wipe: "cascade",
  },
  {
    table: "agent_writing_numbers",
    ownerColumn: "agent_id",
    export: true,
    sheet: "Writing Numbers",
    wipe: "cascade",
  },
  {
    table: "agent_state_licenses",
    ownerColumn: "agent_id",
    export: true,
    sheet: "State Licenses",
    wipe: "cascade",
  },
  {
    table: "contract_documents",
    ownerColumn: "agent_id",
    export: true,
    sheet: "Contract Documents",
    wipe: "cascade",
    storageBucket: "contract-documents",
  },
  {
    table: "user_documents",
    ownerColumn: "user_id",
    export: true,
    sheet: "Documents",
    wipe: "cascade",
    storageBucket: "user-documents",
  },
  {
    table: "presentation_submissions",
    ownerColumn: "user_id",
    export: true,
    sheet: "Presentations",
    wipe: "cascade",
    storageBucket: "presentation-recordings",
  },
  // Recruiting (as a recruiter)
  {
    table: "recruiting_leads",
    ownerColumn: "recruiter_id",
    export: true,
    sheet: "Recruits",
    wipe: "cascade",
  },
  {
    table: "recruit_phase_progress",
    ownerColumn: "user_id",
    export: true,
    sheet: "Onboarding Progress",
    wipe: "cascade",
  },
  {
    table: "recruit_checklist_progress",
    ownerColumn: "user_id",
    export: true,
    sheet: "Onboarding Checklist",
    wipe: "cascade",
  },
  {
    table: "roadmap_item_progress",
    ownerColumn: "user_id",
    export: true,
    sheet: "Roadmap Progress",
    wipe: "cascade",
    note: "added 2026-05-27 after gate-completeness review: user_id-only read policy bypassed the chokepoint",
  },
  // Training
  {
    table: "training_progress",
    ownerColumn: "user_id",
    export: true,
    sheet: "Training Progress",
    wipe: "cascade",
  },
  {
    table: "training_quiz_attempts",
    ownerColumn: "user_id",
    export: true,
    sheet: "Quiz Attempts",
    wipe: "cascade",
  },
  {
    table: "training_user_badges",
    ownerColumn: "user_id",
    export: true,
    sheet: "Badges",
    wipe: "cascade",
  },
  {
    table: "training_user_certifications",
    ownerColumn: "user_id",
    export: true,
    sheet: "Certifications",
    wipe: "cascade",
  },
  {
    table: "training_user_stats",
    ownerColumn: "user_id",
    export: true,
    sheet: "Training Stats",
    wipe: "cascade",
  },
  {
    table: "training_xp_entries",
    ownerColumn: "user_id",
    export: true,
    sheet: "XP History",
    wipe: "cascade",
  },
  {
    table: "training_challenge_participants",
    ownerColumn: "user_id",
    export: true,
    sheet: "Challenges",
    wipe: "cascade",
  },
  // KPI / goals
  {
    table: "close_kpi_dashboards",
    ownerColumn: "user_id",
    export: true,
    sheet: "KPI Dashboards",
    wipe: "explicit",
  },
  {
    table: "close_kpi_widgets",
    ownerColumn: "user_id",
    export: true,
    sheet: "KPI Widgets",
    wipe: "explicit",
  },
  // Lead heat
  {
    table: "lead_heat_scores",
    ownerColumn: "user_id",
    export: true,
    sheet: "Lead Heat Scores",
    wipe: "explicit",
  },
  {
    table: "lead_heat_outcomes",
    ownerColumn: "user_id",
    export: true,
    sheet: "Lead Heat Outcomes",
    wipe: "explicit",
  },
  {
    table: "lead_heat_ai_portfolio_analysis",
    ownerColumn: "user_id",
    export: true,
    sheet: "Lead Heat Analysis",
    wipe: "explicit",
  },
  // Communications
  {
    table: "bulk_email_campaigns",
    ownerColumn: "user_id",
    export: true,
    sheet: "Email Campaigns",
    wipe: "explicit",
  },
  {
    table: "user_emails",
    ownerColumn: "user_id",
    export: true,
    sheet: "Emails",
    wipe: "cascade",
    note: "metadata only; no body secrets",
  },
  {
    table: "notifications",
    ownerColumn: "user_id",
    export: true,
    sheet: "Notifications",
    wipe: "cascade",
  },
  {
    table: "custom_domains",
    ownerColumn: "user_id",
    export: true,
    sheet: "Custom Domains",
    wipe: "explicit",
  },
  {
    table: "recruiting_page_settings",
    ownerColumn: "user_id",
    export: true,
    sheet: "Recruiting Page",
    wipe: "explicit",
  },
];

// ---------------------------------------------------------------------------
// WIPED ONLY — internal/system/sensitive rows. Removed but NOT exported
// (caches, quotas, OAuth tokens, preferences, usage logs).
// ---------------------------------------------------------------------------
export const WIPE_ONLY_TABLES: OwnedTable[] = [
  {
    table: "close_config",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "close_ai_generations",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "close_kpi_cache",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_labels",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_quota_tracking",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "email_scheduled",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_signatures",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_snippets",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_threads",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "email_watch_subscriptions",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "gmail_integrations",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
    note: "OAuth tokens — never export",
  },
  {
    table: "user_email_oauth_tokens",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
    note: "OAuth tokens — never export",
  },
  {
    table: "user_mailbox_settings",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "usage_tracking",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "user_activity_log",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "lead_heat_agent_weights",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "lead_heat_scoring_runs",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "lead_heat_status_config",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "notification_digest_log",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "notification_preferences",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "communication_preferences",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "contact_favorites",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
    note: "contact_user_id FK is CASCADE; user_id owner col is explicit",
  },
  {
    table: "settings",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "user_slack_preferences",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "subscription_events",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "subscription_payments",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "user_subscription_addons",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "user_subscriptions",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
    note: "Stripe sub cancelled separately in the wipe edge fn",
  },
  {
    table: "bot_policy_attributions",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "chat_bot_agents",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "chat_bot_team_overrides",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "instagram_integrations",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
    note: "OAuth tokens",
  },
  {
    table: "instagram_template_categories",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "instagram_usage_tracking",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "instagram_message_templates",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "onboarding_phases",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "recommendation_outcomes",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  {
    table: "scheduling_integrations",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
    note: "OAuth tokens",
  },
  {
    table: "uw_wizard_usage",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "uw_wizard_usage_log",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "workflow_email_tracking",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "workflow_rate_limits",
    ownerColumn: "user_id",
    export: false,
    wipe: "cascade",
  },
  {
    table: "writing_number_history",
    ownerColumn: "agent_id",
    export: false,
    wipe: "explicit",
    note: "agent_id FK is SET NULL",
  },
  {
    table: "user_quick_quote_presets",
    ownerColumn: "user_id",
    export: false,
    wipe: "explicit",
  },
  // Added 2026-05-27 after the gate-completeness review (user_id/owner read policies
  // that bypass the chokepoint). All CASCADE to user_profiles -> wiped automatically.
  {
    table: "presentation_markers",
    ownerColumn: "created_by",
    export: false,
    wipe: "cascade",
    note: "annotation metadata on presentation recordings; created_by CASCADE",
  },
  {
    table: "team_seat_packs",
    ownerColumn: "owner_id",
    export: false,
    wipe: "cascade",
    note: "billing/seat data; owner_id CASCADE",
  },
  {
    table: "team_uw_wizard_seats",
    ownerColumn: "team_owner_id",
    export: false,
    wipe: "cascade",
    note: "seat data; BOTH team_owner_id AND agent_id are CASCADE FKs to user_profiles",
  },
];

// ---------------------------------------------------------------------------
// NO-ACTION "actor" references — NOT ownership. These columns point at the user
// as an actor (who created/updated/verified/assigned something). They are
// NO ACTION FKs, so they BLOCK the user_profiles delete and must be cleared
// BEFORE deleting the profile. Do NOT delete the referenced rows — they belong
// to the IMO / other users.
//
// Split by the column's NOT NULL constraint (verified against the catalog):
//   - NULLABLE columns  -> UPDATE ... SET col = NULL
//   - NOT NULL columns  -> UPDATE ... SET col = <reassignToUserId> (the
//     super-admin / a stable system user) so shared resources (e.g. training
//     modules the user authored) survive and the delete is unblocked.
// ---------------------------------------------------------------------------
export const ACTOR_REFS_TO_NULL: { table: string; column: string }[] = [
  { table: "agency_slack_credentials", column: "created_by" },
  { table: "carrier_contract_requests", column: "updated_by" },
  { table: "carrier_contract_requests", column: "created_by" },
  { table: "carrier_contracts", column: "created_by" },
  { table: "chat_bot_team_overrides", column: "granted_by" },
  { table: "recruit_checklist_progress", column: "completed_by" },
  { table: "recruit_checklist_progress", column: "verified_by" },
  { table: "subscription_settings", column: "updated_by" },
  { table: "system_audit_log", column: "performed_by" },
  { table: "training_modules", column: "updated_by" },
  { table: "user_profiles", column: "archived_by" },
];

// NOT NULL actor refs — reassign to a stable system user (super-admin) to
// unblock the delete without destroying shared/other-owned rows.
export const ACTOR_REFS_TO_REASSIGN: {
  table: string;
  column: string;
  note?: string;
}[] = [
  {
    table: "lead_drop_jobs",
    column: "sender_user_id",
    note: "transient job; reassign or delete acceptable",
  },
  { table: "lead_drop_jobs", column: "recipient_user_id" },
  {
    table: "roadmap_templates",
    column: "created_by",
    note: "shared template — preserve via reassign",
  },
  {
    table: "training_assignments",
    column: "assigned_by",
    note: "assignment this user made to others",
  },
  {
    table: "training_challenges",
    column: "created_by",
    note: "shared challenge — preserve",
  },
  {
    table: "training_modules",
    column: "created_by",
    note: "shared module — preserve, do NOT delete (cascades to lessons/progress)",
  },
];

export const ALL_OWNED_TABLES: OwnedTable[] = [
  ...EXPORTED_TABLES,
  ...WIPE_ONLY_TABLES,
];

// NOTE on the REVOCATION GATE vs this registry — they use opposite defaults:
//   - The GATE (read access for a revoked user) is DENY-BY-DEFAULT, applied in
//     migration 20260526200139_revocation_gate_owned_tables.sql to EVERY
//     RLS-enabled public table except a tiny allowlist (user_profiles, imos,
//     agencies). It is NOT driven by this registry — a kill-switch must fail
//     closed, so we never enumerate what to deny.
//   - This registry drives DESTRUCTION (wipe_user_business_data) and the EXPORT
//     bundle — both of which MUST be explicit, reviewed allowlists. You should
//     always have to remember to delete a row.
// A 2026-05-27 completeness review proved a hand-maintained gate allowlist had
// missed 8+ tables, which is why the gate was flipped to deny-by-default.
