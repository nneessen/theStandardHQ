// src/types/custom-domain.types.ts
// Custom Domain Types
// Matches database schema and Edge Function responses

import type { Database } from "./database.types";
import type { RecruitingPageTheme } from "./recruiting-theme.types";

// Database row type
export type CustomDomain =
  Database["public"]["Tables"]["custom_domains"]["Row"];
export type CustomDomainInsert =
  Database["public"]["Tables"]["custom_domains"]["Insert"];
export type CustomDomainStatus =
  Database["public"]["Enums"]["custom_domain_status"];

// DNS Instructions from Edge Function
export interface DnsInstructions {
  cname: {
    name: string;
    value: string;
  };
  txt: {
    name: string;
    nameRelative: string;
    value: string;
  };
}

// Edge Function Response Types
export interface CreateDomainResponse {
  domain: CustomDomain;
  dns_instructions: DnsInstructions;
  message: string;
}

export interface VerifyDomainResponse {
  verified: boolean;
  domain?: CustomDomain;
  error?: string;
  found_records?: string[];
  expected_record?: {
    name: string;
    name_relative: string;
    value: string;
  };
  message: string;
}

export interface ProvisionDomainResponse {
  status: CustomDomainStatus;
  domain: CustomDomain;
  vercel_verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  message: string;
}

export interface DomainDiagnostics {
  dns_configured: boolean;
  cnames_found: string[];
  misconfigured: boolean | null;
  vercel_verified: boolean | null;
  vercel_configured: boolean | null;
  configured_by: string | null;
}

export interface DomainStatusResponse {
  status: CustomDomainStatus;
  domain: CustomDomain;
  vercel_verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  diagnostics?: DomainDiagnostics;
  message: string;
}

export interface DeleteDomainResponse {
  deleted: boolean;
  hostname: string;
  message: string;
}

export interface ResolveDomainResponse {
  recruiter_slug: string;
  theme?: RecruitingPageTheme;
}

// UI State Types
export interface CustomDomainContextValue {
  customDomainSlug: string | null;
  isCustomDomain: boolean;
  isLoading: boolean;
  error: string | null;
  theme: RecruitingPageTheme | null;
}

// Status display helpers
export const STATUS_LABELS: Record<CustomDomainStatus, string> = {
  draft: "Draft",
  pending_dns: "Pending DNS",
  verified: "Verified",
  provisioning: "Provisioning SSL",
  active: "Active",
  error: "Error",
};

export const STATUS_COLORS: Record<CustomDomainStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  pending_dns: "bg-amber-100 text-amber-700",
  verified: "bg-blue-100 text-blue-700",
  provisioning: "bg-purple-100 text-purple-700",
  active: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};
