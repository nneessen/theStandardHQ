// src/features/chat-bot/components/LeadSourceSelector.tsx
// Checkbox list for selecting lead sources the bot should respond to

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveCloseLeadSourceLabels } from "../lib/close-metadata";

interface LeadSourceSelectorProps {
  selected: string[];
  onChange: (sources: string[]) => void;
  disabled?: boolean;
  options?: string[] | null;
}

export function LeadSourceSelector({
  selected,
  onChange,
  disabled,
  options,
}: LeadSourceSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const sourceLabels = resolveCloseLeadSourceLabels(options);

  const toggle = (source: string) => {
    if (selected.includes(source)) {
      onChange(selected.filter((s) => s !== source));
    } else {
      onChange([...selected, source]);
    }
  };

  const addCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomValue("");
    setShowCustomInput(false);
  };

  const removeCustom = (source: string) => {
    onChange(selected.filter((s) => s !== source));
  };

  const customSources = selected.filter(
    (source) => !sourceLabels.includes(source),
  );

  return (
    <div className="space-y-2">
      {/* Predefined sources */}
      {sourceLabels.map((source) => (
        <label key={source} className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={selected.includes(source)}
            onCheckedChange={() => toggle(source)}
            disabled={disabled}
          />
          <span className="text-[11px] text-zinc-700 dark:text-zinc-300">
            {source}
          </span>
        </label>
      ))}

      {/* Custom sources as badges */}
      {customSources.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {customSources.map((source) => (
            <Badge
              key={source}
              variant="secondary"
              className="text-[10px] h-5 gap-1 pr-1"
            >
              {source}
              {!disabled && (
                <button
                  onClick={() => removeCustom(source)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Add custom */}
      {showCustomInput ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Lead source name"
            className="h-7 text-[11px] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            autoFocus
            disabled={disabled}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            onClick={addCustom}
            disabled={disabled || !customValue.trim()}
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] px-2"
            onClick={() => {
              setShowCustomInput(false);
              setCustomValue("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setShowCustomInput(true)}
          disabled={disabled}
          className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add Custom Source
        </button>
      )}
    </div>
  );
}
