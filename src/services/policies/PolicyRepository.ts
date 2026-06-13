// src/services/policies/PolicyRepository.ts
import { BaseRepository } from "../base/BaseRepository";
import { TABLES } from "../base/supabase";
import {
  Policy,
  CreatePolicyData,
  UpdatePolicyData,
  PolicyRow,
} from "../../types/policy.types";
import { formatDateForDB, parseLocalDate } from "../../lib/date";
import {
  POLICY_WITH_CLIENT,
  POLICY_WITH_CLIENT_AND_COMMISSIONS,
  POLICY_WITH_CLIENT_MINIMAL,
  POLICY_WITH_RELATION_NAMES,
} from "./policy-selects";
import {
  mapPolicyFromDb,
  toNumber,
  type PolicyDbRecord,
} from "./policy-mapper";

// ---------------------------------------------------------------------------
// Type definitions for lightweight metric queries
// ---------------------------------------------------------------------------

/**
 * Lightweight projection used by hierarchy/team metric calculations.
 * Derived from the generated row so columns stay in sync; `user_id` is
 * non-null because these are always queried by `user_id IN (...)`.
 */
export type PolicyMetricRow = Pick<
  PolicyRow,
  | "status"
  | "lifecycle_status"
  | "annual_premium"
  | "created_at"
  | "submit_date"
  | "effective_date"
> & { user_id: string };

/** Policy projection with client/carrier names, for hierarchy summaries. */
export type PolicyWithRelations = Pick<
  PolicyRow,
  | "id"
  | "policy_number"
  | "status"
  | "lifecycle_status"
  | "annual_premium"
  | "product"
  | "carrier_id"
  | "submit_date"
  | "effective_date"
  | "created_at"
> & {
  user_id: string;
  client: { name: string } | null;
  carrier: { name: string } | null;
};

/** Equality/date/search filters accepted by the list, count, and metric reads. */
export interface PolicyFilters {
  status?: string;
  lifecycleStatus?: string;
  carrierId?: string;
  product?: string;
  productId?: string;
  userId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  dateField?: "submit_date" | "effective_date";
  searchTerm?: string;
}

/**
 * Minimal chainable surface of a PostgREST query, used so the shared filter
 * helpers can mutate any policy query while preserving its concrete type.
 */
interface PolicyQueryBuilder {
  eq(column: string, value: string | number | boolean): this;
  gte(column: string, value: string): this;
  lte(column: string, value: string): this;
  or(filters: string): this;
}

export class PolicyRepository extends BaseRepository<
  Policy,
  CreatePolicyData,
  UpdatePolicyData
> {
  constructor() {
    super(TABLES.POLICIES);
  }

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  /**
   * Run a repository operation with a single error path.
   *
   * `handleError()` already builds and logs a friendly Error, so when we catch
   * an Error here we re-throw it untouched (no double-logging). Only genuinely
   * unexpected non-Error throws get wrapped.
   */
  private async run<R>(operation: string, fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw this.wrapError(error, operation);
    }
  }

  /**
   * Apply the canonical equality + date-range filters to a policy query.
   * One implementation shared by findAll, countPolicies, and getAggregateMetrics
   * so the column mapping can never drift between them.
   */
  private applyEqualityAndDates<Q extends PolicyQueryBuilder>(
    query: Q,
    filters: PolicyFilters,
  ): Q {
    if (filters.status != null) query = query.eq("status", filters.status);
    if (filters.lifecycleStatus != null)
      query = query.eq("lifecycle_status", filters.lifecycleStatus);
    if (filters.carrierId != null)
      query = query.eq("carrier_id", filters.carrierId);
    if (filters.product != null) query = query.eq("product", filters.product);
    if (filters.productId != null)
      query = query.eq("product_id", filters.productId);
    if (filters.userId != null) query = query.eq("user_id", filters.userId);

    // Default to submit_date because it's non-nullable — effective_date is null
    // for freshly submitted policies and silently drops them.
    const dateColumn: "submit_date" | "effective_date" =
      filters.dateField === "effective_date" ? "effective_date" : "submit_date";
    if (filters.dateFrom) query = query.gte(dateColumn, filters.dateFrom);
    if (filters.dateTo) query = query.lte(dateColumn, filters.dateTo);

    return query;
  }

  /**
   * Build an .or() filter string that searches both policy_number and client name.
   * PostgREST can't do .or() across foreign-table joins, so we pre-query the
   * clients table for matching IDs, then combine into a single .or() clause.
   */
  private async buildSearchFilter(
    searchTerm: string | undefined,
    userId: string | undefined,
  ): Promise<string | null> {
    if (!searchTerm) return null;

    // Strip PostgREST filter-syntax chars to prevent filter injection
    const sanitized = searchTerm.replace(/[.,()]/g, "");
    if (!sanitized) return null;

    const likeTerm = `%${sanitized}%`;

    // Pre-query clients table for IDs whose name matches
    let clientQuery = this.client
      .from("clients")
      .select("id")
      .ilike("name", likeTerm);

    if (userId) {
      clientQuery = clientQuery.eq("user_id", userId);
    }

    const { data: matchingClients } = await clientQuery;
    const clientIds = matchingClients?.map((c) => c.id) || [];

    if (clientIds.length > 0) {
      return `policy_number.ilike.${likeTerm},client_id.in.(${clientIds.join(",")})`;
    }
    return `policy_number.ilike.${likeTerm}`;
  }

  // -------------------------------------------------------------------------
  // CRUD overrides (each includes the client join so cached data is complete)
  // -------------------------------------------------------------------------

  // Override create to include client join (same as findById/update).
  // Ensures the returned policy has complete client data for immediate edit
  // and for correct client info on the auto-created commission record.
  async create(data: CreatePolicyData): Promise<Policy> {
    return this.run("create", async () => {
      const dbData = this.transformToDB(data);

      const { data: result, error } = await this.client
        .from(this.tableName)
        .insert(dbData)
        .select(POLICY_WITH_CLIENT)
        .single();

      if (error) throw this.handleError(error, "create");

      return this.transformFromDB(result);
    });
  }

  async findById(id: string): Promise<Policy | null> {
    return this.run("findById", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw this.handleError(error, "findById");
      }

      return data ? this.transformFromDB(data) : null;
    });
  }

  async update(
    id: string,
    updates: Partial<UpdatePolicyData>,
  ): Promise<Policy> {
    return this.run("update", async () => {
      const dbData = this.transformToDB(updates, true);

      const { data, error } = await this.client
        .from(this.tableName)
        .update(dbData)
        .eq("id", id)
        .select(POLICY_WITH_CLIENT)
        .single();

      if (error) throw this.handleError(error, "update");

      return this.transformFromDB(data);
    });
  }

  // Override findAll to include client join and support pagination + filtering.
  async findAll(
    options?: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDirection?: "asc" | "desc";
      limit?: number;
      offset?: number;
      userId?: string; // Filter by specific user - CRITICAL for Policies page
    },
    filters?: PolicyFilters,
  ): Promise<Policy[]> {
    return this.run("findAll", async () => {
      let query = this.client.from(this.tableName).select(POLICY_WITH_CLIENT);

      // CRITICAL: Filter by user ID when specified. RLS still allows downline
      // policies for Team/Hierarchy pages; this scopes the Policies page.
      if (options?.userId) {
        query = query.eq("user_id", options.userId);
      }

      if (filters) {
        query = this.applyEqualityAndDates(query, filters);
        const searchFilter = await this.buildSearchFilter(
          filters.searchTerm,
          options?.userId,
        );
        if (searchFilter) query = query.or(searchFilter);
      }

      // Apply sorting
      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection === "asc",
        });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      // Apply pagination (support both page-based and limit/offset styles)
      if (options?.page && options?.pageSize) {
        const offset = (options.page - 1) * options.pageSize;
        query = query.range(offset, offset + options.pageSize - 1);
      } else if (options?.limit) {
        query = query.limit(options.limit);
        if (options?.offset) {
          query = query.range(
            options.offset,
            options.offset + (options.limit || 10) - 1,
          );
        }
      }

      const { data, error } = await query;

      if (error) throw this.handleError(error, "findAll");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  // -------------------------------------------------------------------------
  // Finders
  // -------------------------------------------------------------------------

  async findByPolicyNumber(
    policyNumber: string,
    userId?: string,
  ): Promise<Policy | null> {
    return this.run("findByPolicyNumber", async () => {
      // Use .limit(1) instead of .single() to avoid a 406 when a user has
      // duplicate policy numbers (e.g. from a double-click).
      let query = this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT)
        .eq("policy_number", policyNumber);

      // Scope to a specific user to avoid false positives from upline RLS.
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.limit(1);

      if (error) throw this.handleError(error, "findByPolicyNumber");

      const record = data && data.length > 0 ? data[0] : null;
      return record ? this.transformFromDB(record) : null;
    });
  }

  async findByCarrier(carrierId: string): Promise<Policy[]> {
    return this.run("findByCarrier", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT)
        .eq("carrier_id", carrierId)
        .order("created_at", { ascending: false });

      if (error) throw this.handleError(error, "findByCarrier");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  async findByAgent(userId: string): Promise<Policy[]> {
    return this.run("findByAgent", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw this.handleError(error, "findByAgent");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  /**
   * Find recent policies that are NOT linked to any lead purchase.
   * Used for the policy selector in LeadPurchaseDialog — current user's
   * policies from the last 90 days, with client info.
   */
  async findUnlinkedRecent(
    userId: string,
    limit: number = 50,
  ): Promise<Policy[]> {
    return this.run("findUnlinkedRecent", async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT_MINIMAL)
        .eq("user_id", userId)
        .is("lead_purchase_id", null)
        .gte("effective_date", ninetyDaysAgo.toISOString().split("T")[0])
        .order("effective_date", { ascending: false })
        .limit(limit);

      if (error) throw this.handleError(error, "findUnlinkedRecent");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  /**
   * Find policies linked to a specific lead purchase.
   * Returns policies with client info + commissions for ROI tracking display.
   */
  async findByLeadPurchaseId(leadPurchaseId: string): Promise<Policy[]> {
    return this.run("findByLeadPurchaseId", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_CLIENT_AND_COMMISSIONS)
        .eq("lead_purchase_id", leadPurchaseId)
        .order("created_at", { ascending: false });

      if (error) throw this.handleError(error, "findByLeadPurchaseId");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  // -------------------------------------------------------------------------
  // Batch / hierarchy methods
  // -------------------------------------------------------------------------

  /**
   * Find policy metrics for multiple users (lightweight projection).
   * Used by the hierarchy service for team metric calculations.
   */
  async findMetricsByUserIds(userIds: string[]): Promise<PolicyMetricRow[]> {
    if (userIds.length === 0) return [];

    return this.run("findMetricsByUserIds", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          "user_id, status, lifecycle_status, annual_premium, created_at, submit_date, effective_date",
        )
        .in("user_id", userIds);

      if (error) throw this.handleError(error, "findMetricsByUserIds");

      return (data as PolicyMetricRow[]) || [];
    });
  }

  /** Find policies with client/carrier names for a user. */
  async findWithRelationsByUserId(
    userId: string,
  ): Promise<PolicyWithRelations[]> {
    return this.run("findWithRelationsByUserId", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(POLICY_WITH_RELATION_NAMES)
        .eq("user_id", userId)
        .order("effective_date", { ascending: false });

      if (error) throw this.handleError(error, "findWithRelationsByUserId");

      return (data as unknown as PolicyWithRelations[]) || [];
    });
  }

  /** Find the N most recent policies for a user (no client join). */
  async findRecentByUserId(
    userId: string,
    limit: number = 5,
  ): Promise<Policy[]> {
    return this.run("findRecentByUserId", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw this.handleError(error, "findRecentByUserId");

      return data?.map((item) => this.transformFromDB(item)) || [];
    });
  }

  // -------------------------------------------------------------------------
  // Counts & aggregates
  // -------------------------------------------------------------------------

  /**
   * Count total policies with filters (separate from pagination for perf).
   * @param currentUserId - CRITICAL: scopes the count to the user's policies.
   */
  async countPolicies(
    filters?: PolicyFilters,
    currentUserId?: string,
  ): Promise<number> {
    return this.run("countPolicies", async () => {
      let query = this.client
        .from(this.tableName)
        .select("id", { count: "exact", head: true }); // Count only, no rows

      if (currentUserId) {
        query = query.eq("user_id", currentUserId);
      }

      if (filters) {
        query = this.applyEqualityAndDates(query, filters);
        const searchFilter = await this.buildSearchFilter(
          filters.searchTerm,
          currentUserId,
        );
        if (searchFilter) query = query.or(searchFilter);
      }

      const { count, error } = await query;

      if (error) throw this.handleError(error, "countPolicies");

      return count || 0;
    });
  }

  /**
   * Count how many policies share the same client_id.
   * Used for pre-delete warnings when policies share a client.
   */
  async countPoliciesByClientId(clientId: string): Promise<number> {
    return this.run("countPoliciesByClientId", async () => {
      const { count, error } = await this.client
        .from(this.tableName)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);

      if (error) throw this.handleError(error, "countPoliciesByClientId");

      return count || 0;
    });
  }

  /**
   * Get client_id for a policy. Used to check if a client is shared before
   * deletion.
   */
  async getClientIdForPolicy(policyId: string): Promise<string | null> {
    return this.run("getClientIdForPolicy", async () => {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("client_id")
        .eq("id", policyId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw this.handleError(error, "getClientIdForPolicy");
      }

      return data?.client_id || null;
    });
  }

  /**
   * Get aggregate metrics across ALL policies matching filters (not just the
   * current page).
   * @param currentUserId - CRITICAL: scopes the metrics to the user's policies.
   *
   * NOTE: aggregation runs client-side over the matching rows (≤~171/user in
   * practice). Pushing this into a Postgres RPC is deferred as premature.
   */
  async getAggregateMetrics(
    filters?: PolicyFilters,
    currentUserId?: string,
  ): Promise<{
    totalPolicies: number;
    activePolicies: number;
    pendingPolicies: number;
    lapsedPolicies: number;
    cancelledPolicies: number;
    totalPremium: number;
    avgPremium: number;
    ytdPolicies: number;
    ytdPremium: number;
  }> {
    return this.run("getAggregateMetrics", async () => {
      let query = this.client
        .from(this.tableName)
        .select("status, lifecycle_status, annual_premium, effective_date", {
          count: "exact",
        });

      if (currentUserId) {
        query = query.eq("user_id", currentUserId);
      }

      if (filters) {
        query = this.applyEqualityAndDates(query, filters);
        const searchFilter = await this.buildSearchFilter(
          filters.searchTerm,
          currentUserId,
        );
        if (searchFilter) query = query.or(searchFilter);
      }

      const { data, count, error } = await query;

      if (error) throw this.handleError(error, "getAggregateMetrics");

      const currentYear = new Date().getFullYear();
      const policies = data || [];

      // lifecycle_status drives active/lapsed/cancelled (issued lifecycle);
      // status drives pending (application outcome).
      const activePolicies = policies.filter(
        (p) => p.lifecycle_status === "active",
      ).length;
      const pendingPolicies = policies.filter(
        (p) => p.status === "pending",
      ).length;
      const lapsedPolicies = policies.filter(
        (p) => p.lifecycle_status === "lapsed",
      ).length;
      const cancelledPolicies = policies.filter(
        (p) => p.lifecycle_status === "cancelled",
      ).length;

      const totalPremium = policies.reduce(
        (sum, p) => sum + toNumber(p.annual_premium),
        0,
      );
      const avgPremium =
        policies.length > 0 ? totalPremium / policies.length : 0;

      const isYtd = (p: (typeof policies)[number]) =>
        !!p.effective_date &&
        parseLocalDate(p.effective_date).getFullYear() === currentYear;

      const ytdPolicies = policies.filter(isYtd).length;
      const ytdPremium = policies
        .filter(isYtd)
        .reduce((sum, p) => sum + toNumber(p.annual_premium), 0);

      return {
        totalPolicies: count || 0,
        activePolicies,
        pendingPolicies,
        lapsedPolicies,
        cancelledPolicies,
        totalPremium,
        avgPremium,
        ytdPolicies,
        ytdPremium,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Transforms
  // -------------------------------------------------------------------------

  protected transformFromDB(dbRecord: Record<string, unknown>): Policy {
    return mapPolicyFromDb(dbRecord as unknown as PolicyDbRecord);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transform function requires flexible typing
  protected transformToDB(
    data: any,
    _isUpdate = false,
  ): Record<string, unknown> {
    const dbData: Record<string, unknown> = {};

    if (data.policyNumber !== undefined)
      dbData.policy_number = data.policyNumber;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.lifecycleStatus !== undefined) {
      dbData.lifecycle_status = data.lifecycleStatus;
    } else if (!_isUpdate && data.status === "approved") {
      // Invariant: approved policies must have a lifecycle_status.
      // Defend against forms / callers that omit it on create.
      dbData.lifecycle_status = "active";
    }
    if (data.clientId !== undefined) dbData.client_id = data.clientId;
    if (data.carrierId !== undefined) dbData.carrier_id = data.carrierId;
    if (data.productId !== undefined) dbData.product_id = data.productId;
    if (data.userId !== undefined) dbData.user_id = data.userId;
    if (data.product !== undefined) dbData.product = data.product;
    if (data.effectiveDate !== undefined) {
      dbData.effective_date =
        data.effectiveDate instanceof Date
          ? formatDateForDB(data.effectiveDate)
          : data.effectiveDate;
    }
    if (data.submitDate !== undefined) {
      dbData.submit_date =
        data.submitDate instanceof Date
          ? formatDateForDB(data.submitDate)
          : data.submitDate;
    }
    if (data.termLength !== undefined) dbData.term_length = data.termLength;
    if (data.expirationDate !== undefined) {
      dbData.expiration_date =
        data.expirationDate instanceof Date
          ? formatDateForDB(data.expirationDate)
          : data.expirationDate;
    }
    if (data.annualPremium !== undefined)
      dbData.annual_premium = data.annualPremium;
    if (data.monthlyPremium !== undefined)
      dbData.monthly_premium = data.monthlyPremium;
    if (data.paymentFrequency !== undefined)
      dbData.payment_frequency = data.paymentFrequency;
    if (data.commissionPercentage !== undefined)
      dbData.commission_percentage = data.commissionPercentage;
    if (data.createdBy !== undefined) dbData.created_by = data.createdBy;
    if (data.notes !== undefined) dbData.notes = data.notes;
    // Lead source tracking
    if (data.leadPurchaseId !== undefined)
      dbData.lead_purchase_id = data.leadPurchaseId;
    if (data.leadSourceType !== undefined)
      dbData.lead_source_type = data.leadSourceType;

    // Multi-tenant fields (defense-in-depth - also set by DB trigger)
    if (data.imoId !== undefined) dbData.imo_id = data.imoId;
    if (data.agencyId !== undefined) dbData.agency_id = data.agencyId;

    return dbData;
  }
}
