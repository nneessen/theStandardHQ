// src/services/settings/comp-guide/CompGuideService.ts
import { BaseService, type ServiceResponse } from "../../base/BaseService";
import {
  CompGuideRepository,
  type CompGuideEntry,
  type CompGuideFormData,
} from "./CompGuideRepository";
import { supabase } from "../../base/supabase";
import type { Database } from "@/types/database.types";

type CompGuideInsert = Database["public"]["Tables"]["comp_guide"]["Insert"];

/**
 * Service for comp guide business logic
 * Extends BaseService for standard CRUD operations
 * Uses CompGuideRepository for data access
 */
class CompGuideServiceClass extends BaseService<
  CompGuideEntry,
  CompGuideFormData,
  Partial<CompGuideFormData>
> {
  constructor() {
    const repository = new CompGuideRepository();
    super(repository);
  }

  /**
   * Initialize validation rules
   */
  protected initializeValidationRules(): void {
    this.validationRules = [
      {
        field: "commission_percentage",
        validate: (value) => {
          if (value === undefined || value === null) return false;
          if (typeof value !== "number") return false;
          return value >= 0 && value <= 100;
        },
        message:
          "Commission percentage is required and must be between 0 and 100",
      },
      {
        field: "contract_level",
        validate: (value) => {
          if (value === undefined || value === null) return false;
          if (typeof value !== "number") return false;
          return Number.isInteger(value) && value > 0;
        },
        message: "Contract level is required and must be a positive integer",
      },
      {
        field: "effective_date",
        validate: (value) => {
          if (value === undefined || value === null) return false;
          if (typeof value !== "string" || value.trim() === "") return false;
          const date = new Date(value);
          return !isNaN(date.getTime());
        },
        message: "Effective date is required and must be a valid date",
      },
      {
        field: "product_type",
        validate: (value) => {
          if (value === undefined || value === null) return false;
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "Product type is required",
      },
      {
        field: "bonus_percentage",
        validate: (value) => {
          if (value === null || value === undefined) return true; // Optional
          if (typeof value !== "number") return false;
          return value >= 0 && value <= 100;
        },
        message: "Bonus percentage must be between 0 and 100 if provided",
      },
      {
        field: "expiration_date",
        validate: (value, data) => {
          if (!value) return true; // Optional
          if (typeof value !== "string") return false;
          const expirationDate = new Date(value);
          if (isNaN(expirationDate.getTime())) return false;

          // Validate expiration_date >= effective_date
          const effectiveDate = data?.effective_date
            ? new Date(data.effective_date as string)
            : null;
          if (effectiveDate && expirationDate < effectiveDate) {
            return false;
          }
          return true;
        },
        message:
          "Expiration date must be a valid date and after effective date if provided",
      },
      {
        field: "minimum_premium",
        validate: (value) => {
          if (value === null || value === undefined) return true; // Optional
          if (typeof value !== "number") return false;
          return value > 0;
        },
        message: "Minimum premium must be a positive number if provided",
      },
      {
        field: "maximum_premium",
        validate: (value, data) => {
          if (value === null || value === undefined) return true; // Optional
          if (typeof value !== "number") return false;
          if (value <= 0) return false;

          // Validate maximum_premium > minimum_premium
          const minPremium = data?.minimum_premium as number | undefined;
          if (minPremium && value <= minPremium) {
            return false;
          }
          return true;
        },
        message:
          "Maximum premium must be a positive number and greater than minimum premium if both provided",
      },
      {
        field: "carrier_id",
        validate: (value) => {
          if (!value) return true; // Optional
          if (typeof value !== "string") return false;
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(value);
        },
        message: "Carrier ID must be a valid UUID if provided",
      },
      {
        field: "product_id",
        validate: (value) => {
          if (!value) return true; // Optional
          if (typeof value !== "string") return false;
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(value);
        },
        message: "Product ID must be a valid UUID if provided",
      },
    ];
  }

  /**
   * Get all entries with carrier details
   * Overrides base getAll to use custom repository method
   */
  async getAll(): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entries = await repository.findAllWithCarrier();
      return { success: true, data: entries as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Update an entry with partial data
   * Overrides base update to only validate fields being updated
   */
  async update(
    id: string,
    updates: Partial<CompGuideFormData>,
  ): Promise<ServiceResponse<CompGuideEntry>> {
    try {
      // Only validate rules for fields that are actually being updated
      const fieldsToUpdate = Object.keys(updates);
      const rulesToValidate = this.validationRules.filter((rule) =>
        fieldsToUpdate.includes(rule.field),
      );

      const errors = this.validate(
        updates as Record<string, unknown>,
        rulesToValidate,
      );
      if (errors.length > 0) {
        return {
          success: false,
          error: new Error(errors.map((e) => e.message).join(", ")),
        };
      }

      const entity = await this.repository.update(id, updates);
      return {
        success: true,
        data: entity as CompGuideEntry,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get entry by ID with carrier details
   * Overrides base getById to use custom repository method
   */
  async getById(id: string): Promise<ServiceResponse<CompGuideEntry>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entry = await repository.findByIdWithCarrier(id);
      if (!entry) {
        return { success: false, error: new Error("Entry not found") };
      }
      return { success: true, data: entry as CompGuideEntry };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get entries by carrier
   */
  async getByCarrier(
    carrierId: string,
  ): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entries = await repository.findByCarrier(carrierId);
      return { success: true, data: entries as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get entries by product
   */
  async getByProduct(
    productId: string,
  ): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entries = await repository.findByProduct(productId);
      return { success: true, data: entries as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get all active entries
   */
  async getActive(): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entries = await repository.findActive();
      return { success: true, data: entries as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Search entries
   */
  async search(query: string): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const entries = await repository.search(query);
      return { success: true, data: entries as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Bulk import entries
   */
  async bulkImport(
    entries: CompGuideFormData[],
  ): Promise<ServiceResponse<CompGuideEntry[]>> {
    try {
      const repository = this.repository as CompGuideRepository;
      const insertData: CompGuideInsert[] = entries.map((entry) => ({
        carrier_id: entry.carrier_id,
        product_id: entry.product_id,
        product_type: entry.product_type,
        contract_level: entry.contract_level,
        commission_percentage: entry.commission_percentage,
        bonus_percentage: entry.bonus_percentage,
        effective_date: entry.effective_date,
        expiration_date: entry.expiration_date,
        minimum_premium: entry.minimum_premium,
        maximum_premium: entry.maximum_premium,
      }));

      const created = await repository.bulkCreate(insertData);
      return { success: true, data: created as CompGuideEntry[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get commission rate for specific carrier, product type, and contract level
   * This is the main lookup function used by commission calculations
   * @param carrierName - Carrier name (used for fallback lookup)
   * @param productType - Product type enum (used for fallback lookup)
   * @param contractLevel - User's contract level
   * @param productId - Optional specific product ID (PREFERRED - more accurate lookup)
   */
  async getCommissionRate(
    carrierName: string,
    productType: Database["public"]["Enums"]["product_type"],
    contractLevel: number,
    productId?: string,
  ): Promise<{ data: number | null; error: Error | null }> {
    try {
      const repository = this.repository as CompGuideRepository;

      // PREFERRED: If productId is available, use the more accurate lookup
      if (productId) {
        const rate = await repository.getCommissionRateByProductId(
          productId,
          contractLevel,
        );
        if (rate !== null) {
          return { data: rate, error: null };
        }
        // Fall through to legacy lookup if productId lookup returns no result
      }

      // FALLBACK: Legacy lookup by carrier name + product type
      // This is less accurate when carrier has multiple products of same type
      const { data: carrier, error: carrierError } = await supabase
        .from("carriers")
        .select("id")
        .eq("name", carrierName)
        .eq("imo_id", await repository.getDefaultTenantId())
        .single();

      if (carrierError || !carrier) {
        return {
          data: null,
          error: carrierError || new Error("Carrier not found"),
        };
      }

      const rate = await repository.getCommissionRate(
        carrier.id,
        productType,
        contractLevel,
      );

      return { data: rate, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get all commission data in a unified format for the grid
   * Returns carriers with their products and all commission rates
   * @param imoId Optional IMO ID to filter by (for super admins viewing specific IMO data)
   */
  async getAllCommissionData(imoId?: string): Promise<
    Array<{
      carrierId: string;
      carrierName: string;
      productId: string | null;
      productName: string;
      productType: string | null;
      isActive: boolean;
      rates: Record<number, number>;
    }>
  > {
    let query = supabase
      .from("carriers")
      .select(
        `
        id,
        name,
        imo_id,
        products!products_carrier_id_fkey (
          id,
          name,
          product_type,
          is_active,
          imo_id
        ),
        comp_guide!comp_guide_carrier_id_fkey (
          id,
          product_id,
          contract_level,
          commission_percentage,
          imo_id
        )
      `,
      )
      .eq("is_active", true)
      .order("name");

    // Filter by IMO if provided. Without an explicit IMO, RLS still protects
    // direct access, but super-admin screens must not accidentally aggregate
    // multiple IMOs into one grid.
    if (imoId) {
      query = query.eq("imo_id", imoId);
    } else {
      const repository = this.repository as CompGuideRepository;
      query = query.eq("imo_id", await repository.getDefaultTenantId());
    }

    const { data, error } = await query;

    if (error) throw error;

    const gridData: Array<{
      carrierId: string;
      carrierName: string;
      productId: string | null;
      productName: string;
      productType: string | null;
      isActive: boolean;
      rates: Record<number, number>;
    }> = [];

    for (const carrier of data || []) {
      const productsMap = new Map<
        string,
        {
          carrierId: string;
          carrierName: string;
          productId: string;
          productName: string;
          productType: string;
          isActive: boolean;
          rates: Record<number, number>;
        }
      >();

      // Add products from products table
      for (const product of carrier.products || []) {
        if (product.imo_id !== carrier.imo_id) {
          continue;
        }

        if (!productsMap.has(product.id)) {
          productsMap.set(product.id, {
            carrierId: carrier.id,
            carrierName: carrier.name,
            productId: product.id,
            productName: product.name,
            productType: product.product_type,
            isActive: product.is_active,
            rates: {},
          });
        }
      }

      // Add commission rates to products
      for (const compEntry of carrier.comp_guide || []) {
        if (compEntry.imo_id !== carrier.imo_id) {
          continue;
        }

        if (compEntry.product_id && productsMap.has(compEntry.product_id)) {
          const product = productsMap.get(compEntry.product_id)!;
          product.rates[compEntry.contract_level] =
            compEntry.commission_percentage;
        }
      }

      // Add carrier-level rates
      const carrierLevelRates = (carrier.comp_guide || [])
        .filter(
          (entry: { product_id: string | null; imo_id: string | null }) =>
            !entry.product_id && entry.imo_id === carrier.imo_id,
        )
        .reduce(
          (
            acc: Record<number, number>,
            entry: { contract_level: number; commission_percentage: number },
          ) => {
            acc[entry.contract_level] = entry.commission_percentage;
            return acc;
          },
          {} as Record<number, number>,
        );

      // If there are carrier-level rates but no products, add a placeholder
      if (Object.keys(carrierLevelRates).length > 0 && productsMap.size === 0) {
        gridData.push({
          carrierId: carrier.id,
          carrierName: carrier.name,
          productId: null,
          productName: "Default Rates",
          productType: null,
          isActive: true,
          rates: carrierLevelRates,
        });
      }

      // Add all products to grid data
      for (const product of productsMap.values()) {
        if (
          Object.keys(product.rates).length === 0 &&
          Object.keys(carrierLevelRates).length > 0
        ) {
          product.rates = carrierLevelRates;
        }
        gridData.push(product);
      }
    }

    return gridData;
  }

  async getCurrentRate(params: {
    productId: string;
    contractLevel: number;
    carrierId?: string;
  }): Promise<{
    data: {
      commission_percentage: number;
      bonus_percentage: number | null;
    } | null;
    error: Error | null;
  }> {
    try {
      const repository = this.repository as CompGuideRepository;
      const rate = await repository.getCurrentRate(
        params.productId,
        params.contractLevel,
        params.carrierId,
      );
      return { data: rate, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getCurrentRatesForProducts(
    productIds: string[],
    contractLevel: number,
  ): Promise<{
    data: Array<{
      product_id: string;
      commission_percentage: number;
      effective_date: string;
    }> | null;
    error: Error | null;
  }> {
    try {
      const repository = this.repository as CompGuideRepository;
      const rates = await repository.getCurrentRatesForProducts(
        productIds,
        contractLevel,
      );
      return { data: rates, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ============================================================================
  // Legacy API for backward compatibility
  // ============================================================================

  /** @deprecated Use getAll instead */
  async getAllEntries() {
    const result = await this.getAll();
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use getById instead */
  async getEntryById(id: string) {
    const result = await this.getById(id);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use create instead */
  async createEntry(data: CompGuideFormData) {
    const result = await this.create(data);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use update instead */
  async updateEntry(id: string, data: Partial<CompGuideFormData>) {
    const result = await this.update(id, data);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use delete instead */
  async deleteEntry(id: string) {
    const result = await this.delete(id);
    if (!result.success) {
      return { error: result.error };
    }
    return { error: null };
  }

  /** @deprecated Use search instead */
  async searchEntries(query: string) {
    const result = await this.search(query);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use getByCarrier instead */
  async getEntriesByCarrier(carrierId: string) {
    const result = await this.getByCarrier(carrierId);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use getByProduct instead */
  async getEntriesByProduct(productId: string) {
    const result = await this.getByProduct(productId);
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  /** @deprecated Use bulkImport instead */
  async createBulkEntries(entries: CompGuideInsert[]) {
    try {
      const repository = this.repository as CompGuideRepository;
      const created = await repository.bulkCreate(entries);
      return { data: created, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /** @deprecated Use getActive instead */
  async getActiveEntries() {
    const result = await this.getActive();
    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }
}

export const compGuideService = new CompGuideServiceClass();
export { CompGuideServiceClass };
