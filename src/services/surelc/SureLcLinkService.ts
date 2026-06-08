// src/services/surelc/SureLcLinkService.ts
import { BaseService, type ServiceResponse } from "../base/BaseService";
import { SureLcLinkRepository } from "./SureLcLinkRepository";
import type {
  SureLcLink,
  CreateSureLcLinkData,
  UpdateSureLcLinkData,
} from "@/types/surelc.types";

function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export class SureLcLinkService extends BaseService<
  SureLcLink,
  CreateSureLcLinkData,
  UpdateSureLcLinkData
> {
  declare protected repository: SureLcLinkRepository;

  constructor(repository: SureLcLinkRepository) {
    super(repository);
  }

  protected initializeValidationRules(): void {
    this.validationRules = [
      {
        field: "label",
        validate: (value) => {
          if (typeof value !== "string") return false;
          const trimmed = value.trim();
          return trimmed.length > 0 && trimmed.length <= 120;
        },
        message: "A label is required (1–120 characters).",
      },
      {
        field: "url",
        validate: (value) => isValidUrl(value),
        message: "A valid http(s) URL is required.",
      },
    ];
  }

  /** Company/shared links for the current user's IMO. */
  async getShared(): Promise<ServiceResponse<SureLcLink[]>> {
    try {
      return { success: true, data: await this.repository.findShared() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /** The current user's own personal links. */
  async getMine(userId: string): Promise<ServiceResponse<SureLcLink[]>> {
    try {
      return { success: true, data: await this.repository.findMine(userId) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /** Update validates only the fields actually present (partial update). */
  async update(
    id: string,
    updates: UpdateSureLcLinkData,
  ): Promise<ServiceResponse<SureLcLink>> {
    const rules = this.validationRules.filter((rule) => rule.field in updates);
    const errors = this.validate(updates as Record<string, unknown>, rules);
    if (errors.length > 0) {
      return {
        success: false,
        error: new Error(errors.map((e) => e.message).join(", ")),
      };
    }
    try {
      return { success: true, data: await this.repository.update(id, updates) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

// Singleton
const sureLcLinkRepository = new SureLcLinkRepository();
export const sureLcLinkService = new SureLcLinkService(sureLcLinkRepository);
