// src/features/inbound-crm/components/MedicationsField.tsx
// Grouped common-medication checkboxes for the intake Health tab. Simple: pick the meds the caller
// mentions, grouped by what they treat + the organ/system. Selected names are stored as a flat
// string[] in clients.intake.medications.
import { Checkbox } from "@/components/ui/checkbox";
import { COMMON_MEDICATIONS } from "@/constants/medications";

export function MedicationsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (med: string, on: boolean) => {
    onChange(on ? [...value, med] : value.filter((m) => m !== med));
  };

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {COMMON_MEDICATIONS.map((g) => (
        <div
          key={g.id}
          className="rounded-md border border-v2-ring p-2.5"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink">
              {g.condition}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-v2-ink-subtle">
              {g.organ}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {g.meds.map((med) => {
              const id = `${g.id}-${med}`;
              return (
                <label
                  key={med}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-v2-ink-muted"
                >
                  <Checkbox
                    id={id}
                    checked={value.includes(med)}
                    onCheckedChange={(c) => toggle(med, !!c)}
                  />
                  {med}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
