// src/features/inbound-crm/components/clientForm/useClientIntakeForm.ts
// Owns all CLIENT-LEVEL form state for the shared intake form: the flat field state plus the three
// repeatable arrays (existing coverage, beneficiaries, medications). Hydrates from a client record
// (incl. its intake jsonb) and builds the two payloads the save path needs — identity (clients
// table) and intake (clients.intake jsonb). Used by both the inbound call modal and the Clients
// detail page so the surfaces never drift.
import { useEffect, useRef, useState } from "react";
import type { CoverageItem } from "../ExistingCoverageSection";
import type { Beneficiary } from "../BeneficiariesSection";
import { parseJson } from "./format";
import {
  blankClientForm,
  type ClientFormState,
  type ClientIntake,
  type ClientRecordLike,
} from "./types";

export interface UseClientIntakeFormOptions {
  /** Fallbacks from a live call when the client row hasn't captured them yet. */
  fallbackPhone?: string;
  fallbackState?: string;
  fallbackCarrierId?: string;
}

export interface ClientIntakeForm {
  form: ClientFormState;
  setForm: React.Dispatch<React.SetStateAction<ClientFormState>>;
  set: <K extends keyof ClientFormState>(k: K, v: ClientFormState[K]) => void;
  coverage: CoverageItem[];
  setCoverage: React.Dispatch<React.SetStateAction<CoverageItem[]>>;
  beneficiaries: Beneficiary[];
  setBeneficiaries: React.Dispatch<React.SetStateAction<Beneficiary[]>>;
  medications: string[];
  setMedications: React.Dispatch<React.SetStateAction<string[]>>;
  /** Identity payload for clientService.update. */
  buildIdentity: () => {
    name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    address: string;
  };
  /** Rich intake payload for crm_set_client_intake (clients.intake jsonb). */
  buildIntake: () => ClientIntake;
}

export function useClientIntakeForm(
  record: ClientRecordLike | null | undefined,
  opts: UseClientIntakeFormOptions = {},
): ClientIntakeForm {
  const [form, setForm] = useState<ClientFormState>(blankClientForm);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [medications, setMedications] = useState<string[]>([]);

  const set = <K extends keyof ClientFormState>(k: K, v: ClientFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { fallbackPhone, fallbackState, fallbackCarrierId } = opts;

  // Hydrate the form ONLY when the underlying client identity changes (initial load, switching
  // clients, or a new call for a different client) — never on a same-client `record` refetch.
  // A same-client refetch (e.g. "New application" invalidates the record query to refresh the
  // policies rail) must NOT clobber the agent's unsaved edits.
  const lastHydratedId = useRef<string | null | undefined>(undefined);
  // The address as stored, captured at hydrate, so a non-JSON/legacy/NULL address that can't
  // populate the 4 split fields is preserved on save instead of overwritten with empty-field JSON.
  const originalAddress = useRef<string | null>(null);

  useEffect(() => {
    const recordId = record?.id ?? null;
    if (lastHydratedId.current === recordId) return;
    lastHydratedId.current = recordId;
    if (!record) return;
    originalAddress.current = record.address ?? null;
    const addr = parseJson<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
    }>(record.address);
    const intake = (record.intake ?? {}) as ClientIntake;
    setForm({
      name: record?.name ?? "",
      email: record?.email ?? "",
      phone: record?.phone ?? fallbackPhone ?? "",
      dob: record?.date_of_birth ?? "",
      street: addr.street ?? "",
      city: addr.city ?? "",
      state: addr.state ?? fallbackState ?? "",
      zip: addr.zipCode ?? "",
      title: intake.title ?? "",
      wantsMoreCoverageLater: !!intake.wantsMoreCoverageLater,
      writingAgent: intake.writingAgent ?? "",
      lastReceivedAgent: intake.lastReceivedAgent ?? "",
      currentCarrierId: fallbackCarrierId ?? "",
      currentCarrierName: intake.currentCarrierName ?? "",
      reasonForCalling: intake.reasonForCalling ?? "",
      currentCoverageAmount: intake.currentCoverageAmount ?? "",
      currentMonthlyPremium: intake.currentMonthlyPremium ?? "",
      spanishCall: !!intake.spanishCall,
      majorHealthConditions: intake.majorHealthConditions ?? "",
      majorConditionsDetails: intake.majorConditionsDetails ?? "",
      height: intake.height ?? "",
      weight: intake.weight ?? "",
      nicotineUser: !!intake.nicotineUser,
      birthCountry: intake.birthCountry ?? "",
      birthState: intake.birthState ?? "",
    });
    setCoverage(intake.existingCoverage ?? []);
    setBeneficiaries(intake.beneficiaries ?? []);
    setMedications(intake.medications ?? []);
  }, [record, fallbackPhone, fallbackState, fallbackCarrierId]);

  const buildIdentity = () => {
    const addrFieldsEmpty =
      !form.street && !form.city && !form.state && !form.zip;
    return {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      date_of_birth: form.dob || undefined,
      // When the form has no address to write, preserve whatever was stored rather than
      // overwriting it with empty-field JSON (protects legacy non-JSON / NULL addresses).
      address:
        addrFieldsEmpty && originalAddress.current != null
          ? originalAddress.current
          : JSON.stringify({
              street: form.street,
              city: form.city,
              state: form.state,
              zipCode: form.zip,
            }),
    };
  };

  const buildIntake = (): ClientIntake => ({
    title: form.title,
    wantsMoreCoverageLater: form.wantsMoreCoverageLater,
    writingAgent: form.writingAgent,
    lastReceivedAgent: form.lastReceivedAgent,
    reasonForCalling: form.reasonForCalling,
    currentCoverageAmount: form.currentCoverageAmount,
    currentMonthlyPremium: form.currentMonthlyPremium,
    currentCarrierName: form.currentCarrierName,
    spanishCall: form.spanishCall,
    majorHealthConditions: form.majorHealthConditions,
    majorConditionsDetails: form.majorConditionsDetails,
    height: form.height,
    weight: form.weight,
    nicotineUser: form.nicotineUser,
    birthCountry: form.birthCountry,
    birthState: form.birthState,
    existingCoverage: coverage,
    beneficiaries,
    medications,
  });

  return {
    form,
    setForm,
    set,
    coverage,
    setCoverage,
    beneficiaries,
    setBeneficiaries,
    medications,
    setMedications,
    buildIdentity,
    buildIntake,
  };
}
