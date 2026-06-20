// src/features/policies/components/WizardStepReview.tsx

import React from "react";
import { Pencil } from "lucide-react";
import { NewPolicyForm } from "../../../types/policy.types";
import { WizardStepIntro } from "./WizardStepIntro";

interface Carrier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
}

interface WizardStepReviewProps {
  formData: NewPolicyForm;
  carriers: Carrier[];
  products: Product[];
  annualPremium: number;
  expectedCommission: number;
  usingManualAdvance: boolean;
  canViewCommissions: boolean;
  /** Jump back to a step to edit it. */
  onEditStep: (step: number) => void;
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  withdrawn: "Withdrawn",
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

/** Step 4 of the wizard — a read-only summary with edit-jumps, then submit. */
export const WizardStepReview: React.FC<WizardStepReviewProps> = ({
  formData,
  carriers,
  products,
  annualPremium,
  expectedCommission,
  usingManualAdvance,
  canViewCommissions,
  onEditStep,
}) => {
  const carrierName =
    carriers.find((c) => c.id === formData.carrierId)?.name || "";
  const productName =
    products.find((p) => p.id === formData.productId)?.name || "";
  const contact = [
    formData.clientEmail,
    formData.clientPhone,
    [formData.clientStreet, formData.clientCity, formData.clientZipCode]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <WizardStepIntro title="Review & confirm">
        Double-check everything below, then add the policy. Use “Edit” to jump
        back to any step.
      </WizardStepIntro>

      <ReviewGroup title="Client" onEdit={() => onEditStep(0)}>
        <Row label="Name" value={formData.clientName} />
        <Row label="State" value={formData.clientState} />
        <Row label="Date of birth" value={formData.clientDOB} />
        {contact && <Row label="Contact" value={contact} />}
      </ReviewGroup>

      <ReviewGroup title="Product & Policy" onEdit={() => onEditStep(1)}>
        <Row label="Carrier" value={carrierName} />
        <Row label="Product" value={productName} />
        {formData.termLength ? (
          <Row label="Term length" value={`${formData.termLength} years`} />
        ) : null}
        <Row label="Policy number" value={formData.policyNumber} />
        <Row label="Submit date" value={formData.submitDate} />
        <Row label="Effective date" value={formData.effectiveDate} />
        <Row
          label="Application status"
          value={STATUS_LABEL[formData.status] ?? formData.status}
        />
      </ReviewGroup>

      <ReviewGroup title="Premium & Comp" onEdit={() => onEditStep(2)}>
        <Row
          label="Premium"
          value={
            formData.premium
              ? `$${formData.premium.toFixed(2)} · ${FREQUENCY_LABEL[formData.paymentFrequency] ?? formData.paymentFrequency}`
              : ""
          }
        />
        <Row label="Annual premium" value={`$${annualPremium.toFixed(2)}`} />
        {canViewCommissions && (
          <>
            {!usingManualAdvance && (
              <Row
                label="Product comp %"
                value={`${(formData.commissionPercentage || 0).toFixed(2)}%`}
              />
            )}
            <Row
              label={
                usingManualAdvance
                  ? "Expected advance (manual)"
                  : "Expected advance (9 mo)"
              }
              value={
                <span className="text-success">
                  ${expectedCommission.toFixed(2)}
                </span>
              }
            />
          </>
        )}
        {formData.notes ? <Row label="Notes" value={formData.notes} /> : null}
      </ReviewGroup>
    </div>
  );
};
