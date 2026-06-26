// src/services/settings/comp-guide/CompGuideRepository.ts
import {
  TenantScopedRepository,
  type TenantScopedEntity,
} from "../../base/TenantScopedRepository";
import type { Database } from "@/types/database.types";
import { getTodayString } from "@/lib/date";

type CompGuideRow = Database["public"]["Tables"]["comp_guide"]["Row"];
type CompGuideInsert = Database["public"]["Tables"]["comp_guide"]["Insert"];

// Match the exact database schema
export interface CompGuideEntry {
  id: string;
  carrier_id: string | null;
  product_id: string | null;
  product_type: Database["public"]["Enums"]["product_type"];
  contract_level: number;
  commission_percentage: number;
  bonus_percentage: number | null;
  effective_date: string;
  expiration_date: string | null;
  minimum_premium: number | null;
  maximum_premium: number | null;
  imo_id: string;
  created_at: string | null;
  updated_at: string | null;
  // Joined data from carrier relation (optional)
  carriers?: {
    id: string;
    name: string;
    code: string | null;
  };
}

export interface CompGuideFormData {
  carrier_id: string;
  product_id?: string;
  product_type: Database["public"]["Enums"]["product_type"];
  contract_level: number;
  commission_percentage: number;
  bonus_percentage?: number;
  effective_date: string;
  expiration_date?: string;
  minimum_premium?: number;
  maximum_premium?: number;
}

type CompGuideBaseEntity = CompGuideEntry & TenantScopedEntity;

/**
 * Repository for comp_guide data access
 * Extends BaseRepository for standard CRUD operations
 */
export class CompGuideRepository extends TenantScopedRepository<
  CompGuideBaseEntity,
  CompGuideFormData,
  Partial<CompGuideFormData>
> {
  constructor() {
    super("comp_guide");
  }

  /**
   * Transform database record to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): CompGuideBaseEntity {
    const row = dbRecord as CompGuideRow & {
      carriers?: { id: string; name: string; code: string | null };
    };
    return {
      id: row.id,
      carrier_id: row.carrier_id,
      product_id: row.product_id,
      product_type: row.product_type,
      contract_level: row.contract_level,
      commission_percentage: row.commission_percentage,
      bonus_percentage: row.bonus_percentage,
      effective_date: row.effective_date,
      expiration_date: row.expiration_date,
      minimum_premium: row.minimum_premium,
      maximum_premium: row.maximum_premium,
      imo_id: row.imo_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      carriers: row.carriers,
    } as CompGuideBaseEntity;
  }

  /**
   * Transform entity to database record
   */
  protected transformToDB(
    data: CompGuideFormData | Partial<CompGuideFormData>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (data.carrier_id !== undefined) result.carrier_id = data.carrier_id;
    if (data.product_id !== undefined)
      result.product_id = data.product_id || null;
    if (data.product_type !== undefined)
      result.product_type = data.product_type;
    if (data.contract_level !== undefined)
      result.contract_level = data.contract_level;
    if (data.commission_percentage !== undefined) {
      result.commission_percentage = data.commission_percentage;
    }
    if (data.bonus_percentage !== undefined) {
      result.bonus_percentage = data.bonus_percentage || null;
    }
    if (data.effective_date !== undefined)
      result.effective_date = data.effective_date;
    if (data.expiration_date !== undefined) {
      result.expiration_date = data.expiration_date || null;
    }
    if (data.minimum_premium !== undefined) {
      result.minimum_premium = data.minimum_premium || null;
    }
    if (data.maximum_premium !== undefined) {
      result.maximum_premium = data.maximum_premium || null;
    }

    return result;
  }

  /**
   * Find all entries with carrier details
   */
  async findAllWithCarrier(): Promise<CompGuideBaseEntity[]> {
    const { imo_id } = await this.getTenantFilter();
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        carriers:carrier_id (
          id,
          name,
          code
        )
      `,
      )
      .eq("imo_id", imo_id as string)
      .order("contract_level", { ascending: true });

    if (error) {
      throw this.handleError(error, "findAllWithCarrier");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find entry by ID with carrier details
   */
  async findByIdWithCarrier(id: string): Promise<CompGuideBaseEntity | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        carriers:carrier_id (
          id,
          name,
          code
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findByIdWithCarrier");
    }

    return data ? this.transformFromDB(data) : null;
  }

  /**
   * Find entries by carrier
   */
  async findByCarrier(carrierId: string): Promise<CompGuideBaseEntity[]> {
    const { imo_id } = await this.getTenantFilter();
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("imo_id", imo_id as string)
      .eq("carrier_id", carrierId)
      .order("contract_level", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByCarrier");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find entries by product
   */
  async findByProduct(productId: string): Promise<CompGuideBaseEntity[]> {
    const { imo_id } = await this.getTenantFilter();
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("imo_id", imo_id as string)
      .eq("product_id", productId)
      .order("contract_level", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByProduct");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find all active entries (not expired)
   */
  async findActive(): Promise<CompGuideBaseEntity[]> {
    const today = getTodayString();
    const { imo_id } = await this.getTenantFilter();

    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        carriers:carrier_id (
          id,
          name,
          code
        )
      `,
      )
      .eq("imo_id", imo_id as string)
      .lte("effective_date", today)
      .or(`expiration_date.is.null,expiration_date.gte.${today}`)
      .order("contract_level", { ascending: true });

    if (error) {
      throw this.handleError(error, "findActive");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Search entries by contract level
   */
  async search(query: string): Promise<CompGuideBaseEntity[]> {
    const { imo_id } = await this.getTenantFilter();
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        carriers:carrier_id (
          id,
          name,
          code
        )
      `,
      )
      .eq("imo_id", imo_id as string)
      .or(`contract_level::text.ilike.%${query}%`)
      .order("contract_level", { ascending: true });

    if (error) {
      throw this.handleError(error, "search");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Bulk create entries
   */
  async bulkCreate(entries: CompGuideInsert[]): Promise<CompGuideBaseEntity[]> {
    const tenantId = await this.getDefaultTenantId();
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(
        entries.map((entry) => ({
          ...entry,
          imo_id: entry.imo_id ?? tenantId,
        })),
      )
      .select();

    if (error) {
      throw this.handleError(error, "bulkCreate");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Get commission rate for specific carrier, product type, and contract level
   */
  async getCommissionRate(
    carrierId: string,
    productType: Database["public"]["Enums"]["product_type"],
    contractLevel: number,
  ): Promise<number | null> {
    const { imo_id } = await this.getTenantFilter();
    const { data, error } = await this.client
      .from(this.tableName)
      .select("commission_percentage")
      .eq("imo_id", imo_id as string)
      .eq("carrier_id", carrierId)
      .eq("product_type", productType)
      .eq("contract_level", contractLevel)
      .limit(1) // Prevent errors if duplicates exist
      .maybeSingle(); // Returns null if no entry exists

    if (error) {
      throw this.handleError(error, "getCommissionRate");
    }

    return data?.commission_percentage || null;
  }

  /**
   * Get commission rate for specific product_id and contract level
   * This is the preferred method for accurate comp_guide lookup when product_id is available
   */
  async getCommissionRateByProductId(
    productId: string,
    contractLevel: number,
  ): Promise<number | null> {
    const today = getTodayString();
    const { imo_id } = await this.getTenantFilter();

    const { data, error } = await this.client
      .from(this.tableName)
      .select("commission_percentage")
      .eq("imo_id", imo_id as string)
      .eq("product_id", productId)
      .eq("contract_level", contractLevel)
      .lte("effective_date", today)
      .or(`expiration_date.is.null,expiration_date.gte.${today}`)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw this.handleError(error, "getCommissionRateByProductId");
    }

    return data?.commission_percentage || null;
  }

  async getCurrentRate(
    productId: string,
    contractLevel: number,
    carrierId?: string,
  ): Promise<{
    commission_percentage: number;
    bonus_percentage: number | null;
  } | null> {
    const today = getTodayString();
    const { imo_id } = await this.getTenantFilter();

    let query = this.client
      .from(this.tableName)
      .select("commission_percentage, bonus_percentage")
      .eq("imo_id", imo_id as string)
      .eq("product_id", productId)
      .eq("contract_level", contractLevel)
      .lte("effective_date", today)
      .or(`expiration_date.is.null,expiration_date.gte.${today}`);

    if (carrierId) {
      query = query.eq("carrier_id", carrierId);
    }

    const { data, error } = await query
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw this.handleError(error, "getCurrentRate");
    }

    return data;
  }

  async getCurrentRatesForProducts(
    productIds: string[],
    contractLevel: number,
  ): Promise<
    Array<{
      product_id: string;
      commission_percentage: number;
      effective_date: string;
    }>
  > {
    if (productIds.length === 0) {
      return [];
    }

    const today = getTodayString();
    const { imo_id } = await this.getTenantFilter();

    const { data, error } = await this.client
      .from(this.tableName)
      .select("product_id, commission_percentage, effective_date")
      .eq("imo_id", imo_id as string)
      .in("product_id", productIds)
      .eq("contract_level", contractLevel)
      .lte("effective_date", today)
      .or(`expiration_date.is.null,expiration_date.gte.${today}`)
      .order("effective_date", { ascending: false });

    if (error) {
      throw this.handleError(error, "getCurrentRatesForProducts");
    }

    return data || [];
  }
}
