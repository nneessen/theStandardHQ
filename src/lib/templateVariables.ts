// src/lib/templateVariables.ts
// Canonical source of truth for all template variable definitions.
// All frontend consumers import from here. Edge functions duplicate
// the keys/replacement logic in supabase/functions/_shared/templateVariables.ts.

/** Contexts in which a template variable is available */
export type TemplateVariableContext = "workflow" | "pipeline" | "email";

/** A single template variable definition */
export interface TemplateVariableDefinition {
  /** The variable key without braces, e.g. "recruit_name" */
  key: string;
  /** Human-readable description shown in UI */
  description: string;
  /** Grouping category for UI display */
  category: string;
  /** Preview/example value for the template editor */
  preview: string;
  /** Which systems support this variable */
  contexts: TemplateVariableContext[];
  /** If set, this variable is an alias for another canonical key */
  aliasFor?: string;
}

/**
 * All template variables available across workflows, pipelines, and email templates.
 * 47 variables across 13 categories.
 */
export const TEMPLATE_VARIABLES: readonly TemplateVariableDefinition[] = [
  // ── Recruit Basic ──────────────────────────────────────────────────
  {
    key: "recruit_name",
    description: "Full name of the recruit",
    category: "Recruit Basic",
    preview: "John Smith",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "recruit_first_name",
    description: "First name of the recruit",
    category: "Recruit Basic",
    preview: "John",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "recruit_last_name",
    description: "Last name of the recruit",
    category: "Recruit Basic",
    preview: "Smith",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "recruit_email",
    description: "Email address of the recruit",
    category: "Recruit Basic",
    preview: "john.doe@example.com",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "recruit_phone",
    description: "Phone number of the recruit",
    category: "Recruit Basic",
    preview: "(555) 123-4567",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "recruit_status",
    description: "Current agent status",
    category: "Recruit Basic",
    preview: "active",
    contexts: ["workflow", "pipeline"],
  },

  // ── Recruit Location ───────────────────────────────────────────────
  {
    key: "recruit_city",
    description: "City",
    category: "Recruit Location",
    preview: "Dallas",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_state",
    description: "Mailing address state",
    category: "Recruit Location",
    preview: "TX",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_zip",
    description: "ZIP code",
    category: "Recruit Location",
    preview: "75001",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_address",
    description: "Full street address",
    category: "Recruit Location",
    preview: "123 Main St, Dallas, TX 75001",
    contexts: ["workflow", "pipeline"],
  },

  // ── Recruit Professional ───────────────────────────────────────────
  {
    key: "recruit_contract_level",
    description: "Contract level percentage",
    category: "Recruit Professional",
    preview: "75",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_npn",
    description: "National Producer Number",
    category: "Recruit Professional",
    preview: "9876543",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_license_number",
    description: "Insurance license number",
    category: "Recruit Professional",
    preview: "1234567",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_license_expiration",
    description: "License expiration date",
    category: "Recruit Professional",
    preview: "12/31/2026",
    contexts: ["workflow"],
  },
  {
    key: "recruit_license_state",
    description: "License jurisdiction state",
    category: "Recruit Professional",
    preview: "TX",
    contexts: ["workflow", "pipeline"],
  },
  {
    key: "recruit_referral_source",
    description: "How the recruit was referred",
    category: "Recruit Professional",
    preview: "LinkedIn",
    contexts: ["workflow"],
  },
  {
    key: "contract_level",
    description: "Contract level (alias)",
    category: "Recruit Professional",
    preview: "75",
    contexts: ["pipeline"],
    aliasFor: "recruit_contract_level",
  },

  // ── Recruit Social ─────────────────────────────────────────────────
  {
    key: "recruit_facebook",
    description: "Facebook handle",
    category: "Recruit Social",
    preview: "johnsmith",
    contexts: ["workflow"],
  },
  {
    key: "recruit_instagram",
    description: "Instagram username",
    category: "Recruit Social",
    preview: "@johnsmith",
    contexts: ["workflow"],
  },
  {
    key: "recruit_website",
    description: "Personal website URL",
    category: "Recruit Social",
    preview: "https://johnsmith.com",
    contexts: ["workflow"],
  },

  // ── Organization ───────────────────────────────────────────────────
  {
    key: "company_name",
    description: "Company name",
    category: "Organization",
    preview: "The Standard HQ",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "agency_name",
    description: "Agency name",
    category: "Organization",
    preview: "ABC Insurance Agency",
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "imo_name",
    description: "IMO/FMO name",
    category: "Organization",
    preview: "Premier IMO",
    contexts: ["workflow", "pipeline", "email"],
  },

  // ── User/Owner ─────────────────────────────────────────────────────
  {
    key: "user_name",
    description: "Workflow owner full name",
    category: "User/Owner",
    preview: "Jane Doe",
    contexts: ["workflow"],
  },
  {
    key: "user_first_name",
    description: "Workflow owner first name",
    category: "User/Owner",
    preview: "Jane",
    contexts: ["workflow"],
  },
  {
    key: "user_last_name",
    description: "Workflow owner last name",
    category: "User/Owner",
    preview: "Doe",
    contexts: ["workflow"],
  },
  {
    key: "user_email",
    description: "Workflow owner email",
    category: "User/Owner",
    preview: "jane.doe@example.com",
    contexts: ["workflow"],
  },

  // ── Upline ─────────────────────────────────────────────────────────
  {
    key: "upline_name",
    description: "Upline full name",
    category: "Upline",
    preview: "Jane Doe",
    contexts: ["pipeline", "workflow"],
  },
  {
    key: "upline_first_name",
    description: "Upline first name",
    category: "Upline",
    preview: "Jane",
    contexts: ["pipeline", "workflow"],
  },
  {
    key: "upline_email",
    description: "Upline email address",
    category: "Upline",
    preview: "jane@email.com",
    contexts: ["pipeline", "workflow"],
  },
  {
    key: "upline_phone",
    description: "Upline phone number",
    category: "Upline",
    preview: "(555) 987-6543",
    contexts: ["pipeline", "workflow"],
  },

  // ── Pipeline ───────────────────────────────────────────────────────
  {
    key: "phase_name",
    description: "Current pipeline phase name",
    category: "Pipeline",
    preview: "Contracting",
    contexts: ["pipeline", "email"],
  },
  {
    key: "phase_description",
    description: "Phase description",
    category: "Pipeline",
    preview: "Initial training and orientation",
    contexts: ["pipeline", "email"],
  },
  {
    key: "template_name",
    description: "Pipeline template name",
    category: "Pipeline",
    preview: "New Agent Onboarding",
    contexts: ["pipeline"],
  },
  {
    key: "item_name",
    description: "Checklist item name",
    category: "Pipeline",
    preview: "Submit W-9",
    contexts: ["pipeline", "email"],
  },
  {
    key: "checklist_items",
    description: "List of pending checklist items",
    category: "Pipeline",
    preview: "1. Complete training\n2. Submit documents",
    contexts: ["pipeline", "email"],
  },

  // ── Sender ─────────────────────────────────────────────────────────
  {
    key: "sender_name",
    description: "Name of the email sender",
    category: "Sender",
    preview: "Jane Smith",
    contexts: ["email"],
  },
  {
    key: "recruiter_name",
    description: "Name of the recruiter",
    category: "Sender",
    preview: "Jane Smith",
    contexts: ["email"],
  },

  // ── Dates ──────────────────────────────────────────────────────────
  {
    key: "current_date",
    description: "Today's date (formatted)",
    category: "Dates",
    preview: new Date().toLocaleDateString(),
    contexts: ["workflow", "pipeline", "email"],
  },
  {
    key: "date_today",
    description: "Today's date (alias)",
    category: "Dates",
    preview: new Date().toLocaleDateString(),
    contexts: ["workflow"],
    aliasFor: "current_date",
  },
  {
    key: "date_tomorrow",
    description: "Tomorrow's date",
    category: "Dates",
    preview: new Date(Date.now() + 86400000).toLocaleDateString(),
    contexts: ["workflow"],
  },
  {
    key: "date_next_week",
    description: "Date one week from today",
    category: "Dates",
    preview: new Date(Date.now() + 604800000).toLocaleDateString(),
    contexts: ["workflow"],
  },
  {
    key: "date_current_month",
    description: "Current month name",
    category: "Dates",
    preview: new Date().toLocaleDateString("en-US", { month: "long" }),
    contexts: ["workflow"],
  },
  {
    key: "date_current_year",
    description: "Current year",
    category: "Dates",
    preview: new Date().getFullYear().toString(),
    contexts: ["workflow"],
  },
  {
    key: "deadline_date",
    description: "Phase deadline date (if set)",
    category: "Dates",
    preview: new Date(Date.now() + 604800000).toLocaleDateString(),
    contexts: ["pipeline", "email"],
  },

  // ── Calculated ─────────────────────────────────────────────────────
  {
    key: "days_in_phase",
    description: "Days in current phase",
    category: "Calculated",
    preview: "5",
    contexts: ["pipeline"],
  },
  {
    key: "days_since_signup",
    description: "Days since signup",
    category: "Calculated",
    preview: "30",
    contexts: ["pipeline"],
  },

  // ── Links ──────────────────────────────────────────────────────────
  {
    key: "portal_link",
    description: "Recruit portal link",
    category: "Links",
    preview: "https://app.thestandardhq.com/recruit/123",
    contexts: ["pipeline", "workflow"],
  },
  {
    key: "app_url",
    description: "Application base URL",
    category: "Links",
    preview: "https://app.thestandardhq.com",
    contexts: ["pipeline", "workflow"],
  },

  // ── Workflow ───────────────────────────────────────────────────────
  {
    key: "workflow_name",
    description: "Workflow name",
    category: "Workflow",
    preview: "New Recruit Onboarding",
    contexts: ["workflow"],
  },
  {
    key: "workflow_run_id",
    description: "Workflow run identifier",
    category: "Workflow",
    preview: "run_abc123",
    contexts: ["workflow"],
  },
] as const;

/** All valid template variable keys */
export const TEMPLATE_VARIABLE_KEYS: readonly string[] = TEMPLATE_VARIABLES.map(
  (v) => v.key,
);

/** Preview values derived from variable definitions: Record<key, preview> */
export const TEMPLATE_PREVIEW_VALUES: Record<string, string> =
  Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.preview]));

/**
 * Returns variables grouped by category, optionally filtered by context.
 * Each group has { category: string, variables: TemplateVariableDefinition[] }.
 */
export function getVariablesByCategory(
  context?: TemplateVariableContext,
): { category: string; variables: TemplateVariableDefinition[] }[] {
  const filtered = context
    ? TEMPLATE_VARIABLES.filter((v) => v.contexts.includes(context))
    : [...TEMPLATE_VARIABLES];

  const categoryMap = new Map<string, TemplateVariableDefinition[]>();
  for (const variable of filtered) {
    const existing = categoryMap.get(variable.category);
    if (existing) {
      existing.push(variable);
    } else {
      categoryMap.set(variable.category, [variable]);
    }
  }

  return Array.from(categoryMap.entries()).map(([category, variables]) => ({
    category,
    variables,
  }));
}

/**
 * Standardized template variable replacement.
 * Case-insensitive, whitespace-tolerant: matches {{ key }}, {{key}}, etc.
 */
export function replaceTemplateVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi");
    result = result.replace(regex, value);
  }
  return result;
}
