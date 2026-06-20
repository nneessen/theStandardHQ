// Client type definitions for the insurance sales tracker application

import { Database } from "./database.types";
import { Policy } from "./policy.types";

// Extract types from database schema
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

// Client status enum - matches database constraints
export type ClientStatus = "active" | "inactive" | "lead";

// Core client interface with all fields from database
// TODO: With the new inbound feature and the new client's page and the pop-up dialogue that pops up when an inbound call comes through from the platform that takes inbound calls, do we need to update this interface for the client to include additional fields to identify who the client belongs to (PCID, etc.)? Which would be found in Docs Inbound Feature.
export interface Client {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null; // ISO date string format
  notes: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

// Data for creating a new client (used in forms)
export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string; // ISO date string
  notes?: string;
  status?: ClientStatus;
  // Multi-tenant fields (for data isolation)
  user_id?: string; // Owner of the client
  imo_id?: string | null;
  agency_id?: string | null;
}

// Data for updating an existing client (all fields optional)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdateClientData extends Partial<CreateClientData> {}

// Client with aggregated statistics (from database function)
export interface ClientWithStats extends Client {
  policy_count: number;
  active_policy_count: number;
  total_premium: number;
  avg_premium: number;
  last_policy_date: string | null;
}

// Downline/Team client with owner info (from hierarchy functions)
export interface DownlineClientWithStats extends ClientWithStats {
  owner_name: string; // Name of the agent who owns this client
}

// View mode for client list
export type ClientViewMode = "own" | "team" | "imo";

// Client with full policy details for detail view
export interface ClientWithPolicies extends Client {
  policies: Policy[];
  stats: {
    total: number;
    active: number;
    lapsed: number;
    cancelled: number;
    totalPremium: number;
    avgPremium: number;
    firstPolicyDate: string | null;
    lastPolicyDate: string | null;
    avgPolicyAge: number; // in months
  };
}

// Filter options for client queries
export interface ClientFilters {
  searchTerm?: string; // Search in name, email, phone
  status?: ClientStatus | "all";
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasPolicies?: boolean;
  hasActivePolicies?: boolean;
  minAge?: number; // Filter by client age
  maxAge?: number;
  minPremium?: number; // Filter by total premium
  maxPremium?: number;
}

// Sort configuration for client lists
export interface ClientSortConfig {
  field:
    | "name"
    | "email"
    | "created_at"
    | "policy_count"
    | "total_premium"
    | "last_policy_date"
    | "date_of_birth"
    | "status";
  direction: "asc" | "desc";
}

// Client option for select dropdowns
export interface ClientSelectOption {
  value: string; // client ID
  label: string; // client name
  email?: string;
  phone?: string;
  policyCount?: number;
  status?: ClientStatus;
  age?: number;
}

// Client value segment for analytics
export type ClientSegment =
  | "high_value"
  | "medium_value"
  | "low_value"
  | "at_risk"
  | "inactive";

// Client with segment analysis
export interface ClientWithSegment extends ClientWithStats {
  segment: ClientSegment;
  segmentReason: string;
  recommendedAction?: string;
  retentionScore?: number; // 0-100
  lifetimeValue?: number;
}

// Client import data (for bulk imports)
export interface ClientImportData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  notes?: string;
  external_id?: string; // For tracking imports
}

// Client export data (for CSV/Excel exports)
export interface ClientExportData extends Client {
  age?: number;
  policy_count: number;
  active_policy_count: number;
  total_premium: number;
  avg_premium: number;
  last_policy_date: string | null;
  lifetime_value: number;
}

// Client activity log entry
export interface ClientActivity {
  id: string;
  client_id: string;
  activity_type:
    | "created"
    | "updated"
    | "policy_added"
    | "policy_cancelled"
    | "contacted"
    | "note_added";
  activity_date: string;
  description: string;
  user_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metadata shape
  metadata?: Record<string, any>;
}

// Client communication preference
export interface ClientCommunicationPreference {
  client_id: string;
  preferred_contact_method: "email" | "phone" | "text" | "mail";
  best_time_to_contact?: string;
  do_not_contact?: boolean;
  communication_frequency?: "weekly" | "monthly" | "quarterly" | "annually";
}

// Helper function to calculate age from date of birth
export function calculateAge(
  dateOfBirth: string | null | undefined,
): number | null {
  if (!dateOfBirth) return null;

  try {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    // Check for valid date
    if (isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

// Helper function to format client name for display
export function formatClientName(client: Partial<Client>): string {
  if (!client.name) return "Unknown Client";
  return client.name.trim();
}

// Helper function to format client contact info
export function formatClientContact(client: Partial<Client>): string {
  const parts: string[] = [];
  if (client.email) parts.push(client.email);
  if (client.phone) parts.push(client.phone);
  return parts.join(" | ") || "No contact info";
}

// Helper function to get client initials for avatars
export function getClientInitials(name: string): string {
  if (!name) return "?";

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Helper function to determine client segment based on stats
export function calculateClientSegment(stats: ClientWithStats): ClientSegment {
  const { policy_count, active_policy_count, total_premium } = stats;

  // Inactive clients
  if (active_policy_count === 0) {
    return policy_count > 0 ? "at_risk" : "inactive";
  }

  // Value-based segmentation
  if (total_premium >= 10000) return "high_value";
  if (total_premium >= 5000) return "medium_value";
  if (active_policy_count > 0) return "low_value";

  return "inactive";
}

// Helper function to validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate phone number (US format)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

// Helper function to format phone number
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // Return original if not 10 digits
  return phone;
}

// Helper function to get age group for analytics
export function getAgeGroup(age: number | null): string {
  if (age === null) return "Unknown";
  if (age < 30) return "Under 30";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70+";
}

// Helper function to check if client is eligible for a product based on age
export function isClientEligibleForProduct(
  clientAge: number | null,
  productMinAge: number | null,
  productMaxAge: number | null,
): boolean {
  if (clientAge === null) return false;
  if (productMinAge !== null && clientAge < productMinAge) return false;
  if (productMaxAge !== null && clientAge > productMaxAge) return false;
  return true;
}

// Type guard to check if object is a Client
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- type guard requires any
export function isClient(obj: any): obj is Client {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.created_at === "string"
  );
}

// Type guard to check if object has stats
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- type guard requires any
export function hasClientStats(obj: any): obj is ClientWithStats {
  return (
    isClient(obj) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type assertion for guard
    typeof (obj as any).policy_count === "number" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type assertion for guard
    typeof (obj as any).total_premium === "number"
  );
}
