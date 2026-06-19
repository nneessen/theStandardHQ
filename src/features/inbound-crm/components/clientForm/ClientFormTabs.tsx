// src/features/inbound-crm/components/clientForm/ClientFormTabs.tsx
// The shared 4-tab client record form (Client · Call Details · Coverage · Health). Rendered by BOTH
// the inbound call modal and the Clients detail page so the two surfaces capture exactly the same
// data. Layout-agnostic: `fill` makes the tabs stretch to a flex parent (the full-screen modal);
// without it the tabs lay out at natural height inside a normal scrolling page. Call-disposition
// fields (call type / call notes) are NOT part of this form — the modal injects them via the
// optional slots so the shared fields stay client-level.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CarrierCombobox, type CarrierChoice } from "../CarrierCombobox";
import {
  ExistingCoverageSection,
  type CoverageItem,
} from "../ExistingCoverageSection";
import {
  BeneficiariesSection,
  type Beneficiary,
} from "../BeneficiariesSection";
import { MedicationsField } from "../MedicationsField";
import { FieldLabel, TextField, CheckField, Panel } from "./primitives";
import type { ClientFormState } from "./types";

export interface ClientFormTabsProps {
  form: ClientFormState;
  set: <K extends keyof ClientFormState>(k: K, v: ClientFormState[K]) => void;
  coverage: CoverageItem[];
  setCoverage: (next: CoverageItem[]) => void;
  beneficiaries: Beneficiary[];
  setBeneficiaries: (next: Beneficiary[]) => void;
  medications: string[];
  setMedications: (next: string[]) => void;
  carriers: { id: string; name: string }[];
  /** Stretch tabs to a flex parent (full-screen modal). Off = natural height (page). */
  fill?: boolean;
  defaultValue?: string;
  /** Modal-only: the call-type field, prepended inside the Call Details panel. */
  callTypeSlot?: React.ReactNode;
  /** Modal-only: a right-hand panel on the Call Details tab (e.g. call notes). */
  callNotesSlot?: React.ReactNode;
  /** Title of the Call Details left panel (modal: "Initial Call Details"). */
  callPanelTitle?: string;
}

export function ClientFormTabs({
  form,
  set,
  coverage,
  setCoverage,
  beneficiaries,
  setBeneficiaries,
  medications,
  setMedications,
  carriers,
  fill = false,
  defaultValue = "client",
  callTypeSlot,
  callNotesSlot,
  callPanelTitle = "Initial Call Details",
}: ClientFormTabsProps) {
  const hf = fill ? "h-full " : "";
  const rootCls = fill ? "flex min-h-0 flex-1 flex-col" : "flex flex-col";
  const scrollCls = fill
    ? "min-h-0 flex-1 overflow-y-auto px-6 py-5"
    : "px-6 py-5";
  const tabCls = fill ? "mt-0 h-full" : "mt-0";

  return (
    <Tabs defaultValue={defaultValue} className={rootCls}>
      <TabsList
        className="w-full justify-start gap-1 px-6"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <TabsTrigger value="client" className="data-[state=active]:bg-v2-card">
          Client
        </TabsTrigger>
        <TabsTrigger value="call" className="data-[state=active]:bg-v2-card">
          Call Details
        </TabsTrigger>
        <TabsTrigger
          value="coverage"
          className="data-[state=active]:bg-v2-card"
        >
          Coverage
        </TabsTrigger>
        <TabsTrigger value="health" className="data-[state=active]:bg-v2-card">
          Health
        </TabsTrigger>
      </TabsList>

      <div className={scrollCls}>
        {/* CLIENT */}
        <TabsContent value="client" className={tabCls}>
          <div
            className={`${hf}grid gap-4 xl:grid-cols-2${
              fill ? " xl:[grid-template-rows:auto_1fr]" : ""
            }`}
          >
            <Panel title="Identity">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                />
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={(v) => set("title", v)}
                  placeholder="Mr. / Mrs. / Ms."
                />
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                />
                <TextField
                  label="Email"
                  value={form.email}
                  onChange={(v) => set("email", v)}
                />
                <TextField
                  label="Date of birth"
                  type="date"
                  value={form.dob}
                  onChange={(v) => set("dob", v)}
                />
                <CheckField
                  label="Wants more coverage later"
                  checked={form.wantsMoreCoverageLater}
                  onChange={(v) => set("wantsMoreCoverageLater", v)}
                />
              </div>
            </Panel>
            <Panel title="Servicing">
              <div className="grid gap-3">
                <TextField
                  label="Writing agent"
                  value={form.writingAgent}
                  onChange={(v) => set("writingAgent", v)}
                />
                <TextField
                  label="Last received agent"
                  value={form.lastReceivedAgent}
                  onChange={(v) => set("lastReceivedAgent", v)}
                />
              </div>
            </Panel>
            <Panel title="Address">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Street"
                  value={form.street}
                  onChange={(v) => set("street", v)}
                  className="col-span-2"
                />
                <TextField
                  label="City"
                  value={form.city}
                  onChange={(v) => set("city", v)}
                />
                <TextField
                  label="State"
                  value={form.state}
                  onChange={(v) => set("state", v)}
                />
                <TextField
                  label="ZIP"
                  value={form.zip}
                  onChange={(v) => set("zip", v)}
                />
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* CALL DETAILS */}
        <TabsContent value="call" className={tabCls}>
          <div
            className={`${hf}grid gap-4${
              callNotesSlot ? " xl:grid-cols-2" : ""
            }`}
          >
            <Panel title={callPanelTitle}>
              <div className="grid grid-cols-2 gap-3">
                {callTypeSlot}
                <div>
                  <FieldLabel>Current carrier</FieldLabel>
                  <CarrierCombobox
                    carriers={carriers}
                    value={{
                      id: form.currentCarrierId || null,
                      name:
                        form.currentCarrierName ||
                        carriers.find((c) => c.id === form.currentCarrierId)
                          ?.name ||
                        "",
                    }}
                    onChange={(v: CarrierChoice) => {
                      set("currentCarrierId", v.id ?? "");
                      set("currentCarrierName", v.name);
                    }}
                  />
                </div>
                <TextField
                  label="Current coverage amount"
                  value={form.currentCoverageAmount}
                  onChange={(v) => set("currentCoverageAmount", v)}
                  placeholder="$ face amount"
                />
                <TextField
                  label="Current monthly premium"
                  value={form.currentMonthlyPremium}
                  onChange={(v) => set("currentMonthlyPremium", v)}
                  placeholder="$ / mo"
                />
                <CheckField
                  label="Spanish call?"
                  checked={form.spanishCall}
                  onChange={(v) => set("spanishCall", v)}
                />
                <div className="col-span-2">
                  <FieldLabel>Reason for calling</FieldLabel>
                  <Textarea
                    value={form.reasonForCalling}
                    onChange={(e) => set("reasonForCalling", e.target.value)}
                    placeholder="Cash surrender, consolidation, more coverage…"
                    className="min-h-[120px] text-sm"
                  />
                </div>
              </div>
            </Panel>
            {callNotesSlot}
          </div>
        </TabsContent>

        {/* COVERAGE & BENEFICIARIES */}
        <TabsContent value="coverage" className={tabCls}>
          <div className={`${hf}grid gap-4 xl:grid-cols-2`}>
            <Panel title="Current Coverage">
              <ExistingCoverageSection
                value={coverage}
                onChange={setCoverage}
                carriers={carriers}
              />
            </Panel>
            <Panel title="Beneficiaries">
              <BeneficiariesSection
                value={beneficiaries}
                onChange={setBeneficiaries}
              />
            </Panel>
          </div>
        </TabsContent>

        {/* HEALTH */}
        <TabsContent value="health" className={tabCls}>
          <div className={`flex ${hf}flex-col gap-4`}>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Health Details">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FieldLabel>Major health conditions</FieldLabel>
                    <Textarea
                      value={form.majorHealthConditions}
                      onChange={(e) =>
                        set("majorHealthConditions", e.target.value)
                      }
                      placeholder="Diabetes, heart, cancer, COPD…"
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <FieldLabel>Conditions details / date of dx</FieldLabel>
                    <Textarea
                      value={form.majorConditionsDetails}
                      onChange={(e) =>
                        set("majorConditionsDetails", e.target.value)
                      }
                      placeholder="Diagnosis dates, medications, severity…"
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  <TextField
                    label="Height"
                    value={form.height}
                    onChange={(v) => set("height", v)}
                    placeholder={`5' 10"`}
                  />
                  <TextField
                    label="Weight"
                    value={form.weight}
                    onChange={(v) => set("weight", v)}
                    placeholder="lbs"
                  />
                  <CheckField
                    label="Nicotine user"
                    checked={form.nicotineUser}
                    onChange={(v) => set("nicotineUser", v)}
                  />
                </div>
              </Panel>
              <Panel title="Birthplace & Tobacco">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Birth country"
                    value={form.birthCountry}
                    onChange={(v) => set("birthCountry", v)}
                    placeholder="United States"
                  />
                  <TextField
                    label="Birth state"
                    value={form.birthState}
                    onChange={(v) => set("birthState", v)}
                  />
                </div>
              </Panel>
            </div>
            <Panel title="Common Medications">
              <MedicationsField value={medications} onChange={setMedications} />
            </Panel>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
