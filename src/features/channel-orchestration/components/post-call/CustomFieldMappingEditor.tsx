// src/features/channel-orchestration/components/post-call/CustomFieldMappingEditor.tsx
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseCustomFields } from "../../hooks/useOrchestration";
import type { CustomFieldMapping } from "../../types/orchestration.types";
import { WRITEBACK_EVENTS } from "../../types/orchestration.types";

interface Props {
  mappings: CustomFieldMapping[];
  onChange: (mappings: CustomFieldMapping[]) => void;
}

export function CustomFieldMappingEditor({ mappings, onChange }: Props) {
  const { data: customFields = [], isLoading } = useCloseCustomFields();

  const addRow = () =>
    onChange([
      ...mappings,
      { event: WRITEBACK_EVENTS[0].value, fieldName: "", valueTemplate: "" },
    ]);

  const updateRow = (idx: number, patch: Partial<CustomFieldMapping>) =>
    onChange(mappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const removeRow = (idx: number) =>
    onChange(mappings.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1">
      {mappings.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 text-[9px] text-zinc-400 font-medium px-0.5">
          <span>Event</span>
          <span>Custom Field</span>
          <span>Value Template</span>
          <span />
        </div>
      )}
      {mappings.map((mapping, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center"
        >
          <Select
            value={mapping.event}
            onValueChange={(event) => updateRow(idx, { event })}
          >
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WRITEBACK_EVENTS.map((e) => (
                <SelectItem
                  key={e.value}
                  value={e.value}
                  className="text-[10px]"
                >
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={mapping.fieldName}
            onValueChange={(fieldName) => updateRow(idx, { fieldName })}
          >
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue placeholder={isLoading ? "Loading..." : "Field"} />
            </SelectTrigger>
            <SelectContent>
              {customFields.map((f) => (
                <SelectItem key={f.key} value={f.name} className="text-[10px]">
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={mapping.valueTemplate}
            onChange={(e) => updateRow(idx, { valueTemplate: e.target.value })}
            className="h-7 text-[10px]"
            placeholder="e.g., {{outcome}}"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => removeRow(idx)}
          >
            <X className="h-3 w-3 text-zinc-400" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-[10px]"
        onClick={addRow}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add mapping
      </Button>
    </div>
  );
}
