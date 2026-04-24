// src/features/policies/hooks/usePolicyForm.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  NewPolicyForm,
  PolicyStatus,
  PaymentFrequency,
  Policy,
} from "../../../types/policy.types";
import { ProductType } from "../../../types/product.types";
import {
  formatDateForDB,
  parseLocalDate,
  getTodayString,
} from "../../../lib/date";
import {
  calculatePaymentAmount,
  validatePremium,
  validateCommissionPercentage,
} from "../../../utils/policyCalculations";
import { formatPhoneNumber } from "../../../types/client.types";

/**
 * Check if a date string represents today's date
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns true if the date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

export interface UsePolicyFormOptions {
  policyId?: string;
  policy?: Policy | null;
  products: Array<{ id: string; product_type: string }>;
}

export interface UsePolicyFormReturn {
  formData: NewPolicyForm;
  setFormData: React.Dispatch<React.SetStateAction<NewPolicyForm>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  initialProductId: string | null;
  setInitialProductId: React.Dispatch<React.SetStateAction<string | null>>;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleSelectChange: (name: string, value: string) => void;
  handlePhoneChange: (value: string) => void;
  handleDOBChange: (value: string) => void;
  validateForm: () => boolean;
  resetForm: () => void;
}

/**
 * Creates initial form data from a policy (for edit mode) or empty defaults (for new)
 */
export function createInitialFormData(
  policyId?: string,
  policy?: Policy | null,
): NewPolicyForm {
  if (policyId && policy) {
    return {
      clientName: policy.client?.name || "",
      clientState: policy.client?.state || "",
      clientDOB: policy.client?.dateOfBirth || "",
      clientEmail: policy.client?.email || "",
      clientPhone: policy.client?.phone || "",
      clientStreet: policy.client?.street || "",
      clientCity: policy.client?.city || "",
      clientZipCode: policy.client?.zipCode || "",
      carrierId: policy.carrierId || "",
      productId: policy.productId || "",
      product: policy.product,
      policyNumber: policy.policyNumber || "",
      submitDate: policy.submitDate || formatDateForDB(new Date()),
      effectiveDate: policy.effectiveDate || formatDateForDB(new Date()),
      termLength: policy.termLength,
      premium: calculatePaymentAmount(
        policy.annualPremium || 0,
        policy.paymentFrequency,
      ),
      paymentFrequency: policy.paymentFrequency || "monthly",
      commissionPercentage: (policy.commissionPercentage || 0) * 100,
      status: policy.status || "pending",
      lifecycleStatus: policy.lifecycleStatus ?? null,
      notes: policy.notes || "",
    };
  }

  // Default empty form for new policies
  return {
    clientName: "",
    clientState: "",
    clientDOB: "",
    clientEmail: "",
    clientPhone: "",
    clientStreet: "",
    clientCity: "",
    clientZipCode: "",
    carrierId: "",
    productId: "",
    product: "term_life" as ProductType,
    policyNumber: "",
    submitDate: formatDateForDB(new Date()),
    effectiveDate: formatDateForDB(new Date()),
    premium: 0,
    paymentFrequency: "monthly" as PaymentFrequency,
    commissionPercentage: 0,
    status: "pending" as PolicyStatus,
    lifecycleStatus: null,
    notes: "",
  };
}

/**
 * Validates the policy form data
 * @returns Object with field names as keys and error messages as values
 */
export function validatePolicyForm(
  formData: NewPolicyForm,
  products: Array<{ id: string; product_type: string }>,
): Record<string, string> {
  const newErrors: Record<string, string> = {};

  if (!formData.clientName) newErrors.clientName = "Client name is required";
  if (!formData.clientState) newErrors.clientState = "State is required";

  if (!formData.clientDOB) {
    newErrors.clientDOB = "Date of birth is required";
  } else {
    const dob = new Date(formData.clientDOB);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (isNaN(dob.getTime())) {
      newErrors.clientDOB = "Invalid date format";
    } else if (age < 1 || age > 120) {
      newErrors.clientDOB = "Date of birth must result in age 1-120";
    }
  }

  if (!formData.carrierId) newErrors.carrierId = "Carrier is required";
  if (!formData.productId) newErrors.productId = "Product is required";

  // Validate term length for term_life products
  const selectedProduct = products.find((p) => p.id === formData.productId);
  if (selectedProduct?.product_type === "term_life" && !formData.termLength) {
    newErrors.termLength = "Term length is required for term life products";
  }

  if (!formData.submitDate) {
    newErrors.submitDate = "Submit date is required";
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const submitDate = parseLocalDate(formData.submitDate);
    if (submitDate > today) {
      newErrors.submitDate = "Submit date cannot be in the future";
    }
  }
  if (!formData.effectiveDate)
    newErrors.effectiveDate = "Effective date is required";

  if (!validatePremium(formData.premium)) {
    newErrors.premium = "Premium must be greater than $0";
  }

  if (!validateCommissionPercentage(formData.commissionPercentage)) {
    newErrors.commissionPercentage = "Commission must be between 0-200%";
  }

  return newErrors;
}

/**
 * Custom hook for managing policy form state and handlers
 */
export function usePolicyForm({
  policyId,
  policy,
  products,
}: UsePolicyFormOptions): UsePolicyFormReturn {
  const [formData, setFormData] = useState<NewPolicyForm>(() =>
    createInitialFormData(policyId, policy),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track initial productId to detect user-initiated changes in edit mode
  const [initialProductId, setInitialProductId] = useState<string | null>(
    policyId && policy ? policy.productId || null : null,
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;

      setFormData((prev) => ({
        ...prev,
        [name]: ["clientAge", "premium"].includes(name)
          ? parseFloat(value) || 0
          : value,
      }));

      // Clear error when user types
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors],
  );

  const handleSelectChange = useCallback(
    (name: string, value: string) => {
      // Ignore empty values - Radix Select triggers onValueChange("") on mount
      if (!value) {
        return;
      }

      if (name === "carrierId") {
        setFormData((prev) => {
          const carrierChanged = prev.carrierId !== value;
          return {
            ...prev,
            carrierId: value,
            productId: carrierChanged ? "" : prev.productId,
            commissionPercentage: carrierChanged
              ? 0
              : prev.commissionPercentage,
          };
        });
      } else if (name === "productId") {
        const selectedProduct = products.find((p) => p.id === value);
        setFormData((prev) => ({
          ...prev,
          productId: value,
          product:
            (selectedProduct?.product_type as ProductType) || "term_life",
          termLength:
            selectedProduct?.product_type === "term_life"
              ? prev.termLength
              : undefined,
        }));
      } else if (name === "termLength") {
        setFormData((prev) => ({
          ...prev,
          termLength: value ? parseInt(value, 10) : undefined,
        }));
      } else if (name === "status") {
        setFormData((prev) => ({
          ...prev,
          status: value as PolicyStatus,
          lifecycleStatus:
            value === "approved" && !prev.lifecycleStatus
              ? "active"
              : prev.lifecycleStatus,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }

      // Clear error when user changes
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors, products],
  );

  const handlePhoneChange = useCallback((value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData((prev) => ({
      ...prev,
      clientPhone: formatted,
    }));
  }, []);

  const handleDOBChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, clientDOB: value }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors = validatePolicyForm(formData, products);
    setErrors(newErrors);

    const isValid = Object.keys(newErrors).length === 0;

    if (!isValid) {
      const firstError = Object.values(newErrors)[0];
      toast.error(`Please fix errors: ${firstError}`);
    }

    return isValid;
  }, [formData, products]);

  const resetForm = useCallback(() => {
    setFormData(createInitialFormData(policyId, policy));
    setErrors({});
    setInitialProductId(policyId && policy ? policy.productId || null : null);
  }, [policyId, policy]);

  return {
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
    resetForm,
  };
}
