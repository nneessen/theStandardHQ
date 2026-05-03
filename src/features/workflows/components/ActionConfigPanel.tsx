// src/features/workflows/components/ActionConfigPanel.tsx

import { useState } from "react";
import {
  X,
  Info,
  Variable,
  TestTube,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WorkflowAction } from "@/types/workflow.types";
import { useEmailTemplates } from "@/features/email";
import { useAuth } from "@/contexts/AuthContext";
import { getVariablesByCategory } from "@/lib/templateVariables";

interface ActionConfigPanelProps {
  action: WorkflowAction;
  onUpdate: (updates: Partial<WorkflowAction>) => void;
  onClose: () => void;
}

/** Workflow-context variables derived from shared source, shaped as {{ key }} strings for copy-paste */
const VARIABLE_LIST = getVariablesByCategory("workflow").map((group) => ({
  category: group.category,
  variables: group.variables.map((v) => `{{${v.key}}}`),
}));

export default function ActionConfigPanel({
  action,
  onUpdate,
  onClose,
}: ActionConfigPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const { data: emailTemplates = [] } = useEmailTemplates({ isActive: true });
  const { user } = useAuth();

  const insertVariable = (
    variable: string,
    field: "title" | "message" | "webhookUrl" | "fieldValue",
  ) => {
    const currentValue = (action.config[field] as string) || "";
    onUpdate({
      config: {
        ...action.config,
        [field]: currentValue + " " + variable,
      },
    });
  };

  const renderConfigFields = () => {
    switch (action.type) {
      case "send_email":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Email Template</Label>
              <Select
                value={(action.config.templateId as string) || ""}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, templateId: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm border-input bg-background hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent className="min-w-[250px]">
                  {emailTemplates.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No templates available
                    </div>
                  ) : (
                    emailTemplates.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={template.id}
                        className="py-2 cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {template.name}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {template.subject}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Who Receives This Email?
              </Label>
              <Select
                value={(action.config.recipientType as string) || "triggeruser"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, recipientType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm border-input bg-background hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Select recipient..." />
                </SelectTrigger>
                <SelectContent className="min-w-[280px]">
                  <SelectItem
                    value="triggeruser"
                    className="py-2 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        Person Who Triggered Workflow
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        E.g., recruit being processed
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="specific_email"
                    className="py-2 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        Specific Email Address
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Enter exact email below
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="currentuser"
                    className="py-2 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        Current User ({user?.email})
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        You will receive this email
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="manager" className="py-2 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        Manager/Upline
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Send to manager in hierarchy
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="all_trainers"
                    className="py-2 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">All Trainers</span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Everyone with trainer role
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="all_agents"
                    className="py-2 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        All Active Agents
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Everyone with agent role
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Show recipient summary */}
              <div className="mt-2 p-2 rounded-md bg-muted/30 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground">
                  Email will be sent to:
                </p>
                <p className="text-xs font-semibold mt-1">
                  {action.config.recipientType === "triggeruser" &&
                    "The person who triggered this workflow"}
                  {action.config.recipientType === "specific_email" &&
                    (action.config.recipientEmail || "Enter email below")}
                  {action.config.recipientType === "currentuser" &&
                    `You (${user?.email})`}
                  {action.config.recipientType === "manager" &&
                    "The manager/upline of the trigger user"}
                  {action.config.recipientType === "all_trainers" &&
                    "All users with Trainer role"}
                  {action.config.recipientType === "all_agents" &&
                    "All users with Agent role"}
                </p>
              </div>
            </div>

            {action.config.recipientType === "specific_email" && (
              <div>
                <Label className="text-sm font-medium">Email Address</Label>
                <Input
                  value={(action.config.recipientEmail as string) || ""}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        ...action.config,
                        recipientEmail: e.target.value,
                      },
                    })
                  }
                  placeholder="email@example.com"
                  className="h-9 text-sm"
                  type="email"
                  required
                />
                {action.config.recipientEmail &&
                  !action.config.recipientEmail.includes("@") && (
                    <p className="text-xs text-destructive mt-1">
                      Please enter a valid email address
                    </p>
                  )}
              </div>
            )}
          </>
        );

      case "create_notification":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">
                Who Gets This Notification?
              </Label>
              <Select
                value={(action.config.recipientType as string) || "triggeruser"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, recipientType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="triggeruser" className="text-sm">
                    <div>
                      <div className="font-medium">
                        Person Who Triggered Workflow
                      </div>
                      <div className="text-xs text-muted-foreground">
                        E.g., recruit being processed
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="currentuser" className="text-sm">
                    <div>
                      <div className="font-medium">
                        Current User ({user?.email})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        You will see this notification
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="manager" className="text-sm">
                    <div>
                      <div className="font-medium">Manager/Upline</div>
                      <div className="text-xs text-muted-foreground">
                        Notify the manager in hierarchy
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="all_trainers" className="text-sm">
                    <div>
                      <div className="font-medium">All Trainers</div>
                      <div className="text-xs text-muted-foreground">
                        Everyone with trainer role
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Show recipient summary */}
              <div className="mt-2 p-2 rounded-md bg-muted/30 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground">
                  Notification will appear for:
                </p>
                <p className="text-xs font-semibold mt-1">
                  {action.config.recipientType === "triggeruser" &&
                    "The person who triggered this workflow"}
                  {action.config.recipientType === "currentuser" &&
                    `You (${user?.email})`}
                  {action.config.recipientType === "manager" &&
                    "The manager/upline of the trigger user"}
                  {action.config.recipientType === "all_trainers" &&
                    "All users with Trainer role"}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">
                  Notification Title
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() =>
                          insertVariable("{{recruit_name}}", "title")
                        }
                      >
                        <Variable className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert variable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                value={(action.config.title as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, title: e.target.value },
                  })
                }
                placeholder="e.g., Task Completed"
                className="h-9 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Message</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() =>
                          insertVariable("{{recruit_name}}", "message")
                        }
                      >
                        <Variable className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert variable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                value={(action.config.message as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, message: e.target.value },
                  })
                }
                placeholder="Notification message..."
                className="min-h-[80px] text-sm resize-none"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Type</Label>
              <Select
                value={(action.config.notificationType as string) || "info"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, notificationType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info" className="text-sm">
                    Info
                  </SelectItem>
                  <SelectItem value="success" className="text-sm">
                    Success
                  </SelectItem>
                  <SelectItem value="warning" className="text-sm">
                    Warning
                  </SelectItem>
                  <SelectItem value="error" className="text-sm">
                    Error
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case "wait":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Wait Duration</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input
                    type="number"
                    value={Math.floor(
                      ((action.config.waitMinutes as number) || 0) / 1440,
                    )}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      const hours = Math.floor(
                        (((action.config.waitMinutes as number) || 0) % 1440) /
                          60,
                      );
                      const mins =
                        ((action.config.waitMinutes as number) || 0) % 60;
                      onUpdate({
                        config: {
                          ...action.config,
                          waitMinutes: days * 1440 + hours * 60 + mins,
                        },
                      });
                    }}
                    className="h-9 text-sm"
                    min={0}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
                <div>
                  <Input
                    type="number"
                    value={Math.floor(
                      (((action.config.waitMinutes as number) || 0) % 1440) /
                        60,
                    )}
                    onChange={(e) => {
                      const days = Math.floor(
                        ((action.config.waitMinutes as number) || 0) / 1440,
                      );
                      const hours = parseInt(e.target.value) || 0;
                      const mins =
                        ((action.config.waitMinutes as number) || 0) % 60;
                      onUpdate({
                        config: {
                          ...action.config,
                          waitMinutes: days * 1440 + hours * 60 + mins,
                        },
                      });
                    }}
                    className="h-9 text-sm"
                    min={0}
                    max={23}
                  />
                  <span className="text-xs text-muted-foreground">hours</span>
                </div>
                <div>
                  <Input
                    type="number"
                    value={((action.config.waitMinutes as number) || 0) % 60}
                    onChange={(e) => {
                      const days = Math.floor(
                        ((action.config.waitMinutes as number) || 0) / 1440,
                      );
                      const hours = Math.floor(
                        (((action.config.waitMinutes as number) || 0) % 1440) /
                          60,
                      );
                      const mins = parseInt(e.target.value) || 0;
                      onUpdate({
                        config: {
                          ...action.config,
                          waitMinutes: days * 1440 + hours * 60 + mins,
                        },
                      });
                    }}
                    className="h-9 text-sm"
                    min={0}
                    max={59}
                  />
                  <span className="text-xs text-muted-foreground">mins</span>
                </div>
              </div>

              <div className="mt-2 p-2 rounded-md bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  Total wait: {action.config.waitMinutes || 0} minutes
                  {((action.config.waitMinutes as number) || 0) > 60 && (
                    <span>
                      {" "}
                      ({Math.floor(
                        (action.config.waitMinutes as number) / 60,
                      )}h {(action.config.waitMinutes as number) % 60}m)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </>
        );

      case "webhook":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Webhook URL</Label>
              <Input
                value={(action.config.webhookUrl as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, webhookUrl: e.target.value },
                  })
                }
                placeholder="https://api.example.com/webhook"
                className="h-9 text-sm font-mono"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">HTTP Method</Label>
              <Select
                value={(action.config.webhookMethod as string) || "POST"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, webhookMethod: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET" className="text-sm">
                    GET
                  </SelectItem>
                  <SelectItem value="POST" className="text-sm">
                    POST
                  </SelectItem>
                  <SelectItem value="PUT" className="text-sm">
                    PUT
                  </SelectItem>
                  <SelectItem value="PATCH" className="text-sm">
                    PATCH
                  </SelectItem>
                  <SelectItem value="DELETE" className="text-sm">
                    DELETE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Headers (JSON)</Label>
              <Textarea
                value={
                  typeof action.config.webhookHeaders === "string"
                    ? action.config.webhookHeaders
                    : JSON.stringify(action.config.webhookHeaders || {})
                }
                onChange={(e) =>
                  onUpdate({
                    config: {
                      ...action.config,
                      webhookHeaders: e.target.value,
                    },
                  })
                }
                placeholder='{"Authorization": "Bearer token"}'
                className="h-20 text-sm font-mono resize-none"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Body (JSON)</Label>
              <Textarea
                value={
                  typeof action.config.webhookBody === "string"
                    ? action.config.webhookBody
                    : JSON.stringify(action.config.webhookBody || {})
                }
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, webhookBody: e.target.value },
                  })
                }
                placeholder='{"key": "value"}'
                className="h-20 text-sm font-mono resize-none"
              />
            </div>
          </>
        );

      case "update_field":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Entity Type</Label>
              <Select
                value={(action.config.entityType as string) || "recruit"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, entityType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruit" className="text-sm">
                    Recruit
                  </SelectItem>
                  <SelectItem value="policy" className="text-sm">
                    Policy
                  </SelectItem>
                  <SelectItem value="commission" className="text-sm">
                    Commission
                  </SelectItem>
                  <SelectItem value="user" className="text-sm">
                    User
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Field Name</Label>
              <Input
                value={(action.config.fieldName as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, fieldName: e.target.value },
                  })
                }
                placeholder="e.g., status, assigned_to, etc."
                className="h-9 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Field Value</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() =>
                          insertVariable("{{recruit_name}}", "fieldValue")
                        }
                      >
                        <Variable className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert variable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                value={(action.config.fieldValue as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, fieldValue: e.target.value },
                  })
                }
                placeholder="New value for the field"
                className="h-9 text-sm"
              />
            </div>
          </>
        );

      case "assignuser":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Assign To</Label>
              <Select
                value={(action.config.userId as string) || ""}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, userId: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user?.id || ""} className="text-sm">
                    {user?.first_name
                      ? `${user.first_name} ${user.last_name || ""}`.trim()
                      : user?.email || "Current User"}
                  </SelectItem>
                  <SelectItem value="manager" className="text-sm">
                    Manager
                  </SelectItem>
                  <SelectItem value="trainer" className="text-sm">
                    Trainer
                  </SelectItem>
                  <SelectItem value="next_available" className="text-sm">
                    Next Available
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Entity Type</Label>
              <Select
                value={(action.config.assignEntityType as string) || "recruit"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, assignEntityType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruit" className="text-sm">
                    Recruit
                  </SelectItem>
                  <SelectItem value="task" className="text-sm">
                    Task
                  </SelectItem>
                  <SelectItem value="lead" className="text-sm">
                    Lead
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Assignment Note</Label>
              <Textarea
                value={(action.config.assignmentNote as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: {
                      ...action.config,
                      assignmentNote: e.target.value,
                    },
                  })
                }
                placeholder="Optional note about this assignment..."
                className="h-20 text-sm resize-none"
              />
            </div>
          </>
        );

      case "create_task":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Task Title</Label>
              <Input
                value={(action.config.taskTitle as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, taskTitle: e.target.value },
                  })
                }
                placeholder="e.g., Follow up with recruit"
                className="h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={(action.config.taskDescription as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: {
                      ...action.config,
                      taskDescription: e.target.value,
                    },
                  })
                }
                placeholder="Task details and instructions..."
                className="h-20 text-sm resize-none"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Priority</Label>
              <Select
                value={(action.config.taskPriority as string) || "medium"}
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, taskPriority: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-sm">
                    Low Priority
                  </SelectItem>
                  <SelectItem value="medium" className="text-sm">
                    Medium Priority
                  </SelectItem>
                  <SelectItem value="high" className="text-sm">
                    High Priority
                  </SelectItem>
                  <SelectItem value="urgent" className="text-sm">
                    Urgent
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Due In</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={(action.config.taskDueDays as number) || 1}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        ...action.config,
                        taskDueDays: parseInt(e.target.value) || 1,
                      },
                    })
                  }
                  className="h-9 text-sm w-20"
                  min={0}
                />
                <span className="text-sm text-muted-foreground">
                  days from now
                </span>
              </div>
            </div>
          </>
        );

      case "branch":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">Condition Type</Label>
              <Select
                value={
                  (action.config.conditionType as string) || "field_equals"
                }
                onValueChange={(value) =>
                  onUpdate({
                    config: { ...action.config, conditionType: value },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field_equals" className="text-sm">
                    Field Equals
                  </SelectItem>
                  <SelectItem value="field_contains" className="text-sm">
                    Field Contains
                  </SelectItem>
                  <SelectItem value="field_greater" className="text-sm">
                    Field Greater Than
                  </SelectItem>
                  <SelectItem value="field_less" className="text-sm">
                    Field Less Than
                  </SelectItem>
                  <SelectItem value="field_empty" className="text-sm">
                    Field Is Empty
                  </SelectItem>
                  <SelectItem value="field_not_empty" className="text-sm">
                    Field Is Not Empty
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Field to Check</Label>
              <Input
                value={(action.config.conditionField as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: {
                      ...action.config,
                      conditionField: e.target.value,
                    },
                  })
                }
                placeholder="e.g., recruit_status"
                className="h-9 text-sm"
              />
            </div>

            {!["field_empty", "field_not_empty"].includes(
              (action.config.conditionType as string) || "",
            ) && (
              <div>
                <Label className="text-sm font-medium">Expected Value</Label>
                <Input
                  value={(action.config.conditionValue as string) || ""}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        ...action.config,
                        conditionValue: e.target.value,
                      },
                    })
                  }
                  placeholder="Value to compare against"
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Branch Actions</Label>
              <div className="p-2 rounded-md bg-success/10 dark:bg-success/10 border border-success/30">
                <p className="text-xs font-medium text-success mb-1">If True</p>
                <p className="text-xs text-muted-foreground">
                  Continue to next action
                </p>
              </div>
              <div className="p-2 rounded-md bg-destructive/10 dark:bg-destructive/10 border border-destructive/30">
                <p className="text-xs font-medium text-destructive mb-1">
                  If False
                </p>
                <Select
                  value={(action.config.elseBranch as string) || "skip"}
                  onValueChange={(value) =>
                    onUpdate({
                      config: { ...action.config, elseBranch: value },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip" className="text-xs">
                      Skip remaining actions
                    </SelectItem>
                    <SelectItem value="continue" className="text-xs">
                      Continue anyway
                    </SelectItem>
                    <SelectItem value="jump" className="text-xs">
                      Jump to specific action
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        );

      case "ai_decision":
        return (
          <>
            <div>
              <Label className="text-sm font-medium">AI Prompt</Label>
              <Textarea
                value={(action.config.aiPrompt as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, aiPrompt: e.target.value },
                  })
                }
                placeholder="Describe what decision the AI should make..."
                className="h-24 text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The AI will analyze the context and make a decision based on
                this prompt
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Context to Provide</Label>
              <div className="space-y-2">
                {[
                  "recruit_data",
                  "workflow_history",
                  "user_data",
                  "recent_activities",
                ].map((context) => (
                  <label key={context} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(
                        (action.config.aiContext as string[]) || []
                      ).includes(context)}
                      onChange={(e) => {
                        const contexts =
                          (action.config.aiContext as string[]) || [];
                        if (e.target.checked) {
                          onUpdate({
                            config: {
                              ...action.config,
                              aiContext: [...contexts, context],
                            },
                          });
                        } else {
                          onUpdate({
                            config: {
                              ...action.config,
                              aiContext: contexts.filter((c) => c !== context),
                            },
                          });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm">
                      {context
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Decision Options</Label>
              <Textarea
                value={(action.config.aiOptions as string) || ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...action.config, aiOptions: e.target.value },
                  })
                }
                placeholder="Option 1: Do this&#10;Option 2: Do that&#10;Option 3: Skip"
                className="h-20 text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                List the possible decisions, one per line
              </p>
            </div>
          </>
        );

      default:
        return (
          <div className="p-3 rounded-md bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              Configuration for {action.type} is not yet implemented.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-80 border-l bg-card p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Configure Action</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Action Type Badge */}
      <Badge variant="outline" className="text-xs px-2 py-0.5 mb-3">
        {action.type.replace("_", " ").toUpperCase()}
      </Badge>

      {/* Configuration Fields */}
      <div className="space-y-3">
        {renderConfigFields()}

        {/* Delay Before Action */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Delay Before Action</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs">
                    Add a delay before this action executes. Useful for spacing
                    out emails or waiting for external processes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={action.delayMinutes || 0}
              onChange={(e) =>
                onUpdate({ delayMinutes: parseInt(e.target.value) || 0 })
              }
              className="h-9 text-sm w-20"
              min={0}
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="pt-3 border-t">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium">Advanced Settings</span>
            {showAdvanced ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Retry on Failure</Label>
                <Switch
                  checked={action.retryOnFailure ?? true}
                  onCheckedChange={(checked) =>
                    onUpdate({ retryOnFailure: checked })
                  }
                />
              </div>

              {action.retryOnFailure && (
                <div>
                  <Label className="text-sm font-medium">Max Retries</Label>
                  <Input
                    type="number"
                    value={action.maxRetries || 3}
                    onChange={(e) =>
                      onUpdate({ maxRetries: parseInt(e.target.value) || 3 })
                    }
                    className="h-9 text-sm"
                    min={1}
                    max={10}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Action */}
        <div className="pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm border-info/30 hover:border-info/70 hover:bg-info/10"
            onClick={async () => {
              setTestMode(true);
              const { toast } = await import("sonner");
              const { supabase } = await import("@/services/base/supabase");

              try {
                // For email actions, actually send a test email via Gmail
                if (action.type === "send_email") {
                  if (!action.config.templateId) {
                    toast.error("Select a template first", {
                      description:
                        "You need to select an email template before testing",
                    });
                    return;
                  }

                  // Determine who to send test email to
                  let testRecipient = user?.email;
                  if (
                    action.config.recipientType === "specific_email" &&
                    action.config.recipientEmail
                  ) {
                    testRecipient = action.config.recipientEmail;
                  }

                  if (!testRecipient) {
                    toast.error("No recipient", {
                      description: "Could not determine test recipient",
                    });
                    return;
                  }

                  toast.info("Sending test email...", {
                    description: `Sending to ${testRecipient} via your Gmail`,
                  });

                  // Get the template
                  const { data: template, error: templateError } =
                    await supabase
                      .from("email_templates")
                      .select("*")
                      .eq("id", action.config.templateId)
                      .single();

                  if (templateError || !template) {
                    toast.error("Template not found");
                    return;
                  }

                  // Send via the send-email edge function (uses user's Gmail)
                  const { data: result, error: sendError } =
                    await supabase.functions.invoke("send-email", {
                      body: {
                        to: [testRecipient],
                        subject: `[TEST] ${template.subject}`,
                        bodyHtml: template.body_html,
                        bodyText: template.body_text,
                      },
                    });

                  if (sendError) {
                    throw sendError;
                  }

                  if (result?.success) {
                    toast.success("Test email sent!", {
                      description: `Email sent to ${testRecipient} from your Gmail. Check your inbox.`,
                    });
                  } else {
                    throw new Error(result?.error || "Failed to send email");
                  }
                }
                // For notifications, create an actual test notification
                else if (action.type === "create_notification") {
                  if (!action.config.title || !action.config.message) {
                    toast.error("Missing notification content", {
                      description: "Add a title and message first",
                    });
                    return;
                  }

                  const { error: notifError } = await supabase
                    .from("notifications")
                    .insert({
                      user_id: user?.id,
                      type: "workflow_test",
                      title: `[TEST] ${action.config.title}`,
                      message: action.config.message,
                      is_read: false,
                    });

                  if (notifError) throw notifError;

                  toast.success("Test notification created!", {
                    description: "Check your notification bell",
                  });
                }
                // For other actions, show what would happen
                else if (action.type === "wait") {
                  toast.info("Wait action configured", {
                    description: `Would wait ${action.config.waitMinutes || 0} minutes before next action`,
                  });
                } else if (action.type === "webhook") {
                  if (!action.config.webhookUrl) {
                    toast.error("No webhook URL", {
                      description: "Enter a webhook URL first",
                    });
                    return;
                  }
                  toast.info("Webhook configured", {
                    description: `Would send ${action.config.webhookMethod || "POST"} to ${action.config.webhookUrl}`,
                  });
                } else {
                  toast.info("Action configured", {
                    description: `${action.type} action is ready to use`,
                  });
                }
              } catch (error) {
                console.error("Test failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error";

                // Provide helpful error messages
                if (errorMsg.includes("Gmail not connected")) {
                  toast.error("Gmail not connected", {
                    description:
                      "Connect your Gmail in Settings > Email to send emails",
                  });
                } else if (errorMsg.includes("quota")) {
                  toast.error("Email quota exceeded", {
                    description: "You've reached your daily email limit",
                  });
                } else {
                  toast.error("Test failed", { description: errorMsg });
                }
              } finally {
                setTestMode(false);
              }
            }}
          >
            <TestTube className="h-3 w-3 mr-1" />
            {testMode ? "Testing..." : "Test This Action"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            {action.type === "send_email"
              ? "Sends a real test email via your Gmail"
              : "Tests the action configuration"}
          </p>
        </div>
      </div>

      {/* Variable Helper */}
      <div className="mt-4 p-2 rounded-md bg-muted/30 border border-border/50 max-h-64 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Click to Copy Template Variables
        </p>
        <div className="space-y-2">
          {VARIABLE_LIST.map((category) => (
            <div key={category.category}>
              <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
                {category.category}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {category.variables.map((variable) => (
                  <Badge
                    key={variable}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(variable);
                      // Show a toast feedback
                      const toast = document.createElement("div");
                      toast.className =
                        "fixed bottom-4 right-4 bg-success text-white text-xs px-3 py-1.5 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2";
                      toast.textContent = `Copied: ${variable}`;
                      document.body.appendChild(toast);
                      setTimeout(() => {
                        toast.remove();
                      }, 2000);
                    }}
                    title={`Click to copy ${variable}`}
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
