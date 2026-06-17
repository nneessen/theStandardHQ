// src/services/workflows/WorkflowRepository.ts
// Repository for workflow-related tables data access

import { BaseRepository, BaseEntity } from "../base/BaseRepository";
import { logger } from "../base/logger";
import type { Database } from "@/types/database.types";
import type {
  Workflow,
  WorkflowRun,
  WorkflowTemplate,
  TriggerEventType,
  WorkflowStatus,
} from "@/types/workflow.types";

// Database row types
type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"];
type WorkflowTemplateRow =
  Database["public"]["Tables"]["workflow_templates"]["Row"];
type TriggerEventTypeRow =
  Database["public"]["Tables"]["trigger_event_types"]["Row"];
type TriggerEventTypeInsert =
  Database["public"]["Tables"]["trigger_event_types"]["Insert"];

// Base entity type for workflows
export type WorkflowBaseEntity = WorkflowRow & BaseEntity;

// Run insert data
export interface WorkflowRunInsertData {
  workflow_id: string;
  trigger_source: string;
  status: string;
  context: Record<string, unknown>;
}

// Workflow insert data (raw DB format)
export interface WorkflowInsertData {
  name: string;
  description?: string | null;
  category: string;
  trigger_type: string;
  status: string;
  config: Record<string, unknown>;
  conditions: unknown[];
  actions: unknown[];
  max_runs_per_day?: number | null;
  max_runs_per_recipient?: number | null;
  cooldown_minutes?: number | null;
  priority?: number;
  created_by: string;
}

// Workflow update data (raw DB format)
export interface WorkflowUpdateData {
  name?: string;
  description?: string | null;
  category?: string;
  trigger_type?: string;
  status?: string;
  config?: Record<string, unknown>;
  conditions?: unknown[];
  actions?: unknown[];
  max_runs_per_day?: number | null;
  max_runs_per_recipient?: number | null;
  cooldown_minutes?: number | null;
  priority?: number;
  last_modified_by?: string;
  updated_at?: string;
}

// Event type insert data (camelCase for service layer)
export interface EventTypeInsertData {
  eventName: string;
  category: string;
  description?: string;
  availableVariables?: Record<string, string>;
  isActive?: boolean;
}

/**
 * Repository for workflow-related tables
 * Handles workflows, workflow_runs, workflow_templates, trigger_event_types
 */
export class WorkflowRepository extends BaseRepository<
  WorkflowBaseEntity,
  WorkflowInsertData,
  WorkflowUpdateData
> {
  constructor() {
    super("workflows");
  }

  /**
   * Transform database record to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): WorkflowBaseEntity {
    return dbRecord as unknown as WorkflowBaseEntity;
  }

  /**
   * Transform entity to database record
   */
  protected transformToDB(data: WorkflowInsertData): Record<string, unknown> {
    return data as unknown as Record<string, unknown>;
  }

  // ============================================
  // Workflow Methods
  // ============================================

  /**
   * Get all workflows, optionally filtered by status
   */
  async findWorkflows(status?: WorkflowStatus): Promise<Workflow[]> {
    try {
      let query = this.client
        .from("workflows")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        throw this.handleError(error, "findWorkflows");
      }

      return (data || []).map((row) => this.transformWorkflowFromDB(row));
    } catch (error) {
      throw this.wrapError(error, "findWorkflows");
    }
  }

  /**
   * Get a workflow by ID with triggers and actions
   */
  async findByIdWithRelations(id: string): Promise<Workflow | null> {
    try {
      const { data, error } = await this.client
        .from("workflows")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "findByIdWithRelations");
      }

      return this.transformWorkflowFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "findByIdWithRelations");
    }
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(data: WorkflowInsertData): Promise<Workflow> {
    try {
      const { data: workflow, error } = await this.client
        .from("workflows")
        .insert(data as never)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "createWorkflow");
      }

      return this.transformWorkflowFromDB(workflow);
    } catch (error) {
      throw this.wrapError(error, "createWorkflow");
    }
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(
    id: string,
    data: WorkflowUpdateData,
  ): Promise<Workflow> {
    try {
      const { data: workflow, error } = await this.client
        .from("workflows")
        .update(data as never)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "updateWorkflow");
      }

      return this.transformWorkflowFromDB(workflow);
    } catch (error) {
      throw this.wrapError(error, "updateWorkflow");
    }
  }

  /**
   * Get workflow config (for merging during updates)
   */
  async getWorkflowConfig(id: string): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.client
        .from("workflows")
        .select("config")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "getWorkflowConfig");
      }

      return (data?.config as Record<string, unknown>) || {};
    } catch (error) {
      throw this.wrapError(error, "getWorkflowConfig");
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from("workflows")
        .delete()
        .eq("id", id);

      if (error) {
        throw this.handleError(error, "deleteWorkflow");
      }
    } catch (error) {
      throw this.wrapError(error, "deleteWorkflow");
    }
  }

  /**
   * Update workflow status
   */
  async updateStatus(id: string, status: WorkflowStatus): Promise<Workflow> {
    try {
      const { data, error } = await this.client
        .from("workflows")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "updateStatus");
      }

      return this.transformWorkflowFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "updateStatus");
    }
  }

  // ============================================
  // Workflow Runs Methods
  // ============================================

  /**
   * Get workflow runs, optionally filtered by workflow ID
   */
  async findRuns(workflowId?: string, limit = 50): Promise<WorkflowRun[]> {
    try {
      let query = this.client
        .from("workflow_runs")
        .select(
          `
          *,
          workflow:workflows (
            id,
            name,
            status,
            trigger_type
          )
        `,
        )
        .order("started_at", { ascending: false })
        .limit(limit);

      if (workflowId) {
        query = query.eq("workflow_id", workflowId);
      }

      const { data, error } = await query;

      if (error) {
        throw this.handleError(error, "findRuns");
      }

      return (data || []).map((row) => this.transformRunFromDB(row));
    } catch (error) {
      throw this.wrapError(error, "findRuns");
    }
  }

  /**
   * Get a workflow run by ID
   */
  async findRunById(id: string): Promise<WorkflowRun | null> {
    try {
      const { data, error } = await this.client
        .from("workflow_runs")
        .select(
          `
          *,
          workflows (*)
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "findRunById");
      }

      return this.transformRunFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "findRunById");
    }
  }

  /**
   * Create a workflow run
   */
  async createRun(data: WorkflowRunInsertData): Promise<WorkflowRun> {
    try {
      const { data: run, error } = await this.client
        .from("workflow_runs")
        .insert(data as never)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "createRun");
      }

      return this.transformRunFromDB(run);
    } catch (error) {
      throw this.wrapError(error, "createRun");
    }
  }

  /**
   * Cancel a workflow run
   */
  async cancelRun(runId: string): Promise<WorkflowRun> {
    try {
      const { data, error } = await this.client
        .from("workflow_runs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "cancelRun");
      }

      return this.transformRunFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "cancelRun");
    }
  }

  /**
   * Get workflow run stats for a workflow
   */
  async getRunStats(workflowId: string): Promise<{
    runs: Array<{
      status: string;
      duration_ms: number | null;
      started_at: string;
    }>;
  }> {
    try {
      const { data, error } = await this.client
        .from("workflow_runs")
        .select("status, duration_ms, started_at")
        .eq("workflow_id", workflowId);

      if (error) {
        throw this.handleError(error, "getRunStats");
      }

      return { runs: data || [] };
    } catch (error) {
      throw this.wrapError(error, "getRunStats");
    }
  }

  /**
   * Check if workflow can run via RPC
   */
  async canWorkflowRun(
    workflowId: string,
    recipientId: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.client.rpc("can_workflow_run", {
        p_workflow_id: workflowId,
        p_recipient_id: recipientId,
      });

      if (error) {
        logger.warn("WorkflowRepository.canWorkflowRun RPC failed", error);
        return true; // Allow run if RPC fails
      }

      return data ?? true;
    } catch (error) {
      logger.warn(
        "WorkflowRepository.canWorkflowRun exception",
        error instanceof Error ? error : new Error(String(error)),
      );
      return true; // Allow run if check fails
    }
  }

  // ============================================
  // Workflow Templates Methods
  // ============================================

  /**
   * Get workflow templates, optionally filtered by category
   */
  async findTemplates(category?: string): Promise<WorkflowTemplate[]> {
    try {
      let query = this.client
        .from("workflow_templates")
        .select("*")
        .order("usage_count", { ascending: false });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) {
        throw this.handleError(error, "findTemplates");
      }

      return (data || []).map((row) => this.transformTemplateFromDB(row));
    } catch (error) {
      throw this.wrapError(error, "findTemplates");
    }
  }

  /**
   * Get a template by ID
   */
  async findTemplateById(id: string): Promise<WorkflowTemplate | null> {
    try {
      const { data, error } = await this.client
        .from("workflow_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "findTemplateById");
      }

      return this.transformTemplateFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "findTemplateById");
    }
  }

  /**
   * Increment template usage count
   */
  async incrementTemplateUsage(
    templateId: string,
    currentCount: number,
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from("workflow_templates")
        .update({ usage_count: currentCount + 1 })
        .eq("id", templateId);

      if (error) {
        throw this.handleError(error, "incrementTemplateUsage");
      }
    } catch (error) {
      throw this.wrapError(error, "incrementTemplateUsage");
    }
  }

  // ============================================
  // Trigger Event Types Methods
  // ============================================

  /**
   * Get active trigger event types
   */
  async findActiveTriggerEventTypes(): Promise<TriggerEventType[]> {
    try {
      const { data, error } = await this.client
        .from("trigger_event_types")
        .select("*")
        .eq("is_active", true)
        .order("category");

      if (error) {
        throw this.handleError(error, "findActiveTriggerEventTypes");
      }

      return this.transformEventTypes(data || []);
    } catch (error) {
      throw this.wrapError(error, "findActiveTriggerEventTypes");
    }
  }

  /**
   * Get all trigger event types
   */
  async findAllEventTypes(): Promise<TriggerEventType[]> {
    try {
      const { data, error } = await this.client
        .from("trigger_event_types")
        .select("*")
        .order("category, event_name");

      if (error) {
        throw this.handleError(error, "findAllEventTypes");
      }

      return this.transformEventTypes(data || []);
    } catch (error) {
      throw this.wrapError(error, "findAllEventTypes");
    }
  }

  /**
   * Create a trigger event type
   */
  async createEventType(data: EventTypeInsertData): Promise<TriggerEventType> {
    try {
      const dbData: TriggerEventTypeInsert = {
        event_name: data.eventName,
        category: data.category,
        description: data.description ?? null,
        available_variables: data.availableVariables ?? null,
        is_active: data.isActive ?? true,
      };

      const { data: created, error } = await this.client
        .from("trigger_event_types")
        .insert(dbData)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "createEventType");
      }

      return this.transformEventType(created);
    } catch (error) {
      throw this.wrapError(error, "createEventType");
    }
  }

  /**
   * Update a trigger event type
   */
  async updateEventType(
    id: string,
    updates: Partial<EventTypeInsertData>,
  ): Promise<TriggerEventType> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: any = {};
      if (updates.eventName !== undefined)
        dbUpdates.event_name = updates.eventName;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.description !== undefined)
        dbUpdates.description = updates.description;
      if (updates.availableVariables !== undefined)
        dbUpdates.available_variables = updates.availableVariables;
      if (updates.isActive !== undefined)
        dbUpdates.is_active = updates.isActive;

      const { data, error } = await this.client
        .from("trigger_event_types")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "updateEventType");
      }

      return this.transformEventType(data);
    } catch (error) {
      throw this.wrapError(error, "updateEventType");
    }
  }

  /**
   * Delete a trigger event type
   */
  async deleteEventType(id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from("trigger_event_types")
        .delete()
        .eq("id", id);

      if (error) {
        throw this.handleError(error, "deleteEventType");
      }
    } catch (error) {
      throw this.wrapError(error, "deleteEventType");
    }
  }

  // ============================================
  // Org Template Methods
  // ============================================

  /**
   * Get all org workflow templates in the user's IMO
   */
  async findImoTemplates(): Promise<Workflow[]> {
    try {
      const { data, error } = await this.client.rpc(
        "get_imo_workflow_templates",
      );

      if (error) {
        throw this.handleError(error, "findImoTemplates");
      }

      return (data || []).map((row: Record<string, unknown>) =>
        this.transformWorkflowFromDB(row),
      );
    } catch (error) {
      throw this.wrapError(error, "findImoTemplates");
    }
  }

  /**
   * Save an existing workflow as an org template
   */
  async saveAsOrgTemplate(workflowId: string): Promise<string> {
    try {
      const { data, error } = await this.client.rpc(
        "save_workflow_as_org_template",
        {
          p_workflow_id: workflowId,
        },
      );

      if (error) {
        throw this.handleError(error, "saveAsOrgTemplate");
      }

      return data as string;
    } catch (error) {
      throw this.wrapError(error, "saveAsOrgTemplate");
    }
  }

  /**
   * Clone an org template to create a personal workflow
   */
  async cloneOrgTemplate(templateId: string, newName: string): Promise<string> {
    try {
      const { data, error } = await this.client.rpc("clone_org_template", {
        p_template_id: templateId,
        p_new_name: newName,
      });

      if (error) {
        throw this.handleError(error, "cloneOrgTemplate");
      }

      return data as string;
    } catch (error) {
      throw this.wrapError(error, "cloneOrgTemplate");
    }
  }

  /**
   * Create a new org template directly (IMO admin only)
   */
  async createOrgTemplate(data: WorkflowInsertData): Promise<string> {
    try {
      const { data: templateId, error } = await this.client.rpc(
        "create_org_workflow_template",
        {
          p_name: data.name,
          p_description: data.description || null,
          p_category: data.category,
          p_trigger_type: data.trigger_type,
          p_config: data.config,
          p_conditions: data.conditions || [],
          p_actions: data.actions,
          // null = unlimited (engine enforcement is live; don't force a cap)
          p_max_runs_per_day: data.max_runs_per_day ?? null,
          p_max_runs_per_recipient: data.max_runs_per_recipient || null,
          p_cooldown_minutes: data.cooldown_minutes || null,
          p_priority: data.priority || 50,
        },
      );

      if (error) {
        throw this.handleError(error, "createOrgTemplate");
      }

      return templateId as string;
    } catch (error) {
      throw this.wrapError(error, "createOrgTemplate");
    }
  }

  /**
   * Update an existing org template (IMO admin only)
   */
  async updateOrgTemplate(
    id: string,
    data: WorkflowUpdateData,
  ): Promise<Workflow> {
    return this.updateWorkflow(id, data);
  }

  /**
   * Delete an org template (IMO admin only)
   */
  async deleteOrgTemplate(id: string): Promise<void> {
    return this.deleteWorkflow(id);
  }

  // ============================================
  // Private Transform Methods
  // ============================================

  /**
   * Transform DB workflow row to Workflow entity (snake_case to camelCase)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformWorkflowFromDB(row: any): Workflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category,
      status: row.status,
      triggerType: row.trigger_type,
      config: row.config || {},
      conditions: row.conditions || [],
      actions: row.actions || [],
      maxRunsPerDay: row.max_runs_per_day,
      maxRunsPerRecipient: row.max_runs_per_recipient ?? undefined,
      cooldownMinutes: row.cooldown_minutes ?? undefined,
      priority: row.priority,
      imoId: row.imo_id ?? undefined,
      isOrgTemplate: row.is_org_template ?? false,
      createdBy: row.created_by,
      createdByName: row.created_by_name ?? undefined,
      lastModifiedBy: row.last_modified_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Include relations if present
      ...(row.workflow_triggers && { workflowTriggers: row.workflow_triggers }),
      ...(row.workflow_actions && { workflowActions: row.workflow_actions }),
    };
  }

  /**
   * Transform DB workflow run row to WorkflowRun entity
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformRunFromDB(row: any): WorkflowRun {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflow: row.workflow
        ? this.transformWorkflowFromDB(row.workflow)
        : undefined,
      triggerSource: row.trigger_source ?? undefined,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      context: row.context || {},
      actionsExecuted: row.actions_executed || [],
      error: row.error ?? undefined,
      // Include workflows relation if present (different key)
      ...(row.workflows && {
        workflow: this.transformWorkflowFromDB(row.workflows),
      }),
    };
  }

  /**
   * Transform DB template row to WorkflowTemplate entity
   */
  private transformTemplateFromDB(row: WorkflowTemplateRow): WorkflowTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category as WorkflowTemplate["category"],
      icon: row.icon ?? undefined,
      workflowConfig: (row.workflow_config as Partial<Workflow>) || {},
      isPublic: row.is_public ?? undefined,
      isFeatured: row.is_featured ?? undefined,
      createdBy: row.created_by ?? undefined,
      usageCount: row.usage_count ?? 0,
      createdAt: row.created_at ?? undefined,
    };
  }

  /**
   * Transform DB event types to camelCase
   */
  private transformEventTypes(rows: TriggerEventTypeRow[]): TriggerEventType[] {
    return rows.map((item) => this.transformEventType(item));
  }

  /**
   * Transform single DB event type to camelCase
   */
  private transformEventType(item: TriggerEventTypeRow): TriggerEventType {
    return {
      id: item.id,
      eventName: item.event_name,
      category: item.category,
      description: item.description ?? undefined,
      availableVariables:
        (item.available_variables as Record<string, string>) ?? undefined,
      isActive: item.is_active ?? undefined,
      createdAt: item.created_at ?? undefined,
    };
  }
}
