// Workflow types for automation system

import type { RecipientConfig } from "./workflow-recipients.types";

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowCategory =
  | "email"
  | "recruiting"
  | "commission"
  | "general";
export type TriggerType = "manual" | "schedule" | "event" | "webhook";
export type WorkflowRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowCondition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "in"
    | "not_in";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic condition value
  value: any;
  combineWith?: "AND" | "OR";
}

export interface WorkflowAction {
  id?: string;
  type:
    | "send_email"
    | "send_sms"
    | "create_notification"
    | "update_field"
    | "webhook"
    | "wait"
    // NOTE: branch/create_task/assignuser/ai_decision are not implemented — the
    // engine (process-workflow) throws on them. Kept in the union only because
    // ActionConfigPanel/TestRunDialog still reference them; the UI redesign will
    // remove these along with their config panels.
    | "create_task"
    | "branch"
    | "assignuser"
    | "ai_decision";
  order: number;
  config: {
    // Email action - NEW structured recipient config (preferred)
    recipientConfig?: RecipientConfig;
    // Email action - LEGACY fields (kept for backward compatibility)
    templateId?: string;
    recipientId?: string;
    recipientType?: string;
    recipientEmail?: string;
    variables?: Record<string, unknown>;

    // SMS action (message body reuses the shared `message` field below)
    recipientPhone?: string; // for recipientType "specific_phone"

    // Update field action
    entityType?: string;
    fieldName?: string;
    fieldValue?: unknown;

    // Webhook action
    webhookUrl?: string;
    webhookMethod?: string;
    webhookHeaders?: Record<string, string> | string;
    webhookBody?: Record<string, unknown> | string;

    // Wait action
    waitMinutes?: number;

    // Branch action
    branchConditions?: WorkflowCondition[];
    conditions?: WorkflowCondition[];
    conditionType?: string;
    conditionField?: string;
    conditionValue?: string;
    elseBranch?: string;

    // Notification config
    title?: string;
    message?: string;
    notificationType?: string;
    link?: string;

    // Assign user action
    userId?: string;
    assignEntityType?: string;
    assignmentNote?: string;

    // Create task action
    taskTitle?: string;
    taskDescription?: string;
    taskPriority?: string;
    taskDueDays?: number;
    description?: string;
    dueDate?: string;

    // AI decision action
    prompt?: string;
    aiPrompt?: string;
    aiContext?: string[];
    aiOptions?: string;
  };
  conditions?: WorkflowCondition[];
  delayMinutes?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface WorkflowTrigger {
  id?: string;
  type: TriggerType;
  eventName?: string; // For event triggers
  schedule?: {
    cronExpression?: string;
    timezone?: string;
    time?: string;
    dayOfWeek?: string;
    dayOfMonth?: number;
    // Flexible scheduling options
    frequency?: "hourly" | "daily" | "weekdays" | "weekly" | "monthly";
    selectedDays?: string[]; // For weekly: ['monday', 'wednesday', 'friday']
    intervalHours?: number; // For hourly: run every X hours
  };
  webhookConfig?: {
    endpoint?: string;
    secret?: string;
  };
  conditions?: WorkflowCondition[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  status: WorkflowStatus;
  triggerType: TriggerType;

  // Configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic workflow config
  config: Record<string, any>;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];

  // Execution settings
  maxRunsPerDay?: number | null;
  maxRunsPerRecipient?: number;
  cooldownMinutes?: number;
  priority?: number;

  // Organization template fields
  imoId?: string;
  isOrgTemplate?: boolean;

  // Metadata
  createdBy?: string;
  createdByName?: string;
  lastModifiedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflow?: Workflow;
  triggerSource?: string;
  status: WorkflowRunStatus;

  // Execution details
  startedAt: string;
  completedAt?: string;
  durationMs?: number;

  // Context and results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic workflow context
  context: Record<string, any>;
  actionsExecuted: Array<{
    actionId: string;
    status: "success" | "failed" | "skipped";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic action result
    result?: any;
    error?: string;
  }>;
  errorMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic error details
  errorDetails?: Record<string, any>;

  // Performance metrics
  emailsSent?: number;
  actionsCompleted?: number;
  actionsFailed?: number;

  createdAt?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  icon?: string;

  // Template definition
  workflowConfig: Partial<Workflow>;

  // Visibility
  isPublic?: boolean;
  isFeatured?: boolean;
  createdBy?: string;

  // Usage tracking
  usageCount?: number;
  rating?: number;

  createdAt?: string;
  updatedAt?: string;
}

export interface TriggerEventType {
  id: string;
  eventName: string;
  category: string;
  description?: string;
  availableVariables?: Record<string, string>;
  isActive?: boolean;
  createdAt?: string;
}

// Helper types for UI components
export interface WorkflowFormData {
  name: string;
  description?: string;
  category: WorkflowCategory;
  triggerType: TriggerType;
  trigger: WorkflowTrigger;
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  settings: {
    maxRunsPerDay?: number | null;
    maxRunsPerRecipient?: number;
    cooldownMinutes?: number;
    continueOnError?: boolean;
    priority?: number;
  };
  status?: WorkflowStatus;
}

export interface WorkflowStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRunAt?: string;
  nextScheduledAt?: string;
}
