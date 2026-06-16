// src/services/base/tables.ts
// Centralized table name constants for Supabase queries

export const TABLES = {
  // Core business
  POLICIES: "policies",
  COMMISSIONS: "commissions",
  CHARGEBACKS: "chargebacks",
  OVERRIDE_COMMISSIONS: "override_commissions",
  EXPENSES: "expenses",
  EXPENSE_CATEGORIES: "user_expense_categories",
  GLOBAL_EXPENSE_CATEGORIES: "global_expense_categories",
  EXPENSE_TEMPLATES: "expense_templates",

  // Reference data
  CARRIERS: "carriers",
  PRODUCTS: "products",
  PRODUCT_COMMISSION_OVERRIDES: "product_commission_overrides",
  CLIENTS: "clients",
  COMP_GUIDE: "comp_guide",
  CONSTANTS: "constants",

  // Users & Auth
  USER_PROFILES: "user_profiles",
  USER_TARGETS: "user_targets",
  USER_DOCUMENTS: "user_documents",
  USER_SUBSCRIPTIONS: "user_subscriptions",
  SETTINGS: "settings",

  // Permissions
  ROLES: "roles",
  PERMISSIONS: "permissions",
  ROLE_PERMISSIONS: "role_permissions",

  // Email system
  USER_EMAILS: "user_emails",
  USER_EMAIL_ATTACHMENTS: "user_email_attachments",
  USER_EMAIL_OAUTH_TOKENS: "user_email_oauth_tokens",
  USER_MAILBOX_SETTINGS: "user_mailbox_settings",
  EMAIL_LABELS: "email_labels",
  EMAIL_THREADS: "email_threads",
  EMAIL_QUEUE: "email_queue",
  EMAIL_SCHEDULED: "email_scheduled",
  EMAIL_SIGNATURES: "email_signatures",
  EMAIL_SNIPPETS: "email_snippets",
  EMAIL_TEMPLATES: "email_templates",
  EMAIL_TRIGGERS: "email_triggers",
  EMAIL_TRACKING_EVENTS: "email_tracking_events",
  EMAIL_TRACKING_LINKS: "email_tracking_links",
  EMAIL_WATCH_SUBSCRIPTIONS: "email_watch_subscriptions",
  EMAIL_WEBHOOK_EVENTS: "email_webhook_events",
  EMAIL_QUOTA_TRACKING: "email_quota_tracking",
  BULK_EMAIL_CAMPAIGNS: "bulk_email_campaigns",
  BULK_EMAIL_RECIPIENTS: "bulk_email_recipients",

  // Messaging
  MESSAGES: "messages",
  MESSAGE_THREADS: "message_threads",
  NOTIFICATIONS: "notifications",
  NOTIFICATION_PREFERENCES: "notification_preferences",
  COMMUNICATION_PREFERENCES: "communication_preferences",
  CONTACT_FAVORITES: "contact_favorites",

  // Recruiting & Onboarding
  HIERARCHY_INVITATIONS: "hierarchy_invitations",
  PIPELINE_PHASES: "pipeline_phases",
  PIPELINE_TEMPLATES: "pipeline_templates",
  ONBOARDING_PHASES: "onboarding_phases",
  PHASE_CHECKLIST_ITEMS: "phase_checklist_items",
  RECRUIT_PHASE_PROGRESS: "recruit_phase_progress",
  RECRUIT_CHECKLIST_PROGRESS: "recruit_checklist_progress",
  PROSPECTS: "prospects",

  // Workflows
  // NOTE: actions live in workflows.actions (JSONB) and the trigger in
  // workflows.config->'trigger'. The old normalized workflow_actions /
  // workflow_triggers tables were dropped (migration 20260616072537) as
  // dead/unused — do not reintroduce constants for them.
  WORKFLOWS: "workflows",
  WORKFLOW_EMAIL_TRACKING: "workflow_email_tracking",
  WORKFLOW_EVENTS: "workflow_events",
  WORKFLOW_RATE_LIMITS: "workflow_rate_limits",
  WORKFLOW_RUNS: "workflow_runs",
  WORKFLOW_TEMPLATES: "workflow_templates",
  TRIGGER_EVENT_TYPES: "trigger_event_types",

  // Subscriptions & Billing
  SUBSCRIPTION_PLANS: "subscription_plans",
  SUBSCRIPTION_EVENTS: "subscription_events",
  SUBSCRIPTION_PAYMENTS: "subscription_payments",

  // Activity & Audit
  USER_ACTIVITY_LOG: "user_activity_log",
  SYSTEM_AUDIT_LOG: "system_audit_log",
  USAGE_TRACKING: "usage_tracking",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
