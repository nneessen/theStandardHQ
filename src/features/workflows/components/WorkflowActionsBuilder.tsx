// src/features/workflows/components/WorkflowActionsBuilder.tsx

import { useState } from "react";
import {
  Plus,
  Mail,
  Bell,
  Clock,
  Webhook,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Users,
  Building2,
  UserCog,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { WorkflowAction } from "@/types/workflow.types";
import type { RecipientType } from "@/types/workflow-recipients.types";
import {
  RECIPIENT_CATEGORIES,
  RECIPIENT_TYPE_LABELS,
  AVAILABLE_ROLES,
} from "@/types/workflow-recipients.types";
import { useEmailTemplates } from "@/features/email";
import { usePipelinePhaseOptions } from "@/features/training-hub";
import {
  getRecommendedRecipients,
  isRecommendedRecipient,
  getRecipientContextDescription,
} from "@/lib/workflow-recipient-helpers";

interface WorkflowActionsBuilderProps {
  actions: WorkflowAction[];
  onChange: (actions: WorkflowAction[]) => void;
  errors: Record<string, string>;
  selectedEvent?: string; // The event selected in the trigger setup
}

const ACTION_TYPES = [
  {
    type: "send_email",
    label: "Send Email",
    icon: Mail,
    color: "bg-info/10 border-info/20 text-info",
  },
  {
    type: "create_notification",
    label: "Notification",
    icon: Bell,
    color: "bg-warning/10 border-warning/20 text-warning",
  },
  {
    type: "wait",
    label: "Wait/Delay",
    icon: Clock,
    color:
      "bg-muted/10 border-input/20 text-muted-foreground dark:text-muted-foreground",
  },
  {
    type: "webhook",
    label: "Webhook",
    icon: Webhook,
    color: "bg-info/10 border-info/20 text-info",
  },
] as const;

// Category icons for recipient selector
const CATEGORY_ICONS = {
  hierarchy: Building2,
  role: UserCog,
  context: GitBranch,
  pipeline: Users,
  custom: Mail,
} as const;

export default function WorkflowActionsBuilder({
  actions,
  onChange,
  errors,
  selectedEvent,
}: WorkflowActionsBuilderProps) {
  const { data: emailTemplates = [] } = useEmailTemplates({ isActive: true });
  const { options: pipelinePhaseOptions } = usePipelinePhaseOptions();
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  const addAction = () => {
    const newAction: WorkflowAction = {
      type: "send_email",
      order: actions.length,
      config: {
        recipientConfig: { type: "eventuser" },
      },
      delayMinutes: 0,
    };
    onChange([...actions, newAction]);
  };

  const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const updateActionConfig = (
    index: number,
    configUpdates: Record<string, unknown>,
  ) => {
    const updated = [...actions];
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, ...configUpdates },
    };
    onChange(updated);
  };

  const deleteAction = (index: number) => {
    const filtered = actions.filter((_, i) => i !== index);
    const reordered = filtered.map((action, i) => ({ ...action, order: i }));
    onChange(reordered);
  };

  const moveAction = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= actions.length) return;

    const items = [...actions];
    const [movedItem] = items.splice(index, 1);
    items.splice(newIndex, 0, movedItem);

    const reordered = items.map((item, i) => ({ ...item, order: i }));
    onChange(reordered);
  };

  // Get current recipient type from action config
  const getRecipientType = (action: WorkflowAction): RecipientType => {
    return (
      action.config.recipientConfig?.type ||
      (action.config.recipientType as RecipientType) ||
      "eventuser"
    );
  };

  // Update recipient type
  const updateRecipientType = (index: number, type: RecipientType) => {
    const config = actions[index].config;
    updateActionConfig(index, {
      recipientConfig: {
        ...config.recipientConfig,
        type,
        // Reset type-specific fields
        roles: type === "role" ? [] : undefined,
        phaseIds: type === "pipeline_phase" ? [] : undefined,
        emails: ["specific_email", "email_list"].includes(type)
          ? []
          : undefined,
      },
      // Also set legacy field for backward compat
      recipientType: type,
    });
  };

  // Check if recipient type needs additional config
  const needsRoleSelector = (type: RecipientType) => type === "role";
  const needsPhaseSelector = (type: RecipientType) => type === "pipeline_phase";
  const needsEmailInput = (type: RecipientType) => type === "specific_email";
  const needsEmailListInput = (type: RecipientType) => type === "email_list";

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="p-2 rounded-md bg-muted/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">
            Workflow Actions ({actions.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={addAction}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Action
          </Button>
        </div>
      </div>

      {/* Actions List */}
      {actions.length === 0 ? (
        <div className="p-4 rounded-md bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            No actions configured yet
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addAction}
          >
            Add Your First Action
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action, index) => {
            const actionType = ACTION_TYPES.find((t) => t.type === action.type);
            const Icon = actionType?.icon || Mail;
            const errorKey = `action_${index}`;
            const hasError = !!errors[errorKey];
            const currentRecipientType = getRecipientType(action);

            return (
              <div
                key={index}
                className={cn(
                  "p-2 rounded-md border",
                  actionType?.color || "bg-muted/30",
                  hasError && "border-destructive",
                )}
              >
                {/* Action Header */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <Select
                    value={action.type}
                    onValueChange={(v) =>
                      updateAction(index, {
                        type: v as WorkflowAction["type"],
                        config: {},
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem
                          key={type.type}
                          value={type.type}
                          className="text-xs"
                        >
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAction(index, "up")}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAction(index, "down")}
                      disabled={index === actions.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => deleteAction(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Action Configuration */}
                <div className="space-y-2 pl-6">
                  {action.type === "send_email" && (
                    <>
                      {/* Template Selection */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Email Template
                          </Label>
                          <div className="flex gap-1">
                            <Select
                              value={action.config.templateId || ""}
                              onValueChange={(v) =>
                                updateActionConfig(index, { templateId: v })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs bg-background border-info/30 focus:border-info">
                                <SelectValue placeholder="Select template..." />
                              </SelectTrigger>
                              <SelectContent>
                                {emailTemplates.map((t) => (
                                  <SelectItem
                                    key={t.id}
                                    value={t.id}
                                    className="text-xs"
                                  >
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {action.config.templateId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border-info/30 hover:border-info hover:bg-info/10/50 dark:hover:bg-info/10"
                                onClick={() =>
                                  setPreviewTemplate(
                                    action.config.templateId || null,
                                  )
                                }
                              >
                                <Eye className="h-3 w-3 text-info" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Recipient Selection - Category-Based */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          Send To
                          {selectedEvent && (
                            <span className="ml-1 text-warning">
                              (⭐ = recommended for {selectedEvent})
                            </span>
                          )}
                        </Label>
                        <Select
                          value={currentRecipientType}
                          onValueChange={(v) =>
                            updateRecipientType(index, v as RecipientType)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs bg-background border-info/30 focus:border-info">
                            <SelectValue>
                              {isRecommendedRecipient(
                                selectedEvent,
                                currentRecipientType,
                              ) && "⭐ "}
                              {RECIPIENT_TYPE_LABELS[currentRecipientType] ||
                                currentRecipientType}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {/* Show recommended recipients first if event is selected */}
                            {selectedEvent &&
                              getRecommendedRecipients(selectedEvent).length >
                                0 && (
                                <SelectGroup>
                                  <SelectLabel className="flex items-center gap-1.5 text-[10px] text-warning font-semibold">
                                    <span>
                                      ⭐ Recommended for {selectedEvent}
                                    </span>
                                  </SelectLabel>
                                  {getRecommendedRecipients(selectedEvent).map(
                                    (type) => {
                                      const contextDesc =
                                        getRecipientContextDescription(
                                          selectedEvent,
                                          type,
                                        );
                                      return (
                                        <SelectItem
                                          key={`recommended-${type}`}
                                          value={type}
                                          className="text-xs pl-6"
                                        >
                                          <div>
                                            <span className="font-medium">
                                              ⭐ {RECIPIENT_TYPE_LABELS[type]}
                                            </span>
                                            {contextDesc && (
                                              <span className="block text-[10px] text-muted-foreground">
                                                {contextDesc}
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      );
                                    },
                                  )}
                                </SelectGroup>
                              )}

                            {/* Regular categories */}
                            {Object.entries(RECIPIENT_CATEGORIES).map(
                              ([key, category]) => {
                                const CategoryIcon =
                                  CATEGORY_ICONS[
                                    key as keyof typeof CATEGORY_ICONS
                                  ];
                                return (
                                  <SelectGroup key={key}>
                                    <SelectLabel className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <CategoryIcon className="h-3 w-3" />
                                      {category.label}
                                    </SelectLabel>
                                    {category.types.map((type) => {
                                      const isRecommended =
                                        isRecommendedRecipient(
                                          selectedEvent,
                                          type,
                                        );
                                      const contextDesc =
                                        getRecipientContextDescription(
                                          selectedEvent,
                                          type,
                                        );
                                      return (
                                        <SelectItem
                                          key={type}
                                          value={type}
                                          className={cn(
                                            "text-xs pl-6",
                                            isRecommended && "font-medium",
                                          )}
                                        >
                                          <div>
                                            <span>
                                              {isRecommended && "⭐ "}
                                              {RECIPIENT_TYPE_LABELS[type]}
                                            </span>
                                            {contextDesc && (
                                              <span className="block text-[10px] text-muted-foreground">
                                                {contextDesc}
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectGroup>
                                );
                              },
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Role Selection (for 'role' type) */}
                      {needsRoleSelector(currentRecipientType) && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            Select Roles
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {AVAILABLE_ROLES.map((role) => {
                              const isChecked =
                                action.config.recipientConfig?.roles?.includes(
                                  role.value,
                                ) ?? false;
                              return (
                                <label
                                  key={role.value}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer transition-colors",
                                    isChecked
                                      ? "bg-info/15 border-info/40"
                                      : "bg-background border-input hover:bg-muted/50",
                                  )}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentRoles =
                                        action.config.recipientConfig?.roles ||
                                        [];
                                      const newRoles = checked
                                        ? [...currentRoles, role.value]
                                        : currentRoles.filter(
                                            (r) => r !== role.value,
                                          );
                                      updateActionConfig(index, {
                                        recipientConfig: {
                                          ...action.config.recipientConfig,
                                          type: "role",
                                          roles: newRoles,
                                        },
                                      });
                                    }}
                                    className="h-3 w-3"
                                  />
                                  {role.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pipeline Phase Selection (for 'pipeline_phase' type) */}
                      {needsPhaseSelector(currentRecipientType) && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            Select Pipeline Phases
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto">
                            {pipelinePhaseOptions.map((phase) => {
                              const isChecked =
                                action.config.recipientConfig?.phaseIds?.includes(
                                  phase.value,
                                ) ?? false;
                              return (
                                <label
                                  key={phase.value}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer transition-colors",
                                    isChecked
                                      ? "bg-info/15 border-info/40"
                                      : "bg-background border-input hover:bg-muted/50",
                                  )}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentPhases =
                                        action.config.recipientConfig
                                          ?.phaseIds || [];
                                      const newPhases = checked
                                        ? [...currentPhases, phase.value]
                                        : currentPhases.filter(
                                            (p) => p !== phase.value,
                                          );
                                      updateActionConfig(index, {
                                        recipientConfig: {
                                          ...action.config.recipientConfig,
                                          type: "pipeline_phase",
                                          phaseIds: newPhases,
                                        },
                                      });
                                    }}
                                    className="h-3 w-3"
                                  />
                                  <span
                                    className="truncate max-w-[150px]"
                                    title={phase.label}
                                  >
                                    {phase.phaseName}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {pipelinePhaseOptions.length === 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              No pipeline phases available
                            </p>
                          )}
                        </div>
                      )}

                      {/* Specific Email Input */}
                      {needsEmailInput(currentRecipientType) && (
                        <Input
                          type="email"
                          value={
                            action.config.recipientConfig?.emails?.[0] ||
                            action.config.recipientEmail ||
                            ""
                          }
                          onChange={(e) =>
                            updateActionConfig(index, {
                              recipientConfig: {
                                ...action.config.recipientConfig,
                                type: "specific_email",
                                emails: [e.target.value],
                              },
                              recipientEmail: e.target.value,
                            })
                          }
                          placeholder="email@example.com"
                          className="h-7 text-xs bg-background border-info/30 focus:border-info"
                        />
                      )}

                      {/* Email List Input */}
                      {needsEmailListInput(currentRecipientType) && (
                        <div>
                          <Input
                            value={(
                              action.config.recipientConfig?.emails || []
                            ).join(", ")}
                            onChange={(e) => {
                              const emails = e.target.value
                                .split(",")
                                .map((email) => email.trim())
                                .filter(Boolean);
                              updateActionConfig(index, {
                                recipientConfig: {
                                  ...action.config.recipientConfig,
                                  type: "email_list",
                                  emails,
                                },
                              });
                            }}
                            placeholder="email1@example.com, email2@example.com"
                            className="h-7 text-xs bg-background border-info/30 focus:border-info"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Separate multiple emails with commas (max 50)
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {action.type === "wait" && (
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                          Wait Duration
                        </Label>
                        <Input
                          type="number"
                          value={action.config.waitMinutes || 0}
                          onChange={(e) =>
                            updateActionConfig(index, {
                              waitMinutes: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-7 text-xs bg-background border-input/30 focus:border-input"
                          placeholder="0"
                          min={0}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground dark:text-muted-foreground mt-4">
                        minutes
                      </span>
                    </div>
                  )}

                  {action.type === "webhook" && (
                    <div>
                      <Label className="text-[10px] text-info">
                        Webhook URL
                      </Label>
                      <Input
                        value={action.config.webhookUrl || ""}
                        onChange={(e) =>
                          updateActionConfig(index, {
                            webhookUrl: e.target.value,
                          })
                        }
                        className="h-7 text-xs bg-background border-info/30 focus:border-info"
                        placeholder="https://api.example.com/webhook"
                      />
                    </div>
                  )}

                  {action.type === "create_notification" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-warning">
                          Notification Title
                        </Label>
                        <Input
                          value={action.config.title || ""}
                          onChange={(e) =>
                            updateActionConfig(index, { title: e.target.value })
                          }
                          className="h-7 text-xs bg-background border-warning/30 focus:border-warning"
                          placeholder="Notification title..."
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-warning">
                          Message
                        </Label>
                        <Input
                          value={action.config.message || ""}
                          onChange={(e) =>
                            updateActionConfig(index, {
                              message: e.target.value,
                            })
                          }
                          className="h-7 text-xs bg-background border-warning/30 focus:border-warning"
                          placeholder="Notification message..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Delay Before Next Action */}
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Label className="text-[10px] text-muted-foreground">
                      Delay before next action:
                    </Label>
                    <Input
                      type="number"
                      value={action.delayMinutes || 0}
                      onChange={(e) =>
                        updateAction(index, {
                          delayMinutes: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-6 text-xs w-16 bg-background"
                      placeholder="0"
                      min={0}
                    />
                    <span className="text-xs text-muted-foreground">
                      minutes
                    </span>
                  </div>
                </div>

                {/* Error Display */}
                {hasError && (
                  <p className="text-xs text-destructive mt-2 pl-6">
                    {errors[errorKey]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {errors.actions && (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{errors.actions}</p>
        </div>
      )}

      {/* Email Template Preview Modal */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={() => setPreviewTemplate(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Email Template Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const template = emailTemplates.find(
                (t) => t.id === previewTemplate,
              );
              if (!template)
                return (
                  <p className="text-sm text-muted-foreground">
                    Template not found
                  </p>
                );

              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-info/10/50 dark:bg-info/10 border border-info/30">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs font-semibold text-info">
                          Template Name
                        </Label>
                        <p className="text-sm text-info dark:text-info">
                          {template.name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-info">
                          Subject
                        </Label>
                        <p className="text-sm text-info dark:text-info">
                          {template.subject}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Preview
                    </Label>
                    <div className="p-4 rounded-lg border bg-white dark:bg-muted">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: template.body_html.replace(
                              /{{(.*?)}}/g,
                              '<span class="px-1 py-0.5 bg-warning/20 dark:bg-warning text-warning rounded text-xs font-mono">{{$1}}</span>',
                            ),
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {template.variables && template.variables.length > 0 && (
                    <div className="p-3 rounded-lg bg-warning/10/50 dark:bg-warning/10 border border-warning/30">
                      <Label className="text-xs font-semibold text-warning mb-2 block">
                        Dynamic Variables
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map((v: string, i: number) => (
                          <code
                            key={i}
                            className="text-xs px-2 py-1 bg-warning/20 dark:bg-warning text-warning rounded"
                          >
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
