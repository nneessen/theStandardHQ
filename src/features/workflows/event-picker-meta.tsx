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
