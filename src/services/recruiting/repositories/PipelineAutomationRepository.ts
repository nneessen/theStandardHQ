// src/services/recruiting/repositories/PipelineAutomationRepository.ts
import { BaseRepository } from "../../base/BaseRepository";
import type { Json } from "@/types/database.types";
import type {
  AutomationTriggerType,
  AutomationCommunicationType,
  AutomationSenderType,
  RecipientConfig,
} from "@/types/recruiting.types";

// Entity type
export interface PipelineAutomationEntity {
  id: string;
  phaseId: string | null;
  checklistItemId: string | null;
  imoId: string | null; // Required for system automations, null for phase/item automations
  triggerType: AutomationTriggerType;
  communicationType: AutomationCommunicationType;
  delayDays: number | null;
  recipients: RecipientConfig[];
  emailTemplateId: string | null;
  emailSubject: string | null;
  emailBodyHtml: string | null;
  notificationTitle: string | null;
  notificationMessage: string | null;
  smsMessage: string | null;
  senderType: AutomationSenderType | null;
  senderEmail: string | null;
  senderName: string | null;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

// Create type
export interface CreatePipelineAutomationData {
  phaseId?: string;
  checklistItemId?: string;
  imoId?: string; // Required for system automations
  triggerType: AutomationTriggerType;
  communicationType?: AutomationCommunicationType;
  delayDays?: number;
  recipients: RecipientConfig[];
  emailTemplateId?: string;
  emailSubject?: string;
  emailBodyHtml?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  smsMessage?: string;
  senderType?: AutomationSenderType;
  senderEmail?: string;
  senderName?: string;
}

// Update type
export interface UpdatePipelineAutomationData {
  triggerType?: AutomationTriggerType;
  communicationType?: AutomationCommunicationType;
  delayDays?: number | null;
  recipients?: RecipientConfig[];
  emailTemplateId?: string | null;
  emailSubject?: string | null;
  emailBodyHtml?: string | null;
  notificationTitle?: string | null;
  notificationMessage?: string | null;
  smsMessage?: string | null;
  senderType?: AutomationSenderType | null;
  senderEmail?: string | null;
  senderName?: string | null;
  isActive?: boolean;
}

export class PipelineAutomationRepository extends BaseRepository<
  PipelineAutomationEntity,
  CreatePipelineAutomationData,
  UpdatePipelineAutomationData
> {
  constructor() {
    super("pipeline_automations");
  }

  /**
   * Find automations by phase ID
   */
  async findByPhaseId(phaseId: string): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("phase_id", phaseId)
      .order("created_at", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByPhaseId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find active automations by phase ID
   */
  async findActiveByPhaseId(
    phaseId: string,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("phase_id", phaseId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      throw this.handleError(error, "findActiveByPhaseId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find automations by checklist item ID
   */
  async findByChecklistItemId(
    checklistItemId: string,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("checklist_item_id", checklistItemId)
      .order("created_at", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByChecklistItemId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find active automations by checklist item ID
   */
  async findActiveByChecklistItemId(
    checklistItemId: string,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("checklist_item_id", checklistItemId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      throw this.handleError(error, "findActiveByChecklistItemId");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find automations by trigger type for a phase
   */
  async findByPhaseAndTrigger(
    phaseId: string,
    triggerType: AutomationTriggerType,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("phase_id", phaseId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (error) {
      throw this.handleError(error, "findByPhaseAndTrigger");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find automations by trigger type for a checklist item
   */
  async findByItemAndTrigger(
    checklistItemId: string,
    triggerType: AutomationTriggerType,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("checklist_item_id", checklistItemId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (error) {
      throw this.handleError(error, "findByItemAndTrigger");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find system-level automations (no phase_id or checklist_item_id)
   * These are automations that trigger on system events like password not set
   */
  async findSystemAutomations(): Promise<PipelineAutomationEntity[]> {
    // Use the get_system_automations() SECURITY DEFINER RPC instead of a direct
    // table select. pipeline_automations carries ~14 permissive RLS policies
    // (each subquerying user_profiles' ~15-branch mega-policy); a plain select
    // made the planner expand 5700+ InitPlans (~26s PLANNING) → statement_timeout
    // 500s. The RPC enforces the same super_admin + imo_admin_system access
    // inline and plans in <1ms.
    const { data, error } = await this.client.rpc("get_system_automations");

    if (error) {
      throw this.handleError(error, "findSystemAutomations");
    }

    // The RPC returns SETOF pipeline_automations; supabase-js types a set-
    // returning rpc as the element shape, so coerce to a row array for transform.
    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => this.transformFromDB(row));
  }

  /**
   * Find active system-level automations by trigger type
   */
  async findActiveSystemByTrigger(
    triggerType: AutomationTriggerType,
  ): Promise<PipelineAutomationEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .is("phase_id", null)
      .is("checklist_item_id", null)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (error) {
      throw this.handleError(error, "findActiveSystemByTrigger");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Transform database row to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): PipelineAutomationEntity {
    return {
      id: dbRecord.id as string,
      phaseId: dbRecord.phase_id as string | null,
      checklistItemId: dbRecord.checklist_item_id as string | null,
      imoId: dbRecord.imo_id as string | null,
      triggerType: dbRecord.trigger_type as AutomationTriggerType,
      communicationType:
        (dbRecord.communication_type as AutomationCommunicationType) || "both",
      delayDays: dbRecord.delay_days as number | null,
      recipients: (dbRecord.recipients as RecipientConfig[]) || [],
      emailTemplateId: dbRecord.email_template_id as string | null,
      emailSubject: dbRecord.email_subject as string | null,
      emailBodyHtml: dbRecord.email_body_html as string | null,
      notificationTitle: dbRecord.notification_title as string | null,
      notificationMessage: dbRecord.notification_message as string | null,
      smsMessage: dbRecord.sms_message as string | null,
      senderType:
        (dbRecord.sender_type as AutomationSenderType | null) || "system",
      senderEmail: dbRecord.sender_email as string | null,
      senderName: dbRecord.sender_name as string | null,
      createdBy: dbRecord.created_by as string | null,
      isActive: (dbRecord.is_active as boolean) ?? true,
      createdAt: dbRecord.created_at as string | null,
      updatedAt: dbRecord.updated_at as string | null,
    };
  }

  /**
   * Transform entity to database row
   */
  protected transformToDB(
    data: CreatePipelineAutomationData | UpdatePipelineAutomationData,
    isUpdate = false,
  ): Record<string, unknown> {
    if (isUpdate) {
      const updateData = data as UpdatePipelineAutomationData;
      const dbData: Record<string, unknown> = {};

      if (updateData.triggerType !== undefined)
        dbData.trigger_type = updateData.triggerType;
      if (updateData.communicationType !== undefined)
        dbData.communication_type = updateData.communicationType;
      if (updateData.delayDays !== undefined)
        dbData.delay_days = updateData.delayDays;
      if (updateData.recipients !== undefined)
        dbData.recipients = updateData.recipients as unknown as Json;
      if (updateData.emailTemplateId !== undefined)
        dbData.email_template_id = updateData.emailTemplateId;
      if (updateData.emailSubject !== undefined)
        dbData.email_subject = updateData.emailSubject;
      if (updateData.emailBodyHtml !== undefined)
        dbData.email_body_html = updateData.emailBodyHtml;
      if (updateData.notificationTitle !== undefined)
        dbData.notification_title = updateData.notificationTitle;
      if (updateData.notificationMessage !== undefined)
        dbData.notification_message = updateData.notificationMessage;
      if (updateData.smsMessage !== undefined)
        dbData.sms_message = updateData.smsMessage;
      if (updateData.senderType !== undefined)
        dbData.sender_type = updateData.senderType;
      if (updateData.senderEmail !== undefined)
        dbData.sender_email = updateData.senderEmail;
      if (updateData.senderName !== undefined)
        dbData.sender_name = updateData.senderName;
      if (updateData.isActive !== undefined)
        dbData.is_active = updateData.isActive;

      dbData.updated_at = new Date().toISOString();
      return dbData;
    }

    const createData = data as CreatePipelineAutomationData;
    return {
      phase_id: createData.phaseId ?? null,
      checklist_item_id: createData.checklistItemId ?? null,
      imo_id: createData.imoId ?? null,
      trigger_type: createData.triggerType,
      communication_type: createData.communicationType ?? "both",
      delay_days: createData.delayDays ?? null,
      recipients: createData.recipients as unknown as Json,
      email_template_id: createData.emailTemplateId ?? null,
      email_subject: createData.emailSubject ?? null,
      email_body_html: createData.emailBodyHtml ?? null,
      notification_title: createData.notificationTitle ?? null,
      notification_message: createData.notificationMessage ?? null,
      sms_message: createData.smsMessage ?? null,
      sender_type: createData.senderType ?? "system",
      sender_email: createData.senderEmail ?? null,
      sender_name: createData.senderName ?? null,
    };
  }
}
