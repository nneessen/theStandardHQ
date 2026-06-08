// src/types/leads.types.ts
// TypeScript types for the recruiting leads feature

import type { Database } from "./database.types";

// Base type from database
export type RecruitingLead =
  Database["public"]["Tables"]["recruiting_leads"]["Row"];
export type RecruitingLeadInsert =
  Database["public"]["Tables"]["recruiting_leads"]["Insert"];
export type RecruitingLeadUpdate =
  Database["public"]["Tables"]["recruiting_leads"]["Update"];

// Lead status enum
export type LeadStatus = "pending" | "accepted" | "rejected" | "expired";

// Availability options
export type LeadAvailability = "full_time" | "part_time" | "exploring";

// Insurance experience levels
export type LeadInsuranceExperience =
  | "none"
  | "less_than_1_year"
  | "1_to_3_years"
  | "3_plus_years";

// Income goal options (frontend use)
export type LeadIncomeGoal =
  | "$50k-75k"
  | "$75k-100k"
  | "$100k-150k"
  | "$150k+"
  | "";

// Product specialty options for licensed agents
export type LeadSpecialty =
  | "mortgage_protection"
  | "veterans"
  | "advanced_markets"
  | "final_expense"
  | "iuls_terms"
  | "other";

// Public form submission input
export interface SubmitLeadInput {
  recruiterSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  availability: LeadAvailability;
  incomeGoals?: string;
  whyInterested: string;
  insuranceExperience: LeadInsuranceExperience;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerUrl?: string;
  isLicensed?: boolean;
  currentImoName?: string;
  specialties?: LeadSpecialty[];
  tcpaConsentText?: string;
  tcpaConsentVersion?: string;
}

// RPC response for submit_recruiting_lead
export interface SubmitLeadResponse {
  success: boolean;
  lead_id?: string;
  error?: string;
  message?: string;
  /** True when the submission was rejected by the per-recruiter/IP rate limit
   *  (submit_recruiting_lead returns this flag) so the form can show a distinct
   *  "slow down" message instead of a generic error. */
  rate_limited?: boolean;
}

// Public recruiter info for landing page
export interface PublicRecruiterInfo {
  recruiter_id: string;
  recruiter_first_name: string | null;
  recruiter_last_name: string | null;
  imo_name: string | null;
  imo_logo_url: string | null;
  imo_primary_color: string | null;
  imo_description: string | null;
  calendly_url: string | null;
  is_active: boolean;
}

// Lead with enriched data for display
export interface EnrichedLead extends RecruitingLead {
  recruiter_name?: string;
  recruiter_email?: string;
  days_since_submitted?: number;
}

// Leads filter options
export interface LeadsFilters {
  status?: LeadStatus[];
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

// Paginated leads response
export interface PaginatedLeadsResponse {
  leads: EnrichedLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Leads stats
export interface LeadsStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  this_week: number;
  this_month: number;
}

// RPC response for accept/reject
export interface LeadActionResponse {
  success: boolean;
  recruit_id?: string;
  error?: string;
  message?: string;
}

// Display label mappings
export const AVAILABILITY_LABELS: Record<LeadAvailability, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  exploring: "Just exploring",
};

export const EXPERIENCE_LABELS: Record<LeadInsuranceExperience, string> = {
  none: "No experience",
  less_than_1_year: "Less than 1 year",
  "1_to_3_years": "1-3 years",
  "3_plus_years": "3+ years",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  pending: "Pending Review",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export const STATUS_COLORS: Record<
  LeadStatus,
  { bg: string; text: string; border: string }
> = {
  pending: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  accepted: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  rejected: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  expired: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-500 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
  },
};

// Income goal options for form
export const INCOME_GOAL_OPTIONS = [
  { value: "", label: "Select income goal (optional)" },
  { value: "$50k-75k", label: "$50,000 - $75,000" },
  { value: "$75k-100k", label: "$75,000 - $100,000" },
  { value: "$100k-150k", label: "$100,000 - $150,000" },
  { value: "$150k+", label: "$150,000+" },
] as const;

// Product specialty options for form (multi-select)
export const SPECIALTY_OPTIONS: { value: LeadSpecialty; label: string }[] = [
  { value: "mortgage_protection", label: "Mortgage Protection" },
  { value: "veterans", label: "Veterans/Military" },
  { value: "advanced_markets", label: "Advanced Markets" },
  { value: "final_expense", label: "Final Expense" },
  { value: "iuls_terms", label: "IULs/Terms" },
  { value: "other", label: "Other" },
];

// Specialty labels for display
export const SPECIALTY_LABELS: Record<LeadSpecialty, string> = {
  mortgage_protection: "Mortgage Protection",
  veterans: "Veterans/Military",
  advanced_markets: "Advanced Markets",
  final_expense: "Final Expense",
  iuls_terms: "IULs/Terms",
  other: "Other",
};
