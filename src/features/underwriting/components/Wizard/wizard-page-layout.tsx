// src/features/underwriting/components/wizard-page-layout.tsx

import { Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { WizardStep } from "../../types/underwriting.types";
import { WIZARD_STEPS } from "../../types/underwriting.types";

interface WizardPageLayoutProps {
  currentStep: WizardStep;
  children: React.ReactNode;
  onStepClick?: (step: WizardStep) => void;
  canNavigateToStep?: (step: WizardStep) => boolean;
  headerRight?: React.ReactNode;
  onBack?: () => void;
}

export function WizardPageLayout({
  currentStep,
  children,
  onStepClick,
  canNavigateToStep,
  headerRight,
  onBack,
}: WizardPageLayoutProps) {
  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  const getStepStatus = (stepId: WizardStep) => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === stepId);
    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return "current";
    return "upcoming";
  };

  const handleStepClick = (stepId: WizardStep) => {
    if (!onStepClick) return;
    if (canNavigateToStep && !canNavigateToStep(stepId)) return;
    onStepClick(stepId);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background flex-shrink-0">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <img
            src="/logos/LetterLogo.png"
            alt="Logo"
            className="h-6 w-6 hidden dark:block"
          />
          <img
            src="/logos/Light Letter Logo .png"
            alt="Logo"
            className="h-6 w-6 dark:hidden"
          />
          <span className="text-sm font-semibold tracking-wide text-v2-ink">
            Underwriting Wizard
          </span>
        </div>
        {headerRight && (
          <div className="ml-auto flex items-center gap-2">{headerRight}</div>
        )}
      </div>

      {/* Horizontal Stepper */}
      <div className="px-4 py-2.5 border-b border-v2-ring bg-v2-card-tinted flex-shrink-0">
        <nav
          className="flex items-center justify-center gap-0"
          aria-label="Progress"
        >
          {WIZARD_STEPS.map((stepConfig, index) => {
            const status = getStepStatus(stepConfig.id);
            const isClickable =
              onStepClick &&
              (canNavigateToStep
                ? canNavigateToStep(stepConfig.id)
                : status !== "upcoming");
            const isLast = index === WIZARD_STEPS.length - 1;

            return (
              <div key={stepConfig.id} className="flex items-center">
                <button
                  onClick={() => handleStepClick(stepConfig.id)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-left",
                    isClickable &&
                      status !== "current" &&
                      "hover:bg-v2-accent-soft cursor-pointer",
                    !isClickable && "cursor-default",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold transition-colors flex-shrink-0",
                      status === "completed" &&
                        "bg-v2-accent-soft text-v2-ink border border-v2-ring",
                      status === "current" &&
                        "bg-v2-ink text-v2-canvas shadow-sm",
                      status === "upcoming" && "bg-v2-ring text-v2-ink-muted",
                    )}
                  >
                    {status === "completed" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <span
                    className={cn(
                      "hidden sm:block text-xs font-medium whitespace-nowrap",
                      status === "current"
                        ? "text-v2-ink"
                        : status === "completed"
                          ? "text-v2-ink-muted"
                          : "text-v2-ink-subtle",
                    )}
                  >
                    {stepConfig.label}
                  </span>
                </button>

                {!isLast && (
                  <div
                    className={cn(
                      "w-6 lg:w-10 h-px mx-0.5",
                      index < currentStepIndex ? "bg-v2-ink/30" : "bg-v2-ring",
                    )}
                  />
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

export default WizardPageLayout;
