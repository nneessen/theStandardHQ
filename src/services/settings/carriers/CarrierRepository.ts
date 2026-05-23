// src/services/settings/carriers/CarrierRepository.ts
import {
  TenantScopedRepository,
  type TenantScopedEntity,
} from "../../base/TenantScopedRepository";
import type {
  Carrier,
  CarrierInsert,
  CarrierUpdate,
} from "@/types/carrier.types";

type CarrierBaseEntity = Carrier & TenantScopedEntity;

export class CarrierRepository extends TenantScopedRepository<
  CarrierBaseEntity,
  CarrierInsert,
  CarrierUpdate
> {
  constructor() {
    super("carriers");
  }

  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): CarrierBaseEntity {
    return {
      id: dbRecord.id as string,
      name: dbRecord.name as string,
      code: dbRecord.code as string | null,
      commission_structure:
        dbRecord.commission_structure as Carrier["commission_structure"],
      contact_info: dbRecord.contact_info as Carrier["contact_info"],
      is_active: dbRecord.is_active as boolean | null,
      imo_id: dbRecord.imo_id as string | null,
      advance_cap: dbRecord.advance_cap as number | null,
      created_at: (dbRecord.created_at as string) || null,
      updated_at: (dbRecord.updated_at as string) || null,
    } as CarrierBaseEntity;
  }

  protected transformToDB(
    data: CarrierInsert | CarrierUpdate,
  ): Record<string, unknown> {
    const dbData: Record<string, unknown> = {};

    if ("name" in data && data.name !== undefined) dbData.name = data.name;
    if ("code" in data && data.code !== undefined) dbData.code = data.code;
    if (
      "commission_structure" in data &&
      data.commission_structure !== undefined
    ) {
      dbData.commission_structure = data.commission_structure;
    }
    if ("contact_info" in data && data.contact_info !== undefined) {
      dbData.contact_info = data.contact_info;
    }
    if ("is_active" in data && data.is_active !== undefined) {
      dbData.is_active = data.is_active;
    }
    // Handle imo_id - include null values to allow clearing
    if ("imo_id" in data) {
      dbData.imo_id = data.imo_id ?? null;
    }
    // Handle advance_cap - include null values to allow clearing
    if ("advance_cap" in data) {
      dbData.advance_cap = data.advance_cap ?? null;
    }

    // Debug: log what we're sending to DB
    console.log("[CarrierRepository.transformToDB] Input:", data);
    console.log("[CarrierRepository.transformToDB] Output:", dbData);

    return dbData;
  }

  /**
   * Search carriers by name or code (case-insensitive)
   */
  async search(query: string): Promise<CarrierBaseEntity[]> {
    try {
      const { imo_id } = await this.getTenantFilter();
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("imo_id", imo_id as string)
        .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
        .order("name", { ascending: true });

      if (error) throw this.handleError(error, "search");
      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "search");
    }
  }

  /**
   * Get all active carriers
   */
  async findActive(): Promise<CarrierBaseEntity[]> {
    try {
      const { imo_id } = await this.getTenantFilter();
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("imo_id", imo_id as string)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw this.handleError(error, "findActive");
      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findActive");
    }
  }

  /**
   * Override findAll to always order by name
   */
  override async findAll(): Promise<CarrierBaseEntity[]> {
    return super.findAll({ orderBy: "name", orderDirection: "asc" });
  }
}
