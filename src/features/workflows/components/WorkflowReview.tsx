// src/features/workflows/components/WorkflowReview.tsx

import {
  Edit2,
  Mail,
  Bell,
  Clock,
  Webhook,
  Play,
  Calendar,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WorkflowFormData } from "@/types/workflow.types";

interface WorkflowReviewProps {
  data: WorkflowFormData;
  onEdit: (step: number) => void;
}

export default function WorkflowReview({ data, onEdit }: WorkflowReviewProps) {
  const ACTION_LABELS: Record<string, string> = {
    send_email: "Email",
    create_notification: "Notify",
    wait: "Wait",
    webhook: "Webhook",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon component type
  const ACTION_ICONS: Record<string, any> = {
    send_email: Mail,
    create_notification: Bell,
    wait: Clock,
    webhook: Webhook,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon component type
  const TRIGGER_ICONS: Record<string, any> = {
    manual: Play,
    schedule: Calendar,
    event: Zap,
    webhook: Webhook,
  };

  const TRIGGER_COLORS = {
    manual: "bg-info/10 text-info border-info/30 dark:text-info",
    schedule: "bg-success/10 text-success border-success/30 dark:text-success",
    event: "bg-warning/10 text-warning border-warning/30 dark:text-warning",
    webhook: "bg-info/10 text-info border-info/30 dark:text-info",
  };

  const ACTION_COLORS = {
    send_email: "bg-info/10 text-info border-info/30 dark:text-info",
    create_notification:
      "bg-warning/10 text-warning border-warning/30 dark:text-warning",
    wait: "bg-muted/10 text-muted-foreground border-input/30 dark:text-muted-foreground",
    webhook: "bg-info/10 text-info border-info/30 dark:text-info",
  };

  return (
    <div className="w-full space-y-4">
      {/* Basic Info */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-primary">
            Basic Information
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-primary/10"
            onClick={() => onEdit(0)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-base font-medium">
            {data.name || "Untitled Workflow"}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {data.category}
            </Badge>
            {data.description && (
              <span className="text-sm text-muted-foreground">
                {data.description}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trigger */}
      <div className="p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-muted-foreground">
            Trigger Configuration
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(1)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-start gap-3">
          {data.triggerType &&
            (() => {
              const TriggerIcon = TRIGGER_ICONS[data.triggerType];
              const colorClass =
                TRIGGER_COLORS[data.triggerType as keyof typeof TRIGGER_COLORS];
              return (
                <>
                  <div className={`p-2 rounded-lg border ${colorClass}`}>
                    {TriggerIcon && <TriggerIcon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium capitalize">
                      {data.triggerType} Trigger
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.triggerType === "schedule" &&
                        data.trigger?.schedule && (
                          <>
                            {data.trigger.schedule.dayOfWeek === "daily"
                              ? "Every day"
                              : data.trigger.schedule.dayOfWeek === "weekday"
                                ? "Weekdays"
                                : `Every ${data.trigger.schedule.dayOfWeek}`}{" "}
                            at {data.trigger.schedule.time}
                          </>
                        )}
                      {data.triggerType === "event" &&
                        data.trigger?.eventName && (
                          <>{data.trigger.eventName}</>
                        )}
                      {data.triggerType === "manual" && (
                        <>Manual trigger only - run from workflows list</>
                      )}
                      {data.triggerType === "webhook" && (
                        <>Via webhook URL (generated after creation)</>
                      )}
                    </p>
                  </div>
                </>
              );
            })()}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-muted/40 to-muted/60 border border-muted">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">
            Workflow Actions ({data.actions.length})
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(2)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
        {data.actions.length === 0 ? (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-sm text-warning">
              No actions configured. Add at least one action to define workflow
              behavior.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.actions.map((action, i) => {
              const ActionIcon = ACTION_ICONS[action.type];
              const colorClass =
                ACTION_COLORS[action.type as keyof typeof ACTION_COLORS];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded-lg border ${colorClass} bg-opacity-50`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border">
                    <span className="text-xs font-bold">{i + 1}</span>
                  </div>
                  {ActionIcon && <ActionIcon className="h-4 w-4" />}
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {ACTION_LABELS[action.type] || action.type}
                    </span>
                    {action.type === "send_email" &&
                      action.config.templateId && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Template configured
                        </span>
                      )}
                    {action.type === "wait" && action.config.waitMinutes && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {action.config.waitMinutes} minutes
                      </span>
                    )}
                    {action.type === "webhook" && action.config.webhookUrl && (
                      <span className="text-xs text-muted-foreground ml-2">
                        URL configured
                      </span>
                    )}
                    {action.type === "create_notification" &&
                      action.config.title && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {action.config.title}
                        </span>
                      )}
                  </div>
                  {action.delayMinutes && action.delayMinutes > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{action.delayMinutes}m
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="p-3 rounded-lg bg-muted/20 border border-muted/40">
        <p className="text-sm font-semibold text-muted-foreground mb-2">
          Workflow Settings
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-info mt-1"></div>
            <div>
              <span className="text-sm">
                Max runs per day:{" "}
                <strong className="text-foreground">
                  {data.settings?.maxRunsPerDay || 50}
                </strong>
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Limits how many times this workflow can execute in a 24-hour
                period
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-warning mt-1"></div>
            <div>
              <span className="text-sm">
                Priority:{" "}
                <strong className="text-foreground">
                  {(() => {
                    const priority = data.settings?.priority || 50;
                    if (priority >= 80) return `High (${priority}/100)`;
                    if (priority >= 60) return `Medium-High (${priority}/100)`;
                    if (priority >= 40) return `Normal (${priority}/100)`;
                    if (priority >= 20) return `Low (${priority}/100)`;
                    return `Very Low (${priority}/100)`;
                  })()}
                </strong>
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {(() => {
                  const priority = data.settings?.priority || 50;
                  if (priority >= 80)
                    return "Executes before lower priority workflows when multiple are triggered";
                  if (priority >= 60)
                    return "Slightly elevated execution priority";
                  if (priority >= 40)
                    return "Standard execution priority (default)";
                  if (priority >= 20)
                    return "Executes after higher priority workflows";
                  return "Lowest execution priority - runs last";
                })()}
              </p>
            </div>
          </div>

          {data.settings?.cooldownMinutes && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-success mt-1"></div>
              <div>
                <span className="text-sm">
                  Cooldown:{" "}
                  <strong className="text-foreground">
                    {data.settings.cooldownMinutes} minutes
                  </strong>
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Minimum wait time between workflow runs for the same recipient
                </p>
              </div>
            </div>
          )}

          {data.settings?.maxRunsPerRecipient && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-info mt-1"></div>
              <div>
                <span className="text-sm">
                  Max per recipient:{" "}
                  <strong className="text-foreground">
                    {data.settings.maxRunsPerRecipient}
                  </strong>
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Maximum times this workflow can run for a single recipient
                </p>
              </div>
            </div>
          )}

          {data.settings?.continueOnError && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-warning mt-1"></div>
              <div>
                <span className="text-sm">
                  Continue on error:{" "}
                  <strong className="text-foreground">Enabled</strong>
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Workflow continues executing even if an action fails
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation */}
      {data.actions.length === 0 && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive font-medium">
            Workflow incomplete - add at least one action to continue
          </p>
        </div>
      )}
    </div>
  );
}
