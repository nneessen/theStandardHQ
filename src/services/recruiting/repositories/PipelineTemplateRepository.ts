// src/services/recruiting/repositories/PipelineTemplateRepository.ts
import { BaseRepository } from "../../base/BaseRepository";
import type { Database } from "@/types/database.types";

// Database row types
type PipelineTemplateRow =
  Database["public"]["Tables"]["pipeline_templates"]["Row"];

// Entity type
export interface PipelineTemplateEntity {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Owning IMO — carried through so the admin UI can show/verify tenancy. */
  imoId: string | null;
}

// Create/update types
export interface CreatePipelineTemplateData {
  name: string;
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  createdBy?: string | null;
  imoId?: string | null;
}

export interface UpdatePipelineTemplateData {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

export class PipelineTemplateRepository extends BaseRepository<
  PipelineTemplateEntity,
  CreatePipelineTemplateData,
  UpdatePipelineTemplateData
> {
  constructor() {
    super("pipeline_templates");
  }

  /**
   * Find all templates ordered by default and creation date
   */
  async findAllOrdered(): Promise<PipelineTemplateEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw this.handleError(error, "findAllOrdered");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find active templates
   */
  async findActive(): Promise<PipelineTemplateEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw this.handleError(error, "findActive");
    }

    return (data || []).map((row) => this.transformFromDB(row));
  }

  /**
   * Find the default active template
   */
  async findDefaultActive(): Promise<PipelineTemplateEntity | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw this.handleError(error, "findDefaultActive");
    }

    return data ? this.transformFromDB(data) : null;
  }

  /**
   * Set a template as the default (unsets others)
   */
  async setDefault(id: string): Promise<PipelineTemplateEntity> {
    // Resolve the target's IMO so we only flip defaults WITHIN that tenant.
    // Without this scoping a super-admin (whose RLS is unconditional) would
    // clear is_default on every IMO's templates, corrupting other tenants'
    // default pipelines.
    const { data: target, error: targetError } = await this.client
      .from(this.tableName)
      .select("imo_id")
      .eq("id", id)
      .single();

    if (targetError) {
      throw this.handleError(targetError, "setDefault:lookup");
    }

    const targetImoId = (target as { imo_id: string | null }).imo_id;

    // Unset default only within the same IMO (NULL-IMO templates form their own
    // shared scope and must not clobber tenant-owned defaults).
    let unset = this.client
      .from(this.tableName)
      .update({ is_default: false })
      .neq("id", id);
    unset =
      targetImoId === null
        ? unset.is("imo_id", null)
        : unset.eq("imo_id", targetImoId);
    await unset;

    // Then set the specified one as default
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_default: true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "setDefault");
    }

    return this.transformFromDB(data);
  }

  /**
   * Find template with phases and checklist items
   */
  async findWithPhasesAndItems(id: string): Promise<
    | (PipelineTemplateRow & {
        phases: (Database["public"]["Tables"]["pipeline_phases"]["Row"] & {
          checklist_items: Database["public"]["Tables"]["phase_checklist_items"]["Row"][];
        })[];
      })
    | null
  > {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        phases:pipeline_phases(
          *,
          checklist_items:phase_checklist_items(*)
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findWithPhasesAndItems");
    }

    return data;
  }

  /**
   * Transform database row to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): PipelineTemplateEntity {
    const row = dbRecord as PipelineTemplateRow;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.is_active ?? true,
      isDefault: row.is_default ?? false,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      imoId: row.imo_id ?? null,
    };
  }

  /**
   * Transform entity to database row
   */
  protected transformToDB(
    data: CreatePipelineTemplateData | UpdatePipelineTemplateData,
    isUpdate = false,
  ): Record<string, unknown> {
    if (isUpdate) {
      const updateData = data as UpdatePipelineTemplateData;
      const dbData: Record<string, unknown> = {};

      if (updateData.name !== undefined) dbData.name = updateData.name;
      if (updateData.description !== undefined)
        dbData.description = updateData.description;
      if (updateData.isActive !== undefined)
        dbData.is_active = updateData.isActive;
      if (updateData.isDefault !== undefined)
        dbData.is_default = updateData.isDefault;

      dbData.updated_at = new Date().toISOString();
      return dbData;
    }

    const createData = data as CreatePipelineTemplateData;
    return {
      name: createData.name,
      description: createData.description ?? null,
      is_active: createData.isActive ?? true,
      is_default: createData.isDefault ?? false,
      created_by: createData.createdBy ?? null,
      imo_id: createData.imoId ?? null,
    };
  }
}
