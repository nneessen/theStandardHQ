// src/features/expenses/leads/VendorCombobox.tsx

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
import type { LeadVendor } from "@/types/lead-purchase.types";

interface VendorComboboxProps {
  vendors: LeadVendor[];
  value: string;
  onChange: (vendorId: string) => void;
  onAddVendor: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function VendorCombobox({
  vendors,
  value,
  onChange,
  onAddVendor,
  disabled = false,
  placeholder = "Select vendor...",
}: VendorComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedVendor = vendors.find((v) => v.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between text-xs font-normal bg-v2-canvas border-v2-ring"
        >
          {selectedVendor ? (
            <span className="truncate">{selectedVendor.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput
            placeholder="Search vendors..."
            className="h-8 text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              No vendors found.
            </CommandEmpty>
            <CommandGroup>
              {vendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  value={vendor.name}
                  onSelect={() => {
                    onChange(vendor.id);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === vendor.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{vendor.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onAddVendor();
                }}
                className="text-xs cursor-pointer text-primary"
              >
                <Plus className="mr-2 h-3 w-3" />
                Add new vendor
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
