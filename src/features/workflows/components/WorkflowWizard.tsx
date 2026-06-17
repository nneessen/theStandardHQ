// src/features/workflows/components/WorkflowWizard.tsx

import { useState, useEffect, useCallback, Fragment } from "react";
import { ArrowLeft, ArrowRight, Check, Save, TestTube, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { tint } from "../board";
import type {
  Workflow,
  WorkflowFormData,
  WorkflowAction,
  WorkflowCategory,
  WorkflowStatus,
  TriggerType,
} from "@/types/workflow.types";
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useWorkflows,
  useTriggerWorkflow,
} from "@/hooks/workflows";
import { useAuth } from "@/contexts/AuthContext";
import WorkflowBasicInfo from "./WorkflowBasicInfo";
import WorkflowTriggerSetup from "./WorkflowTriggerSetup";
import WorkflowActionsBuilder from "./WorkflowActionsBuilder";
import WorkflowReview from "./WorkflowReview";

interface WorkflowWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: Workflow | null;
}

const WIZARD_STEPS = [
  { id: "basic", label: "Basic Info", component: WorkflowBasicInfo },
  { id: "trigger", label: "Trigger", component: WorkflowTriggerSetup },
  { id: "actions", label: "Actions", component: WorkflowActionsBuilder },
  { id: "review", label: "Review", component: WorkflowReview },
];

export default function WorkflowWizard({
  open,
  onOpenChange,
  workflow,
}: WorkflowWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: "",
    description: "",
    category: "general",
    triggerType: "manual",
    trigger: {
      type: "manual",
      schedule: undefined,
      eventName: undefined,
      webhookConfig: undefined,
    },
    actions: [],
    settings: {
      // maxRunsPerDay omitted = unlimited by default (set it to opt into a cap)
      continueOnError: false,
      priority: 50, // 1-100, 50 is normal priority
    },
    // New workflows are created Active by default so they actually run; the
    // header pill toggles this to Draft, and "Test Run" always saves a draft.
    status: "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow(workflow?.id || "");
  const triggerWorkflowMutation = useTriggerWorkflow();
  const { data: existingWorkflows = [] } = useWorkflows();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (workflow) {
        // Get trigger from config, not from the top-level triggerType
        const triggerConfig = workflow.config?.trigger || {};
        const actualTriggerType =
          triggerConfig.type || workflow.triggerType || "manual";

        setFormData({
          name: workflow.name,
          description: workflow.description || "",
          category: (workflow.category as WorkflowCategory) || "general",
          triggerType: actualTriggerType as TriggerType, // Use the actual trigger type from config
          trigger: {
            type: actualTriggerType as TriggerType, // Use the same value here
            eventName: triggerConfig.eventName,
            schedule: triggerConfig.schedule,
            webhookConfig: triggerConfig.webhookConfig,
          },
          actions: (workflow.actions as WorkflowAction[]) || [],
          settings: {
            // Preserve unlimited (null/undefined) — defaulting to 10 here would
            // silently re-cap an unlimited workflow on save now that the engine
            // enforces this value.
            maxRunsPerDay: workflow.maxRunsPerDay ?? undefined,
            maxRunsPerRecipient: workflow.maxRunsPerRecipient || undefined,
            cooldownMinutes: workflow.cooldownMinutes || undefined,
            continueOnError: workflow.config?.continueOnError || false,
            priority: workflow.priority || 50,
          },
          status: (workflow.status as WorkflowStatus) || "draft",
        });
      } else {
        // Reset for new workflow
        setFormData({
          name: "",
          description: "",
          category: "general",
          triggerType: "manual",
          trigger: {
            type: "manual",
            schedule: undefined,
            eventName: undefined,
            webhookConfig: undefined,
          },
          actions: [],
          settings: {
            // maxRunsPerDay omitted = unlimited by default
            continueOnError: false,
            priority: 50,
          },
          status: "active",
        });
      }
      setCurrentStep(0);
      setErrors({});
    }
  }, [open, workflow]);

  // Parse error messages for user-friendly display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
  const parseErrorMessage = (error: any): string => {
    const errorMessage =
      error?.message || error?.toString() || "An unknown error occurred";

    // Check for duplicate key errors
    if (
      errorMessage.includes("duplicate key") ||
      errorMessage.includes("workflows_name_unique")
    ) {
      return `A workflow named "${formData.name}" already exists. Please choose a different name.`;
    }

    // Check for validation errors
    if (errorMessage.includes("required")) {
      return "Please fill in all required fields.";
    }

    // Check for permission errors
    if (
      errorMessage.includes("permission") ||
      errorMessage.includes("unauthorized")
    ) {
      return "You do not have permission to perform this action.";
    }

    // Check for network errors
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }

    // Return original if we can't parse it
    return errorMessage;
  };

  // Validate current step
  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      const newErrors: Record<string, string> = {};

      switch (stepIndex) {
        case 0: // Basic Info
          if (!formData.name.trim()) {
            newErrors.name = "Workflow name is required";
          } else if (formData.name.trim().length < 3) {
            newErrors.name = "Workflow name must be at least 3 characters";
          } else if (formData.name.trim().length > 50) {
            newErrors.name = "Workflow name must be less than 50 characters";
          } else {
            // Check for duplicate names (only for new workflows or if name changed)
            const isDuplicate = existingWorkflows.some(
              (w) =>
                w.name.toLowerCase() === formData.name.trim().toLowerCase() &&
                w.id !== workflow?.id, // Exclude current workflow when editing
            );
            if (isDuplicate) {
              newErrors.name = `A workflow named "${formData.name.trim()}" already exists. Please choose a different name.`;
            }
          }
          if (formData.description && formData.description.length > 500) {
            newErrors.description =
              "Description must be less than 500 characters";
          }
          break;

        case 1: // Trigger
          if (
            formData.triggerType === "event" &&
            !formData.trigger?.eventName
          ) {
            newErrors.trigger = "Please select an event";
          }
          if (formData.triggerType === "schedule") {
            if (!formData.trigger?.schedule?.time) {
              newErrors.schedule = "Please set a schedule time";
            }
          }
          if (
            formData.triggerType === "webhook" &&
            !formData.trigger?.webhookConfig
          ) {
            newErrors.trigger = "Please configure webhook settings";
          }
          break;

        case 2: // Actions
          if (formData.actions.length === 0) {
            newErrors.actions = "Add at least one action";
          }
          // Validate each action
          formData.actions.forEach((action, index) => {
            if (action.type === "send_email" && !action.config.templateId) {
              newErrors[`action_${index}`] = "Select an email template";
            }
            if (action.type === "webhook" && !action.config.webhookUrl) {
              newErrors[`action_${index}`] = "Enter webhook URL";
            }
            if (action.type === "create_notification") {
              if (!action.config.title)
                newErrors[`action_${index}_title`] = "Title required";
              if (!action.config.message)
                newErrors[`action_${index}_message`] = "Message required";
            }
            if (action.type === "wait" && !action.config.waitMinutes) {
              newErrors[`action_${index}`] = "Wait duration is required";
            }
          });
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData, existingWorkflows, workflow?.id],
  );

  // Handle navigation
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Update form data
  const updateFormData = useCallback(
    (updates: Partial<WorkflowFormData>) => {
      setFormData((prev) => {
        // Special handling for trigger updates to ensure persistence
        if (updates.trigger) {
          return {
            ...prev,
            ...updates,
            trigger: {
              ...prev.trigger,
              ...updates.trigger,
            },
          };
        }
        return { ...prev, ...updates };
      });
      // Clear relevant errors when data changes
      const newErrors = { ...errors };
      if (updates.name !== undefined) delete newErrors.name;
      if (updates.trigger !== undefined) {
        delete newErrors.trigger;
        delete newErrors.schedule;
      }
      if (updates.actions !== undefined) {
        Object.keys(newErrors).forEach((key) => {
          if (key.startsWith("action_")) delete newErrors[key];
        });
        delete newErrors.actions;
      }
      setErrors(newErrors);
    },
    [errors],
  );

  // Handle save
  const handleSave = async () => {
    // Validate all steps
    for (let i = 0; i <= 2; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return;
      }
    }

    // Clear any previous errors
    setErrors({});
    setIsSubmitting(true);

    try {
      if (workflow) {
        await updateWorkflow.mutateAsync(formData);
      } else {
        await createWorkflow.mutateAsync(formData);
      }
      onOpenChange(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("[WorkflowWizard] Failed to save workflow:", error);

      // Parse and display user-friendly error
      const userMessage = parseErrorMessage(error);
      setErrors({ submit: userMessage });

      // If it's a name conflict, go back to basic info step
      if (
        userMessage.includes("already exists") ||
        userMessage.includes("name")
      ) {
        setCurrentStep(0);
        setErrors((prev) => ({ ...prev, name: userMessage }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle test run
  const handleTestRun = async () => {
    // Validate all steps
    for (let i = 0; i <= 2; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // First save the workflow as draft if new
      let workflowId = workflow?.id;

      if (!workflowId) {
        const draftData = { ...formData, status: "draft" as WorkflowStatus };
        const result = await createWorkflow.mutateAsync(draftData);
        workflowId = result.id;
      }

      // Trigger real workflow run so emails actually send
      const userName = [user?.first_name, user?.last_name]
        .filter(Boolean)
        .join(" ");
      await triggerWorkflowMutation.mutateAsync({
        workflowId,
        context: {
          recipientEmail: user?.email || "",
          recipientId: user?.id || "",
          recipientName: userName || user?.email || "",
        },
        skipLimits: true,
      });

      onOpenChange(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to test workflow:", error);
      setErrors({ submit: `Test failed: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render current step component
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <WorkflowBasicInfo
            data={formData}
            onChange={updateFormData}
            errors={errors}
          />
        );
      case 1:
        return (
          <WorkflowTriggerSetup
            data={formData}
            onChange={updateFormData}
            errors={errors}
          />
        );
      case 2:
        return (
          <WorkflowActionsBuilder
            actions={formData.actions}
            onChange={(actions) => updateFormData({ actions })}
            errors={errors}
            selectedEvent={
              formData.triggerType === "event"
                ? formData.trigger?.eventName
                : undefined
            }
          />
        );
      case 3:
        return <WorkflowReview data={formData} onEdit={setCurrentStep} />;
      default:
        return null;
    }
  };

  const stepHasError = (index: number) =>
    Object.keys(errors).some((key) => {
      if (index === 0) return key === "name" || key === "description";
      if (index === 1) return key === "trigger" || key === "schedule";
      if (index === 2) return key === "actions" || key.startsWith("action_");
      return false;
    });
  const lastStep = WIZARD_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="block gap-0 border-0 p-0 shadow-none sm:max-w-none"
        style={{
          width: 920,
          maxWidth: "95vw",
          maxHeight: "92vh",
          borderRadius: 20,
          background: "var(--surface-2)",
          border: "1px solid var(--line2)",
          boxShadow: "var(--panelshadow)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <DialogTitle
                className="font-display text-[20px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                {workflow ? "Edit" : "Create"} Workflow
              </DialogTitle>
              <button
                type="button"
                onClick={() =>
                  updateFormData({
                    status:
                      formData.status === "active"
                        ? ("draft" as WorkflowStatus)
                        : ("active" as WorkflowStatus),
                  })
                }
                title="Click to toggle Active / Draft"
                className="cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors"
                style={{
                  background:
                    formData.status === "active"
                      ? tint("--green", 16)
                      : "var(--surface-4)",
                  color:
                    formData.status === "active"
                      ? "var(--green)"
                      : "var(--mut)",
                }}
              >
                {formData.status === "active" ? "Active" : "Draft"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
              style={{ color: "var(--mut2)" }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper — completed steps are click-to-jump */}
          <div className="mt-4 flex items-center gap-2">
            {WIZARD_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isDone = index < currentStep;
              const hasError = stepHasError(index);
              const clickable = index <= currentStep;
              const circle = hasError
                ? { background: tint("--red", 18), color: "var(--red)" }
                : isActive
                  ? {
                      background: "var(--blue)",
                      color: "#0c1322",
                      boxShadow: `0 0 0 4px ${tint("--blue", 22)}`,
                    }
                  : isDone
                    ? { background: tint("--green", 18), color: "var(--green)" }
                    : { background: "var(--surface-4)", color: "var(--mut2)" };
              return (
                <Fragment key={step.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setCurrentStep(index)}
                    className="flex items-center gap-2 disabled:cursor-default"
                  >
                    <span
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-full font-mono text-[12px] font-bold transition-shadow"
                      style={circle}
                    >
                      {isDone && !hasError ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className="font-sans text-[13px] font-semibold"
                      style={{
                        color: isActive
                          ? "var(--ink)"
                          : isDone
                            ? "var(--mut)"
                            : "var(--mut2)",
                      }}
                    >
                      {step.label}
                    </span>
                  </button>
                  {index < lastStep && (
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--mut3)" }}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>

          {errors.submit && (
            <div
              className="mt-3 rounded-lg px-3 py-2"
              style={{
                background: tint("--red", 12),
                border: `1px solid ${tint("--red", 30)}`,
              }}
            >
              <p
                className="font-sans text-[12px]"
                style={{ color: "var(--red)" }}
              >
                {errors.submit}
              </p>
            </div>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {renderStepContent()}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <div>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-4)] disabled:opacity-40"
                style={{ color: "var(--mut)" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep < lastStep ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex h-9 items-center gap-1.5 rounded-lg px-5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--blue)", color: "#0c1322" }}
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleTestRun}
                  disabled={isSubmitting}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-colors disabled:opacity-40"
                  style={{
                    border: `1px solid ${tint("--amber", 45)}`,
                    color: "var(--amber)",
                  }}
                >
                  <TestTube className="h-3.5 w-3.5" />
                  Test Run
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: "var(--green)", color: "#0a1a0f" }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSubmitting
                    ? "Saving…"
                    : workflow
                      ? "Update Workflow"
                      : "Create Workflow"}
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
