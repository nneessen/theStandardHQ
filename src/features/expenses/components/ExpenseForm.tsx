// src/features/expenses/components/ExpenseForm.tsx
//
// Orchestrator for the Add/Edit Expense guided wizard. Mirrors the policy
// wizard's PolicyForm: a stepper, per-step intro, a two-pane body with an
// always-on summary rail, per-step validation gating, and a Review step.
//
// Designed to mount fresh each time the dialog opens (Radix unmounts the dialog
// body on close, and the shell keys this component on the expense id), so all
// state is seeded with lazy initializers — no reset effects needed.

import React, { useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/v2";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Expense, CreateExpenseData } from "@/types/expense.types";
import type {
  LeadVendor,
  LeadPurchase,
  CreateLeadVendorData,
} from "@/types/lead-purchase.types";
import { getTodayString } from "@/lib/date";
import { useCreateExpenseTemplate } from "@/hooks/expenses";
import { useLeadVendors, useCreateLeadVendor } from "@/hooks/lead-purchases";
import { LeadVendorDialog } from "../leads/LeadVendorDialog";
import { ExpenseWizardStepper } from "./ExpenseWizardStepper";
import { ExpenseRunningSummary } from "./ExpenseRunningSummary";
import { ExpenseWizardStepDetails } from "./ExpenseWizardStepDetails";
import { ExpenseWizardStepOptions } from "./ExpenseWizardStepOptions";
import { ExpenseWizardStepReview } from "./ExpenseWizardStepReview";
import type {
  CreateExpenseWithLeadData,
  LeadPurchaseFields,
  ExpenseFormErrors,
} from "./expenseWizardTypes";

interface ExpenseFormProps {
  expense?: Expense | null;
  linkedLeadPurchase?: LeadPurchase | null;
  onSave: (data: CreateExpenseWithLeadData) => void;
  /** Close the dialog (Cancel on step 1). */
  onCancel: () => void;
  /** Parent mutation pending — drives the submit button + blocks re-submit. */
  isSubmitting: boolean;
}

const STEPS = ["Details", "Options", "Review"];

/**
 * Required fields gated per step when advancing. The Review step runs the full
 * check. `vendorId`/`leadCount` only appear in the error map when lead fields
 * are actually required, so listing them here is safe for non-lead expenses.
 */
const STEP_FIELDS: ReadonlyArray<readonly string[]> = [
  ["name", "amount", "category", "vendorId", "leadCount"],
  ["recurring_frequency"],
];

const LEAD_CATEGORY = "Life Insurance Leads";

function buildInitialFormData(expense?: Expense | null): CreateExpenseData {
  if (expense) {
    return {
      name: expense.name,
      description: expense.description || "",
      amount: expense.amount,
      category: expense.category,
      expense_type: expense.expense_type,
      date: expense.date,
      is_recurring: expense.is_recurring || false,
      recurring_frequency: expense.recurring_frequency || null,
      recurring_end_date: expense.recurring_end_date || null,
      is_tax_deductible: expense.is_tax_deductible || false,
      receipt_url: expense.receipt_url || "",
      notes: expense.notes || "",
    };
  }
  return {
    name: "",
    description: "",
    amount: 0,
    category: "",
    expense_type: "personal",
    date: getTodayString(),
    is_recurring: false,
    recurring_frequency: null,
    recurring_end_date: null,
    is_tax_deductible: false,
    receipt_url: "",
    notes: "",
  };
}

function buildInitialLeadFields(
  expense?: Expense | null,
  linkedLeadPurchase?: LeadPurchase | null,
): LeadPurchaseFields {
  if (expense?.category === LEAD_CATEGORY && linkedLeadPurchase) {
    return {
      vendorId: linkedLeadPurchase.vendorId,
      leadCount: String(linkedLeadPurchase.leadCount),
      leadFreshness: linkedLeadPurchase.leadFreshness,
      purchaseName: linkedLeadPurchase.purchaseName || "",
    };
  }
  return {
    vendorId: "",
    leadCount: "",
    leadFreshness: "fresh",
    purchaseName: "",
  };
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  expense,
  linkedLeadPurchase,
  onSave,
  onCancel,
  isSubmitting,
}) => {
  const isNew = !expense;

  const [formData, setFormData] = useState<CreateExpenseData>(() =>
    buildInitialFormData(expense),
  );
  const [leadFields, setLeadFields] = useState<LeadPurchaseFields>(() =>
    buildInitialLeadFields(expense, linkedLeadPurchase),
  );
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [errors, setErrors] = useState<ExpenseFormErrors>({});

  // Edit mode unlocks every step immediately (the data already exists).
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(expense ? STEPS.length - 1 : 0);

  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const { data: vendors = [] } = useLeadVendors();
  const createVendor = useCreateLeadVendor();
  const createTemplate = useCreateExpenseTemplate();

  // Edit-mode lead preload: `linkedLeadPurchase` arrives from an async query that
  // resolves AFTER this form mounts, so the lazy `useState` initializer above
  // can miss it on a cold cache. Re-seed the lead fields once it arrives. Guarded
  // by a ref so it runs exactly once and never clobbers the agent's own edits.
  const appliedLinkedRef = useRef(false);
  useEffect(() => {
    if (appliedLinkedRef.current) return;
    if (expense?.category === LEAD_CATEGORY && linkedLeadPurchase) {
      appliedLinkedRef.current = true;
      setLeadFields({
        vendorId: linkedLeadPurchase.vendorId,
        leadCount: String(linkedLeadPurchase.leadCount),
        leadFreshness: linkedLeadPurchase.leadFreshness,
        purchaseName: linkedLeadPurchase.purchaseName || "",
      });
    }
  }, [expense, linkedLeadPurchase]);

  const isLeadCategory = formData.category === LEAD_CATEGORY;
  // For edits, only require lead fields when a linked lead purchase is present.
  // (Historical unlinked lead expenses exist from earlier flows.)
  const shouldRequireLeadFields =
    isLeadCategory && (isNew || !!linkedLeadPurchase);

  const vendorName =
    vendors.find((v: LeadVendor) => v.id === leadFields.vendorId)?.name || "";

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateAll = (): ExpenseFormErrors => {
    const e: ExpenseFormErrors = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.amount || formData.amount <= 0)
      e.amount = "Amount must be greater than 0";
    if (!formData.category) e.category = "Category is required";
    if (formData.is_recurring && !formData.recurring_frequency)
      e.recurring_frequency = "Select a frequency";
    if (shouldRequireLeadFields) {
      if (!leadFields.vendorId) e.vendorId = "Select a lead vendor";
      const n = parseInt(leadFields.leadCount, 10);
      if (!n || n <= 0) e.leadCount = "Enter the number of leads";
    }
    if (isNew && saveAsTemplate && !templateName.trim())
      e.templateName = "Template name is required";
    return e;
  };

  /** Validate just the current step's required fields before advancing. */
  const validateStep = (s: number): boolean => {
    const all = validateAll();
    if (s >= STEP_FIELDS.length) {
      // Review step — full validation.
      setErrors(all);
      if (Object.keys(all).length > 0) {
        toast.error(`Please fix: ${Object.values(all)[0]}`);
        return false;
      }
      return true;
    }
    const stepErrors: ExpenseFormErrors = {};
    for (const field of STEP_FIELDS[s]) {
      if (all[field]) stepErrors[field] = all[field];
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      toast.error(`Please fix: ${Object.values(stepErrors)[0]}`);
      return false;
    }
    return true;
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const goToStep = (s: number) => {
    setStep(s);
    setFurthest((f) => Math.max(f, s));
  };

  const handleContinue = () => {
    if (validateStep(step)) {
      setErrors({});
      goToStep(step + 1);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitExpense = async () => {
    const saveData: CreateExpenseWithLeadData = { ...formData };

    if (isLeadCategory && leadFields.vendorId && leadFields.leadCount) {
      saveData.leadPurchase = {
        vendorId: leadFields.vendorId,
        leadCount: parseInt(leadFields.leadCount, 10),
        leadFreshness: leadFields.leadFreshness,
        purchaseName: leadFields.purchaseName.trim() || null,
      };
    }

    // Parent owns the create/update (and lead-purchase sync) + closes the dialog.
    onSave(saveData);

    // Save as template only for new expenses, after the expense is handed off.
    if (isNew && saveAsTemplate && templateName.trim()) {
      try {
        await createTemplate.mutateAsync({
          template_name: templateName.trim(),
          amount: formData.amount,
          category: formData.category,
          expense_type: formData.expense_type,
          is_tax_deductible: formData.is_tax_deductible,
          recurring_frequency: formData.recurring_frequency,
          notes: formData.notes,
          description: formData.description,
        });
        toast.success("Template saved!");
      } catch (error) {
        console.error("Failed to save template:", error);
        toast.error("Failed to save template");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Earlier steps: the primary button just advances.
    if (step < STEPS.length - 1) {
      handleContinue();
      return;
    }

    // Review step: full validation, then submit.
    const all = validateAll();
    if (Object.keys(all).length > 0) {
      setErrors(all);
      // Jump back to the first step that has an error (template errors have no
      // step field, so they keep us on Review).
      const badStep = STEP_FIELDS.findIndex((fields) =>
        fields.some((f) => all[f]),
      );
      if (badStep >= 0) goToStep(badStep);
      toast.error(`Please fix: ${Object.values(all)[0]}`);
      return;
    }

    await submitExpense();
  };

  const handleAddVendor = async (data: CreateLeadVendorData) => {
    try {
      const newVendor = await createVendor.mutateAsync(data);
      setLeadFields((prev) => ({ ...prev, vendorId: newVendor.id }));
      setShowVendorDialog(false);
      toast.success("Vendor added!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add vendor",
      );
    }
  };

  const isReview = step === STEPS.length - 1;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {/* Stepper — fixed, no scroll */}
        <div className="flex-shrink-0 border-b border-border/60 bg-v2-card-tinted px-5 py-3.5 sm:px-6">
          <ExpenseWizardStepper
            steps={STEPS}
            current={step}
            furthest={furthest}
            onStepClick={goToStep}
          />
        </div>

        {/* Body: the current step (left) + the always-on summary (right) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="flex flex-col lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 p-5 sm:p-6">
              <div className="mx-auto w-full max-w-[560px]">
                {step === 0 && (
                  <ExpenseWizardStepDetails
                    formData={formData}
                    setFormData={setFormData}
                    leadFields={leadFields}
                    setLeadFields={setLeadFields}
                    errors={errors}
                    vendors={vendors}
                    onAddVendor={() => setShowVendorDialog(true)}
                  />
                )}
                {step === 1 && (
                  <ExpenseWizardStepOptions
                    formData={formData}
                    setFormData={setFormData}
                    errors={errors}
                  />
                )}
                {step === 2 && (
                  <ExpenseWizardStepReview
                    formData={formData}
                    leadFields={leadFields}
                    vendorName={vendorName}
                    isLeadCategory={isLeadCategory}
                    isNew={isNew}
                    saveAsTemplate={saveAsTemplate}
                    setSaveAsTemplate={setSaveAsTemplate}
                    templateName={templateName}
                    setTemplateName={setTemplateName}
                    errors={errors}
                    onEditStep={goToStep}
                  />
                )}
              </div>
            </div>

            {/* Right — persistent running summary */}
            <aside className="border-t border-border/60 bg-v2-card-tinted p-5 sm:p-6 lg:sticky lg:top-0 lg:w-[320px] lg:flex-none lg:self-start lg:border-l lg:border-t-0">
              <ExpenseRunningSummary
                formData={formData}
                leadCount={leadFields.leadCount}
                vendorName={vendorName}
                isLeadCategory={isLeadCategory}
              />
            </aside>
          </div>
        </div>

        {/* Footer — Back · step indicator · Continue / Save */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-v2-ring bg-v2-card-tinted px-5 py-3">
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <PillButton
                type="button"
                onClick={handleBack}
                tone="ghost"
                size="sm"
                disabled={isSubmitting}
              >
                Back
              </PillButton>
            ) : (
              <PillButton
                type="button"
                onClick={onCancel}
                tone="ghost"
                size="sm"
                disabled={isSubmitting}
              >
                Cancel
              </PillButton>
            )}
            <span className="text-[11px] text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <PillButton
            type="submit"
            tone="black"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : !isReview ? (
              "Continue →"
            ) : expense ? (
              "Update expense"
            ) : (
              "Add expense"
            )}
          </PillButton>
        </div>
      </form>

      {/* Vendor dialog for adding new lead vendors */}
      <LeadVendorDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        onSave={handleAddVendor}
        isLoading={createVendor.isPending}
      />
    </>
  );
};
