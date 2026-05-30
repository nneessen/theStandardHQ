// src/services/recruiting/pipelineService.ts
import { supabase } from "@/services/base/supabase";
import {
  PipelineTemplateRepository,
  PipelinePhaseRepository,
  PhaseChecklistItemRepository,
} from "./repositories";
import type {
  PipelineTemplateEntity,
  CreatePipelineTemplateData,
  UpdatePipelineTemplateData,
  PipelinePhaseEntity,
  CreatePipelinePhaseData,
  UpdatePipelinePhaseData,
  PhaseChecklistItemEntity,
  CreatePhaseChecklistItemData,
  UpdatePhaseChecklistItemData,
} from "./repositories";
import type {
  PipelineTemplate,
  PipelinePhase,
  PhaseChecklistItem,
} from "@/types/recruiting.types";
import type { ChecklistMetadata } from "@/types/checklist-metadata.types";

// Repository instances
const templateRepository = new PipelineTemplateRepository();
const phaseRepository = new PipelinePhaseRepository();
const checklistItemRepository = new PhaseChecklistItemRepository();

export const pipelineService = {
  // ========================================
  // PIPELINE TEMPLATES
  // ========================================

  async getTemplates(): Promise<PipelineTemplate[]> {
    const entities = await templateRepository.findAllOrdered();
    return entities.map(mapTemplateEntityToType);
  },

  async getTemplate(id: string): Promise<
    | (PipelineTemplate & {
        phases: (PipelinePhase & { checklist_items: PhaseChecklistItem[] })[];
      })
    | null
  > {
    const result = await templateRepository.findWithPhasesAndItems(id);
    if (!result) return null;

    // The raw result from repository includes the nested data
    return result as unknown as PipelineTemplate & {
      phases: (PipelinePhase & { checklist_items: PhaseChecklistItem[] })[];
    };
  },

  async getActiveTemplate(): Promise<
    | (PipelineTemplate & {
        phases: (PipelinePhase & { checklist_items: PhaseChecklistItem[] })[];
      })
    | null
  > {
    // Find default active template
    const defaultTemplate = await templateRepository.findDefaultActive();
    if (!defaultTemplate) return null;

    // Get with phases and items
    return this.getTemplate(defaultTemplate.id);
  },

  async createTemplate(
    templateData: CreateTemplateInput,
  ): Promise<PipelineTemplate> {
    const createData: CreatePipelineTemplateData = {
      name: templateData.name,
      description: templateData.description,
      isActive: templateData.is_active,
      isDefault: templateData.is_default,
      createdBy: templateData.created_by ?? null,
      imoId: templateData.imo_id ?? null,
    };
    const entity = await templateRepository.create(createData);
    return mapTemplateEntityToType(entity);
  },

  async updateTemplate(
    id: string,
    updates: UpdateTemplateInput,
  ): Promise<PipelineTemplate> {
    const updateData: UpdatePipelineTemplateData = {
      name: updates.name,
      description: updates.description,
      isActive: updates.is_active,
      isDefault: updates.is_default,
    };
    const entity = await templateRepository.update(id, updateData);
    return mapTemplateEntityToType(entity);
  },

  async deleteTemplate(id: string): Promise<void> {
    await templateRepository.delete(id);
  },

  async setDefaultTemplate(id: string): Promise<PipelineTemplate> {
    const entity = await templateRepository.setDefault(id);
    return mapTemplateEntityToType(entity);
  },

  async duplicateTemplate(
    templateId: string,
    newName: string,
  ): Promise<string> {
    const { data, error } = await supabase.rpc("clone_pipeline_template", {
      p_template_id: templateId,
      p_new_name: newName,
    });

    if (error) {
      throw error;
    }

    return data as string;
  },

  // ========================================
  // PIPELINE PHASES
  // ========================================

  async getPhases(templateId: string): Promise<PipelinePhase[]> {
    const entities = await phaseRepository.findByTemplateId(templateId);
    return entities.map(mapPhaseEntityToType);
  },

  async getPhase(
    phaseId: string,
  ): Promise<
    (PipelinePhase & { checklist_items: PhaseChecklistItem[] }) | null
  > {
    const result = await phaseRepository.findWithChecklistItems(phaseId);
    if (!result) return null;

    return result as unknown as PipelinePhase & {
      checklist_items: PhaseChecklistItem[];
    };
  },

  async createPhase(
    templateId: string,
    phaseData: CreatePhaseInput,
  ): Promise<PipelinePhase> {
    // Get next phase order if not provided
    const phaseOrder =
      phaseData.phase_order ??
      (await phaseRepository.getNextPhaseOrder(templateId));

    const createData: CreatePipelinePhaseData = {
      templateId,
      phaseName: phaseData.phase_name,
      phaseDescription: phaseData.phase_description,
      phaseOrder,
      estimatedDays: phaseData.estimated_days,
      requiredApproverRole: phaseData.required_approver_role,
      autoAdvance: phaseData.auto_advance,
      isActive: phaseData.is_active,
      visibleToRecruit: phaseData.visible_to_recruit,
    };

    const entity = await phaseRepository.create(createData);
    return mapPhaseEntityToType(entity);
  },

  async updatePhase(
    phaseId: string,
    updates: UpdatePhaseInput,
  ): Promise<PipelinePhase> {
    const updateData: UpdatePipelinePhaseData = {
      phaseName: updates.phase_name,
      phaseDescription: updates.phase_description,
      phaseOrder: updates.phase_order,
      estimatedDays: updates.estimated_days,
      requiredApproverRole: updates.required_approver_role,
      autoAdvance: updates.auto_advance,
      isActive: updates.is_active,
      visibleToRecruit: updates.visible_to_recruit,
    };

    const entity = await phaseRepository.update(phaseId, updateData);
    return mapPhaseEntityToType(entity);
  },

  async deletePhase(phaseId: string): Promise<void> {
    await phaseRepository.delete(phaseId);
  },

  async reorderPhases(_templateId: string, phaseIds: string[]): Promise<void> {
    await phaseRepository.reorder(phaseIds);
  },

  // ========================================
  // CHECKLIST ITEMS
  // ========================================

  async getChecklistItems(phaseId: string): Promise<PhaseChecklistItem[]> {
    const entities = await checklistItemRepository.findByPhaseId(phaseId);
    return entities.map(mapChecklistItemEntityToType);
  },

  async getChecklistItem(itemId: string): Promise<PhaseChecklistItem | null> {
    const entity = await checklistItemRepository.findById(itemId);
    if (!entity) return null;
    return mapChecklistItemEntityToType(entity);
  },

  async createChecklistItem(
    phaseId: string,
    itemData: CreateChecklistItemInput,
  ): Promise<PhaseChecklistItem> {
    // Get next item order if not provided
    const itemOrder =
      itemData.item_order ??
      (await checklistItemRepository.getNextItemOrder(phaseId));

    const createData: CreatePhaseChecklistItemData = {
      phaseId,
      itemName: itemData.item_name,
      itemDescription: itemData.item_description,
      itemType: itemData.item_type,
      itemOrder,
      isRequired: itemData.is_required,
      isActive: itemData.is_active,
      visibleToRecruit: itemData.visible_to_recruit,
      documentType: itemData.document_type,
      externalLink: itemData.external_link,
      canBeCompletedBy: itemData.can_be_completed_by ?? "recruit", // Default if not provided
      requiresVerification: itemData.requires_verification,
      verificationBy: itemData.verification_by,
      metadata: itemData.metadata as unknown as
        | import("@/types/database.types").Json
        | null
        | undefined,
    };

    const entity = await checklistItemRepository.create(createData);
    return mapChecklistItemEntityToType(entity);
  },

  async updateChecklistItem(
    itemId: string,
    updates: UpdateChecklistItemInput,
  ): Promise<PhaseChecklistItem> {
    const updateData: UpdatePhaseChecklistItemData = {
      itemName: updates.item_name,
      itemDescription: updates.item_description,
      itemType: updates.item_type,
      itemOrder: updates.item_order,
      isRequired: updates.is_required,
      isActive: updates.is_active,
      visibleToRecruit: updates.visible_to_recruit,
      documentType: updates.document_type,
      externalLink: updates.external_link,
      canBeCompletedBy: updates.can_be_completed_by,
      requiresVerification: updates.requires_verification,
      verificationBy: updates.verification_by,
      metadata: updates.metadata as unknown as
        | import("@/types/database.types").Json
        | null
        | undefined,
    };

    const entity = await checklistItemRepository.update(itemId, updateData);
    return mapChecklistItemEntityToType(entity);
  },

  async deleteChecklistItem(itemId: string): Promise<void> {
    await checklistItemRepository.delete(itemId);
  },

  async reorderChecklistItems(
    _phaseId: string,
    itemIds: string[],
  ): Promise<void> {
    await checklistItemRepository.reorder(itemIds);
  },
};

// ========================================
// Input Types (for backward compatibility)
// ========================================

interface CreateTemplateInput {
  name: string;
  description?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  created_by?: string | null;
  imo_id?: string | null;
}

interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  is_default?: boolean;
}

interface CreatePhaseInput {
  phase_name: string;
  phase_description?: string | null;
  phase_order?: number;
  estimated_days?: number | null;
  required_approver_role?: string | null;
  auto_advance?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
}

interface UpdatePhaseInput {
  phase_name?: string;
  phase_description?: string | null;
  phase_order?: number;
  estimated_days?: number | null;
  required_approver_role?: string | null;
  auto_advance?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
}

interface CreateChecklistItemInput {
  item_name: string;
  item_description?: string | null;
  item_type: string;
  item_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
  document_type?: string | null;
  external_link?: string | null;
  can_be_completed_by?: string; // Optional to match recruiting.types
  requires_verification?: boolean;
  verification_by?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface UpdateChecklistItemInput {
  item_name?: string;
  item_description?: string | null;
  item_type?: string;
  item_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
  document_type?: string | null;
  external_link?: string | null;
  can_be_completed_by?: string;
  requires_verification?: boolean;
  verification_by?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ========================================
// Mapping Functions (Entity -> Type)
// ========================================

function mapTemplateEntityToType(
  entity: PipelineTemplateEntity,
): PipelineTemplate {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    is_active: entity.isActive,
    is_default: entity.isDefault,
    created_by: entity.createdBy ?? undefined,
    created_at: entity.createdAt ?? new Date().toISOString(),
    updated_at: entity.updatedAt ?? new Date().toISOString(),
  };
}

function mapPhaseEntityToType(entity: PipelinePhaseEntity): PipelinePhase {
  return {
    id: entity.id,
    template_id: entity.templateId,
    phase_name: entity.phaseName,
    phase_description: entity.phaseDescription,
    phase_order: entity.phaseOrder,
    estimated_days: entity.estimatedDays,
    required_approver_role: entity.requiredApproverRole,
    auto_advance: entity.autoAdvance,
    is_active: entity.isActive,
    visible_to_recruit: entity.visibleToRecruit,
  };
}

function mapChecklistItemEntityToType(
  entity: PhaseChecklistItemEntity,
): PhaseChecklistItem {
  return {
    id: entity.id,
    phase_id: entity.phaseId,
    item_name: entity.itemName,
    item_description: entity.itemDescription,
    item_type: entity.itemType,
    item_order: entity.itemOrder,
    is_required: entity.isRequired,
    is_active: entity.isActive,
    visible_to_recruit: entity.visibleToRecruit,
    document_type: entity.documentType,
    external_link: entity.externalLink,
    can_be_completed_by: entity.canBeCompletedBy,
    requires_verification: entity.requiresVerification,
    verification_by: entity.verificationBy,
    metadata: entity.metadata as ChecklistMetadata,
  };
}
