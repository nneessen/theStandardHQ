import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOW_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface WorkflowsSectionProps {
  data: Pick<PromptWizardFormData, "enabledWorkflows" | "workflowGuidance">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function WorkflowsSection({ data, onChange }: WorkflowsSectionProps) {
  const toggleWorkflow = (key: string, enabled: boolean) => {
    const next = enabled
      ? [...data.enabledWorkflows, key]
      : data.enabledWorkflows.filter((k) => k !== key);

    const nextGuidance = { ...data.workflowGuidance };
    if (enabled && !nextGuidance[key]) {
      const preset = WORKFLOW_PRESETS.find((p) => p.key === key);
      if (preset) nextGuidance[key] = preset.defaultGuidance;
    }

    onChange({ enabledWorkflows: next, workflowGuidance: nextGuidance });
  };

  const updateGuidance = (key: string, value: string) => {
    onChange({
      workflowGuidance: { ...data.workflowGuidance, [key]: value },
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        These control how your agent opens the call depending on the situation.
        The system automatically tells the agent which scenario applies.
      </p>

      <div className="space-y-3">
        {WORKFLOW_PRESETS.map((preset) => {
          const enabled = data.enabledWorkflows.includes(preset.key);
          return (
            <div
              key={preset.key}
              className="rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`wiz-wf-${preset.key}`}
                  className="text-[11px] font-medium cursor-pointer"
                >
                  {preset.label}
                </Label>
                <Switch
                  id={`wiz-wf-${preset.key}`}
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    toggleWorkflow(preset.key, checked)
                  }
                />
              </div>
              {enabled && (
                <div className="mt-2">
                  <Textarea
                    value={data.workflowGuidance[preset.key] ?? ""}
                    onChange={(e) => updateGuidance(preset.key, e.target.value)}
                    placeholder="Describe how the agent should handle this scenario..."
                    className="min-h-[60px] text-xs"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
