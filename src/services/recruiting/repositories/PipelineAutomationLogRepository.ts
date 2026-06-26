// src/services/recruiting/repositories/PipelineAutomationLogRepository.ts
import { BaseRepository } from "../../base/BaseRepository";
import type { Json } from "@/types/database.types";
import { getTodayString } from "@/lib/date";

export type AutomationLogStatus = "pending" | "sent" | "failed" | "skipped";

// Entity type
export interface PipelineAutomationLogEntity {
  id: string;
  automationId: string;
  recruitId: string;
  triggeredAt: string;
  triggeredDate: string; // UTC date for deduplication (computed column)
  status: AutomationLogStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

// Create type
export interface CreatePipelineAutomationLogData {
  automationId: string;
  recruitId: string;
  status: AutomationLogStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// Update type
export interface UpdatePipelineAutomationLogData {
  status?: AutomationLogStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class PipelineAutomationLogRepository extends BaseRepository<
  PipelineAutomationLogEntity,
  CreatePipelineAutomationLogData,
  UpdatePipelineAutomationLogData
> {
  constructor() {
    super("pipeline_automation_logs");
  }

  /**
   * Find logs by automation ID with pagination
   */
  async findByAutomationId(
    automationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<PipelineAutomationLogEntity[]> {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("automation_id", automationId)
      .order("triggered_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw this.handleError(error, "findByAutomationId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find logs by recruit ID with pagination
   */
  async findByRecruitId(
    recruitId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<PipelineAutomationLogEntity[]> {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("recruit_id", recruitId)
      .order("triggered_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw this.handleError(error, "findByRecruitId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Check if automation was already triggered for recruit today (UTC date)
   * Uses the triggered_date computed column for consistent timezone handling
   */
  async wasTriggeredToday(
    automationId: string,
    recruitId: string,
  ): Promise<boolean> {
    // Get today's date in LOCAL time to match the computed column
    const today = getTodayString();

    const { data, error } = await this.client
      .from(this.tableName)
      .select("id")
      .eq("automation_id", automationId)
      .eq("recruit_id", recruitId)
      .eq("triggered_date", today)
      .limit(1);

    if (error) {
      throw this.handleError(error, "wasTriggeredToday");
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Find pending logs (for retry processing)
   */
  async findPending(): Promise<PipelineAutomationLogEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("status", "pending")
      .order("triggered_at", { ascending: true });

    if (error) {
      throw this.handleError(error, "findPending");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find failed logs (for retry processing)
   */
  async findFailed(limit = 100): Promise<PipelineAutomationLogEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("status", "failed")
      .order("triggered_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw this.handleError(error, "findFailed");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Override update to use maybeSingle instead of single
   * This prevents 406 errors when the row might not exist (e.g., due to RLS or race conditions)
   */
  async update(
    id: string,
    updates: UpdatePipelineAutomationLogData,
  ): Promise<PipelineAutomationLogEntity> {
    const dbData = this.transformToDB(updates, true);

    const { data, error } = await this.client
      .from(this.tableName)
      .update(dbData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      throw this.handleError(error, "update");
    }

    if (!data) {
      // Row wasn't found - log warning but don't throw (might be RLS or deleted)
      console.warn(
        `[PipelineAutomationLogRepository] Update found no row with id ${id}`,
      );
      // Return a placeholder entity to prevent cascading errors
      return {
        id,
        automationId: "",
        recruitId: "",
        triggeredAt: new Date().toISOString(),
        triggeredDate: getTodayString(),
        status: updates.status || "pending",
        errorMessage: updates.errorMessage || null,
        metadata: updates.metadata || null,
      };
    }

    return this.transformFromDB(data);
  }

  /**
   * Transform database row to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): PipelineAutomationLogEntity {
    return {
      id: dbRecord.id as string,
      automationId: dbRecord.automation_id as string,
      recruitId: dbRecord.recruit_id as string,
      triggeredAt: dbRecord.triggered_at as string,
      triggeredDate: dbRecord.triggered_date as string,
      status: dbRecord.status as AutomationLogStatus,
      errorMessage: dbRecord.error_message as string | null,
      metadata: dbRecord.metadata as Record<string, unknown> | null,
    };
  }

  /**
   * Transform entity to database row
   */
  protected transformToDB(
    data: CreatePipelineAutomationLogData | UpdatePipelineAutomationLogData,
    isUpdate = false,
  ): Record<string, unknown> {
    if (isUpdate) {
      const updateData = data as UpdatePipelineAutomationLogData;
      const dbData: Record<string, unknown> = {};

      if (updateData.status !== undefined) dbData.status = updateData.status;
      if (updateData.errorMessage !== undefined)
        dbData.error_message = updateData.errorMessage;
      if (updateData.metadata !== undefined)
        dbData.metadata = updateData.metadata as unknown as Json;

      return dbData;
    }

    const createData = data as CreatePipelineAutomationLogData;
    return {
      automation_id: createData.automationId,
      recruit_id: createData.recruitId,
      status: createData.status,
      error_message: createData.errorMessage ?? null,
      metadata: (createData.metadata as unknown as Json) ?? null,
    };
  }
}
