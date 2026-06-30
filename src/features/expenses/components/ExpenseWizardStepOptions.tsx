// src/features/expenses/components/ExpenseWizardStepOptions.tsx

import React from "react";
import { Info, Receipt, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  CreateExpenseData,
  RecurringFrequency,
} from "@/types/expense.types";
import {
  RECURRING_FREQUENCY_OPTIONS,
  TAX_DEDUCTIBLE_TOOLTIP,
} from "../config/recurringConfig";
import { ExpenseStepIntro } from "./ExpenseStepIntro";
import { fieldClass, LABEL, HELPER, ERROR_TEXT } from "./expenseFormStyles";
import type { ExpenseFormErrors } from "./expenseWizardTypes";

interface ExpenseWizardStepOptionsProps {
  formData: CreateExpenseData;
  setFormData: React.Dispatch<React.SetStateAction<CreateExpenseData>>;
  errors: ExpenseFormErrors;
}

/** A bordered card wrapper for an optional toggle + its revealed fields. */
function OptionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
      {children}
    </div>
  );
}

/** Step 2 — everything optional: description, tax flag, recurring, receipt, notes. */
export const ExpenseWizardStepOptions: React.FC<
  ExpenseWizardStepOptionsProps
> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-5">
      <ExpenseStepIntro title="Extra details">
        All optional — add only what's useful. Mark it deductible, make it
        repeat, or attach a receipt and notes.
      </ExpenseStepIntro>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className={LABEL}>Description</Label>
        <Input
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className={fieldClass(false)}
          placeholder="Optional short description"
        />
      </div>

      {/* Tax deductible */}
      <OptionCard>
        <div className="flex items-start gap-3">
          <Checkbox
            id="is_tax_deductible"
            checked={formData.is_tax_deductible || false}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                is_tax_deductible: checked as boolean,
              })
            }
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="is_tax_deductible"
              className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              Tax deductible
            </Label>
            <p className={HELPER} title={TAX_DEDUCTIBLE_TOOLTIP}>
              {TAX_DEDUCTIBLE_TOOLTIP}
            </p>
          </div>
        </div>
      </OptionCard>

      {/* Recurring */}
      <OptionCard>
        <div className="flex items-start gap-3">
          <Checkbox
            id="is_recurring"
            checked={formData.is_recurring || false}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                is_recurring: checked as boolean,
                recurring_frequency: checked
                  ? formData.recurring_frequency || "monthly"
                  : null,
                recurring_end_date: checked
                  ? formData.recurring_end_date
                  : null,
              })
            }
            className="mt-0.5"
          />
          <Label
            htmlFor="is_recurring"
            className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground"
          >
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
            Recurring expense
          </Label>
        </div>

        {formData.is_recurring && (
          <div className="space-y-3 pl-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={LABEL}>
                  Frequency <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.recurring_frequency || "monthly"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      recurring_frequency: value as RecurringFrequency,
                    })
                  }
                >
                  <SelectTrigger
                    className={fieldClass(!!errors.recurring_frequency)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.recurring_frequency && (
                  <p className={ERROR_TEXT}>{errors.recurring_frequency}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className={LABEL}>End date (optional)</Label>
                <Input
                  type="date"
                  value={formData.recurring_end_date || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recurring_end_date: e.target.value || null,
                    })
                  }
                  min={formData.date}
                  className={fieldClass(false)}
                />
              </div>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                The next 12 occurrences will be auto-generated.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </OptionCard>

      {/* Receipt URL */}
      <div className="space-y-1.5">
        <Label className={LABEL}>Receipt URL</Label>
        <Input
          type="url"
          value={formData.receipt_url || ""}
          onChange={(e) =>
            setFormData({ ...formData, receipt_url: e.target.value })
          }
          className={fieldClass(false)}
          placeholder="https://…"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className={LABEL}>Notes</Label>
        <Textarea
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="resize-none rounded-xl border-border/60 bg-background text-[15px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.30)]"
          placeholder="Anything worth remembering about this expense…"
        />
      </div>
    </div>
  );
};
