// src/services/settings/call-types/CallTypeService.ts
import type { ServiceResponse } from "@/services/base/BaseService";
import { CallTypeRepository } from "./CallTypeRepository";
import type { Database } from "@/types/database.types";

type CallTypeRow = Database["public"]["Tables"]["kpi_call_types"]["Row"];

export interface CallTypeCreateForm {
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  imo_id: string;
  created_by?: string | null;
}

export interface CallTypeUpdateForm {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes(UNIQUE_VIOLATION) ||
      msg.includes("unique") ||
      msg.includes("duplicate") ||
      msg.includes("uq_kpi_call_types_imo_name")
    );
  }
  return false;
}

export class CallTypeService {
  private repository: CallTypeRepository;

  constructor(repository: CallTypeRepository) {
    this.repository = repository;
  }

  async getAllForImo(imoId: string): Promise<ServiceResponse<CallTypeRow[]>> {
    try {
      const data = await this.repository.getAllForImo(imoId);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getActiveForImo(
    imoId: string,
  ): Promise<ServiceResponse<CallTypeRow[]>> {
    try {
      const data = await this.repository.getActiveForImo(imoId);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async createFromForm(
    form: CallTypeCreateForm,
  ): Promise<ServiceResponse<CallTypeRow>> {
    const name = form.name?.trim();
    if (!name) {
      return {
        success: false,
        error: new Error("Call type name is required"),
      };
    }

    try {
      const data = await this.repository.create({
        name,
        description: form.description ?? null,
        sort_order: form.sort_order ?? 0,
        is_active: form.is_active ?? true,
        imo_id: form.imo_id,
        created_by: form.created_by ?? null,
      });
      return { success: true, data };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          success: false,
          error: new Error("A call type with that name already exists"),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async updateFromForm(
    id: string,
    patch: CallTypeUpdateForm,
  ): Promise<ServiceResponse<CallTypeRow>> {
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) {
        return {
          success: false,
          error: new Error("Call type name is required"),
        };
      }
      patch = { ...patch, name };
    }

    try {
      const data = await this.repository.update(id, patch);
      return { success: true, data };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          success: false,
          error: new Error("A call type with that name already exists"),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await this.repository.delete(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

// Singleton
const callTypeRepository = new CallTypeRepository();
export const callTypeService = new CallTypeService(callTypeRepository);
