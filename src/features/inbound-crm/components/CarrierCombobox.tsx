// src/features/inbound-crm/components/CarrierCombobox.tsx
// User-friendly carrier picker for the inbound intake's "current carrier" field: search/pick from
// the agent's full managed carrier list (reusing useCarriers — NOT a fixed 9) OR type any carrier
// the caller names (free text). Mirrors the VendorCombobox pattern. Selecting a known carrier yields
// its id (stored as inquiry_carrier_id); free text yields { id: null, name } (stored in intake).
import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CarrierChoice {
  id: string | null;
  name: string;
}

export function CarrierCombobox({
  carriers,
  value,
  onChange,
  placeholder = "Select or type a carrier…",
  disabled = false,
}: {
  carriers: { id: string; name: string }[];
  value: CarrierChoice;
  onChange: (v: CarrierChoice) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const hasExact = carriers.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between text-sm font-normal"
        >
          {value.name ? (
            <span className="truncate">{value.name}</span>
          ) : (
            <span className="text-v2-ink-subtle">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput
            placeholder="Search or type a carrier…"
            className="h-9 text-sm"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-v2-ink-subtle">
              Type a name, then pick the option below.
            </CommandEmpty>
            <CommandGroup>
              {carriers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange({ id: c.id, name: c.name });
                    setQuery("");
                    setOpen(false);
                  }}
                  className="cursor-pointer text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value.id === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !hasExact && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`use ${trimmed}`}
                    onSelect={() => {
                      onChange({ id: null, name: trimmed });
                      setQuery("");
                      setOpen(false);
                    }}
                    className="cursor-pointer text-sm text-v2-accent"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Use “{trimmed}”
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
