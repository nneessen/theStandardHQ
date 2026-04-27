// src/features/the-standard-team/components/StateClassificationDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StateClassificationType } from "../hooks/useStateClassifications";

interface StateClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stateName: string;
  stateCode: string;
  currentClassification: StateClassificationType;
  onSave: (classification: StateClassificationType) => void;
  isSaving?: boolean;
}

const CLASSIFICATION_OPTIONS: {
  value: StateClassificationType;
  label: string;
  description: string;
  colorClass: string;
}[] = [
  {
    value: "green",
    label: "Green",
    description: "Favorable state - priority market",
    colorClass:
      "bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700",
  },
  {
    value: "yellow",
    label: "Yellow",
    description: "Moderate state - acceptable market",
    colorClass:
      "bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700",
  },
  {
    value: "red",
    label: "Red",
    description: "Unfavorable state - avoid if possible",
    colorClass:
      "bg-red-100 border-red-300 dark:bg-red-950/40 dark:border-red-700",
  },
  {
    value: "neutral",
    label: "Neutral",
    description: "No classification - default",
    colorClass:
      "bg-v2-card-tinted border-v2-ring-strong dark:bg-v2-card-tinted dark:border-v2-ring-strong",
  },
];

export function StateClassificationDialog({
  open,
  onOpenChange,
  stateName,
  stateCode,
  currentClassification,
  onSave,
  isSaving,
}: StateClassificationDialogProps) {
  const handleSave = (value: StateClassificationType) => {
    onSave(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {stateName} ({stateCode}) Classification
          </DialogTitle>
        </DialogHeader>
        <div className="py-3">
          <RadioGroup
            defaultValue={currentClassification}
            onValueChange={(v) => handleSave(v as StateClassificationType)}
            className="space-y-2"
          >
            {CLASSIFICATION_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center">
                <RadioGroupItem
                  value={option.value}
                  id={option.value}
                  className="sr-only"
                  disabled={isSaving}
                />
                <Label
                  htmlFor={option.value}
                  className={cn(
                    "flex-1 cursor-pointer rounded-md border-2 p-3 transition-colors",
                    option.colorClass,
                    currentClassification === option.value
                      ? "ring-2 ring-primary ring-offset-2"
                      : "hover:opacity-80",
                  )}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {option.description}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
