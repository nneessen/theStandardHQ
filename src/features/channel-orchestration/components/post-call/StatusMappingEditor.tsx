// src/features/channel-orchestration/components/post-call/StatusMappingEditor.tsx
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatBotCloseLeadStatuses } from "@/features/chat-bot";
import type { StatusMapping } from "../../types/orchestration.types";
import { WRITEBACK_EVENTS } from "../../types/orchestration.types";

interface Props {
  mappings: StatusMapping[];
  onChange: (mappings: StatusMapping[]) => void;
}

export function StatusMappingEditor({ mappings, onChange }: Props) {
  const { data: leadStatuses = [], isLoading } = useChatBotCloseLeadStatuses();

  const addRow = () =>
    onChange([
      ...mappings,
      { event: WRITEBACK_EVENTS[0].value, statusLabel: "" },
    ]);

  const updateRow = (idx: number, patch: Partial<StatusMapping>) =>
    onChange(mappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const removeRow = (idx: number) =>
    onChange(mappings.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1">
      {mappings.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1 text-[9px] text-zinc-400 font-medium px-0.5">
          <span>Event</span>
          <span>Set Lead Status To</span>
          <span />
        </div>
      )}
      {mappings.map((mapping, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center"
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
            value={mapping.statusLabel}
            onValueChange={(statusLabel) => updateRow(idx, { statusLabel })}
          >
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue
                placeholder={isLoading ? "Loading..." : "Select status"}
              />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.label ?? s.id}
                  className="text-[10px]"
                >
                  {s.label ?? s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
