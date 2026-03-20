// src/features/chat-bot/components/LeadStatusSelector.tsx
// Checkbox list for selecting which lead statuses the bot should respond to

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { resolveCloseLeadStatusLabels } from "../lib/close-metadata";
import type { ChatBotCloseLeadStatus } from "../hooks/useChatBot";

interface LeadStatusSelectorProps {
  selected: string[];
  onChange: (statuses: string[]) => void;
  disabled?: boolean;
  options?: ChatBotCloseLeadStatus[] | null;
}

export function LeadStatusSelector({
  selected,
  onChange,
  disabled,
  options,
}: LeadStatusSelectorProps) {
  const statusLabels = resolveCloseLeadStatusLabels(options);
  const allSelected = statusLabels.every((status) => selected.includes(status));

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...statusLabels]);
    }
  };

  const toggle = (status: string) => {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Select All toggle */}
      <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-blue-600 dark:text-blue-400"
          onClick={toggleAll}
          disabled={disabled}
        >
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <span className="text-[10px] text-zinc-400">
          {selected.length} / {statusLabels.length}
        </span>
      </div>

      {/* Status checkboxes */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {statusLabels.map((status) => (
          <label
            key={status}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(status)}
              onCheckedChange={() => toggle(status)}
              disabled={disabled}
            />
            <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
              {status}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
