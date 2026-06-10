// src/features/policies/hooks/__tests__/usePolicyForm.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePolicyForm,
  createInitialFormData,
  validatePolicyForm,
} from "../usePolicyForm";
import { Policy } from "../../../../types/policy.types";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock date utility
vi.mock("../../../../lib/date", () => ({
  formatDateForDB: vi.fn(() => "2024-01-15"),
  parseLocalDate: vi.fn((dateString: string) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }),
}));

describe("createInitialFormData", () => {
  it("returns empty defaults for new policy (no policyId)", () => {
    const result = createInitialFormData();

    expect(result.clientName).toBe("");
    expect(result.clientState).toBe("");
    expect(result.clientDOB).toBe("");
    expect(result.carrierId).toBe("");
    expect(result.productId).toBe("");
    expect(result.product).toBe("term_life");
    expect(result.premium).toBe(0);
    expect(result.paymentFrequency).toBe("monthly");
    expect(result.commissionPercentage).toBe(0);
    expect(result.status).toBe("pending");
  });

  it("populates form data from existing policy for edit mode", () => {
    const policy = {
      id: "policy-1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      client: {
        id: "client-1",
        name: "John Doe",
        state: "CA",
        dateOfBirth: "1980-05-15",
        email: "john@example.com",
        phone: "555-123-4567",
        street: "123 Main St",
        city: "Los Angeles",
        zipCode: "90001",
      },
      carrierId: "carrier-1",
      productId: "product-1",
      product: "whole_life",
      policyNumber: "POL-12345",
      submitDate: "2024-01-01",
      effectiveDate: "2024-02-01",
      termLength: 20,
      annualPremium: 1200,
      paymentFrequency: "monthly",
      commissionPercentage: 0.85,
      status: "active",
      notes: "Test notes",
    } as unknown as Policy;

    const result = createInitialFormData("policy-1", policy);

    expect(result.clientName).toBe("John Doe");
    expect(result.clientState).toBe("CA");
    expect(result.clientDOB).toBe("1980-05-15");
    expect(result.clientEmail).toBe("john@example.com");
    expect(result.carrierId).toBe("carrier-1");
    expect(result.productId).toBe("product-1");
    expect(result.policyNumber).toBe("POL-12345");
    expect(result.commissionPercentage).toBe(85); // Converted from 0.85 to 85%
    expect(result.status).toBe("active");
    expect(result.notes).toBe("Test notes");
  });

  it("handles missing client data gracefully", () => {
    const policy = {
      id: "policy-1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      carrierId: "carrier-1",
      productId: "product-1",
    } as unknown as Policy;

    const result = createInitialFormData("policy-1", policy);

    expect(result.clientName).toBe("");
    expect(result.clientState).toBe("");
    expect(result.clientEmail).toBe("");
  });
});

describe("validatePolicyForm", () => {
  const products = [
    { id: "prod-1", product_type: "term_life" },
    { id: "prod-2", product_type: "whole_life" },
  ];

  const validFormData = {
    clientName: "John Doe",
    clientState: "CA",
    clientDOB: "1980-05-15",
    clientEmail: "",
    clientPhone: "",
    clientStreet: "",
    clientCity: "",
    clientZipCode: "",
    carrierId: "carrier-1",
    productId: "prod-2", // whole_life - no term length required
    product: "whole_life" as const,
    policyNumber: "",
    submitDate: "2024-01-15",
    effectiveDate: "2024-02-01",
    premium: 100,
    paymentFrequency: "monthly" as const,
    commissionPercentage: 85,
    status: "pending" as const,
    notes: "",
  };

  it("returns empty errors for valid form", () => {
    const errors = validatePolicyForm(validFormData, products);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("validates required client name", () => {
    const errors = validatePolicyForm(
      { ...validFormData, clientName: "" },
      products,
    );
    expect(errors.clientName).toBe("Client name is required");
  });

  it("validates required state", () => {
    const errors = validatePolicyForm(
      { ...validFormData, clientState: "" },
      products,
    );
    expect(errors.clientState).toBe("State is required");
  });

  it("validates required date of birth", () => {
    const errors = validatePolicyForm(
      { ...validFormData, clientDOB: "" },
      products,
    );
    expect(errors.clientDOB).toBe("Date of birth is required");
  });

  it("validates DOB age range (too young)", () => {
    // Use a future date to ensure age would be 0 or negative
    const futureYear = new Date().getFullYear() + 1;
    const errors = validatePolicyForm(
      { ...validFormData, clientDOB: `${futureYear}-06-15` },
      products,
    );
    expect(errors.clientDOB).toBe("Date of birth must result in age 1-120");
  });

  it("validates DOB age range (too old)", () => {
    const errors = validatePolicyForm(
      { ...validFormData, clientDOB: "1800-01-01" },
      products,
    );
    expect(errors.clientDOB).toBe("Date of birth must result in age 1-120");
  });

  it("validates invalid date format", () => {
    const errors = validatePolicyForm(
      { ...validFormData, clientDOB: "invalid-date" },
      products,
    );
    expect(errors.clientDOB).toBe("Invalid date format");
  });

  it("validates required carrier", () => {
    const errors = validatePolicyForm(
      { ...validFormData, carrierId: "" },
      products,
    );
    expect(errors.carrierId).toBe("Carrier is required");
  });

  it("validates required product", () => {
    const errors = validatePolicyForm(
      { ...validFormData, productId: "" },
      products,
    );
    expect(errors.productId).toBe("Product is required");
  });

  it("validates term length required for term_life products", () => {
    const errors = validatePolicyForm(
      {
        ...validFormData,
        productId: "prod-1",
        product: "term_life" as const,
        termLength: undefined,
      },
      products,
    );
    expect(errors.termLength).toBe(
      "Term length is required for term life products",
    );
  });

  it("does not require term length for non-term products", () => {
    const errors = validatePolicyForm(
      {
        ...validFormData,
        productId: "prod-2",
        product: "whole_life" as const,
        termLength: undefined,
      },
      products,
    );
    expect(errors.termLength).toBeUndefined();
  });

  it("validates premium greater than zero", () => {
    const errors = validatePolicyForm(
      { ...validFormData, premium: 0 },
      products,
    );
    expect(errors.premium).toBe("Premium must be greater than $0");
  });

  it("validates commission percentage range", () => {
    const errors = validatePolicyForm(
      { ...validFormData, commissionPercentage: 250 },
      products,
    );
    expect(errors.commissionPercentage).toBe(
      "Commission must be between 0-200%",
    );
  });

  it("allows blank (0) commission for manual entry", () => {
    // Manual commission entry: leaving commission blank records a $0 advance
    // now and is filled in later — it must NOT be a validation error.
    const errors = validatePolicyForm(
      { ...validFormData, commissionPercentage: 0 },
      products,
    );
    expect(errors.commissionPercentage).toBeUndefined();
  });

  it("rejects negative commission", () => {
    const errors = validatePolicyForm(
      { ...validFormData, commissionPercentage: -5 },
      products,
    );
    expect(errors.commissionPercentage).toBe(
      "Commission must be between 0-200%",
    );
  });

  it("validates required submit date", () => {
    const errors = validatePolicyForm(
      { ...validFormData, submitDate: "" },
      products,
    );
    expect(errors.submitDate).toBe("Submit date is required");
  });

  it("validates submit date cannot be in the future", () => {
    const futureYear = new Date().getFullYear() + 1;
    const errors = validatePolicyForm(
      { ...validFormData, submitDate: `${futureYear}-06-15` },
      products,
    );
    expect(errors.submitDate).toBe("Submit date cannot be in the future");
  });

  it("allows today's date as submit date", () => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const errors = validatePolicyForm(
      { ...validFormData, submitDate: todayString },
      products,
    );
    expect(errors.submitDate).toBeUndefined();
  });

  it("allows past dates as submit date", () => {
    const errors = validatePolicyForm(
      { ...validFormData, submitDate: "2020-01-15" },
      products,
    );
    expect(errors.submitDate).toBeUndefined();
  });

  it("validates required effective date", () => {
    const errors = validatePolicyForm(
      { ...validFormData, effectiveDate: "" },
      products,
    );
    expect(errors.effectiveDate).toBe("Effective date is required");
  });
});

describe("usePolicyForm hook", () => {
  const mockProducts = [
    { id: "prod-1", product_type: "term_life" },
    { id: "prod-2", product_type: "whole_life" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty form for new policy", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    expect(result.current.formData.clientName).toBe("");
    expect(result.current.formData.status).toBe("pending");
    expect(result.current.errors).toEqual({});
    expect(result.current.initialProductId).toBeNull();
  });

  it("initializes with policy data for edit mode", () => {
    const policy = {
      client: { name: "Jane Doe", state: "NY", dateOfBirth: "1990-03-20" },
      carrierId: "carrier-1",
      productId: "prod-1",
      product: "term_life",
      annualPremium: 600,
      paymentFrequency: "monthly",
      commissionPercentage: 0.75,
      status: "active",
    } as unknown as Policy;

    const { result } = renderHook(() =>
      usePolicyForm({ policyId: "policy-1", policy, products: mockProducts }),
    );

    expect(result.current.formData.clientName).toBe("Jane Doe");
    expect(result.current.formData.clientState).toBe("NY");
    expect(result.current.formData.commissionPercentage).toBe(75);
    expect(result.current.initialProductId).toBe("prod-1");
  });

  it("handles input change correctly", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.handleInputChange({
        target: { name: "clientName", value: "Test User" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.formData.clientName).toBe("Test User");
  });

  it("parses numeric fields correctly", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.handleInputChange({
        target: { name: "premium", value: "150.50" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.formData.premium).toBe(150.5);
  });

  it("clears error when field is edited", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    // Set an error
    act(() => {
      result.current.setErrors({ clientName: "Required" });
    });

    expect(result.current.errors.clientName).toBe("Required");

    // Edit the field
    act(() => {
      result.current.handleInputChange({
        target: { name: "clientName", value: "New Name" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.errors.clientName).toBe("");
  });

  it("resets product when carrier changes", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    // Set initial values
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        carrierId: "carrier-1",
        productId: "prod-1",
        commissionPercentage: 80,
      }));
    });

    // Change carrier
    act(() => {
      result.current.handleSelectChange("carrierId", "carrier-2");
    });

    expect(result.current.formData.carrierId).toBe("carrier-2");
    expect(result.current.formData.productId).toBe("");
    expect(result.current.formData.commissionPercentage).toBe(0);
  });

  it("does not reset product when same carrier selected", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    // Set initial values
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        carrierId: "carrier-1",
        productId: "prod-1",
        commissionPercentage: 80,
      }));
    });

    // Select same carrier
    act(() => {
      result.current.handleSelectChange("carrierId", "carrier-1");
    });

    expect(result.current.formData.productId).toBe("prod-1");
    expect(result.current.formData.commissionPercentage).toBe(80);
  });

  it("updates product type when product is selected", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.handleSelectChange("productId", "prod-2");
    });

    expect(result.current.formData.productId).toBe("prod-2");
    expect(result.current.formData.product).toBe("whole_life");
  });

  it("clears term length when switching to non-term product", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    // Set term length for term product
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        productId: "prod-1",
        termLength: 20,
      }));
    });

    // Switch to whole life
    act(() => {
      result.current.handleSelectChange("productId", "prod-2");
    });

    expect(result.current.formData.termLength).toBeUndefined();
  });

  it("handles term length change", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.handleSelectChange("termLength", "30");
    });

    expect(result.current.formData.termLength).toBe(30);
  });

  it("handles DOB change", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.handleDOBChange("1985-06-20");
    });

    expect(result.current.formData.clientDOB).toBe("1985-06-20");
  });

  it("ignores empty select values", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        carrierId: "carrier-1",
      }));
    });

    // Try to set empty value
    act(() => {
      result.current.handleSelectChange("carrierId", "");
    });

    expect(result.current.formData.carrierId).toBe("carrier-1");
  });

  it("validateForm returns false and shows toast for invalid form", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm();
    });

    expect(isValid!).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
  });

  it("resetForm restores initial state", () => {
    const { result } = renderHook(() =>
      usePolicyForm({ products: mockProducts }),
    );

    // Modify form
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        clientName: "Modified Name",
      }));
      result.current.setErrors({ clientName: "Some error" });
    });

    // Reset
    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData.clientName).toBe("");
    expect(result.current.errors).toEqual({});
  });
});
