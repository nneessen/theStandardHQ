// src/features/policies/PolicyForm.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCarriers } from "../../hooks/carriers";
import { useProducts } from "../../hooks/products/useProducts";
import { NewPolicyForm, Policy } from "../../types/policy.types";
import { PillButton } from "@/components/v2";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";

import {
  calculateAnnualPremium,
  calculateExpectedCommission,
} from "../../utils/policyCalculations";

import {
  usePolicyForm,
  createInitialFormData,
  isToday,
} from "./hooks/usePolicyForm";
import {
  usePolicyCommission,
  useUserContractLevel,
} from "./hooks/usePolicyCommission";
import { Textarea } from "@/components/ui/textarea";
import { PolicyFormClientSection } from "./components/PolicyFormClientSection";
import { PolicyFormPolicySection } from "./components/PolicyFormPolicySection";
import { PolicyFormFinancialSection } from "./components/PolicyFormFinancialSection";
import { PolicySectionHeader } from "./components/PolicySectionHeader";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // GUARD: Prevent any submission if already in progress
    if (isLoading) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    // For NEW policies with today's date, show confirmation dialog
    if (!policyId && isToday(formData.submitDate)) {
      setPendingSubmission(formData);
      setShowDateConfirm(true);
      return;
    }

    // Otherwise, submit directly
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
  const expectedCommission =
    formData.manualAdvanceAmount && formData.manualAdvanceAmount > 0
      ? formData.manualAdvanceAmount
      : calculateExpectedCommission(
          annualPremium,
          formData.commissionPercentage,
        );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Direction B — Two-Pane Linear. The body scrolls as one region; on
          desktop an ordered, scannable field column sits on the left and the
          compensation + computed summary live in a sticky rail on the right,
          OUT of the input flow so the math never reads as another field. Under
          `md` the panes stack: fields first, then the rail. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {/* Two-pane only at `lg` (>=1024px): below that the rail would squeeze
            the field column under ~250px and break the inner 2-col grids, so the
            panes stay stacked full-width through the tablet band. */}
        <div className="flex flex-col lg:flex-row lg:items-start">
          {/* Left — ordered field groups: Client → Product → Policy → Premium
              → Status → Notes */}
          <div className="min-w-0 flex-1 space-y-8 p-5 sm:p-6">
            <PolicyFormClientSection
              formData={formData}
              displayErrors={displayErrors}
              carriers={carriers}
              products={carrierProducts}
              productsLoading={productsLoading}
              productCommissionRates={productCommissionRates}
              termModifiers={termModifiers}
              showContactDetails={showContactDetails}
              onShowContactDetailsChange={setShowContactDetails}
              onInputChange={handleInputChange}
              onSelectChange={handleSelectChange}
              onPhoneChange={handlePhoneChange}
              onDOBChange={handleDOBChange}
            />

            <PolicyFormPolicySection
              formData={formData}
              displayErrors={displayErrors}
              policyId={policyId}
              onInputChange={handleInputChange}
              onSelectChange={handleSelectChange}
            />

            <section className="space-y-3.5">
              <PolicySectionHeader icon={StickyNote} label="Notes" />
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add any context about this policy — underwriting notes, client preferences, follow-ups…"
                className="min-h-[88px] resize-y rounded-lg border-border/60 bg-background text-sm shadow-inner focus:border-accent"
              />
            </section>
          </div>

          {/* Right — compensation + computed summary, out of the field flow */}
          <aside className="space-y-5 border-t border-border/60 bg-v2-card-tinted p-5 sm:p-6 lg:sticky lg:top-0 lg:w-[372px] lg:flex-none lg:self-start lg:border-l lg:border-t-0">
            <PolicyFormFinancialSection
              formData={formData}
              displayErrors={displayErrors}
              policyId={policyId}
              annualPremium={annualPremium}
              expectedCommission={expectedCommission}
              contractLevel={contractLevelConfigured ? userContractLevel : null}
              contractLevelLoading={contractLevelLoading}
              onInputChange={handleInputChange}
            />
          </aside>
        </div>
      </div>

      {/* Footer — fixed, no scroll */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-v2-ring bg-v2-card-tinted px-5 py-3">
        <span className="text-[11px] text-muted-foreground">
          <span className="text-destructive">*</span> Required fields
        </span>
        <div className="flex items-center gap-2">
          <PillButton
            type="button"
            onClick={onClose}
            tone="ghost"
            size="sm"
            disabled={isLoading}
          >
            Cancel
          </PillButton>
          <PillButton type="submit" tone="black" size="sm" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {policyId ? "Saving…" : "Creating…"}
              </>
            ) : policyId ? (
              "Update policy"
            ) : (
              "Add policy"
            )}
          </PillButton>
        </div>
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
