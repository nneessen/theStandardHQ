import { Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  MedicationInfo,
  WizardFormData,
} from "../../types/underwriting.types";

interface WizardInfoPanelProps {
  formData: WizardFormData;
}

function formatProductType(productType: string): string {
  return productType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function countMedicationSignals(medications: MedicationInfo): number {
  const booleanFlags = [
    medications.bloodThinners,
    medications.heartMeds,
    medications.insulinUse,
    medications.oralDiabetesMeds,
    medications.antidepressants,
    medications.antianxiety,
    medications.antipsychotics,
    medications.moodStabilizers,
    medications.sleepAids,
    medications.adhdMeds,
    medications.seizureMeds,
    medications.migraineMeds,
    medications.inhalers,
    medications.copdMeds,
    medications.thyroidMeds,
    medications.hormonalTherapy,
    medications.steroids,
    medications.immunosuppressants,
    medications.biologics,
    medications.dmards,
    medications.cancerTreatment,
    medications.antivirals,
    medications.osteoporosisMeds,
    medications.kidneyMeds,
    medications.liverMeds,
  ].filter(Boolean).length;

  const countFlags =
    (medications.bpMedCount > 0 ? 1 : 0) +
    (medications.cholesterolMedCount > 0 ? 1 : 0) +
    (medications.painMedications !== "none" ? 1 : 0);

  return booleanFlags + countFlags;
}

interface SnapshotRowProps {
  label: string;
  value: string | number;
}

function SnapshotRow({ label, value }: SnapshotRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-v2-ring last:border-b-0">
      <span className="text-[11px] uppercase tracking-wider text-v2-ink-muted">
        {label}
      </span>
      <span className="text-xs font-medium text-v2-ink">{value}</span>
    </div>
  );
}

export function WizardInfoPanel({ formData }: WizardInfoPanelProps) {
  const validFaceAmounts = formData.coverage.faceAmounts.filter(
    (amount) => amount >= 10000,
  );
  const medicationSignals = countMedicationSignals(formData.health.medications);
  const conditionsCount = formData.health.conditions.length;
  const profile =
    formData.client.age > 0
      ? `Age ${formData.client.age}${formData.client.state ? `, ${formData.client.state}` : ""}`
      : "—";

  return (
    <aside className="xl:sticky xl:top-4 rounded-v2-md border border-v2-ring bg-v2-card shadow-v2-soft p-4">
      <header className="flex items-center gap-2 pb-3 mb-3 border-b border-v2-ring">
        <Stethoscope className="h-3.5 w-3.5 text-v2-ink-muted" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-v2-ink-muted">
          Case Snapshot
        </h2>
      </header>

      <div className="space-y-0">
        <SnapshotRow
          label="Applicant"
          value={formData.client.name || "Unnamed"}
        />
        <SnapshotRow label="Profile" value={profile} />
        <SnapshotRow label="Conditions" value={conditionsCount} />
        <SnapshotRow label="Med signals" value={medicationSignals} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-ink-muted">
          Coverage targets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {validFaceAmounts.length > 0 ? (
            validFaceAmounts.map((amount) => (
              <Badge
                key={amount}
                variant="secondary"
                className="text-[10px] px-2 py-0.5 font-normal"
              >
                ${amount.toLocaleString()}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-v2-ink-muted">Not set</span>
          )}
        </div>
      </div>

      {formData.coverage.productTypes.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-ink-muted">
            Product types
          </div>
          <div className="flex flex-wrap gap-1.5">
            {formData.coverage.productTypes.map((productType) => (
              <Badge
                key={productType}
                variant="outline"
                className="text-[10px] px-2 py-0.5 font-normal"
              >
                {formatProductType(productType)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default WizardInfoPanel;
