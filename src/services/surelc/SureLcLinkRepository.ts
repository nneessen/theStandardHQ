// src/services/surelc/SureLcLinkRepository.ts
import { BaseRepository } from "../base/BaseRepository";
import {
  type SureLcLink,
  type CreateSureLcLinkData,
  type UpdateSureLcLinkData,
  transformSureLcLinkFromDB,
  transformSureLcLinkToDB,
} from "@/types/surelc.types";

export class SureLcLinkRepository extends BaseRepository<
  SureLcLink,
  CreateSureLcLinkData,
  UpdateSureLcLinkData
> {
  constructor() {
    super("surelc_links");
  }

  protected transformFromDB(dbRecord: Record<string, unknown>): SureLcLink {
    return transformSureLcLinkFromDB(
      dbRecord as Parameters<typeof transformSureLcLinkFromDB>[0],
    );
  }

  protected transformToDB(
    data: CreateSureLcLinkData | UpdateSureLcLinkData,
  ): Record<string, unknown> {
    return transformSureLcLinkToDB(data);
  }

  /**
   * Create a link. Injects imo_id + created_by from the current user, and sets
   * owner_user_id from the requested scope (NULL = shared/company, else the user).
   * RLS still has final say: only super-admins can persist a shared row.
   */
  async create(data: CreateSureLcLinkData): Promise<SureLcLink> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: profile, error: profileError } = await this.client
      .from("user_profiles")
      .select("imo_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.imo_id) {
      throw new Error("Could not determine user IMO");
    }

    const dbData = {
      ...this.transformToDB(data),
      imo_id: profile.imo_id,
      owner_user_id: data.scope === "personal" ? user.id : null,
      created_by: user.id,
    };

    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "create");
    }

    return this.transformFromDB(result);
  }

  /** Company/shared links visible to the current user (RLS scopes to their IMO). */
  async findShared(): Promise<SureLcLink[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .is("owner_user_id", null)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      throw this.handleError(error, "findShared");
    }

    return data?.map((row) => this.transformFromDB(row)) ?? [];
  }

  /** The current user's own personal links. */
  async findMine(userId: string): Promise<SureLcLink[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("owner_user_id", userId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      throw this.handleError(error, "findMine");
    }

    return data?.map((row) => this.transformFromDB(row)) ?? [];
  }
}
