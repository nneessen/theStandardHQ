// src/components/ui/MultiSelectFilter.tsx
// Shared multi-select dropdown filter. Relocated out of the (removed) Reports
// feature; still consumed by the Close KPIs widget config forms.

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  id: string;
  name: string;
  count?: number; // Optional count of items with this filter
}

interface MultiSelectFilterProps {
  label: string;
  options: FilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelectFilter({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Search...",
  disabled = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedCount = selectedIds.length;
  const hasSelection = selectedCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 px-2.5 text-xs justify-between min-w-[100px] max-w-[160px]",
            hasSelection && "border-primary/50 bg-primary/5",
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            {label}
            {hasSelection && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] rounded-sm"
              >
                {selectedCount}
              </Badge>
            )}
          </span>
          {hasSelection ? (
            <X
              className="h-3 w-3 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleClearAll}
            />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
              No results found.
            </CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {options.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => handleToggle(option.id)}
                    className="text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                      <span className="flex-1 truncate">{option.name}</span>
                      {option.count !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          ({option.count})
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {hasSelection && (
            <div className="border-t p-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="w-full h-7 text-xs"
              >
                Clear selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
