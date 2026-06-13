// src/types/carrier.types.ts
// Carrier type definitions - DATABASE-FIRST pattern

import type { Database } from "./database.types";

// =============================================================================
// DATABASE-DERIVED TYPES (Source of Truth)
// =============================================================================

/** Raw database row type for carriers table */
export type CarrierRow = Database["public"]["Tables"]["carriers"]["Row"];

/** Insert type for creating new carriers */
export type CarrierInsert = Database["public"]["Tables"]["carriers"]["Insert"];

/** Update type for modifying carriers */
export type CarrierUpdate = Database["public"]["Tables"]["carriers"]["Update"];

// =============================================================================
// CARRIER INTERFACE
// =============================================================================

/**
 * Carrier - extends database row with typed contact_info
 */
export interface Carrier extends Omit<CarrierRow, "contact_info"> {
  contact_info: CarrierContactInfo | null;
}

/**
 * Typed contact info structure (stored as JSON in database)
 */
export interface CarrierContactInfo {
  email?: string;
  phone?: string;
  website?: string;
  rep_name?: string;
  rep_email?: string;
  rep_phone?: string;
}

// =============================================================================
// CONTRACTING INSTRUCTIONS ("what to expect")
// =============================================================================

/**
 * How an agent contracts with a carrier. Stored on carriers.contracting_metadata JSONB.
 * Distinct from the recruiting-checklist CarrierContractingMetadata in recruiting.types.ts
 * (which configures a checklist item, not the carrier itself).
 */
export type CarrierContractingMethod =
  | "surelc"
  | "email"
  | "portal"
  | "paper"
  | "other";

export interface CarrierContractingInstructions {
  method?: CarrierContractingMethod;
  instructions?: string;
  portal_url?: string;
  contact_email?: string;
  processing_time_days?: number;
}

export const CARRIER_CONTRACTING_METHOD_LABEL: Record<
  CarrierContractingMethod,
  string
> = {
  surelc: "SureLC",
  email: "Email request",
  portal: "Carrier portal",
  paper: "Paper application",
  other: "Other",
};

/** Safely parse carriers.contracting_metadata JSON into typed instructions (null if empty). */
export function parseCarrierContractingInstructions(
  raw: unknown,
): CarrierContractingInstructions | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const out: CarrierContractingInstructions = {};
  if (
    m.method === "surelc" ||
    m.method === "email" ||
    m.method === "portal" ||
    m.method === "paper" ||
    m.method === "other"
  ) {
    out.method = m.method;
  }
  if (typeof m.instructions === "string" && m.instructions.trim())
    out.instructions = m.instructions;
  if (typeof m.portal_url === "string" && m.portal_url.trim())
    out.portal_url = m.portal_url;
  if (typeof m.contact_email === "string" && m.contact_email.trim())
    out.contact_email = m.contact_email;
  if (typeof m.processing_time_days === "number" && m.processing_time_days > 0)
    out.processing_time_days = m.processing_time_days;
  return Object.keys(out).length > 0 ? out : null;
}

// =============================================================================
// FORM & INPUT TYPES
// =============================================================================

export interface NewCarrierForm {
  name: string;
  code?: string;
  is_active?: boolean;
  contact_info?: CarrierContactInfo;
  imo_id?: string;
  advance_cap?: number | null;
  /** Per-carrier "what to expect" contracting instructions (carriers.contracting_metadata). */
  contracting_metadata?: CarrierContractingInstructions | null;
}

export interface UpdateCarrierForm extends Partial<NewCarrierForm> {
  id: string;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface CarrierStats {
  carrierId: string;
  carrierName: string;
  totalCommissions: number;
  totalPremiums: number;
  policyCount: number;
  averageCommissionRate: number;
  averagePremium: number;
}

// =============================================================================
// DEFAULT DATA
// =============================================================================

// NOTE: is this normal to hardcode these carriers in this const? should this not be coming from the actual database table from carriers?
export const DEFAULT_CARRIERS: Array<
  Omit<Carrier, "id" | "created_at" | "updated_at" | "imo_id">
> = [
  {
    name: "United Home Life",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "Legal & General America",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "American Home Life",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "SBLI",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "Baltimore Life",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "John Hancock",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "American-Amicable Group",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "Corebridge Financial",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "Transamerica",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "ELCO Mutual",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
  {
    name: "Kansas City Life",
    code: null,
    is_active: true,
    commission_structure: null,
    contact_info: null,
    advance_cap: null,
    contracting_metadata: null,
  },
];
