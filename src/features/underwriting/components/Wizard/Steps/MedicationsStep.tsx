// src/features/underwriting/components/WizardSteps/MedicationsStep.tsx

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MedicationInfo } from "../../../types/underwriting.types";

interface MedicationsStepProps {
  data: MedicationInfo;
  onChange: (updates: Partial<MedicationInfo>) => void;
  errors: Record<string, string>;
}

// Medication categories for organized display
const MEDICATION_CATEGORIES = [
  {
    id: "cardiovascular",
    label: "Cardiovascular",
    items: [
      { key: "bpMedCount", label: "Blood Pressure", type: "count", max: 3 },
      {
        key: "cholesterolMedCount",
        label: "Cholesterol",
        type: "count",
        max: 2,
      },
      { key: "bloodThinners", label: "Blood Thinners", type: "boolean" },
      { key: "heartMeds", label: "Heart Medications", type: "boolean" },
    ],
  },
  {
    id: "diabetes",
    label: "Diabetes",
    items: [
      { key: "insulinUse", label: "Insulin", type: "boolean" },
      { key: "oralDiabetesMeds", label: "Oral Diabetes Meds", type: "boolean" },
    ],
  },
  {
    id: "mental_health",
    label: "Mental Health",
    items: [
      { key: "antidepressants", label: "Antidepressants", type: "boolean" },
      { key: "antianxiety", label: "Anti-Anxiety", type: "boolean" },
      { key: "antipsychotics", label: "Antipsychotics", type: "boolean" },
      { key: "moodStabilizers", label: "Mood Stabilizers", type: "boolean" },
      { key: "sleepAids", label: "Sleep Aids", type: "boolean" },
      { key: "adhdMeds", label: "ADHD Medications", type: "boolean" },
    ],
  },
  {
    id: "pain_neuro",
    label: "Pain & Neurological",
    items: [
      { key: "painMedications", label: "Pain Medications", type: "pain" },
      { key: "seizureMeds", label: "Seizure/Epilepsy", type: "boolean" },
      { key: "migraineMeds", label: "Migraine Prevention", type: "boolean" },
    ],
  },
  {
    id: "respiratory",
    label: "Respiratory",
    items: [
      { key: "inhalers", label: "Inhalers (Asthma)", type: "boolean" },
      { key: "copdMeds", label: "COPD Medications", type: "boolean" },
    ],
  },
  {
    id: "hormonal",
    label: "Thyroid & Hormonal",
    items: [
      { key: "thyroidMeds", label: "Thyroid", type: "boolean" },
      { key: "hormonalTherapy", label: "Hormone Therapy", type: "boolean" },
      { key: "steroids", label: "Corticosteroids", type: "boolean" },
    ],
  },
  {
    id: "immune",
    label: "Immune & Autoimmune",
    items: [
      {
        key: "immunosuppressants",
        label: "Immunosuppressants",
        type: "boolean",
      },
      { key: "biologics", label: "Biologics", type: "boolean" },
      { key: "dmards", label: "DMARDs (Rheumatoid)", type: "boolean" },
    ],
  },
  {
    id: "specialty",
    label: "Specialty",
    items: [
      { key: "cancerTreatment", label: "Cancer Treatment", type: "boolean" },
      { key: "antivirals", label: "Antivirals (HIV/Hep)", type: "boolean" },
      { key: "osteoporosisMeds", label: "Osteoporosis", type: "boolean" },
      { key: "kidneyMeds", label: "Kidney Medications", type: "boolean" },
      { key: "liverMeds", label: "Liver Medications", type: "boolean" },
    ],
  },
] as const;

export default function MedicationsStep({
  data,
  onChange,
  errors: _errors,
}: MedicationsStepProps) {
  // Count selected medications for summary
  const selectedCount = countSelectedMedications(data);

  // Identify high-risk medications for warnings
  const highRiskMeds = getHighRiskMedications(data);

  return (
    <div className="space-y-3 p-1">
      <div className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle">
        Select current medications. All fields optional but impacts product
        eligibility.
      </div>

      {/* Medication Grid - Two columns */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {MEDICATION_CATEGORIES.map((category) => (
          <div
            key={category.id}
            className="space-y-1.5 p-2 bg-v2-canvas dark:bg-v2-card-tinted/30 rounded border border-v2-ring dark:border-v2-ring-strong"
          >
            <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              {category.label}
            </div>
            <div className="space-y-1">
              {category.items.map((item) => (
                <MedicationField
                  key={item.key}
                  item={item}
                  data={data}
                  onChange={onChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* High-risk warnings */}
      {highRiskMeds.length > 0 && (
        <div className="p-2 rounded border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">
            ⚠️ High-impact medications detected:
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400">
            {highRiskMeds.join(", ")}
          </div>
        </div>
      )}

      {/* Summary */}
      <div
        className={cn(
          "p-2 rounded border text-xs",
          selectedCount === 0
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
        )}
      >
        {selectedCount === 0
          ? "✓ No medications reported"
          : `${selectedCount} medication${selectedCount > 1 ? "s" : ""} reported`}
      </div>
    </div>
  );
}

// Individual medication field renderer
interface MedicationFieldProps {
  item: (typeof MEDICATION_CATEGORIES)[number]["items"][number];
  data: MedicationInfo;
  onChange: (updates: Partial<MedicationInfo>) => void;
}

function MedicationField({ item, data, onChange }: MedicationFieldProps) {
  const key = item.key as keyof MedicationInfo;

  if (item.type === "boolean") {
    const checked = data[key] as boolean;
    return (
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={item.key}
          checked={checked}
          onCheckedChange={(c) => onChange({ [key]: c === true })}
          className="h-3.5 w-3.5"
        />
        <Label
          htmlFor={item.key}
          className={cn(
            "text-[11px] cursor-pointer",
            checked
              ? "text-blue-700 dark:text-blue-300 font-medium"
              : "text-v2-ink-muted dark:text-v2-ink-subtle",
          )}
        >
          {item.label}
        </Label>
      </div>
    );
  }

  if (item.type === "count") {
    const value = data[key] as number;
    const maxValue = item.max || 3;
    return (
      <div className="flex items-center gap-2">
        <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle min-w-[80px]">
          {item.label}
        </Label>
        <Select
          value={value.toString()}
          onValueChange={(v) => onChange({ [key]: parseInt(v) })}
        >
          <SelectTrigger className="h-6 text-[10px] w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">None</SelectItem>
            {Array.from({ length: maxValue }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {i + 1 === maxValue ? `${i + 1}+` : (i + 1).toString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (item.type === "pain") {
    const value = data.painMedications;
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          {item.label}
        </Label>
        <Select
          value={value}
          onValueChange={(v) =>
            onChange({
              painMedications: v as MedicationInfo["painMedications"],
            })
          }
        >
          <SelectTrigger className="h-6 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="otc_only">OTC only</SelectItem>
            <SelectItem value="prescribed_non_opioid">Rx non-opioid</SelectItem>
            <SelectItem value="opioid">Opioid</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}

function countSelectedMedications(data: MedicationInfo): number {
  return [
    data.bpMedCount > 0,
    data.cholesterolMedCount > 0,
    data.bloodThinners,
    data.heartMeds,
    data.insulinUse,
    data.oralDiabetesMeds,
    data.antidepressants,
    data.antianxiety,
    data.antipsychotics,
    data.moodStabilizers,
    data.sleepAids,
    data.adhdMeds,
    data.painMedications !== "none",
    data.seizureMeds,
    data.migraineMeds,
    data.inhalers,
    data.copdMeds,
    data.thyroidMeds,
    data.hormonalTherapy,
    data.steroids,
    data.immunosuppressants,
    data.biologics,
    data.dmards,
    data.cancerTreatment,
    data.antivirals,
    data.osteoporosisMeds,
    data.kidneyMeds,
    data.liverMeds,
  ].filter(Boolean).length;
}

function getHighRiskMedications(data: MedicationInfo): string[] {
  const highRisk: string[] = [];
  if (data.insulinUse) highRisk.push("Insulin");
  if (data.painMedications === "opioid") highRisk.push("Opioids");
  if (data.antipsychotics) highRisk.push("Antipsychotics");
  if (data.cancerTreatment) highRisk.push("Cancer Treatment");
  if (data.antivirals) highRisk.push("Antivirals");
  if (data.immunosuppressants) highRisk.push("Immunosuppressants");
  if (data.biologics) highRisk.push("Biologics");
  if (data.kidneyMeds) highRisk.push("Kidney Medications");
  if (data.liverMeds) highRisk.push("Liver Medications");
  return highRisk;
}
