// src/features/policies/components/__tests__/policyWizardComp.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardStepPremiumComp } from "../WizardStepPremiumComp";
import { PolicyRunningEstimate } from "../PolicyRunningEstimate";
import type { NewPolicyForm } from "@/types/policy.types";

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

function renderComp(
  overrides: {
    form?: Partial<NewPolicyForm>;
    policyId?: string;
    canView?: boolean;
  } = {},
) {
  const onInputChange = vi.fn();
  const onSelectChange = vi.fn();
  render(
    <WizardStepPremiumComp
      formData={{ ...baseForm, ...(overrides.form ?? {}) }}
      displayErrors={{}}
      policyId={overrides.policyId}
      canViewCommissions={overrides.canView ?? true}
      onInputChange={onInputChange}
      onSelectChange={onSelectChange}
    />,
  );
  return { onInputChange };
}

function renderRail(
  overrides: {
    expected?: number;
    manual?: boolean;
    contractLevel?: number | null;
    canView?: boolean;
  } = {},
) {
  render(
    <PolicyRunningEstimate
      annualPremium={3000}
      commissionPercentage={85}
      expectedCommission={overrides.expected ?? 1912.5}
      usingManualAdvance={overrides.manual ?? false}
      contractLevel={
        overrides.contractLevel === undefined ? 110 : overrides.contractLevel
      }
      contractLevelLoading={false}
      canViewCommissions={overrides.canView ?? true}
    />,
  );
}

describe("WizardStepPremiumComp — comp inputs", () => {
  it("renders an editable 'Product comp %' bound to the form", () => {
    const { onInputChange } = renderComp();
    const input = screen.getByLabelText("Product comp %") as HTMLInputElement;
    expect(input.value).toBe("85");
    fireEvent.change(input, {
      target: { value: "70", name: "commissionPercentage" },
    });
    expect(onInputChange).toHaveBeenCalled();
  });

  it("shows the flat-$ advance override for NEW policies", () => {
    renderComp();
    expect(screen.getByLabelText("Advance $ (optional)")).toBeTruthy();
  });

  it("hides the flat-$ override when editing an existing policy", () => {
    renderComp({ policyId: "policy-1" });
    expect(screen.queryByLabelText("Advance $ (optional)")).toBeNull();
  });

  it("hides the comp inputs entirely without Pro access", () => {
    renderComp({ canView: false });
    expect(screen.queryByLabelText("Product comp %")).toBeNull();
  });
});

describe("PolicyRunningEstimate — contract level + money panel", () => {
  it("shows the agent's stored contract level read-only", () => {
    renderRail({ contractLevel: 110 });
    expect(screen.getByText("Your contract level")).toBeTruthy();
    expect(screen.getByText("110")).toBeTruthy();
  });

  it("shows 'Not set' when no contract level is configured", () => {
    renderRail({ contractLevel: null });
    expect(screen.getByText(/Not set/)).toBeTruthy();
  });

  it("shows the percentage-derived 9-month advance by default", () => {
    renderRail();
    expect(screen.getByText("Expected Advance (9 mo)")).toBeTruthy();
    expect(screen.getByText("$1912.50")).toBeTruthy();
  });

  it("labels the advance '(manual)' when a flat override is entered", () => {
    renderRail({ manual: true, expected: 1900 });
    expect(screen.getByText("Expected Advance (manual)")).toBeTruthy();
    expect(screen.getByText("$1900.00")).toBeTruthy();
    expect(screen.getByText("flat advance entered")).toBeTruthy();
  });

  it("locks to annual premium + upsell without Pro access", () => {
    renderRail({ canView: false });
    expect(screen.getByText(/Commission details available/)).toBeTruthy();
    expect(screen.queryByText("Your contract level")).toBeNull();
  });
});
