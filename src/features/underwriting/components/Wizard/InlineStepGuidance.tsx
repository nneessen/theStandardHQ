import { ClipboardList } from "lucide-react";
import { STEP_GUIDANCE } from "./wizard-content";
import type { WizardStep } from "../../types/underwriting.types";

interface InlineStepGuidanceProps {
  step: WizardStep;
}

export function InlineStepGuidance({ step }: InlineStepGuidanceProps) {
  const guidance = STEP_GUIDANCE[step];

  return (
    <div className="rounded-v2-md border border-v2-ring bg-v2-card-tinted p-3 mb-4">
      <div className="flex items-start gap-2.5">
        <ClipboardList className="h-3.5 w-3.5 mt-0.5 text-v2-ink-muted flex-shrink-0" />
        <div className="min-w-0 space-y-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted">
              {guidance.eyebrow}
            </div>
            <h3 className="text-sm font-semibold text-v2-ink mt-0.5">
              {guidance.title}
            </h3>
          </div>
          <ul className="space-y-1 text-xs leading-5 text-v2-ink-muted">
            {guidance.checklist.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-v2-ink-muted flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default InlineStepGuidance;
