// Domain Progress Indicator
// Compact horizontal stepper showing domain setup progress

import React from "react";
import { Check } from "lucide-react";
import type { CustomDomainStatus } from "@/types/custom-domain.types";

interface DomainProgressIndicatorProps {
  status: CustomDomainStatus;
}

type StepState = "completed" | "current" | "pending";

interface Step {
  id: string;
  label: string;
  getState: (status: CustomDomainStatus) => StepState;
}

const STEPS: Step[] = [
  {
    id: "add",
    label: "Add",
    getState: () => "completed", // Always completed if domain exists
  },
  {
    id: "dns",
    label: "DNS",
    getState: (status) => {
      if (status === "draft" || status === "pending_dns") return "current";
      return "completed";
    },
  },
  {
    id: "verify",
    label: "Verify",
    getState: (status) => {
      if (status === "draft" || status === "pending_dns") return "pending";
      if (status === "verified") return "current";
      return "completed";
    },
  },
  {
    id: "ssl",
    label: "SSL",
    getState: (status) => {
      if (["draft", "pending_dns", "verified"].includes(status))
        return "pending";
      if (status === "provisioning") return "current";
      return "completed";
    },
  },
  {
    id: "active",
    label: "Active",
    getState: (status) => {
      if (status === "active") return "completed";
      return "pending";
    },
  },
];

function StepDot({ state }: { state: StepState }) {
  if (state === "completed") {
    return (
      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success">
        <Check className="h-2 w-2 text-white" strokeWidth={3} />
      </div>
    );
  }

  if (state === "current") {
    return (
      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-info bg-info/20">
        <div className="h-1.5 w-1.5 rounded-full bg-info" />
      </div>
    );
  }

  return (
    <div className="h-3.5 w-3.5 rounded-full border border-v2-ring bg-v2-card" />
  );
}

function StepConnector({ fromState }: { fromState: StepState }) {
  const color = fromState === "completed" ? "bg-success" : "bg-v2-ring";
  return <div className={`h-[2px] w-3 ${color}`} />;
}

export function DomainProgressIndicator({
  status,
}: DomainProgressIndicatorProps) {
  // Don't show for error status
  if (status === "error") {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5">
      {STEPS.map((step, index) => {
        const state = step.getState(status);
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-0.5">
              <StepDot state={state} />
              <span
                className={`text-[9px] font-medium ${
                  state === "current"
                    ? "text-info"
                    : state === "completed"
                      ? "text-success"
                      : "text-v2-ink-subtle"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && <StepConnector fromState={state} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
