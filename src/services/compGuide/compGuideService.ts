// /home/nneessen/projects/commissionTracker/src/services/compGuide/compGuideService.ts
// Service layer for Commission Guide data from Supabase database

import { supabase } from "../base/supabase";
import { getTodayString } from "@/lib/date";

export interface CompGuideRecord {
  id: string;
  carrierId: string;
  carrierName: string;
  productType: string;
  productName: string;
  compLevel: string;
  contractLevel: number;
  commissionPercentage: number;
  effectiveDate: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompGuideFilters {
  carrierName?: string;
  productType?: string;
  contractLevel?: number;
  searchTerm?: string;
}

export interface CompGuidePaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?:
    | "carrier_name"
    | "product_type"
    | "commission_percentage"
    | "contract_level";
  sortOrder?: "asc" | "desc";
}

export interface CompGuideQueryResult {
  data: CompGuideRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class CompGuideService {
  private readonly tableName = "comp_guide";

  /**
   * Get paginated commission guide data with filtering and search
   */
  async getCompGuideData(
    filters: CompGuideFilters = {},
    pagination: CompGuidePaginationOptions = {},
  ): Promise<CompGuideQueryResult> {
    const {
      page = 1,
      pageSize = 50,
      sortBy = "carrier_name",
      sortOrder = "asc",
    } = pagination;

    const { carrierName, productType, contractLevel, searchTerm } = filters;

    // Build the query with joins
    let query = supabase.from(this.tableName).select(
      `
        id,
        carrier_id,
        product_type,
        comp_level,
        commission_percentage,
        effective_date,
        expiration_date,
        created_at,
        updated_at,
        carriers!inner(
          id,
          name
        )
      `,
      { count: "exact" },
    );

    // Apply filters
    if (carrierName) {
      query = query.ilike("carriers.name", `%${carrierName}%`);
    }

    if (productType) {
      query = query.eq("product_type", productType);
    }

    if (contractLevel) {
      const compLevel = this.mapContractLevelToCompLevel(contractLevel);
      query = query.eq("comp_level", compLevel);
    }

    if (searchTerm) {
      query = query.or(
        `carriers.name.ilike.%${searchTerm}%,product_type.ilike.%${searchTerm}%`,
      );
    }

    // Apply sorting - map to database column names
    const dbSortBy = this.mapSortField(sortBy);
    query = query.order(dbSortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(
        `Failed to fetch commission guide data: ${error.message}`,
      );
    }

    const transformedData = (data || []).map(this.transformFromDB);
    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: transformedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get all unique carrier names for filtering
   */
  async getCarrierNames(): Promise<string[]> {
    const { data, error } = await supabase
      .from("carriers")
      .select("name")
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch carrier names: ${error.message}`);
    }

    return (data || []).map((carrier) => carrier.name);
  }

  /**
   * Get all unique product types for filtering
   */
  async getProductTypes(): Promise<string[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("product_type")
      .order("product_type");

    if (error) {
      throw new Error(`Failed to fetch product types: ${error.message}`);
    }

    // Get unique values
    const uniqueTypes = Array.from(
      new Set((data || []).map((item) => item.product_type)),
    );
    return uniqueTypes;
  }

  /**
   * Get commission rate for specific criteria
   */
  async getCommissionRate(
    carrierName: string,
    productType: string,
    contractLevel: number,
  ): Promise<number | null> {
    const compLevel = this.mapContractLevelToCompLevel(contractLevel);

    const { data, error } = await supabase
      .from(this.tableName)
      .select(
        `
        commission_percentage,
        carriers!inner(name)
      `,
      )
      .ilike("carriers.name", `%${carrierName}%`)
      .eq("product_type", productType)
      .eq("comp_level", compLevel)
      .lte("effective_date", getTodayString())
      .or("expiration_date.is.null,expiration_date.gte." + getTodayString())
      .order("effective_date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch commission rate: ${error.message}`);
    }

    // Return as-is - database stores decimals (e.g., 0.95 = 95%)
    // CommissionCalculationService expects decimal format for calculations
    return data ? data.commission_percentage : null;
  }

  /**
   * Export all commission guide data for CSV/PDF generation
   */
  async exportAllData(
    filters: CompGuideFilters = {},
  ): Promise<CompGuideRecord[]> {
    const { data } = await this.getCompGuideData(filters, { pageSize: 10000 });
    return data;
  }

  /**
   * Transform database record to application format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
  private transformFromDB(dbRecord: any): CompGuideRecord {
    return {
      id: dbRecord.id,
      carrierId: dbRecord.carrier_id,
      carrierName: dbRecord.carriers?.name || "Unknown Carrier",
      productType: dbRecord.product_type,
      productName: this.formatProductName(dbRecord.product_type),
      compLevel: dbRecord.comp_level,
      contractLevel: this.mapCompLevelToContractLevel(dbRecord.comp_level),
      commissionPercentage: dbRecord.commission_percentage * 100, // Convert to percentage
      effectiveDate: dbRecord.effective_date,
      expirationDate: dbRecord.expiration_date,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
    };
  }

  /**
   * Map contract level number to comp_level enum
   */
  private mapContractLevelToCompLevel(contractLevel: number): string {
    if (contractLevel >= 140) return "premium";
    if (contractLevel >= 120) return "enhanced";
    if (contractLevel >= 100) return "release";
    return "street";
  }

  /**
   * Map comp_level enum to contract level number
   */
  private mapCompLevelToContractLevel(compLevel: string): number {
    const mapping = {
      street: 80,
      release: 100,
      enhanced: 120,
      premium: 140,
    };
    return mapping[compLevel as keyof typeof mapping] || 100;
  }

  /**
   * Format product type for display
   */
  private formatProductName(productType: string): string {
    const mapping = {
      whole_life: "Whole Life",
      term_life: "Term Life",
      universal_life: "Universal Life",
      variable_life: "Variable Life",
      health: "Health",
      disability: "Disability",
      annuity: "Annuity",
    };
    return mapping[productType as keyof typeof mapping] || productType;
  }

  /**
   * Map frontend sort field to database column
   */
  private mapSortField(sortBy: string): string {
    const mapping = {
      carrier_name: "carriers.name",
      product_type: "product_type",
      commission_percentage: "commission_percentage",
      contract_level: "comp_level",
    };
    return mapping[sortBy as keyof typeof mapping] || "carriers.name";
  }

  /**
   * Get statistics for dashboard
   */
  async getStatistics(): Promise<{
    totalRecords: number;
    uniqueCarriers: number;
    productTypes: number;
    averageCommission: number;
  }> {
    const [recordsResult, carriersResult, productsResult, avgResult] =
      await Promise.all([
        supabase
          .from(this.tableName)
          .select("id", { count: "exact", head: true }),
        supabase.from("carriers").select("id", { count: "exact", head: true }),
        supabase
          .from(this.tableName)
          .select("product_type")
          .then(({ data }) =>
            data
              ? Array.from(new Set(data.map((item) => item.product_type)))
                  .length
              : 0,
          ),
        supabase
          .from(this.tableName)
          .select("commission_percentage")
          .then(({ data }) => {
            if (!data || data.length === 0) return 0;
            const avg =
              data.reduce((sum, item) => sum + item.commission_percentage, 0) /
              data.length;
            return avg * 100; // Convert to percentage
          }),
      ]);

    return {
      totalRecords: recordsResult.count || 0,
      uniqueCarriers: carriersResult.count || 0,
      productTypes: productsResult,
      averageCommission: avgResult,
    };
  }
}

export const compGuideService = new CompGuideService();
