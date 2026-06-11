// src/types/prospect.types.ts
// TypeScript types for the recruiting "Prospects" feature — lightweight,
// agent-owned follow-up contacts (no auth account, no email). Distinct from the
// user_profiles "prospect" onboarding_status used for created-but-unenrolled recruits.

import type { Database } from "./database.types";

// Base types from database
export type Prospect = Database["public"]["Tables"]["prospects"]["Row"];
export type ProspectInsert =
  Database["public"]["Tables"]["prospects"]["Insert"];
export type ProspectUpdate =
  Database["public"]["Tables"]["prospects"]["Update"];

// Prospect status lifecycle (enforced in TypeScript, not a DB enum)
export type ProspectStatus =
  | "new"
  | "contacted"
  | "following_up"
  | "not_interested"
  | "converted";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "new",
  "contacted",
  "following_up",
  "not_interested",
  "converted",
];

// Statuses a user may pick manually. "converted" is terminal and system-set —
// it is only ever assigned by the Convert→recruit flow (which also stamps
// converted_recruit_id), never chosen by hand.
export const SELECTABLE_PROSPECT_STATUSES: ProspectStatus[] =
  PROSPECT_STATUSES.filter((s) => s !== "converted");

// Input for creating a prospect. owner_id/imo_id/agency_id are derived from the
// caller's tenant context in the service, so callers only supply contact fields.
export interface CreateProspectInput {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  source?: string | null;
  status?: ProspectStatus;
  notes?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
}

// Input for updating a prospect (all fields optional)
export interface UpdateProspectInput {
  first_name?: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  source?: string | null;
  status?: ProspectStatus;
  notes?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  converted_recruit_id?: string | null;
  converted_at?: string | null;
}

// Filter options for the prospect list
export interface ProspectFilters {
  status?: ProspectStatus[];
  search?: string;
}

// Display label mappings
export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  following_up: "Following up",
  not_interested: "Not interested",
  converted: "Converted",
};

// Tailwind class triplets per status (mirrors leads.types.ts STATUS_COLORS shape)
export const PROSPECT_STATUS_COLORS: Record<
  ProspectStatus,
  { bg: string; text: string; border: string }
> = {
  new: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-800",
  },
  contacted: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  following_up: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  not_interested: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-500 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
  },
  converted: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};
