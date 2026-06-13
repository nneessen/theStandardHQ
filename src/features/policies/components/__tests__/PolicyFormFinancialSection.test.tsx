// src/features/policies/components/__tests__/PolicyFormFinancialSection.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolicyFormFinancialSection } from "../PolicyFormFinancialSection";
import type { NewPolicyForm } from "@/types/policy.types";

// Commission UI lives behind the Pro "Financial Summary" gate — grant access.
vi.mock("@/hooks/subscription", () => ({
  useFeatureAccess: () => ({ hasAccess: true }),
}));

const baseForm: NewPolicyForm = {
  policyNumber: "",
  status: "pending",
  clientName: "",
  clientState: "",
  clientDOB: "",
  carrierId: "carrier-1",
  productId: "product-1",
  product: "whole_life",
  submitDate: "2026-06-01",
  effectiveDate: "2026-06-15",
  premium: 250,
  annualPremium: 3000,
  paymentFrequency: "monthly",
  commissionPercentage: 85,
  manualAdvanceAmount: null,
};

function renderSection(
  overrides: Partial<{
    form: Partial<NewPolicyForm>;
    policyId?: string;
    expectedCommission: number;
    contractLevel: number | null;
  }> = {},
) {
  const form = { ...baseForm, ...(overrides.form ?? {}) };
  const onInputChange = vi.fn();
  render(
    <PolicyFormFinancialSection
      formData={form}
      displayErrors={{}}
      policyId={overrides.policyId}
      annualPremium={form.annualPremium ?? 0}
      expectedCommission={overrides.expectedCommission ?? 1912.5}
      contractLevel={
        overrides.contractLevel === undefined ? 110 : overrides.contractLevel
      }
      onInputChange={onInputChange}
    />,
  );
  return { onInputChange };
}

describe("PolicyFormFinancialSection — manual commission entry", () => {
  it("renders an editable 'Product Comp %' field bound to the form", () => {
    const { onInputChange } = renderSection();
    const input = screen.getByLabelText("Product Comp %") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("85");
    fireEvent.change(input, {
      target: { value: "70", name: "commissionPercentage" },
    });
    expect(onInputChange).toHaveBeenCalled();
  });

  it("shows the agent's stored contract level read-only for confirmation", () => {
    renderSection({ contractLevel: 110 });
    expect(screen.getByText("Your contract level")).toBeTruthy();
    expect(screen.getByText("110")).toBeTruthy();
  });

  it("shows 'Not set' when no contract level is configured", () => {
    renderSection({ contractLevel: null });
    expect(screen.getByText(/Not set/)).toBeTruthy();
  });

  it("shows the flat-$ advance override for NEW policies", () => {
    renderSection();
    expect(screen.getByLabelText("Advance $ (optional)")).toBeTruthy();
    // Default (no override) → percentage-derived 9-month advance.
    expect(screen.getByText("Expected Advance (9 mo)")).toBeTruthy();
    expect(screen.getByText("$1912.50")).toBeTruthy();
  });

  it("hides the flat-$ override when editing an existing policy", () => {
    renderSection({ policyId: "policy-1" });
    expect(screen.queryByLabelText("Advance $ (optional)")).toBeNull();
  });

  it("labels the advance '(manual)' when a flat override is entered", () => {
    renderSection({
      form: { manualAdvanceAmount: 1900 },
      expectedCommission: 1900,
    });
    expect(screen.getByText("Expected Advance (manual)")).toBeTruthy();
    expect(screen.getByText("$1900.00")).toBeTruthy();
    expect(screen.getByText("flat advance entered")).toBeTruthy();
  });
});
