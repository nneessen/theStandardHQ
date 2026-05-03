// src/features/messages/components/compose/ContactPicker.tsx
// Contact picker component with autocomplete for email composition

import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { X, User, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContactPicker, type Contact } from "../../hooks/useContacts";

interface ContactPickerProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ContactPicker({
  value,
  onChange,
  placeholder = "Add recipients...",
  disabled = false,
  className,
}: ContactPickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { contacts, isLoading, hasSearchQuery } = useContactPicker(inputValue);

  // Filter out already selected contacts
  const availableContacts = contacts.filter(
    (c) => !value.includes(c.email.toLowerCase()),
  );

  const addEmail = useCallback(
    (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail && !value.includes(normalizedEmail)) {
        if (normalizedEmail.includes("@")) {
          onChange([...value, normalizedEmail]);
          setInputValue("");
        }
      }
    },
    [value, onChange],
  );

  const removeEmail = useCallback(
    (email: string) => {
      onChange(value.filter((e) => e !== email));
    },
    [value, onChange],
  );

  const handleSelectContact = useCallback(
    (contact: Contact) => {
      addEmail(contact.email);
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [addEmail],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        if (inputValue.trim() && inputValue.includes("@")) {
          e.preventDefault();
          addEmail(inputValue);
          setIsOpen(false);
        } else if (availableContacts.length > 0 && isOpen) {
          // Let Command handle Enter to select first item
        }
      } else if (e.key === "Tab" && inputValue.trim()) {
        if (inputValue.includes("@")) {
          e.preventDefault();
          addEmail(inputValue);
          setIsOpen(false);
        }
      } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
        removeEmail(value[value.length - 1]);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [
      inputValue,
      value,
      addEmail,
      removeEmail,
      availableContacts.length,
      isOpen,
    ],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      if (!isOpen) {
        setIsOpen(true);
      }
    },
    [isOpen],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        // Add email on blur if valid
        if (inputValue.trim() && inputValue.includes("@")) {
          addEmail(inputValue);
        }
      }
    },
    [inputValue, addEmail],
  );

  return (
    <Popover open={isOpen && !disabled} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div
          ref={containerRef}
          className={cn(
            "flex flex-wrap items-center gap-1 min-h-[32px] px-2 py-1 border border-input rounded-sm bg-background cursor-text",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "ring-1 ring-ring",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Selected emails as badges */}
          {value.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="h-5 text-[10px] gap-1 pr-1 shrink-0"
            >
              <span className="max-w-[150px] truncate">{email}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmail(email);
                  }}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled}
            className="flex-1 min-w-[120px] bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[300px] p-0 z-[200]"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Don't close if clicking inside the container
          if (containerRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <Command shouldFilter={false} loop>
          <CommandList className="max-h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-[11px] text-muted-foreground">
                  Loading contacts...
                </span>
              </div>
            ) : availableContacts.length > 0 ? (
              <CommandGroup
                heading={
                  hasSearchQuery
                    ? `Results (${availableContacts.length})`
                    : "Contacts"
                }
              >
                {availableContacts.slice(0, 15).map((contact) => (
                  <CommandItem
                    key={`${contact.type}-${contact.id}`}
                    value={contact.email}
                    onSelect={() => handleSelectContact(contact)}
                    className="cursor-pointer py-2"
                  >
                    <ContactItemContent contact={contact} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : inputValue.length >= 2 ? (
              <CommandEmpty className="py-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    No contacts found for "{inputValue}"
                  </span>
                  {inputValue.includes("@") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        addEmail(inputValue);
                        setIsOpen(false);
                      }}
                    >
                      Add "{inputValue}"
                    </Button>
                  )}
                </div>
              </CommandEmpty>
            ) : (
              <div className="py-6 text-center">
                <span className="text-[11px] text-muted-foreground">
                  {contacts.length === 0 && !isLoading
                    ? "No contacts available"
                    : "Type to search contacts..."}
                </span>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ContactItemContentProps {
  contact: Contact;
}

function ContactItemContent({ contact }: ContactItemContentProps) {
  const Icon = contact.type === "team" ? Users : User;

  return (
    <div className="flex items-center gap-2 w-full">
      <div
        className={cn(
          "flex items-center justify-center h-6 w-6 rounded-full shrink-0",
          contact.type === "team"
            ? "bg-info/20 text-info dark:bg-info/30 dark:text-info"
            : "bg-success/20 text-success dark:bg-success/15 dark:text-success",
        )}
      >
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium truncate">{contact.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {contact.email}
        </div>
      </div>
      {contact.role && (
        <Badge variant="outline" className="h-4 text-[9px] shrink-0">
          {contact.role}
        </Badge>
      )}
      <Badge
        variant="secondary"
        className={cn(
          "h-4 text-[9px] shrink-0",
          contact.type === "team"
            ? "bg-info/10 text-info dark:bg-info/20 dark:text-info"
            : "bg-success/10 text-success dark:bg-success/20 dark:text-success",
        )}
      >
        {contact.type === "team" ? "Team" : "Client"}
      </Badge>
    </div>
  );
}
