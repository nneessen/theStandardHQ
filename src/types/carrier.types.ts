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
// FORM & INPUT TYPES
// =============================================================================

export interface NewCarrierForm {
  name: string;
  code?: string;
  is_active?: boolean;
  contact_info?: CarrierContactInfo;
  imo_id?: string;
  advance_cap?: number | null;
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
