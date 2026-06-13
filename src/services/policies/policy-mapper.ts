// src/services/policies/policy-mapper.ts
// DB-row -> domain-entity mapping for policies, extracted from PolicyRepository.
//
// Previously this logic lived inside a single `any`-typed `transformFromDB`
// method that also did address-JSON parsing and age math inline. It is now
// typed against the generated `PolicyRow` and split into small pure helpers.

import type { Product } from "../../types/product.types";
import { calculateAge } from "../../types/client.types";
import type {
  Policy,
  PolicyClient,
  PolicyLifecycleStatus,
  PolicyRow,
  PolicyStatus,
} from "../../types/policy.types";

/** Shape of the joined `clients` row (only the columns we select). */
export interface JoinedClient {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  // address is JSONB on the client; older rows stored it as a JSON string.
  address?: string | Record<string, unknown> | null;
  date_of_birth?: string | null;
  state?: string | null;
}

/**
 * A policy row as returned by our reads: the generated table row plus any of
 * the optional joins (`clients`, legacy `client`, `products`, `commissions`).
 */
export type PolicyDbRecord = PolicyRow & {
  clients?: JoinedClient | null;
  client?: PolicyClient | null;
  products?: Product | null;
  commissions?: unknown;
};

/** Parsed subset of a client's legacy embedded-address JSON. */
interface ParsedAddress {
  state?: string;
  age?: number;
  street?: string;
  city?: string;
  zipCode?: string;
}

/**
 * Older clients embedded `state`/`age`/`street`/... inside the JSONB `address`
 * column (sometimes as a JSON string). Parse it defensively; never throw.
 */
export function parseClientAddress(
  address: string | Record<string, unknown> | null | undefined,
): ParsedAddress {
  if (!address) return {};
  if (typeof address === "string") {
    try {
      return JSON.parse(address) as ParsedAddress;
    } catch {
      return {}; // malformed legacy data — fall back to defaults
    }
  }
  return address as ParsedAddress;
}

/** Build the camelCase client object from whichever join shape is present. */
function mapClient(record: PolicyDbRecord): PolicyClient {
  if (record.clients) {
    const address = parseClientAddress(record.clients.address);
    return {
      id: record.clients.id || undefined,
      name: record.clients.name || "Unknown",
      // Prefer the dedicated clients.state column; fall back to the legacy
      // address-embedded state for older clients that only stored it there.
      state: record.clients.state || address.state || "Unknown",
      // Calculated age from DOB, falling back to legacy address.age.
      age: calculateAge(record.clients.date_of_birth) || address.age || 0,
      dateOfBirth: record.clients.date_of_birth || undefined,
      email: record.clients.email ?? undefined,
      phone: record.clients.phone ?? undefined,
      street: address.street || undefined,
      city: address.city || undefined,
      zipCode: address.zipCode || undefined,
    };
  }

  // Backward-compat: a legacy embedded `client` object.
  if (record.client) return record.client;

  // No client data at all — minimal placeholder.
  return { name: "Unknown", state: "Unknown", age: 0 };
}

/** Coerce a DB numeric/string/null premium-style value to a number (0 if absent). */
export function toNumber(value: number | string | null | undefined): number {
  return value != null ? parseFloat(String(value)) : 0;
}

/** Map a raw policy DB record (with optional joins) to the `Policy` entity. */
export function mapPolicyFromDb(record: PolicyDbRecord): Policy {
  return {
    id: record.id,
    policyNumber: record.policy_number,
    status: record.status as PolicyStatus,
    lifecycleStatus: (record.lifecycle_status as PolicyLifecycleStatus) || null,
    client: mapClient(record),
    carrierId: record.carrier_id,
    productId: record.product_id ?? undefined,
    userId: record.user_id ?? undefined,
    product: record.product,
    productDetails: record.products || undefined,
    submitDate: record.submit_date || undefined,
    effectiveDate: record.effective_date,
    termLength: record.term_length ?? undefined,
    expirationDate: record.expiration_date || undefined,
    annualPremium: toNumber(record.annual_premium),
    monthlyPremium: toNumber(record.monthly_premium),
    paymentFrequency: record.payment_frequency as Policy["paymentFrequency"],
    commissionPercentage: toNumber(record.commission_percentage),
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
    // BaseEntity-compat aliases; DB returns ISO strings (not Date objects).
    created_at: record.created_at ?? undefined,
    updated_at: record.updated_at ?? undefined,
    createdBy: (record as { created_by?: string }).created_by,
    notes: record.notes ?? undefined,
    leadPurchaseId: record.lead_purchase_id,
    leadSourceType: record.lead_source_type,
  };
}
