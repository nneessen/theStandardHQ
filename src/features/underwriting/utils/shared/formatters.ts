// src/features/underwriting/utils/formatters.ts

import type { HealthTier } from "../../types/underwriting.types";
import { TINT } from "@/components/ui/StatusBadge";

/**
 * Returns Tailwind CSS classes for health tier badge coloring.
 * Uses the shared TINT palette so badges read correctly in both the light
 * theme and the .theme-v2 charcoal dark theme.
 */
export function getHealthTierBadgeColor(tier: string | null): string {
  if (!tier) return TINT.slate;

  switch (tier) {
    case "preferred_plus":
    case "preferred":
      // Best / top-tier health — positive tone
      return TINT.emerald;
    case "standard_plus":
    case "standard":
      // Mid-tier, informational — blue tone
      return TINT.blue;
    case "substandard":
    case "table_rated":
      // Below standard / extra-rated — amber caution
      return TINT.amber;
    case "decline":
      // Declined — negative tone
      return TINT.rose;
    default:
      return TINT.slate;
  }
}

/**
 * Formats a date string for session list display (short format)
 */
export function formatSessionDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Formats a date string for session detail display (long format)
 */
export function formatSessionDateLong(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Formats a number as USD currency
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formats a product type enum value for display
 * e.g., "term_life" -> "Term Life"
 */
export function formatProductType(type: string): string {
  if (!type) return "";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Type guard to check if a value is a valid HealthTier
 */
export function isValidHealthTier(tier: unknown): tier is HealthTier {
  const validTiers = [
    "preferred_plus",
    "preferred",
    "standard_plus",
    "standard",
    "substandard",
    "table_rated",
    "decline",
  ];
  return typeof tier === "string" && validTiers.includes(tier);
}

/**
 * Safely parses JSON array from database field
 */
export function safeParseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value as T[];
  return fallback;
}

/**
 * Safely parses JSON object from database field
 */
export function safeParseJsonObject<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T = {} as T,
): T {
  if (!value) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value as T;
  return fallback;
}
