// src/features/inbound-crm/components/clientForm/types.ts
// Shared shapes for the client intake form. The `intake` object is persisted verbatim into the
// `clients.intake` jsonb column (via crm_set_client_intake) — both the inbound call modal and the
// Clients detail page read/write the exact same structure, so the two surfaces stay in parity.
import type { CoverageItem } from "../ExistingCoverageSection";
import type { Beneficiary } from "../BeneficiariesSection";

/** The rich, CLIENT-LEVEL data stored in clients.intake jsonb. (Call disposition — call type /
 *  inquiry carrier / call notes — is NOT here: that belongs to the inbound_calls row and is
 *  managed only by the live-call modal.) */
export interface ClientIntake {
  title?: string;
  wantsMoreCoverageLater?: boolean;
  writingAgent?: string;
  lastReceivedAgent?: string;
  reasonForCalling?: string;
  currentCoverageAmount?: string;
  currentMonthlyPremium?: string;
  currentCarrierName?: string;
  spanishCall?: boolean;
  majorHealthConditions?: string;
  majorConditionsDetails?: string;
  height?: string;
  weight?: string;
  nicotineUser?: boolean;
  birthCountry?: string;
  birthState?: string;
  existingCoverage?: CoverageItem[];
  beneficiaries?: Beneficiary[];
  medications?: string[];
}

/** Flat form state backing the shared tabs: identity (clients table columns) + the client-level
 *  intake fields. `currentCarrierId` is kept for the carrier combobox selection (the modal also
 *  reuses it as the call's inquiry_carrier_id); only `currentCarrierName` is persisted to intake. */
export interface ClientFormState {
  name: string;
  email: string;
  phone: string;
  dob: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  title: string;
  wantsMoreCoverageLater: boolean;
  writingAgent: string;
  lastReceivedAgent: string;
  currentCarrierId: string;
  currentCarrierName: string;
  reasonForCalling: string;
  currentCoverageAmount: string;
  currentMonthlyPremium: string;
  spanishCall: boolean;
  majorHealthConditions: string;
  majorConditionsDetails: string;
  height: string;
  weight: string;
  nicotineUser: boolean;
  birthCountry: string;
  birthState: string;
}

export const blankClientForm: ClientFormState = {
  name: "",
  email: "",
  phone: "",
  dob: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  title: "",
  wantsMoreCoverageLater: false,
  writingAgent: "",
  lastReceivedAgent: "",
  currentCarrierId: "",
  currentCarrierName: "",
  reasonForCalling: "",
  currentCoverageAmount: "",
  currentMonthlyPremium: "",
  spanishCall: false,
  majorHealthConditions: "",
  majorConditionsDetails: "",
  height: "",
  weight: "",
  nicotineUser: false,
  birthCountry: "",
  birthState: "",
};

/** The minimum shape the form hook hydrates from (client row + its intake jsonb). */
export interface ClientRecordLike {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  intake?: ClientIntake | Record<string, unknown> | null;
}
