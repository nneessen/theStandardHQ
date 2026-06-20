// src/features/inbound-crm/components/ExistingCoverageSection.tsx
// Repeatable capture of the coverage the caller ALREADY has (informational — not real policies in
// the book). Each row: carrier (combobox/free-text), policy type, monthly premium, how long held,
// and a health note. Stored as clients.intake.existingCoverage[].
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COVERAGE_POLICY_TYPES } from "@/constants/medications";
import { CarrierCombobox } from "./CarrierCombobox";

export interface CoverageItem {
  carrier: string;
  policyType: string;
  monthlyPremium: string;
  coverageLength: string;
  healthNotes: string;
}

export const blankCoverage = (): CoverageItem => ({
  carrier: "",
  policyType: "",
  monthlyPremium: "",
  coverageLength: "",
  healthNotes: "",
});

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
    {children}
  </label>
);

export function ExistingCoverageSection({
  value,
  onChange,
  carriers,
}: {
  value: CoverageItem[];
  onChange: (next: CoverageItem[]) => void;
  carriers: { id: string; name: string }[];
}) {
  const update = (i: number, patch: Partial<CoverageItem>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, blankCoverage()]);

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-v2-ring px-4 py-5 text-center text-sm text-v2-ink-subtle">
          No current coverage recorded. Add what the caller already has.
        </div>
      )}
      {value.map((row, i) => (
        <div
          key={i}
          className="relative rounded-md border border-v2-ring p-3"
          style={{ background: "var(--surface-2)" }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            className="absolute right-1.5 top-1.5 h-7 w-7 p-0 text-v2-ink-subtle hover:text-v2-ink"
            aria-label="Remove coverage"
          >
            <Trash2 size={14} />
          </Button>
          <div className="grid grid-cols-2 gap-3 pr-8">
            <div>
              <Label>Carrier</Label>
              <CarrierCombobox
                carriers={carriers}
                value={{ id: null, name: row.carrier }}
                onChange={(v) => update(i, { carrier: v.name })}
              />
            </div>
            <div>
              <Label>Policy type</Label>
              <Select
                value={row.policyType}
                onValueChange={(v) => update(i, { policyType: v })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE_POLICY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly premium</Label>
              <Input
                value={row.monthlyPremium}
                onChange={(e) => update(i, { monthlyPremium: e.target.value })}
                placeholder="$ / mo"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label>Coverage held</Label>
              <Input
                value={row.coverageLength}
                onChange={(e) => update(i, { coverageLength: e.target.value })}
                placeholder="e.g. 3 yrs"
                className="h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label>Health notes for this policy</Label>
              <Input
                value={row.healthNotes}
                onChange={(e) => update(i, { healthNotes: e.target.value })}
                placeholder="Conditions noted when this policy was written…"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="w-fit gap-1.5"
      >
        <Plus size={15} />
        Add coverage
      </Button>
    </div>
  );
}
