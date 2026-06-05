// src/services/agency/AgencyRepository.ts

import { BaseRepository } from "../base/BaseRepository";
import type {
  AgencyRow,
  AgencyInsert,
  AgencyUpdate,
  Agency,
} from "../../types/imo.types";

export class AgencyRepository extends BaseRepository<
  AgencyRow,
  AgencyInsert,
  AgencyUpdate
> {
  constructor() {
    super("agencies");
  }

  async findByCodeInImo(
    imoId: string,
    code: string,
  ): Promise<AgencyRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("imo_id", imoId)
      .eq("code", code)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findByCodeInImo");
    }

    return data;
  }

  async findWithOwner(agencyId: string): Promise<Agency | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        owner:user_profiles!agencies_owner_id_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `,
      )
      .eq("id", agencyId)
      // maybeSingle() returns { data: null } for 0 rows instead of a 406
      // (PGRST116). After sunset deactivation the user's agency row is no longer
      // RLS-visible, which is an expected empty state, not an error. Catching
      // PGRST116 in JS still left the browser logging the 406 to the console.
      .maybeSingle();

    if (error) {
      throw this.handleError(error, "findWithOwner");
    }

    return (data as Agency | null) ?? null;
  }

  /**
   * Find all agencies in an IMO with owner info
   */
  async findByImo(imoId: string): Promise<Agency[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        owner:user_profiles!agencies_owner_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `,
      )
      .eq("imo_id", imoId)
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByImo");
    }

    return (data ?? []) as Agency[];
  }

  async findActiveByImo(imoId: string): Promise<Agency[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        owner:user_profiles!agencies_owner_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `,
      )
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findActiveByImo");
    }

    return (data ?? []) as Agency[];
  }

  async findByOwner(ownerId: string): Promise<AgencyRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByOwner");
    }

    return data ?? [];
  }

  async getAgentCount(agencyId: string): Promise<number> {
    const { count, error } = await this.client
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId);

    if (error) {
      throw this.handleError(error, "getAgentCount");
    }

    return count ?? 0;
  }

  async isCodeAvailable(
    imoId: string,
    code: string,
    excludeId?: string,
  ): Promise<boolean> {
    let query = this.client
      .from(this.tableName)
      .select("id", { count: "exact", head: true })
      .eq("imo_id", imoId)
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

  async updateOwner(
    agencyId: string,
    ownerId: string | null,
  ): Promise<AgencyRow> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ owner_id: ownerId })
      .eq("id", agencyId)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "updateOwner");
    }

    return data;
  }

  async findAllActive(): Promise<Agency[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(
        `
        *,
        owner:user_profiles!agencies_owner_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `,
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw this.handleError(error, "findAllActive");
    }

    return (data ?? []) as Agency[];
  }
}
