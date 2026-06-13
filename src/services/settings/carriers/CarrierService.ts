// src/services/settings/carriers/CarrierService.ts
import { BaseService, type ServiceResponse } from "../../base/BaseService";
import { CarrierRepository } from "./CarrierRepository";
import type {
  Carrier,
  NewCarrierForm,
  CarrierContactInfo,
  CarrierInsert,
  CarrierUpdate,
} from "@/types/carrier.types";
import type { Json } from "@/types/database.types";

type CarrierEntity = Carrier;
type CarrierCreateData = CarrierInsert;
type CarrierUpdateData = CarrierUpdate;

/**
 * Service for carrier business logic
 * Extends BaseService for standard CRUD operations
 */
export class CarrierService extends BaseService<
  CarrierEntity,
  CarrierCreateData,
  CarrierUpdateData
> {
  constructor(repository: CarrierRepository) {
    super(repository);
  }

  /**
   * Initialize validation rules for carrier data
   */
  protected initializeValidationRules(): void {
    this.validationRules = [
      {
        field: "name",
        validate: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "Carrier name is required",
      },
      {
        field: "code",
        validate: (value) => {
          if (value === undefined || value === null || value === "")
            return true; // Optional field
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "Carrier code must be a non-empty string if provided",
      },
      {
        field: "is_active",
        validate: (value) => {
          if (value === undefined || value === null) return true; // Optional field
          return typeof value === "boolean";
        },
        message: "is_active must be a boolean value",
      },
      {
        field: "contact_info",
        validate: (value) => {
          if (value === undefined || value === null) return true; // Optional field

          const contactInfo = value as CarrierContactInfo;

          // Validate email format if provided
          if (contactInfo.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactInfo.email)) return false;
          }

          // Validate rep_email format if provided
          if (contactInfo.rep_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactInfo.rep_email)) return false;
          }

          // Validate phone formats if provided (basic validation)
          if (contactInfo.phone && contactInfo.phone.trim().length < 10) {
            return false;
          }
          if (
            contactInfo.rep_phone &&
            contactInfo.rep_phone.trim().length < 10
          ) {
            return false;
          }

          // Validate website format if provided (basic validation)
          if (contactInfo.website) {
            try {
              new URL(contactInfo.website);
            } catch {
              return false;
            }
          }

          return true;
        },
        message:
          "Contact info must have valid email addresses, phone numbers (min 10 chars), and website URL if provided",
      },
      {
        field: "imo_id",
        validate: (value) => {
          if (value === undefined || value === null || value === "")
            return true; // Optional field
          // UUID validation (basic)
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return typeof value === "string" && uuidRegex.test(value);
        },
        message: "IMO ID must be a valid UUID if provided",
      },
    ];
  }

  /**
   * Create a new carrier from form data (User-facing API)
   * Transforms NewCarrierForm to repository format
   */
  async createFromForm(
    data: NewCarrierForm,
  ): Promise<ServiceResponse<CarrierEntity>> {
    // Transform NewCarrierForm to repository format
    const repositoryData: CarrierCreateData = {
      name: data.name,
      code: data.code || null,
      is_active: data.is_active ?? true,
      contact_info: (data.contact_info || null) as Json,
      commission_structure: null, // Always null on creation
      imo_id: data.imo_id || undefined,
      advance_cap: data.advance_cap ?? null,
      contracting_metadata: (data.contracting_metadata || null) as Json,
    };

    return super.create(repositoryData);
  }

  /**
   * Update carrier from partial form data (User-facing API)
   * Transforms partial NewCarrierForm to repository format
   */
  async updateFromForm(
    id: string,
    data: Partial<NewCarrierForm>,
  ): Promise<ServiceResponse<CarrierEntity>> {
    // Debug: log incoming data
    console.log("[CarrierService.updateFromForm] Received data:", {
      id,
      name: data.name,
      code: data.code,
      is_active: data.is_active,
      imo_id: data.imo_id,
      advance_cap: data.advance_cap,
      hasAdvanceCap: "advance_cap" in data,
      advanceCapType: typeof data.advance_cap,
    });

    // Transform partial NewCarrierForm to repository format
    const repositoryData: CarrierUpdateData = {};

    if (data.name !== undefined) repositoryData.name = data.name;
    if (data.code !== undefined) repositoryData.code = data.code || null;
    if (data.is_active !== undefined) repositoryData.is_active = data.is_active;
    if (data.contact_info !== undefined) {
      repositoryData.contact_info = (data.contact_info || null) as Json;
    }
    // Include imo_id if present in data (even if null/undefined to allow clearing)
    if ("imo_id" in data) {
      repositoryData.imo_id = data.imo_id || undefined;
    }
    // Include advance_cap if present in data (even if null/undefined to allow clearing)
    if ("advance_cap" in data) {
      repositoryData.advance_cap = data.advance_cap ?? null;
    }
    // Include contracting instructions if present (allows clearing back to null)
    if ("contracting_metadata" in data) {
      repositoryData.contracting_metadata = (data.contracting_metadata ||
        null) as Json;
    }

    console.log(
      "[CarrierService.updateFromForm] Sending to repository:",
      repositoryData,
    );

    return super.update(id, repositoryData);
  }

  /**
   * Create many carriers from form data (User-facing API)
   * Transforms NewCarrierForm array to repository format
   */
  async createManyFromForm(
    items: NewCarrierForm[],
  ): Promise<ServiceResponse<CarrierEntity[]>> {
    // Transform all NewCarrierForm items to repository format
    const repositoryItems: CarrierCreateData[] = items.map((data) => ({
      name: data.name,
      code: data.code || null,
      is_active: data.is_active ?? true,
      contact_info: (data.contact_info || null) as Json,
      commission_structure: null,
      imo_id: data.imo_id || undefined,
      advance_cap: data.advance_cap ?? null,
      contracting_metadata: null,
    }));

    return super.createMany(repositoryItems);
  }

  // ============================================================================
  // LEGACY API (for backward compatibility)
  // ============================================================================

  /**
   * @deprecated Use createFromForm() instead
   * Legacy create method that accepts NewCarrierForm
   */
  async create_legacy(
    data: NewCarrierForm,
  ): Promise<ServiceResponse<CarrierEntity>> {
    return this.createFromForm(data);
  }

  /**
   * @deprecated Use updateFromForm() instead
   * Legacy update method that accepts Partial<NewCarrierForm>
   */
  async update_legacy(
    id: string,
    data: Partial<NewCarrierForm>,
  ): Promise<ServiceResponse<CarrierEntity>> {
    return this.updateFromForm(id, data);
  }

  // ============================================================================
  // BUSINESS LOGIC METHODS
  // ============================================================================

  /**
   * Search carriers by name or code (business logic)
   */
  async search(query: string): Promise<ServiceResponse<CarrierEntity[]>> {
    try {
      const repo = this.repository as CarrierRepository;
      const carriers = await repo.search(query);
      return { success: true, data: carriers };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get all active carriers (business logic)
   */
  async getActive(): Promise<ServiceResponse<CarrierEntity[]>> {
    try {
      const repo = this.repository as CarrierRepository;
      const carriers = await repo.findActive();
      return { success: true, data: carriers };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get carriers for an explicit IMO. Used by super-admin settings views so
   * tenant selection is deliberate instead of relying on a user default IMO.
   */
  async getAllForImo(imoId: string): Promise<ServiceResponse<CarrierEntity[]>> {
    try {
      const repo = this.repository as CarrierRepository;
      const carriers = await repo.findAllByTenant(imoId, {
        orderBy: "name",
        orderDirection: "asc",
      });
      return { success: true, data: carriers };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ============================================================================
  // INHERITED FROM BaseService (no code needed):
  // ============================================================================
  // - getAll(options?, filters?): Promise<ServiceResponse<CarrierEntity[]>>
  // - getById(id: string): Promise<ServiceResponse<CarrierEntity>>
  // - update(id: string, updates: CarrierUpdateData): Promise<ServiceResponse<CarrierEntity>>
  // - delete(id: string): Promise<ServiceResponse<void>>
  // - createMany(items: CarrierCreateData[]): Promise<ServiceResponse<CarrierEntity[]>>
  //
  // USER-FACING FORM API (use these for NewCarrierForm):
  // - createFromForm(data: NewCarrierForm): Promise<ServiceResponse<CarrierEntity>>
  // - updateFromForm(id, data: Partial<NewCarrierForm>): Promise<ServiceResponse<CarrierEntity>>
  // - createManyFromForm(items: NewCarrierForm[]): Promise<ServiceResponse<CarrierEntity[]>>
  // - getPaginated(page, pageSize, filters?, orderBy?, orderDirection?): Promise<ServiceResponse<ListResponse<CarrierEntity>>>
  // - exists(id: string): Promise<boolean>
  // - count(filters?): Promise<number>
}

// Singleton instance
const carrierRepository = new CarrierRepository();
export const carrierService = new CarrierService(carrierRepository);

// Export class for testing
export { CarrierService as CarrierServiceClass };
