// src/features/workflows/components/WorkflowBasicInfo.tsx

import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type {
  WorkflowFormData,
  WorkflowCategory,
} from "@/types/workflow.types";

interface WorkflowBasicInfoProps {
  data: WorkflowFormData;
  onChange: (updates: Partial<WorkflowFormData>) => void;
  errors: Record<string, string>;
}

const WORKFLOW_CATEGORIES = [
  {
    value: "email" as WorkflowCategory,
    label: "Email",
    description: "Email campaigns and communications",
  },
  {
    value: "recruiting" as WorkflowCategory,
    label: "Recruiting",
    description: "Candidate and recruit management",
  },
  {
    value: "commission" as WorkflowCategory,
    label: "Commission",
    description: "Commission tracking and alerts",
  },
  {
    value: "general" as WorkflowCategory,
    label: "General",
    description: "Other automation workflows",
  },
];

export default function WorkflowBasicInfo({
  data,
  onChange,
  errors,
}: WorkflowBasicInfoProps) {
  return (
    <div className="w-full space-y-3">
      {/* Workflow Name */}
      <div className="p-2 rounded-md bg-muted/50">
        <Label className="text-xs font-medium text-muted-foreground">
          Workflow Name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Welcome Email Series"
          className={cn(
            "h-8 text-xs mt-1 bg-background",
            errors.name && "border-destructive focus-visible:ring-destructive",
          )}
          maxLength={100}
          autoComplete="off"
          data-bwignore="true"
          data-1p-ignore="true"
          data-lpignore="true"
        />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div className="p-2 rounded-md bg-muted/30">
        <Label className="text-xs font-medium text-muted-foreground">
          Description{" "}
          <span className="text-xs text-muted-foreground/70">(optional)</span>
        </Label>
        <Textarea
          value={data.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Briefly describe what this workflow does..."
          className="h-16 text-xs resize-none mt-1 bg-background"
          rows={3}
          maxLength={500}
          autoComplete="off"
          data-bwignore="true"
          data-1p-ignore="true"
          data-lpignore="true"
        />
      </div>

      {/* Category */}
      <div className="p-2 rounded-md bg-muted/50">
        <Label className="text-xs font-medium text-muted-foreground">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.category}
          onValueChange={(value) =>
            onChange({ category: value as WorkflowCategory })
          }
        >
          <SelectTrigger className="h-8 text-xs mt-1 bg-background">
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_CATEGORIES.map((category) => (
              <SelectItem
                key={category.value}
                value={category.value}
                className="text-xs"
              >
                <div>
                  <div className="font-medium">{category.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {category.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Settings - Priority */}
      <div className="p-3 rounded-md bg-gradient-to-r from-amber-500/5 to-amber-500/10 border border-warning/20">
        <div className="flex items-start gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
          <div className="flex-1">
            <Label className="text-xs font-medium text-warning">
              Execution Priority
            </Label>
            <p className="text-[10px] text-warning mt-0.5">
              Controls the order of execution when multiple workflows are
              triggered simultaneously
            </p>
          </div>
        </div>

        {/* Priority Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Low</span>
            <span className="text-sm font-bold text-warning">
              {(() => {
                const priority = data.settings?.priority || 50;
                if (priority >= 80) return "High Priority";
                if (priority >= 60) return "Medium-High";
                if (priority >= 40) return "Normal";
                if (priority >= 20) return "Low Priority";
                return "Very Low";
              })()}
            </span>
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>

          <Slider
            value={[data.settings?.priority || 50]}
            onValueChange={([value]) =>
              onChange({
                settings: {
                  ...data.settings,
                  priority: value,
                },
              })
            }
            min={1}
            max={100}
            step={10}
            className="w-full"
          />

          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>1</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>

          {/* Priority Explanation */}
          <div
            className={cn(
              "p-2 rounded text-[10px] mt-2",
              "bg-warning/10 border",
              data.settings?.priority && data.settings.priority >= 80
                ? "border-warning text-warning"
                : data.settings?.priority && data.settings.priority <= 20
                  ? "border-warning/70 text-warning"
                  : "border-warning/30 text-warning",
            )}
          >
            <p className="font-medium mb-0.5">
              Current: {data.settings?.priority || 50}/100
              {data.settings?.priority === 50 && " (Default)"}
            </p>
            <p>
              {(() => {
                const priority = data.settings?.priority || 50;
                if (priority >= 80)
                  return "🚀 High priority workflows execute first. Use for critical automations like welcome emails or urgent alerts.";
                if (priority >= 60)
                  return "⬆️ Slightly elevated priority. Executes before normal workflows but after high priority ones.";
                if (priority >= 40)
                  return "➡️ Normal priority (default). Standard execution order with other normal workflows.";
                if (priority >= 20)
                  return "⬇️ Low priority. Executes after normal and high priority workflows. Good for non-urgent tasks.";
                return "🐌 Lowest priority. Only executes after all other workflows complete. Use for background tasks.";
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
