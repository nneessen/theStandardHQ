// src/features/channel-orchestration/components/rules/RuleEditor.tsx
import { useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RuleConditionBuilder } from "./RuleConditionBuilder";
import { RuleActionBuilder } from "./RuleActionBuilder";
import type {
  OrchestrationRule,
  RuleConditions,
  RuleAction,
  CreateRulePayload,
} from "../../types/orchestration.types";

interface Props {
  /** Existing rule to edit, or null for creating a new rule */
  rule: OrchestrationRule | null;
  onSave: (payload: CreateRulePayload) => void;
  onCancel: () => void;
  saving?: boolean;
}

const DEFAULT_CONDITIONS: RuleConditions = {};
const DEFAULT_ACTION: RuleAction = {
  allowedChannels: ["sms", "voice"],
  preferredChannel: "sms",
};

export function RuleEditor({ rule, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [conditions, setConditions] = useState<RuleConditions>(
    rule?.conditions ?? DEFAULT_CONDITIONS,
  );
  const [action, setAction] = useState<RuleAction>(
    rule?.action ?? DEFAULT_ACTION,
  );

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      conditions,
      action,
    });
  };

  return (
    <div className="border border-info/30 rounded-md bg-info/10/30 dark:bg-info/10 p-2.5 space-y-2.5">
      {/* Rule Name */}
      <div>
        <Label className="text-[10px] text-v2-ink-muted font-medium">
          Rule Name
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 text-[11px] mt-0.5"
          placeholder="e.g., SMS for new leads"
          autoFocus
        />
        <p className="text-[9px] text-v2-ink-subtle mt-0.5">
          Give this rule a descriptive name, e.g. &quot;SMS only on
          weekends&quot; or &quot;Voice priority for veteran leads&quot;
        </p>
      </div>

      {/* Conditions */}
      <div>
        <Label className="text-[10px] text-v2-ink-muted font-medium mb-1 block">
          Conditions (all must match)
        </Label>
        <RuleConditionBuilder
          conditions={conditions}
          onChange={setConditions}
        />
      </div>

      {/* Action */}
      <div>
        <Label className="text-[10px] text-v2-ink-muted font-medium mb-1 block">
          Action
        </Label>
        <RuleActionBuilder action={action} onChange={setAction} />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-v2-ring dark:border-v2-ring-strong">
        <Button
          size="sm"
          className="h-7 text-[10px] px-3"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          <Save className="h-3 w-3 mr-1" />
          {rule ? "Update Rule" : "Add Rule"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] px-3"
          onClick={onCancel}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
