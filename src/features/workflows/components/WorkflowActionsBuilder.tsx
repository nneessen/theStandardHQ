// src/features/workflows/components/WorkflowActionsBuilder.tsx

import { useState } from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import {
  Plus,
  Mail,
  MessageSquare,
  Bell,
  Clock,
  Webhook,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
} from "lucide-react";
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
} from "@/lib/workflow-recipient-helpers";
import { tint, ACTION_ACCENT } from "../board";

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
  },
  {
    type: "send_sms",
    label: "Send SMS",
    icon: MessageSquare,
  },
  {
    type: "create_notification",
    label: "Notification",
    icon: Bell,
  },
  {
    type: "wait",
    label: "Wait/Delay",
    icon: Clock,
  },
  {
    type: "webhook",
    label: "Webhook",
    icon: Webhook,
  },
] as const;

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
    <div className="w-full space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-[13px] font-extrabold uppercase tracking-widest"
            style={{ color: "var(--ink)" }}
          >
            Workflow Actions
          </span>
          <span
            className="font-mono text-[11px] font-bold"
            style={{ color: "var(--mut2)" }}
          >
            {actions.length}
          </span>
        </div>
        <button
          type="button"
          onClick={addAction}
          className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--blue)", color: "var(--on-accent)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Action
        </button>
      </div>

      {/* ── Actions List ─────────────────────────────────────────────── */}
      {actions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl py-10 text-center"
          style={{
            background: "var(--surface-3)",
            border: "1px dashed var(--line2)",
          }}
        >
          <p className="font-sans text-[13px]" style={{ color: "var(--mut)" }}>
            No actions configured yet
          </p>
          <button
            type="button"
            onClick={addAction}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--blue)", color: "var(--on-accent)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Your First Action
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, index) => {
            const actionType = ACTION_TYPES.find((t) => t.type === action.type);
            const Icon = actionType?.icon || Mail;
            const errorKey = `action_${index}`;
            const hasError = !!errors[errorKey];
            const currentRecipientType = getRecipientType(action);
            const accent =
              ACTION_ACCENT[action.type as keyof typeof ACTION_ACCENT] ||
              "--mut";

            return (
              <div
                key={index}
                className="relative rounded-xl overflow-hidden"
                style={{
                  background: "var(--surface-3)",
                  border: hasError
                    ? `1px solid var(--red)`
                    : "1px solid var(--line)",
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: `var(${accent})` }}
                />

                <div className="pl-4 pr-3 pt-3 pb-3">
                  {/* ── Card Header ──────────────────────────────────── */}
                  <div className="flex items-center gap-2.5 mb-3">
                    {/* Step tile */}
                    <span
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
                      style={{
                        background: tint(accent, 14),
                        color: `var(${accent})`,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Action icon */}
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: `var(${accent})` }}
                    />

                    {/* Type select */}
                    <select
                      value={action.type}
                      onChange={(e) =>
                        updateAction(index, {
                          type: e.target.value as WorkflowAction["type"],
                          config: {},
                        })
                      }
                      className="h-8 rounded-lg px-2 font-sans text-[13px] font-semibold outline-none cursor-pointer transition-shadow"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--line2)",
                        color: "var(--ink)",
                        minWidth: 140,
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 0 0 3px " + tint(accent, 30))
                      }
                      onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                      {ACTION_TYPES.map((type) => (
                        <option key={type.type} value={type.type}>
                          {type.label}
                        </option>
                      ))}
                    </select>

                    {/* Reorder + delete controls */}
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveAction(index, "up")}
                        disabled={index === 0}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-5)] disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: "var(--mut2)" }}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAction(index, "down")}
                        disabled={index === actions.length - 1}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-5)] disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: "var(--mut2)" }}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAction(index)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-5)]"
                        style={{ color: "var(--red)" }}
                        aria-label="Delete action"
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = tint("--red", 12))
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── Card Body: type-specific config ──────────────── */}
                  <div className="space-y-2.5 pl-[34px]">
                    {action.type === "send_email" && (
                      <>
                        {/* Template Selection */}
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label
                              className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "var(--mut2)" }}
                            >
                              Email Template
                            </label>
                            <div className="flex gap-1.5">
                              <select
                                value={action.config.templateId || ""}
                                onChange={(e) =>
                                  updateActionConfig(index, {
                                    templateId: e.target.value,
                                  })
                                }
                                className="h-9 flex-1 rounded-[10px] px-3 font-sans text-[13px] outline-none cursor-pointer transition-shadow"
                                style={{
                                  background: "var(--surface-1)",
                                  border: "1px solid var(--line2)",
                                  color: action.config.templateId
                                    ? "var(--ink)"
                                    : "var(--mut2)",
                                }}
                                onFocus={(e) =>
                                  (e.currentTarget.style.boxShadow =
                                    "0 0 0 3px " + tint("--blue", 30))
                                }
                                onBlur={(e) =>
                                  (e.currentTarget.style.boxShadow = "none")
                                }
                              >
                                <option value="" disabled>
                                  Select template…
                                </option>
                                {emailTemplates.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              {action.config.templateId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewTemplate(
                                      action.config.templateId || null,
                                    )
                                  }
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors"
                                  style={{
                                    background: tint("--blue", 10),
                                    border: `1px solid ${tint("--blue", 30)}`,
                                    color: "var(--blue)",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = tint(
                                      "--blue",
                                      20,
                                    ))
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = tint(
                                      "--blue",
                                      10,
                                    ))
                                  }
                                  aria-label="Preview template"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Recipient Selection */}
                        <div>
                          <label
                            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--mut2)" }}
                          >
                            Send To
                            {selectedEvent && (
                              <span
                                className="ml-1 font-mono text-[10px] normal-case"
                                style={{ color: "var(--amber)" }}
                              >
                                (⭐ = recommended for {selectedEvent})
                              </span>
                            )}
                          </label>
                          <select
                            value={currentRecipientType}
                            onChange={(e) =>
                              updateRecipientType(
                                index,
                                e.target.value as RecipientType,
                              )
                            }
                            className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none cursor-pointer transition-shadow"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--line2)",
                              color: "var(--ink)",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0 0 3px " + tint("--blue", 30))
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.boxShadow = "none")
                            }
                          >
                            {/* Recommended group */}
                            {selectedEvent &&
                              getRecommendedRecipients(selectedEvent).length >
                                0 && (
                                <optgroup
                                  label={`⭐ Recommended for ${selectedEvent}`}
                                >
                                  {getRecommendedRecipients(selectedEvent).map(
                                    (type) => (
                                      <option
                                        key={`recommended-${type}`}
                                        value={type}
                                      >
                                        ⭐ {RECIPIENT_TYPE_LABELS[type] || type}
                                      </option>
                                    ),
                                  )}
                                </optgroup>
                              )}
                            {/* Regular categories */}
                            {Object.entries(RECIPIENT_CATEGORIES).map(
                              ([key, category]) => (
                                <optgroup key={key} label={category.label}>
                                  {category.types.map((type) => (
                                    <option key={type} value={type}>
                                      {isRecommendedRecipient(
                                        selectedEvent,
                                        type,
                                      )
                                        ? "⭐ "
                                        : ""}
                                      {RECIPIENT_TYPE_LABELS[type] || type}
                                    </option>
                                  ))}
                                </optgroup>
                              ),
                            )}
                          </select>
                        </div>

                        {/* Role Selection (for 'role' type) */}
                        {needsRoleSelector(currentRecipientType) && (
                          <div>
                            <label
                              className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "var(--mut2)" }}
                            >
                              Select Roles
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {AVAILABLE_ROLES.map((role) => {
                                const isChecked =
                                  action.config.recipientConfig?.roles?.includes(
                                    role.value,
                                  ) ?? false;
                                return (
                                  <label
                                    key={role.value}
                                    className={cn(
                                      "flex items-center gap-1.5 cursor-pointer rounded-lg px-2.5 py-1.5 font-sans text-[13px] transition-colors select-none",
                                    )}
                                    style={{
                                      background: isChecked
                                        ? tint("--blue", 14)
                                        : "var(--surface-1)",
                                      border: isChecked
                                        ? `1px solid ${tint("--blue", 40)}`
                                        : "1px solid var(--line2)",
                                      color: isChecked
                                        ? "var(--blue)"
                                        : "var(--mut)",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const currentRoles =
                                          action.config.recipientConfig
                                            ?.roles || [];
                                        const newRoles = e.target.checked
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
                                      className="h-3 w-3 accent-[var(--blue)]"
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
                            <label
                              className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "var(--mut2)" }}
                            >
                              Select Pipeline Phases
                            </label>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                              {pipelinePhaseOptions.map((phase) => {
                                const isChecked =
                                  action.config.recipientConfig?.phaseIds?.includes(
                                    phase.value,
                                  ) ?? false;
                                return (
                                  <label
                                    key={phase.value}
                                    className="flex items-center gap-1.5 cursor-pointer rounded-lg px-2.5 py-1.5 font-sans text-[13px] transition-colors select-none"
                                    style={{
                                      background: isChecked
                                        ? tint("--blue", 14)
                                        : "var(--surface-1)",
                                      border: isChecked
                                        ? `1px solid ${tint("--blue", 40)}`
                                        : "1px solid var(--line2)",
                                      color: isChecked
                                        ? "var(--blue)"
                                        : "var(--mut)",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const currentPhases =
                                          action.config.recipientConfig
                                            ?.phaseIds || [];
                                        const newPhases = e.target.checked
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
                                      className="h-3 w-3 accent-[var(--blue)]"
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
                              <p
                                className="mt-1 font-sans text-[12px]"
                                style={{ color: "var(--mut2)" }}
                              >
                                No pipeline phases available
                              </p>
                            )}
                          </div>
                        )}

                        {/* Specific Email Input */}
                        {needsEmailInput(currentRecipientType) && (
                          <input
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
                            className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--line2)",
                              color: "var(--ink)",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0 0 3px " + tint("--blue", 30))
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.boxShadow = "none")
                            }
                          />
                        )}

                        {/* Email List Input */}
                        {needsEmailListInput(currentRecipientType) && (
                          <div>
                            <input
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
                              className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                              style={{
                                background: "var(--surface-1)",
                                border: "1px solid var(--line2)",
                                color: "var(--ink)",
                              }}
                              onFocus={(e) =>
                                (e.currentTarget.style.boxShadow =
                                  "0 0 0 3px " + tint("--blue", 30))
                              }
                              onBlur={(e) =>
                                (e.currentTarget.style.boxShadow = "none")
                              }
                            />
                            <p
                              className="mt-1 font-sans text-[12px]"
                              style={{ color: "var(--mut2)" }}
                            >
                              Separate multiple emails with commas (max 50)
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {action.type === "wait" && (
                      <div className="flex items-center gap-2.5">
                        <div>
                          <label
                            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--mut2)" }}
                          >
                            Wait Duration
                          </label>
                          <input
                            type="number"
                            value={action.config.waitMinutes || 0}
                            onChange={(e) =>
                              updateActionConfig(index, {
                                waitMinutes: parseInt(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            min={0}
                            className="h-9 w-24 rounded-[10px] px-3 font-mono text-[13px] outline-none transition-shadow"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--line2)",
                              color: "var(--ink)",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0 0 3px " + tint("--mut", 30))
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.boxShadow = "none")
                            }
                          />
                        </div>
                        <span
                          className="mt-5 font-sans text-[13px]"
                          style={{ color: "var(--mut)" }}
                        >
                          minutes
                        </span>
                      </div>
                    )}

                    {action.type === "webhook" && (
                      <div>
                        <label
                          className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--cyan)" }}
                        >
                          Webhook URL
                        </label>
                        <input
                          value={action.config.webhookUrl || ""}
                          onChange={(e) =>
                            updateActionConfig(index, {
                              webhookUrl: e.target.value,
                            })
                          }
                          placeholder="https://api.example.com/webhook"
                          className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                          style={{
                            background: "var(--surface-1)",
                            border: "1px solid var(--line2)",
                            color: "var(--ink)",
                          }}
                          onFocus={(e) =>
                            (e.currentTarget.style.boxShadow =
                              "0 0 0 3px " + tint("--cyan", 30))
                          }
                          onBlur={(e) =>
                            (e.currentTarget.style.boxShadow = "none")
                          }
                        />
                      </div>
                    )}

                    {action.type === "create_notification" && (
                      <div className="space-y-2">
                        <div>
                          <label
                            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--amber)" }}
                          >
                            Notification Title
                          </label>
                          <input
                            value={action.config.title || ""}
                            onChange={(e) =>
                              updateActionConfig(index, {
                                title: e.target.value,
                              })
                            }
                            placeholder="Notification title…"
                            className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--line2)",
                              color: "var(--ink)",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0 0 3px " + tint("--amber", 30))
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.boxShadow = "none")
                            }
                          />
                        </div>
                        <div>
                          <label
                            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--amber)" }}
                          >
                            Message
                          </label>
                          <input
                            value={action.config.message || ""}
                            onChange={(e) =>
                              updateActionConfig(index, {
                                message: e.target.value,
                              })
                            }
                            placeholder="Notification message…"
                            className="h-9 w-full rounded-[10px] px-3 font-sans text-[13px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--line2)",
                              color: "var(--ink)",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0 0 3px " + tint("--amber", 30))
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.boxShadow = "none")
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Card Footer: delay before next action ──────── */}
                    <div
                      className="flex items-center gap-2.5 pt-2.5"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <label
                        className="font-sans text-[12px] shrink-0"
                        style={{ color: "var(--mut2)" }}
                      >
                        Delay before next action:
                      </label>
                      <input
                        type="number"
                        value={action.delayMinutes || 0}
                        onChange={(e) =>
                          updateAction(index, {
                            delayMinutes: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min={0}
                        className="h-8 w-16 rounded-lg px-2 font-mono text-[13px] outline-none transition-shadow"
                        style={{
                          background: "var(--surface-1)",
                          border: "1px solid var(--line2)",
                          color: "var(--ink)",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.boxShadow =
                            "0 0 0 3px " + tint("--mut", 25))
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.boxShadow = "none")
                        }
                      />
                      <span
                        className="font-sans text-[12px]"
                        style={{ color: "var(--mut2)" }}
                      >
                        minutes
                      </span>
                    </div>
                  </div>

                  {/* ── Per-action error ──────────────────────────────── */}
                  {hasError && (
                    <p
                      className="mt-2 pl-[34px] font-sans text-[12px]"
                      style={{ color: "var(--red)" }}
                    >
                      {errors[errorKey]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Dashed "add another" row at the bottom */}
          <button
            type="button"
            onClick={addAction}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-4)]"
            style={{
              border: "1px dashed var(--line2)",
              color: "var(--mut)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add another action
          </button>
        </div>
      )}

      {/* ── Global actions error ─────────────────────────────────────── */}
      {errors.actions && (
        <div
          className="rounded-lg px-3 py-2"
          style={{
            background: tint("--red", 10),
            border: `1px solid ${tint("--red", 28)}`,
          }}
        >
          <p className="font-sans text-[12px]" style={{ color: "var(--red)" }}>
            {errors.actions}
          </p>
        </div>
      )}

      {/* ── Email Template Preview Modal ─────────────────────────────── */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={() => setPreviewTemplate(null)}
      >
        <DialogContent
          className="block gap-0 border-0 p-0 shadow-none sm:max-w-none"
          style={{
            width: 680,
            maxWidth: "95vw",
            maxHeight: "82vh",
            borderRadius: 20,
            background: "var(--surface-2)",
            border: "1px solid var(--line2)",
            boxShadow: "var(--panelshadow)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DialogHeader
            className="shrink-0 px-6 pt-6 pb-4"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <DialogTitle
              className="font-display text-[17px] font-extrabold uppercase tracking-wide"
              style={{ color: "var(--ink)" }}
            >
              Email Template Preview
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {(() => {
              const template = emailTemplates.find(
                (t) => t.id === previewTemplate,
              );
              if (!template)
                return (
                  <p
                    className="font-sans text-[13px]"
                    style={{ color: "var(--mut)" }}
                  >
                    Template not found
                  </p>
                );

              return (
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: tint("--blue", 8),
                      border: `1px solid ${tint("--blue", 25)}`,
                    }}
                  >
                    <div className="space-y-2">
                      <div>
                        <p
                          className="font-mono text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--blue)" }}
                        >
                          Template Name
                        </p>
                        <p
                          className="font-sans text-[14px]"
                          style={{ color: "var(--ink)" }}
                        >
                          {template.name}
                        </p>
                      </div>
                      <div>
                        <p
                          className="font-mono text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--blue)" }}
                        >
                          Subject
                        </p>
                        <p
                          className="font-sans text-[14px]"
                          style={{ color: "var(--ink)" }}
                        >
                          {template.subject}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p
                      className="font-mono text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--mut2)" }}
                    >
                      Preview
                    </p>
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: "var(--surface-3)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(
                              template.body_html.replace(
                                /{{(.*?)}}/g,
                                '<span class="px-1 py-0.5 bg-warning/20 text-warning rounded text-xs font-mono">{{$1}}</span>',
                              ),
                            ),
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {template.variables && template.variables.length > 0 && (
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: tint("--amber", 8),
                        border: `1px solid ${tint("--amber", 25)}`,
                      }}
                    >
                      <p
                        className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--amber)" }}
                      >
                        Dynamic Variables
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map((v: string, i: number) => (
                          <code
                            key={i}
                            className="rounded px-2 py-0.5 font-mono text-[12px]"
                            style={{
                              background: tint("--amber", 16),
                              color: "var(--amber)",
                            }}
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
