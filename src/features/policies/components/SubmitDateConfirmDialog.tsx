// src/features/policies/components/SubmitDateConfirmDialog.tsx

import { useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { PillButton } from "@/components/v2";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2 } from "lucide-react";
import { formatDateForDB } from "@/lib/date";

interface SubmitDateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmToday: () => void;
  onSelectDate: (date: string) => void;
  isSubmitting: boolean;
}

export function SubmitDateConfirmDialog({
  open,
  onOpenChange,
  onConfirmToday,
  onSelectDate,
  isSubmitting,
}: SubmitDateConfirmDialogProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowDatePicker(false);
      setSelectedDate("");
    }
    onOpenChange(newOpen);
  };

  const handleSelectDifferentDate = () => {
    setShowDatePicker(true);
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedDate(formatDateForDB(yesterday));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleSubmitWithDate = () => {
    if (selectedDate) {
      onSelectDate(selectedDate);
    }
  };

  // Get max date (yesterday) for the date picker
  const getMaxDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateForDB(yesterday);
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialogPrimitive.Portal>
        {/* Overlay with higher z-index to render above parent Dialog (z-100) */}
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[200] bg-black/80",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        {/* Content with higher z-index */}
        <AlertDialogPrimitive.Content
          className={cn(
            "theme-v2 font-display fixed left-[50%] top-[50%] z-[200] flex flex-col w-[calc(100vw-1.5rem)] sm:w-auto max-w-sm max-h-[calc(100vh-1.5rem)] translate-x-[-50%] translate-y-[-50%]",
            "border border-v2-ring p-4 sm:p-5 gap-4 rounded-v2-lg shadow-v2-lift duration-200",
            "bg-v2-card text-v2-ink",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-2.5">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-v2-pill bg-v2-accent-soft text-v2-ink flex-shrink-0">
              <Calendar className="h-4 w-4" />
            </span>
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <AlertDialogPrimitive.Title className="text-base font-semibold tracking-tight text-v2-ink">
                Confirm submit date
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-[12px] text-v2-ink-muted mt-0.5">
                {showDatePicker
                  ? "Select the actual date this policy was written."
                  : "Submit date is set to today. Was this policy actually written today?"}
              </AlertDialogPrimitive.Description>
            </div>
          </div>

          {showDatePicker ? (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="actualSubmitDate"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-v2-ink-subtle"
              >
                Actual submit date
              </Label>
              <Input
                id="actualSubmitDate"
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={getMaxDate()}
                className="h-9 text-sm bg-v2-card border-v2-ring focus-visible:ring-v2-accent"
                autoFocus
              />
            </div>
          ) : (
            <div className="rounded-v2-md border border-v2-ring bg-v2-accent-soft p-3">
              <p className="text-[12px] text-v2-ink">
                If you&apos;re entering an older policy, choose &quot;Different
                day&quot; to set the correct date.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {showDatePicker ? (
              <>
                <PillButton
                  type="button"
                  tone="ghost"
                  size="sm"
                  onClick={() => setShowDatePicker(false)}
                  disabled={isSubmitting}
                >
                  Back
                </PillButton>
                <PillButton
                  type="button"
                  tone="black"
                  size="sm"
                  onClick={handleSubmitWithDate}
                  disabled={isSubmitting || !selectedDate}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Use this date"
                  )}
                </PillButton>
              </>
            ) : (
              <>
                <PillButton
                  type="button"
                  tone="ghost"
                  size="sm"
                  onClick={handleSelectDifferentDate}
                  disabled={isSubmitting}
                >
                  Different day
                </PillButton>
                <PillButton
                  type="button"
                  tone="black"
                  size="sm"
                  onClick={onConfirmToday}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Yes, written today"
                  )}
                </PillButton>
              </>
            )}
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
