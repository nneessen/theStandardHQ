// src/components/ui/date-of-birth-input.tsx
// Masked date input with calendar popover for Date of Birth fields

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateOfBirthInputProps {
  value: string | null; // YYYY-MM-DD format
  onChange: (value: string) => void;
  error?: boolean;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
}

/**
 * Converts YYYY-MM-DD to MM/DD/YYYY display format
 */
function toDisplayFormat(isoDate: string | null): string {
  if (!isoDate) return "";
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

/**
 * Converts MM/DD/YYYY to YYYY-MM-DD storage format
 */
function toStorageFormat(displayDate: string): string {
  const match = displayDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Validates if a date string is a valid date
 */
function isValidDate(displayDate: string): boolean {
  const match = displayDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, month, day, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return (
    date.getFullYear() === parseInt(year) &&
    date.getMonth() === parseInt(month) - 1 &&
    date.getDate() === parseInt(day)
  );
}

export function DateOfBirthInput({
  value,
  onChange,
  error,
  className,
  id,
  name,
  disabled,
}: DateOfBirthInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    toDisplayFormat(value),
  );
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync display value when external value changes
  React.useEffect(() => {
    const newDisplay = toDisplayFormat(value);
    if (newDisplay !== displayValue && value) {
      setDisplayValue(newDisplay);
    }
  }, [value]);

  // Calculate year range for calendar (120 years back from today)
  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - 120;
  const fromDate = new Date(fromYear, 0, 1);
  const toDate = new Date(currentYear, 11, 31);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Remove all non-digits
    const digits = rawValue.replace(/\D/g, "").slice(0, 8);

    // Format as MM/DD/YYYY
    let formatted = "";

    if (digits.length === 0) {
      formatted = "";
    } else if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }

    setDisplayValue(formatted);

    // Calculate cursor position based on number of digits
    // Position cursor at end of formatted string
    const newCursorPos = formatted.length;

    // Update cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });

    // If we have a complete date, validate and update parent
    if (formatted.length === 10) {
      if (isValidDate(formatted)) {
        onChange(toStorageFormat(formatted));
      }
    } else if (formatted.length === 0) {
      onChange("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const cursorPos = input.selectionStart || 0;
    const selectionEnd = input.selectionEnd || 0;

    // Handle backspace
    if (e.key === "Backspace") {
      e.preventDefault();

      // Get current digits
      const currentDigits = displayValue.replace(/\D/g, "");

      // If there's a selection, remove selected portion by calculating digit positions
      // Otherwise, remove the last digit
      let newDigits: string;

      if (cursorPos !== selectionEnd) {
        // There's a selection - for simplicity, just remove last digit
        newDigits = currentDigits.slice(0, -1);
      } else if (cursorPos === 0) {
        // Cursor at start, nothing to delete
        return;
      } else {
        // Calculate which digit to remove based on cursor position
        // Position 0-2 = digits 0-1 (month)
        // Position 3 = slash
        // Position 3-5 = digits 2-3 (day)
        // Position 6 = slash
        // Position 7-10 = digits 4-7 (year)
        let digitIndex: number;
        if (cursorPos <= 2) {
          digitIndex = cursorPos - 1;
        } else if (cursorPos === 3) {
          digitIndex = 1; // Before slash, delete last month digit
        } else if (cursorPos <= 5) {
          digitIndex = cursorPos - 2;
        } else if (cursorPos === 6) {
          digitIndex = 3; // Before slash, delete last day digit
        } else {
          digitIndex = cursorPos - 3;
        }

        digitIndex = Math.max(
          0,
          Math.min(digitIndex, currentDigits.length - 1),
        );
        newDigits =
          currentDigits.slice(0, digitIndex) +
          currentDigits.slice(digitIndex + 1);
      }

      // Reformat
      let formatted = "";
      if (newDigits.length === 0) {
        formatted = "";
      } else if (newDigits.length <= 2) {
        formatted = newDigits;
      } else if (newDigits.length <= 4) {
        formatted = `${newDigits.slice(0, 2)}/${newDigits.slice(2)}`;
      } else {
        formatted = `${newDigits.slice(0, 2)}/${newDigits.slice(2, 4)}/${newDigits.slice(4, 8)}`;
      }

      setDisplayValue(formatted);

      // Position cursor at end
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = formatted.length;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });

      if (formatted.length === 0) {
        onChange("");
      } else if (formatted.length === 10 && isValidDate(formatted)) {
        onChange(toStorageFormat(formatted));
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const isoDate = format(date, "yyyy-MM-dd");
      const display = format(date, "MM/dd/yyyy");
      setDisplayValue(display);
      onChange(isoDate);
      setIsCalendarOpen(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");

    // Try to parse various date formats
    const formats = [
      "MM/dd/yyyy",
      "M/d/yyyy",
      "MM-dd-yyyy",
      "M-d-yyyy",
      "yyyy-MM-dd",
      "MMddyyyy",
    ];

    for (const fmt of formats) {
      try {
        const parsed = parse(pastedText.trim(), fmt, new Date());
        if (isValid(parsed)) {
          const isoDate = format(parsed, "yyyy-MM-dd");
          const display = format(parsed, "MM/dd/yyyy");
          setDisplayValue(display);
          onChange(isoDate);
          return;
        }
      } catch {
        // Try next format
      }
    }

    // If no format matched, just extract digits and format
    const digits = pastedText.replace(/\D/g, "").slice(0, 8);
    if (digits.length >= 8) {
      // Assume MMDDYYYY
      const formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      if (isValidDate(formatted)) {
        setDisplayValue(formatted);
        onChange(toStorageFormat(formatted));
      }
    }
  };

  // Parse current value for calendar default month
  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;
  const defaultMonth =
    selectedDate && isValid(selectedDate) ? selectedDate : new Date(1990, 0, 1);

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        disabled={disabled}
        className={cn(
          "flex w-full rounded-md bg-background border border-input px-3 py-2 text-sm text-foreground transition-colors duration-150",
          "hover:border-foreground/30",
          "focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring",
          "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          "pr-9",
          error && "border-destructive",
          className,
        )}
      />
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 h-full px-2 hover:bg-transparent"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={
              selectedDate && isValid(selectedDate) ? selectedDate : undefined
            }
            onSelect={handleCalendarSelect}
            defaultMonth={defaultMonth}
            captionLayout="dropdown"
            fromDate={fromDate}
            toDate={toDate}
            disabled={{ after: toDate, before: fromDate }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
