// src/services/workflows/workflowService.ts
// Service for managing workflow business logic

import { supabase } from "@/services/base/supabase";
import {
  WorkflowRepository,
  type EventTypeInsertData,
  type WorkflowInsertData,
  type WorkflowUpdateData,
} from "./WorkflowRepository";
import type {
  Workflow,
  WorkflowRun,
  WorkflowTemplate,
  TriggerEventType,
  WorkflowFormData,
  WorkflowStats,
  WorkflowStatus,
} from "@/types/workflow.types";

class WorkflowService {
  private repository: WorkflowRepository;

  constructor() {
    this.repository = new WorkflowRepository();
  }

  // =====================================================
  // WORKFLOWS CRUD
  // =====================================================

  async getWorkflows(status?: WorkflowStatus): Promise<Workflow[]> {
    return this.repository.findWorkflows(status);
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const workflow = await this.repository.findByIdWithRelations(id);
    if (!workflow) {
      throw new Error("Workflow not found");
    }
    return workflow;
  }

  async createWorkflow(formData: WorkflowFormData): Promise<Workflow> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    const insertData: WorkflowInsertData = {
      name: formData.name.trim(),
      description: formData.description?.trim() ?? null,
      category: formData.category,
      trigger_type: formData.triggerType,
      status: formData.status || "draft",
      config: {
        trigger: formData.trigger,
        continueOnError: formData.settings?.continueOnError,
      },
      conditions: formData.conditions || [],
      actions: formData.actions.map((a) => ({
        type: a.type,
        order: a.order,
        config: a.config,
        delayMinutes: a.delayMinutes || 0,
        conditions: a.conditions || [],
        retryOnFailure: a.retryOnFailure ?? true,
        maxRetries: a.maxRetries || 3,
      })),
      // Blank = unlimited: undefined omits the column (NULL). The engine only
      // enforces a daily cap when this is a positive number, so workflows aren't
      // silently throttled by default.
      max_runs_per_day: formData.settings?.maxRunsPerDay,
      max_runs_per_recipient: formData.settings?.maxRunsPerRecipient ?? null,
      cooldown_minutes: formData.settings?.cooldownMinutes ?? null,
      priority: Number(formData.settings?.priority) || 50,
      created_by: user.user.id,
    };

    return this.repository.createWorkflow(insertData);
  }

  async updateWorkflow(
    id: string,
    updates: Partial<WorkflowFormData>,
  ): Promise<Workflow> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    // Fetch existing config for merging
    const existingConfig = await this.repository.getWorkflowConfig(id);

    // Build update object
    const updateData: WorkflowUpdateData = {
      last_modified_by: user.user.id,
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined)
      updateData.description = updates.description?.trim() ?? null;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.triggerType !== undefined)
      updateData.trigger_type = updates.triggerType;
    if (updates.conditions !== undefined)
      updateData.conditions = updates.conditions;

    if (updates.actions !== undefined) {
      updateData.actions = updates.actions.map((a) => ({
        type: a.type,
        order: a.order,
        config: a.config,
        delayMinutes: a.delayMinutes || 0,
        conditions: a.conditions || [],
        retryOnFailure: a.retryOnFailure ?? true,
        maxRetries: a.maxRetries || 3,
      }));
    }

    if (updates.settings?.maxRunsPerDay !== undefined) {
      updateData.max_runs_per_day = updates.settings.maxRunsPerDay;
    }
    if (updates.settings?.maxRunsPerRecipient !== undefined) {
      updateData.max_runs_per_recipient = updates.settings.maxRunsPerRecipient;
    }
    if (updates.settings?.cooldownMinutes !== undefined) {
      updateData.cooldown_minutes = updates.settings.cooldownMinutes;
    }
    if (updates.settings?.priority !== undefined) {
      updateData.priority = Number(updates.settings.priority);
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    // Handle config updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configUpdate: Record<string, any> = { ...existingConfig };

    if (updates.trigger !== undefined) {
      configUpdate.trigger = updates.trigger;
    } else if (updates.triggerType !== undefined && !updates.trigger) {
      configUpdate.trigger = { type: updates.triggerType };
    }

    if (updates.settings?.continueOnError !== undefined) {
      configUpdate.continueOnError = updates.settings.continueOnError;
    }

    updateData.config = configUpdate;

    return this.repository.updateWorkflow(id, updateData);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.repository.deleteWorkflow(id);
  }

  async updateWorkflowStatus(
    id: string,
    status: WorkflowStatus,
  ): Promise<Workflow> {
    return this.repository.updateStatus(id, status);
  }

  // =====================================================
  // WORKFLOW RUNS
  // =====================================================

  async getWorkflowRuns(
    workflowId?: string,
    limit = 50,
  ): Promise<WorkflowRun[]> {
    return this.repository.findRuns(workflowId, limit);
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun> {
    const run = await this.repository.findRunById(id);
    if (!run) {
      throw new Error("Workflow run not found");
    }
    return run;
  }

  async triggerWorkflow(
    workflowId: string,
    context: Record<string, unknown> = {},
    options?: { skipLimits?: boolean },
  ): Promise<WorkflowRun> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    // Get the workflow
    const workflow = await this.repository.findByIdWithRelations(workflowId);
    if (!workflow) throw new Error("Workflow not found");

    // Build enriched context
    const enrichedContext: Record<string, unknown> = {
      ...context,
      workflowId: workflowId,
      triggeredBy: user.user.id,
      triggeredByEmail: user.user.email,
      triggeredAt: new Date().toISOString(),
      workflowName: workflow.name,
    };

    // Default recipient to current user if not provided
    if (!enrichedContext.recipientId) {
      enrichedContext.recipientId = user.user.id;
      enrichedContext.recipientEmail = user.user.email;
      enrichedContext.recipientName =
        user.user.user_metadata?.name || user.user.email;
    }

    // Check if workflow can run (skip for manual test runs)
    if (!options?.skipLimits) {
      const canRun = await this.repository.canWorkflowRun(
        workflowId,
        enrichedContext.recipientId as string,
      );

      if (!canRun) {
        throw new Error("Workflow cannot run due to execution limits");
      }
    }

    // Create workflow run
    const run = await this.repository.createRun({
      workflow_id: workflowId,
      trigger_source: "manual",
      status: "running",
      context: enrichedContext,
    });

    // Trigger edge function asynchronously
    this.invokeWorkflowProcessor(run.id, workflowId, false);

    return run;
  }

  async cancelWorkflowRun(runId: string): Promise<WorkflowRun> {
    return this.repository.cancelRun(runId);
  }

  // =====================================================
  // WORKFLOW TEMPLATES
  // =====================================================

  async getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]> {
    return this.repository.findTemplates(category);
  }

  async createWorkflowFromTemplate(
    templateId: string,
    name: string,
  ): Promise<Workflow> {
    const template = await this.repository.findTemplateById(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Increment usage count
    await this.repository.incrementTemplateUsage(
      templateId,
      template.usageCount || 0,
    );

    // Create workflow from template
    const workflowConfig = template.workflowConfig;
    const formData: WorkflowFormData = {
      name,
      description: workflowConfig.description,
      category: workflowConfig.category || "general",
      triggerType: workflowConfig.triggerType || "manual",
      trigger: {
        type: workflowConfig.triggerType || "manual",
        eventName: undefined,
        schedule: undefined,
        webhookConfig: undefined,
      },
      conditions: workflowConfig.conditions || [],
      actions: workflowConfig.actions || [],
      settings: {
        // No cap unless the template defines one (enforcement is now live, so a
        // hard-coded default would silently throttle template-created workflows).
        maxRunsPerDay: workflowConfig.maxRunsPerDay || undefined,
        maxRunsPerRecipient: workflowConfig.maxRunsPerRecipient,
        cooldownMinutes: workflowConfig.cooldownMinutes,
        continueOnError: false,
        priority: workflowConfig.priority || 50,
      },
    };

    return this.createWorkflow(formData);
  }

  // =====================================================
  // TRIGGER EVENT TYPES
  // =====================================================

  async getTriggerEventTypes(): Promise<TriggerEventType[]> {
    return this.repository.findActiveTriggerEventTypes();
  }

  async getEventTypes(): Promise<TriggerEventType[]> {
    return this.repository.findAllEventTypes();
  }

  async createEventType(
    eventData: Omit<TriggerEventType, "id" | "createdAt">,
  ): Promise<TriggerEventType> {
    const insertData: EventTypeInsertData = {
      eventName: eventData.eventName,
      category: eventData.category,
      description: eventData.description,
      availableVariables: eventData.availableVariables,
      isActive: eventData.isActive,
    };
    return this.repository.createEventType(insertData);
  }

  async updateEventType(
    id: string,
    updates: Partial<TriggerEventType>,
  ): Promise<TriggerEventType> {
    const updateData: Partial<EventTypeInsertData> = {};
    if (updates.eventName !== undefined)
      updateData.eventName = updates.eventName;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.availableVariables !== undefined)
      updateData.availableVariables = updates.availableVariables;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    return this.repository.updateEventType(id, updateData);
  }

  async deleteEventType(id: string): Promise<void> {
    return this.repository.deleteEventType(id);
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  async getWorkflowStats(workflowId: string): Promise<WorkflowStats> {
    const { runs } = await this.repository.getRunStats(workflowId);

    const totalRuns = runs.length;
    const successfulRuns = runs.filter((r) => r.status === "completed").length;
    const failedRuns = runs.filter((r) => r.status === "failed").length;

    const durations = runs
      .filter((r) => r.duration_ms !== null)
      .map((r) => r.duration_ms as number);

    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    const lastRun =
      runs.length > 0
        ? runs.sort(
            (a, b) =>
              new Date(b.started_at).getTime() -
              new Date(a.started_at).getTime(),
          )[0]
        : null;

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      averageDuration,
      lastRunAt: lastRun?.started_at,
    };
  }

  // =====================================================
  // TEST WORKFLOW
  // =====================================================

  async testWorkflow(
    workflowId: string,
    testContext: Record<string, unknown>,
  ): Promise<WorkflowRun> {
    const run = await this.repository.createRun({
      workflow_id: workflowId,
      trigger_source: "test",
      status: "running",
      context: { ...testContext, workflowId, isTest: true },
    });

    // Trigger edge function for test workflow
    this.invokeWorkflowProcessor(run.id, workflowId, true);

    return run;
  }

  // =====================================================
  // ORG TEMPLATES
  // =====================================================

  /**
   * Get all org workflow templates in the user's IMO
   */
  async getImoWorkflowTemplates(): Promise<Workflow[]> {
    return this.repository.findImoTemplates();
  }

  /**
   * Save an existing workflow as an org template (IMO admin only)
   */
  async saveAsOrgTemplate(workflowId: string): Promise<string> {
    return this.repository.saveAsOrgTemplate(workflowId);
  }

  /**
   * Clone an org template to create a personal workflow
   */
  async cloneOrgTemplate(templateId: string, newName: string): Promise<string> {
    return this.repository.cloneOrgTemplate(templateId, newName);
  }

  /**
   * Create a new org template directly (IMO admin only)
   * Note: created_by will be set by the database function using auth.uid()
   */
  async createOrgTemplate(data: Workflow): Promise<string> {
    const insertData: WorkflowInsertData = {
      name: data.name,
      description: data.description,
      category: data.category,
      trigger_type: data.triggerType,
      status: data.status || "draft",
      config: data.config,
      conditions: data.conditions || [],
      actions: data.actions,
      max_runs_per_day: data.maxRunsPerDay,
      max_runs_per_recipient: data.maxRunsPerRecipient,
      cooldown_minutes: data.cooldownMinutes,
      priority: data.priority,
      created_by: "", // Will be set by DB function using auth.uid()
    };
    return this.repository.createOrgTemplate(insertData);
  }

  /**
   * Update an existing org template (IMO admin only)
   */
  async updateOrgTemplate(
    id: string,
    data: Partial<Workflow>,
  ): Promise<Workflow> {
    return this.repository.updateOrgTemplate(id, data);
  }

  /**
   * Delete an org template (IMO admin only)
   */
  async deleteOrgTemplate(id: string): Promise<void> {
    return this.repository.deleteOrgTemplate(id);
  }

  // =====================================================
  // PRIVATE HELPERS
  // =====================================================

  /**
   * Invoke the workflow processor edge function asynchronously
   */
  private invokeWorkflowProcessor(
    runId: string,
    workflowId: string,
    isTest: boolean,
  ): void {
    supabase.functions
      .invoke("process-workflow", {
        body: { runId, workflowId, isTest },
      })
      .then((response) => {
        if (response.error) {
          console.error("Workflow processor returned error:", response.error);
        }
      })
      .catch((err) => {
        console.error("Failed to invoke workflow processor:", err);
      });
  }
}

export const workflowService = new WorkflowService();
export { WorkflowService };
