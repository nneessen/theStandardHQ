// Email feature constants
// TODO: why are we hardcoding email template categories? this should be coming from a table, where there is a service file for CRUD ops

import type { EmailTemplateCategory } from "@/types/email.types";

export const EMAIL_TEMPLATE_CATEGORIES: {
  value: EmailTemplateCategory;
  label: string;
}[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "documents", label: "Documents" },
  { value: "follow_up", label: "Follow Up" },
  { value: "general", label: "General" },
  { value: "automation", label: "Automation" },
];

import { TEMPLATE_PREVIEW_VALUES } from "@/lib/templateVariables";

/** Preview variables for email template editor — sourced from shared definitions */
export const TEMPLATE_PREVIEW_VARIABLES: Record<string, string> =
  TEMPLATE_PREVIEW_VALUES;
