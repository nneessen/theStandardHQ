// src/services/imo/ImoRepository.ts
// Data access layer for IMOs

import { BaseRepository } from "../base/BaseRepository";
import type { ImoRow, ImoInsert, ImoUpdate, Imo } from "../../types/imo.types";

/**
 * Repository for IMO data access
 * Extends BaseRepository with IMO-specific queries
 */
export class ImoRepository extends BaseRepository<
  ImoRow,
  ImoInsert,
  ImoUpdate
> {
  constructor() {
    super("imos");
  }

  /**
   * Find an IMO by its unique code
   */
  async findByCode(code: string): Promise<ImoRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("code", code)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw this.handleError(error, "findByCode");
    }

    return data;
  }

  /**
   * Find an IMO with its agencies
   */
  async findWithAgencies(imoId: string): Promise<Imo | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        agencies (
          id,
          name,
          code,
          description,
          logo_url,
          owner_id,
          is_active,
          created_at
        )
      `,
      )
      .eq("id", imoId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findWithAgencies");
    }

    return data as Imo;
  }

  /**
   * Get count of agents in an IMO
   */
  async getAgentCount(imoId: string): Promise<number> {
    const { count, error } = await this.client
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("imo_id", imoId);

    if (error) {
      throw this.handleError(error, "getAgentCount");
    }

    return count ?? 0;
  }

  /**
   * Get all active IMOs
   */
  async findAllActive(): Promise<ImoRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findAllActive");
    }

    return data ?? [];
  }

  async findAll(): Promise<ImoRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findAll");
    }

    return data ?? [];
  }

  async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    let query = this.client
      .from(this.tableName)
      .select("id", { count: "exact", head: true })
      .eq("code", code);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw this.handleError(error, "isCodeAvailable");
    }

    return count === 0;
  }
}
