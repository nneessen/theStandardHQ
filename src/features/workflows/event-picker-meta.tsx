// Presentational metadata for the Event Trigger picker (and, later, the wizard).
// The canonical event data + variable NAMES come from the DB (useTriggerEventTypes,
// seeded from eventCatalog.ts). This module only adds display concerns the catalog
// intentionally doesn't carry — variable TYPE (for the color-coded chips), the
// POPULAR badge, and per-category label/accent/icon. It never mutates the catalog.

import {
  DollarSign,
  FileText,
  MapPin,
  UserPlus,
  Mail,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type VarType = "string" | "number" | "UUID" | "date" | "boolean";

/**
 * Infer a template-variable's type from its name (the catalog stores names only).
 * The real catalog is almost entirely strings with a few dates — we don't
 * manufacture variety; most chips are correctly blue.
 */
export function variableType(name: string): VarType {
  const n = name.toLowerCase();
  if (/(^|_)id$|_uuid$/.test(n)) return "UUID";
  if (/^date_|_date$|^current_date$|_at$/.test(n)) return "date";
  if (/(count|amount|total|quantity|^num_|_num$)/.test(n)) return "number";
  if (/^(is|has)_|_enabled$|_flag$/.test(n)) return "boolean";
  return "string";
}

/**
 * Variables available on (nearly) every event — workflow/user/date context, not
 * event-specific. Mirrors the COMMON group in eventCatalog.ts. The picker folds
 * these into a single "+N shared" chip so cards stay compact as the catalog grows
 * (the full typed list lives in the email/action tag inserter, where tags are
 * actually inserted). Keep in sync with eventCatalog COMMON.
 */
export const GLOBAL_VARS = new Set<string>([
  "user_name",
  "user_first_name",
  "user_last_name",
  "user_email",
  "company_name",
  "agency_name",
  "imo_name",
  "current_date",
  "date_today",
  "date_tomorrow",
  "date_current_month",
  "date_current_year",
  "app_url",
  "workflow_name",
]);

/** Split an event's variables into the event-specific ones (shown as chips) and a
 *  count of the shared/global ones (folded into a single indicator). */
export function splitVars(names: string[]): {
  specific: string[];
  sharedCount: number;
} {
  const specific: string[] = [];
  let sharedCount = 0;
  for (const n of names) {
    if (GLOBAL_VARS.has(n)) sharedCount += 1;
    else specific.push(n);
  }
  return { specific, sharedCount };
}

/** Accent CSS var per variable type — matches the handoff legend. */
export const VAR_TYPE_ACCENT: Record<VarType, string> = {
  string: "--blue",
  number: "--green",
  UUID: "--violet",
  date: "--amber",
  boolean: "--cyan",
};

/**
 * Events surfaced with a ✦ POPULAR badge — the obvious high-use triggers.
 * Presentational only (the catalog has no "popular" concept).
 */
export const POPULAR_EVENTS = new Set<string>([
  "policy.created",
  "commission.earned",
  "recruit.created",
]);

export interface CategoryMeta {
  key: string;
  label: string;
  /** Accent CSS var name, e.g. "--green". */
  accent: string;
  icon: LucideIcon;
}

/** Per-category display + the rail's display order. */
export const CATEGORY_META: CategoryMeta[] = [
  {
    key: "commission",
    label: "Commissions",
    accent: "--green",
    icon: DollarSign,
  },
  { key: "policy", label: "Policies", accent: "--blue", icon: FileText },
  { key: "lead", label: "Leads", accent: "--amber", icon: MapPin },
  { key: "recruit", label: "Recruiting", accent: "--violet", icon: UserPlus },
  { key: "email", label: "Emails", accent: "--cyan", icon: Mail },
  { key: "user", label: "Users", accent: "--pink", icon: User },
];

export function categoryMeta(key: string): CategoryMeta {
  return (
    CATEGORY_META.find((c) => c.key === key) ?? {
      key,
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : "Other",
      accent: "--mut",
      icon: Zap,
    }
  );
}

/** Order index for a category (unknown categories sort last, stably). */
export function categoryOrder(key: string): number {
  const i = CATEGORY_META.findIndex((c) => c.key === key);
  return i === -1 ? CATEGORY_META.length : i;
}
