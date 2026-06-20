// src/features/policies/PolicyForm.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCarriers } from "../../hooks/carriers";
import { useProducts } from "../../hooks/products/useProducts";
import { useFeatureAccess } from "@/hooks/subscription";
import { NewPolicyForm, Policy } from "../../types/policy.types";
import { PillButton } from "@/components/v2";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  calculateAnnualPremium,
  calculateExpectedCommission,
} from "../../utils/policyCalculations";

import {
  usePolicyForm,
  validatePolicyForm,
  createInitialFormData,
  isToday,
} from "./hooks/usePolicyForm";
import {
  usePolicyCommission,
  useUserContractLevel,
} from "./hooks/usePolicyCommission";
import { PolicyWizardStepper } from "./components/PolicyWizardStepper";
import { PolicyRunningEstimate } from "./components/PolicyRunningEstimate";
import { WizardStepClient } from "./components/WizardStepClient";
import { WizardStepProductPolicy } from "./components/WizardStepProductPolicy";
import { WizardStepPremiumComp } from "./components/WizardStepPremiumComp";
import { WizardStepReview } from "./components/WizardStepReview";
import { SubmitDateConfirmDialog } from "./components/SubmitDateConfirmDialog";

interface PolicyFormProps {
  policyId?: string;
  policy?: Policy | null;
  onClose: () => void;
  addPolicy: (form: NewPolicyForm) => Promise<Policy | null>;
  updatePolicy: (id: string, updates: Partial<NewPolicyForm>) => Promise<void>;
  /** External validation errors from service layer (e.g., duplicate policy number) */
  externalErrors?: Record<string, string>;
  /** Parent mutation pending state */
  isPending?: boolean;
  /** Callback to notify parent when form submission state changes */
  onSubmittingChange?: (isSubmitting: boolean) => void;
  /** New-mode only: prefill values merged over empty defaults (e.g. known client from intake). */
  defaultFormData?: Partial<NewPolicyForm>;
}

/** Wizard step labels (Direction A — Guided Wizard). */
const STEPS = ["Client", "Product & Policy", "Premium & Comp", "Review"];

/** Required fields gated per step when advancing (Review runs the full check). */
const STEP_FIELDS: string[][] = [
  ["clientName", "clientState", "clientDOB"],
  ["carrierId", "productId", "termLength", "submitDate", "effectiveDate"],
  ["premium", "commissionPercentage"],
];

export const PolicyForm: React.FC<PolicyFormProps> = ({
  policyId,
  policy,
  onClose,
  addPolicy,
  updatePolicy,
  externalErrors = {},
  isPending = false,
  onSubmittingChange,
  defaultFormData,
}) => {
  const { user } = useAuth();

  // LOCAL submission state - becomes true IMMEDIATELY on click, before any async work
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard navigation. Edit mode starts with all steps reachable (the data
  // already exists) so the user can jump straight to the field they want.
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(policyId ? STEPS.length - 1 : 0);

  // Submit date confirmation dialog state
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const [pendingSubmission, setPendingSubmission] =
    useState<NewPolicyForm | null>(null);

  // Combined loading state - true if either local or parent says we're loading
  const isLoading = isSubmitting || isPending;

  // Notify parent when submission state changes
  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);
  const { data: carriers = [] } = useCarriers();

  // Commission detail (comp inputs + the running estimate) is a Pro feature.
  const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard");

  const {
    level: userContractLevel,
    isConfigured: contractLevelConfigured,
    isLoading: contractLevelLoading,
  } = useUserContractLevel(user?.id, user?.contract_level || 100);

  // Track carrierId separately for the products query.
  // For edit mode: initialized from policy so products load immediately.
  // For new mode: empty until user selects a carrier.
  const [productQueryCarrierId, setProductQueryCarrierId] = useState<string>(
    policy?.carrierId || "",
  );

  const { data: products = [], isLoading: productsLoading } = useProducts(
    productQueryCarrierId,
  );

  const {
    formData,
    setFormData,
    errors,
    setErrors,
    initialProductId,
    setInitialProductId,
    handleInputChange,
    handleSelectChange,
    handlePhoneChange,
    handleDOBChange,
    validateForm,
  } = usePolicyForm({
    policyId,
    policy,
    products,
    defaultFormData,
  });

  // Sync productQueryCarrierId when carrier changes in the form
  useEffect(() => {
    if (formData.carrierId !== productQueryCarrierId) {
      setProductQueryCarrierId(formData.carrierId);
    }
  }, [formData.carrierId, productQueryCarrierId]);

  const carrierProducts = useMemo(
    () => products.filter((p) => p.carrier_id === formData.carrierId),
    [products, formData.carrierId],
  );

  // Get commission data
  const {
    commissionPercentage: calculatedCommission,
    termModifiers,
    productCommissionRates,
  } = usePolicyCommission({
    productId: formData.productId,
    userContractLevel,
    products: carrierProducts,
    termLength: formData.termLength,
    isEditMode: !!policyId,
    initialProductId,
    carrierId: formData.carrierId,
  });

  useEffect(() => {
    if (!policyId || formData.productId !== initialProductId) {
      if (calculatedCommission > 0) {
        setFormData((prev) => ({
          ...prev,
          commissionPercentage: calculatedCommission,
        }));
      }
    }
  }, [
    calculatedCommission,
    policyId,
    formData.productId,
    initialProductId,
    setFormData,
  ]);

  const [showContactDetails, setShowContactDetails] = useState(
    !!(
      policyId &&
      policy &&
      (policy.client?.email ||
        policy.client?.phone ||
        policy.client?.street ||
        policy.client?.city ||
        policy.client?.zipCode)
    ),
  );

  useEffect(() => {
    if (!policyId || !policy) {
      return;
    }

    const newFormData = createInitialFormData(policyId, policy);
    setFormData(newFormData);
    setInitialProductId(policy.productId || null);
  }, [policyId, policy, carriers.length, setFormData, setInitialProductId]);

  useEffect(() => {
    if (!policyId || carrierProducts.length === 0) return;

    if (formData.carrierId && !formData.productId && formData.product) {
      const matchingProduct = carrierProducts.find(
        (p) =>
          p.carrier_id === formData.carrierId &&
          p.product_type === formData.product,
      );

      if (matchingProduct) {
        setFormData((prev) => ({
          ...prev,
          productId: matchingProduct.id,
        }));
      }
    }
  }, [
    policyId,
    carrierProducts,
    formData.carrierId,
    formData.productId,
    formData.product,
    setFormData,
  ]);

  const displayErrors = { ...errors, ...externalErrors };

  // Execute the actual policy submission
  const executeSubmission = async (submissionData: NewPolicyForm) => {
    setIsSubmitting(true);

    const annualPremium = calculateAnnualPremium(
      submissionData.premium,
      submissionData.paymentFrequency,
    );

    const dataWithPremium = {
      ...submissionData,
      annualPremium,
    };

    try {
      if (policyId) {
        await updatePolicy(policyId, dataWithPremium);
        onClose();
      } else {
        await addPolicy(dataWithPremium);
        onClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save policy",
      );
    } finally {
      setIsSubmitting(false);
      setPendingSubmission(null);
    }
  };

  // ── Wizard navigation ────────────────────────────────────────────────────
  const goToStep = (s: number) => {
    setStep(s);
    setFurthest((f) => Math.max(f, s));
  };

  /** Validate just the current step's required fields before advancing. */
  const validateStep = (s: number): boolean => {
    if (s >= STEP_FIELDS.length) {
      return validateForm();
    }
    const all = validatePolicyForm(formData, products);
    const stepErrors: Record<string, string> = {};
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

  const handleContinue = () => {
    if (validateStep(step)) {
      setErrors({});
      goToStep(step + 1);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // GUARD: Prevent any submission if already in progress
    if (isLoading) {
      return;
    }

    // Earlier steps: the primary button just advances.
    if (step < STEPS.length - 1) {
      handleContinue();
      return;
    }

    // Final (Review) step: full validation, then submit.
    if (!validateForm()) {
      // Jump back to the first step that has an error so the user can fix it.
      const all = validatePolicyForm(formData, products);
      const badStep = STEP_FIELDS.findIndex((fields) =>
        fields.some((f) => all[f]),
      );
      if (badStep >= 0) goToStep(badStep);
      return;
    }

    // For NEW policies with today's date, show confirmation dialog
    if (!policyId && isToday(formData.submitDate)) {
      setPendingSubmission(formData);
      setShowDateConfirm(true);
      return;
    }

    await executeSubmission(formData);
  };

  // Handle user confirming that today is correct
  const handleConfirmToday = async () => {
    if (pendingSubmission) {
      await executeSubmission(pendingSubmission);
    }
    setShowDateConfirm(false);
  };

  // Handle user selecting a different date
  const handleSelectDifferentDate = async (newDate: string) => {
    if (pendingSubmission) {
      const updatedData = { ...pendingSubmission, submitDate: newDate };
      // Also update form state so UI reflects the change
      setFormData((prev) => ({ ...prev, submitDate: newDate }));
      await executeSubmission(updatedData);
    }
    setShowDateConfirm(false);
  };

  // Calculate display values
  const annualPremium = calculateAnnualPremium(
    formData.premium,
    formData.paymentFrequency,
  );
  // Manual commission entry: a hand-entered flat advance (if any) wins over the
  // percentage-derived figure; otherwise compute the 9-month advance from the
  // product comp % the agent entered.
  const usingManualAdvance =
    !!formData.manualAdvanceAmount && formData.manualAdvanceAmount > 0;
  const expectedCommission = usingManualAdvance
    ? (formData.manualAdvanceAmount as number)
    : calculateExpectedCommission(annualPremium, formData.commissionPercentage);

  const isReview = step === STEPS.length - 1;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Stepper — fixed, no scroll */}
      <div className="flex-shrink-0 border-b border-border/60 bg-v2-card-tinted px-5 py-3.5 sm:px-6">
        <PolicyWizardStepper
          steps={STEPS}
          current={step}
          furthest={furthest}
          onStepClick={goToStep}
        />
      </div>

      {/* Body: only this step's fields (left) + the always-on estimate (right) */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="flex flex-col lg:flex-row lg:items-start">
          {/* Left — the current step in a calm ≤560px column */}
          <div className="min-w-0 flex-1 p-5 sm:p-6">
            <div className="mx-auto w-full max-w-[560px]">
              {step === 0 && (
                <WizardStepClient
                  formData={formData}
                  displayErrors={displayErrors}
                  showContactDetails={showContactDetails}
                  onShowContactDetailsChange={setShowContactDetails}
                  onInputChange={handleInputChange}
                  onSelectChange={handleSelectChange}
                  onPhoneChange={handlePhoneChange}
                  onDOBChange={handleDOBChange}
                />
              )}
              {step === 1 && (
                <WizardStepProductPolicy
                  formData={formData}
                  displayErrors={displayErrors}
                  policyId={policyId}
                  carriers={carriers}
                  products={carrierProducts}
                  productsLoading={productsLoading}
                  productCommissionRates={productCommissionRates}
                  termModifiers={termModifiers}
                  onInputChange={handleInputChange}
                  onSelectChange={handleSelectChange}
                />
              )}
              {step === 2 && (
                <WizardStepPremiumComp
                  formData={formData}
                  displayErrors={displayErrors}
                  policyId={policyId}
                  canViewCommissions={canViewCommissions}
                  onInputChange={handleInputChange}
                  onSelectChange={handleSelectChange}
                />
              )}
              {step === 3 && (
                <WizardStepReview
                  formData={formData}
                  carriers={carriers}
                  products={carrierProducts}
                  annualPremium={annualPremium}
                  expectedCommission={expectedCommission}
                  usingManualAdvance={usingManualAdvance}
                  canViewCommissions={canViewCommissions}
                  onEditStep={goToStep}
                />
              )}
            </div>
          </div>

          {/* Right — persistent running estimate */}
          <aside className="border-t border-border/60 bg-v2-card-tinted p-5 sm:p-6 lg:sticky lg:top-0 lg:w-[360px] lg:flex-none lg:self-start lg:border-l lg:border-t-0">
            <PolicyRunningEstimate
              annualPremium={annualPremium}
              commissionPercentage={formData.commissionPercentage || 0}
              expectedCommission={expectedCommission}
              usingManualAdvance={usingManualAdvance}
              contractLevel={contractLevelConfigured ? userContractLevel : null}
              contractLevelLoading={contractLevelLoading}
              canViewCommissions={canViewCommissions}
            />
          </aside>
        </div>
      </div>

      {/* Footer — Back · step indicator · Continue / Add policy */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-v2-ring bg-v2-card-tinted px-5 py-3">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <PillButton
              type="button"
              onClick={handleBack}
              tone="ghost"
              size="sm"
              disabled={isLoading}
            >
              Back
            </PillButton>
          ) : (
            <PillButton
              type="button"
              onClick={onClose}
              tone="ghost"
              size="sm"
              disabled={isLoading}
            >
              Cancel
            </PillButton>
          )}
          <span className="text-[11px] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <PillButton type="submit" tone="black" size="sm" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {policyId ? "Saving…" : "Creating…"}
            </>
          ) : !isReview ? (
            "Continue →"
          ) : policyId ? (
            "Update policy"
          ) : (
            "Add policy"
          )}
        </PillButton>
      </div>

      {/* Submit Date Confirmation Dialog */}
      <SubmitDateConfirmDialog
        open={showDateConfirm}
        onOpenChange={setShowDateConfirm}
        onConfirmToday={handleConfirmToday}
        onSelectDate={handleSelectDifferentDate}
        isSubmitting={isSubmitting}
      />
    </form>
  );
};
