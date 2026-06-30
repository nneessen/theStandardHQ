// src/features/expenses/components/ExpenseWizardStepReview.tsx

import React from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { CreateExpenseData } from "@/types/expense.types";
import { formatDateForDisplay } from "@/lib/date";
import { getRecurringLabel } from "../config/recurringConfig";
import { ExpenseStepIntro } from "./ExpenseStepIntro";
import { fieldClass, LABEL, ERROR_TEXT } from "./expenseFormStyles";
import { annualizeAmount, costPerLead, formatUSD } from "./expenseWizardCalc";
import type {
  LeadPurchaseFields,
  ExpenseFormErrors,
} from "./expenseWizardTypes";

interface ExpenseWizardStepReviewProps {
  formData: CreateExpenseData;
  leadFields: LeadPurchaseFields;
  vendorName: string;
  isLeadCategory: boolean;
  /** New expense (not editing) — gates the "save as template" control. */
  isNew: boolean;
  saveAsTemplate: boolean;
  setSaveAsTemplate: (value: boolean) => void;
  templateName: string;
  setTemplateName: (value: string) => void;
  errors: ExpenseFormErrors;
  onEditStep: (step: number) => void;
}

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "Fresh (High-Intent)",
  aged: "Aged",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground/60">—</span>}
      </span>
    </div>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  );
}

/** Step 3 — read-only summary with edit-jumps, save-as-template, then submit. */
export const ExpenseWizardStepReview: React.FC<
  ExpenseWizardStepReviewProps
> = ({
  formData,
  leadFields,
  vendorName,
  isLeadCategory,
  isNew,
  saveAsTemplate,
  setSaveAsTemplate,
  templateName,
  setTemplateName,
  errors,
  onEditStep,
}) => {
  const parsedLeads = parseInt(leadFields.leadCount, 10);
  const perLead =
    isLeadCategory && parsedLeads > 0
      ? costPerLead(formData.amount || 0, parsedLeads)
      : 0;
  const annualCost =
    formData.is_recurring && formData.recurring_frequency
      ? annualizeAmount(formData.amount || 0, formData.recurring_frequency)
      : 0;

  return (
    <div className="space-y-5">
      <ExpenseStepIntro title="Review & confirm">
        Double-check everything below, then save. Use “Edit” to jump back to any
        step.
      </ExpenseStepIntro>

      <ReviewGroup title="Details" onEdit={() => onEditStep(0)}>
        <Row label="Name" value={formData.name} />
        <Row
          label="Amount"
          value={formData.amount ? formatUSD(formData.amount) : ""}
        />
        <Row
          label="Type"
          value={formData.expense_type === "business" ? "Business" : "Personal"}
        />
        <Row
          label="Date"
          value={formData.date ? formatDateForDisplay(formData.date) : ""}
        />
        <Row label="Category" value={formData.category} />
        {isLeadCategory && (
          <>
            <Row label="Vendor" value={vendorName} />
            <Row
              label="# of leads"
              value={parsedLeads > 0 ? parsedLeads.toLocaleString() : ""}
            />
            <Row
              label="Lead type"
              value={
                FRESHNESS_LABEL[leadFields.leadFreshness] ??
                leadFields.leadFreshness
              }
            />
            {leadFields.purchaseName && (
              <Row label="Pack name" value={leadFields.purchaseName} />
            )}
            {perLead > 0 && (
              <Row
                label="Cost per lead"
                value={<span className="text-info">{formatUSD(perLead)}</span>}
              />
            )}
          </>
        )}
      </ReviewGroup>

      <ReviewGroup title="Extra details" onEdit={() => onEditStep(1)}>
        {formData.description && (
          <Row label="Description" value={formData.description} />
        )}
        <Row
          label="Tax deductible"
          value={formData.is_tax_deductible ? "Yes" : "No"}
        />
        <Row
          label="Recurring"
          value={
            formData.is_recurring && formData.recurring_frequency
              ? getRecurringLabel(formData.recurring_frequency)
              : "No"
          }
        />
        {annualCost > 0 && (
          <Row label="Annualized cost" value={formatUSD(annualCost, false)} />
        )}
        {formData.recurring_end_date && (
          <Row
            label="Recurring ends"
            value={formatDateForDisplay(formData.recurring_end_date)}
          />
        )}
        {formData.receipt_url && (
          <Row label="Receipt" value={formData.receipt_url} />
        )}
        {formData.notes && <Row label="Notes" value={formData.notes} />}
      </ReviewGroup>

      {/* Save as template — new expenses only */}
      {isNew && (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="save_as_template"
              checked={saveAsTemplate}
              onCheckedChange={(checked) =>
                setSaveAsTemplate(checked as boolean)
              }
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <Label
                htmlFor="save_as_template"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                Save as a reusable template
              </Label>
              {saveAsTemplate && (
                <div className="space-y-1.5">
                  <Label className={LABEL}>
                    Template name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className={fieldClass(!!errors.templateName)}
                    placeholder="e.g., Monthly Office Rent"
                  />
                  {errors.templateName && (
                    <p className={ERROR_TEXT}>{errors.templateName}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
