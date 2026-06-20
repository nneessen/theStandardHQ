// src/features/inbound-crm/components/BeneficiariesSection.tsx
// Repeatable beneficiary capture (primary + contingent). Stored as clients.intake.beneficiaries[].
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

export interface Beneficiary {
  name: string;
  relationship: string;
  percentage: string;
  type: "primary" | "contingent";
}

export const blankBeneficiary = (): Beneficiary => ({
  name: "",
  relationship: "",
  percentage: "",
  type: "primary",
});

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
    {children}
  </label>
);

export function BeneficiariesSection({
  value,
  onChange,
}: {
  value: Beneficiary[];
  onChange: (next: Beneficiary[]) => void;
}) {
  const update = (i: number, patch: Partial<Beneficiary>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, blankBeneficiary()]);

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-v2-ring px-4 py-5 text-center text-sm text-v2-ink-subtle">
          No beneficiaries yet. Add primary and contingent beneficiaries.
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
            aria-label="Remove beneficiary"
          >
            <Trash2 size={14} />
          </Button>
          <div className="grid grid-cols-2 gap-3 pr-8">
            <div>
              <Label>Full name</Label>
              <Input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label>Relationship</Label>
              <Input
                value={row.relationship}
                onChange={(e) => update(i, { relationship: e.target.value })}
                placeholder="Spouse, child…"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label>Share %</Label>
              <Input
                value={row.percentage}
                onChange={(e) => update(i, { percentage: e.target.value })}
                placeholder="e.g. 50"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={row.type}
                onValueChange={(v) =>
                  update(i, { type: v as Beneficiary["type"] })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="contingent">Contingent</SelectItem>
                </SelectContent>
              </Select>
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
        Add beneficiary
      </Button>
    </div>
  );
}
