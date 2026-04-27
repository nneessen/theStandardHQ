// src/features/workflows/components/WorkflowWizard.tsx

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check, Save, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
      maxRunsPerDay: 10,
      continueOnError: false,
      priority: 50, // 1-100, 50 is normal priority
    },
    status: "draft",
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
            maxRunsPerDay: workflow.maxRunsPerDay || 10,
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
            maxRunsPerDay: 10,
            continueOnError: false,
            priority: 50,
          },
          status: "draft",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] p-3 flex flex-col bg-v2-card border-v2-ring dark:border-v2-ring"
        hideCloseButton
      >
        {/* Header - compact but readable */}
        <div className="shrink-0 pb-2 border-b border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card-tinted/50 -m-3 mb-2 p-3 rounded-t-lg">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
              {workflow ? "Edit" : "Create"} Workflow
            </DialogTitle>
          </div>

          {/* Step Progress - compact */}
          <div className="flex items-center gap-2 mt-2">
            {WIZARD_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const hasError = Object.keys(errors).some((key) => {
                if (index === 0) return key === "name" || key === "description";
                if (index === 1) return key === "trigger" || key === "schedule";
                if (index === 2)
                  return key === "actions" || key.startsWith("action_");
                return false;
              });

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-1",
                    isActive && "font-medium text-v2-ink dark:text-v2-ink",
                    isCompleted &&
                      !isActive &&
                      "text-v2-ink-muted dark:text-v2-ink-subtle",
                    !isActive &&
                      !isCompleted &&
                      "text-v2-ink-subtle dark:text-v2-ink-muted",
                    hasError && "text-red-600 dark:text-red-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                      isActive &&
                        "bg-v2-ink dark:bg-v2-card-tinted text-white dark:text-v2-ink",
                      isCompleted &&
                        !isActive &&
                        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
                      !isActive &&
                        !isCompleted &&
                        "bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle",
                      hasError &&
                        "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="text-[11px]">{step.label}</span>
                  {index < WIZARD_STEPS.length - 1 && (
                    <span className="text-v2-ink-subtle dark:text-v2-ink-muted text-[11px] ml-1">
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Display submit error if any */}
          {errors.submit && (
            <div className="mt-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-[11px] text-red-600 dark:text-red-400">
                {errors.submit}
              </p>
            </div>
          )}
        </div>

        {/* Content - scrollable, takes remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full">{renderStepContent()}</div>
        </div>

        {/* Footer - fixed at bottom, compact */}
        <div className="shrink-0 pt-2 mt-2 border-t border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card-tinted/30 -m-3 p-3 rounded-b-lg">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              size="sm"
              className="h-6 text-[10px] px-2 border-v2-ring dark:border-v2-ring-strong"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back
            </Button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                size="sm"
                disabled={isSubmitting}
                className="h-6 text-[10px] px-2"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleTestRun}
                  disabled={isSubmitting}
                  size="sm"
                  className="h-6 text-[10px] px-2 border-amber-300 dark:border-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                >
                  <TestTube className="h-3 w-3 mr-1" />
                  Test Run
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  size="sm"
                  className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isSubmitting ? "Saving..." : workflow ? "Update" : "Create"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
