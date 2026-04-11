// src/services/policies/PolicyRepository.ts
import { BaseRepository } from "../base/BaseRepository";
import { TABLES } from "../base/supabase";
import {
  Policy,
  CreatePolicyData,
  UpdatePolicyData,
} from "../../types/policy.types";
import { formatDateForDB, parseLocalDate } from "../../lib/date";

// ---------------------------------------------------------------------------
// Type definitions for lightweight metric queries
// ---------------------------------------------------------------------------

export interface PolicyMetricRow {
  user_id: string;
  status: string | null;
  lifecycle_status: string | null;
  annual_premium: number | string | null;
  created_at: string | null;
  submit_date: string | null;
  effective_date: string | null;
}

export interface PolicyWithRelations {
  id: string;
  policy_number: string | null;
  user_id: string;
  status: string | null;
  lifecycle_status: string | null; // TODO: should this not be using a type/interface? lifecycle statuses will never change.
  annual_premium: number | string | null;
  product: string | null;
  carrier_id: string | null;
  submit_date: string | null;
  effective_date: string | null;
  created_at: string | null;
  client: { name: string } | null;
  carrier: { name: string } | null;
}

export class PolicyRepository extends BaseRepository<
  Policy,
  CreatePolicyData,
  UpdatePolicyData
> {
  constructor() {
    super(TABLES.POLICIES);
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

  // Override create to include client join (same as findById/update)
  // This ensures the returned policy has complete client data for:
  // 1. Immediate edit functionality (client name/state/age populate correctly)
  // 2. Commission creation (correct client info stored on commission record)
  async create(data: CreatePolicyData): Promise<Policy> {
    try {
      const dbData = this.transformToDB(data);

      const { data: result, error } = await this.client
        .from(this.tableName)
        .insert(dbData)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .single();

      if (error) {
        throw this.handleError(error, "create");
      }

      return this.transformFromDB(result);
    } catch (error) {
      throw this.wrapError(error, "create");
    }
  }

  // Override findById to include client join
  async findById(id: string): Promise<Policy | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw this.handleError(error, "findById");
      }

      return data ? this.transformFromDB(data) : null;
    } catch (error) {
      throw this.wrapError(error, "findById");
    }
  }

  // Override update to include client join so cached data is complete
  async update(
    id: string,
    updates: Partial<import("../../types/policy.types").UpdatePolicyData>,
  ): Promise<Policy> {
    try {
      const dbData = this.transformToDB(updates, true);

      const { data, error } = await this.client
        .from(this.tableName)
        .update(dbData)
        .eq("id", id)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .single();

      if (error) {
        throw this.handleError(error, "update");
      }

      return this.transformFromDB(data);
    } catch (error) {
      throw this.wrapError(error, "update");
    }
  }

  // Override findAll to include client join and support pagination + date filtering
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
    filters?: {
      status?: string;
      carrierId?: string;
      product?: string;
      dateFrom?: string; // YYYY-MM-DD format
      dateTo?: string; // YYYY-MM-DD format
      dateField?: "submit_date" | "effective_date";
      searchTerm?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
      [key: string]: any;
    },
  ): Promise<Policy[]> {
    try {
      let query = this.client.from(this.tableName).select(`
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `);

      // CRITICAL: Filter by user ID when specified
      // This ensures Policies page shows only the user's own policies
      // RLS still allows access to downline policies for Team/Hierarchy pages
      if (options?.userId) {
        query = query.eq("user_id", options.userId);
      }

      // Apply filters
      if (filters) {
        // Handle standard equality filters
        const { dateFrom, dateTo, dateField, searchTerm, ...equalityFilters } =
          filters;

        Object.entries(equalityFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Map filter keys to database columns
            const columnMap: { [key: string]: string } = {
              carrierId: "carrier_id",
              product: "product",
              status: "status",
              lifecycleStatus: "lifecycle_status",
            };
            const column = columnMap[key] || key;
            query = query.eq(column, value);
          }
        });

        // Apply date range filters against the caller-selected column.
        // Default to submit_date because it's non-nullable — effective_date is
        // null for freshly submitted policies and silently drops them.
        const dateColumn: "submit_date" | "effective_date" =
          dateField === "effective_date" ? "effective_date" : "submit_date";
        if (dateFrom) {
          query = query.gte(dateColumn, dateFrom);
        }
        if (dateTo) {
          query = query.lte(dateColumn, dateTo);
        }

        // Apply search term filter (searches policy_number and client name)
        const searchFilter = await this.buildSearchFilter(
          searchTerm,
          options?.userId,
        );
        if (searchFilter) {
          query = query.or(searchFilter);
        }
      }

      // Apply sorting
      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection === "asc",
        });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      // Apply pagination (support both old style and new style)
      if (options?.page && options?.pageSize) {
        // New style: page-based pagination
        const offset = (options.page - 1) * options.pageSize;
        query = query.range(offset, offset + options.pageSize - 1);
      } else if (options?.limit) {
        // Old style: limit/offset pagination
        query = query.limit(options.limit);
        if (options?.offset) {
          query = query.range(
            options.offset,
            options.offset + (options.limit || 10) - 1,
          );
        }
      }

      const { data, error } = await query;

      if (error) {
        throw this.handleError(error, "findAll");
      }

      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findAll");
    }
  }

  async findByPolicyNumber(
    policyNumber: string,
    userId?: string,
  ): Promise<Policy | null> {
    try {
      // Use .limit(1) instead of .single() to avoid 406 error when multiple
      // users have the same policy number (RLS filters to current user, but
      // if user has duplicates from double-click, .single() would fail)
      let query = this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .eq("policy_number", policyNumber);

      // Scope to specific user to avoid false positives from upline RLS visibility
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        throw this.handleError(error, "findByPolicyNumber");
      }

      // .limit(1) returns an array, get the first element or null
      const record = data && data.length > 0 ? data[0] : null;
      return record ? this.transformFromDB(record) : null;
    } catch (error) {
      throw this.wrapError(error, "findByPolicyNumber");
    }
  }

  async findByCarrier(carrierId: string): Promise<Policy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .eq("carrier_id", carrierId)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByCarrier");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findByCarrier");
    }
  }

  async findByAgent(userId: string): Promise<Policy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByAgent");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findByAgent");
    }
  }

  /**
   * Find recent policies that are NOT linked to any lead purchase
   * Used for the policy selector in LeadPurchaseDialog
   * Returns only the current user's policies from the last 90 days with client info
   */
  async findUnlinkedRecent(
    userId: string,
    limit: number = 50,
  ): Promise<Policy[]> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email
          )
        `,
        )
        .eq("user_id", userId)
        .is("lead_purchase_id", null)
        .gte("effective_date", ninetyDaysAgo.toISOString().split("T")[0])
        .order("effective_date", { ascending: false })
        .limit(limit);

      if (error) {
        throw this.handleError(error, "findUnlinkedRecent");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findUnlinkedRecent");
    }
  }

  /**
   * Find policies linked to a specific lead purchase
   * Returns policies with client info for ROI tracking display
   */
  async findByLeadPurchaseId(leadPurchaseId: string): Promise<Policy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          ),
          commissions (
            id,
            amount,
            type
          )
        `,
        )
        .eq("lead_purchase_id", leadPurchaseId)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByLeadPurchaseId");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findByLeadPurchaseId");
    }
  }

  // -------------------------------------------------------------------------
  // BATCH METHODS (for hierarchy/team queries)
  // -------------------------------------------------------------------------

  /**
   * Find policies for multiple agents (batch)
   */
  async findByAgents(userIds: string[]): Promise<Policy[]> {
    if (userIds.length === 0) return [];

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .in("user_id", userIds)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByAgents");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findByAgents");
    }
  }

  /**
   * Find policy metrics for multiple users (lightweight query)
   * Used by hierarchy service for calculating team metrics
   */
  async findMetricsByUserIds(userIds: string[]): Promise<PolicyMetricRow[]> {
    if (userIds.length === 0) return [];

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          "user_id, status, lifecycle_status, annual_premium, created_at, submit_date, effective_date",
        )
        .in("user_id", userIds);

      if (error) {
        throw this.handleError(error, "findMetricsByUserIds");
      }

      return (data as PolicyMetricRow[]) || [];
    } catch (error) {
      throw this.wrapError(error, "findMetricsByUserIds");
    }
  }

  /**
   * Find policies with client/carrier relations for a user
   */
  async findWithRelationsByUserId(
    userId: string,
  ): Promise<PolicyWithRelations[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          client:clients(name),
          carrier:carriers(name)
        `,
        )
        .eq("user_id", userId)
        .order("effective_date", { ascending: false });

      if (error) {
        throw this.handleError(error, "findWithRelationsByUserId");
      }

      return (data as PolicyWithRelations[]) || [];
    } catch (error) {
      throw this.wrapError(error, "findWithRelationsByUserId");
    }
  }

  /**
   * Find recent policies for a user
   */
  async findRecentByUserId(
    userId: string,
    limit: number = 5,
  ): Promise<Policy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw this.handleError(error, "findRecentByUserId");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findRecentByUserId");
    }
  }

  async findActiveByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Policy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          )
        `,
        )
        .eq("status", "active")
        .gte("effective_date", formatDateForDB(startDate))
        .lte("effective_date", formatDateForDB(endDate))
        .order("effective_date", { ascending: false });

      if (error) {
        throw this.handleError(error, "findActiveByDateRange");
      }

      return data?.map(this.transformFromDB) || [];
    } catch (error) {
      throw this.wrapError(error, "findActiveByDateRange");
    }
  }

  async getTotalAnnualPremiumByCarrier(carrierId: string): Promise<number> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("annual_premium")
        .eq("carrier_id", carrierId)
        .eq("status", "active");

      if (error) {
        throw this.handleError(error, "getTotalAnnualPremiumByCarrier");
      }

      return (
        data?.reduce(
          (total, policy) => total + parseFloat(policy.annual_premium || "0"),
          0,
        ) || 0
      );
    } catch (error) {
      throw this.wrapError(error, "getTotalAnnualPremiumByCarrier");
    }
  }

  /**
   * Find policies with cursor-based pagination to handle Supabase 1000 row limit
   * @param options Pagination options including cursor, limit, and filters
   * @returns Paginated policy results with next cursor
   */
  async findPaginated(options: {
    cursor?: string;
    limit?: number;
    filters?: {
      status?: string;
      carrierId?: string;
      productId?: string;
      userId?: string;
    };
    orderBy?: "created_at" | "effective_date" | "id";
    orderDirection?: "asc" | "desc";
  }): Promise<{
    data: Policy[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    try {
      const {
        cursor,
        limit = 50,
        filters = {},
        orderBy = "created_at",
        orderDirection = "desc",
      } = options;

      // Build base query
      let query = this.client.from(this.tableName).select(`
          *,
          clients!policies_client_id_fkey (
            id,
            name,
            email,
            phone,
            address,
            date_of_birth
          ),
          products!policies_product_id_fkey(*)
        `); // Include client and product details

      // Apply cursor (for pagination)
      if (cursor) {
        if (orderDirection === "desc") {
          query = query.lt(orderBy, cursor);
        } else {
          query = query.gt(orderBy, cursor);
        }
      }

      // Apply filters
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.carrierId) query = query.eq("carrier_id", filters.carrierId);
      if (filters.productId) query = query.eq("product_id", filters.productId);
      if (filters.userId) query = query.eq("user_id", filters.userId);

      // Order and limit
      query = query
        .order(orderBy, { ascending: orderDirection === "asc" })
        .limit(limit + 1); // Fetch one extra to check if there's more

      const { data, error } = await query;

      if (error) {
        throw this.handleError(error, "findPaginated");
      }

      const hasMore = data ? data.length > limit : false;
      const policies = data
        ? data.slice(0, limit).map(this.transformFromDB)
        : [];

      // Next cursor is the last item's orderBy field
      const nextCursor =
        hasMore && policies.length > 0
          ? policies[policies.length - 1][
              orderBy === "created_at"
                ? "createdAt"
                : orderBy === "effective_date"
                  ? "effectiveDate"
                  : "id"
            ]
          : null;

      return {
        data: policies,
        nextCursor: typeof nextCursor === "string" ? nextCursor : null,
        hasMore,
      };
    } catch (error) {
      throw this.wrapError(error, "findPaginated");
    }
  }

  /**
   * Count total policies with filters (separate from pagination for performance)
   * @param filters - Optional filters including userId for user-specific counts
   * @param currentUserId - CRITICAL: Current user's ID to filter to only their policies
   */
  async countPolicies(
    filters?: {
      status?: string;
      carrierId?: string;
      productId?: string;
      product?: string;
      userId?: string;
      dateFrom?: string; // YYYY-MM-DD format
      dateTo?: string; // YYYY-MM-DD format
      dateField?: "submit_date" | "effective_date";
      searchTerm?: string;
    },
    currentUserId?: string,
  ): Promise<number> {
    try {
      let query = this.client
        .from(this.tableName)
        .select("id", { count: "exact", head: true }); // Only count, don't fetch data

      // CRITICAL: Filter by current user ID when specified
      if (currentUserId) {
        query = query.eq("user_id", currentUserId);
      }

      if (filters) {
        // Standard equality filters
        if (filters.status) query = query.eq("status", filters.status);
        if (filters.carrierId)
          query = query.eq("carrier_id", filters.carrierId);
        if (filters.productId)
          query = query.eq("product_id", filters.productId);
        if (filters.product) query = query.eq("product", filters.product);
        if (filters.userId) query = query.eq("user_id", filters.userId);

        // Date range filters — target column chosen by caller (default submit_date)
        const dateColumn: "submit_date" | "effective_date" =
          filters.dateField === "effective_date"
            ? "effective_date"
            : "submit_date";
        if (filters.dateFrom) {
          query = query.gte(dateColumn, filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte(dateColumn, filters.dateTo);
        }

        // Search term filter (searches policy_number and client name)
        const searchFilter = await this.buildSearchFilter(
          filters.searchTerm,
          currentUserId,
        );
        if (searchFilter) {
          query = query.or(searchFilter);
        }
      }

      const { count, error } = await query;

      if (error) {
        throw this.handleError(error, "countPolicies");
      }

      return count || 0;
    } catch (error) {
      throw this.wrapError(error, "countPolicies");
    }
  }

  /**
   * Count how many policies share the same client_id
   * Used for pre-delete warnings when multiple policies share a client
   * @param clientId - The client ID to check
   * @returns Count of policies with this client_id
   */
  async countPoliciesByClientId(clientId: string): Promise<number> {
    try {
      const { count, error } = await this.client
        .from(this.tableName)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);

      if (error) {
        throw this.handleError(error, "countPoliciesByClientId");
      }

      return count || 0;
    } catch (error) {
      throw this.wrapError(error, "countPoliciesByClientId");
    }
  }

  /**
   * Get client_id for a specific policy
   * Used to check if client is shared before deletion
   */
  async getClientIdForPolicy(policyId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("client_id")
        .eq("id", policyId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw this.handleError(error, "getClientIdForPolicy");
      }

      return data?.client_id || null;
    } catch (error) {
      throw this.wrapError(error, "getClientIdForPolicy");
    }
  }

  async getMonthlyMetrics(
    year: number,
    month: number,
  ): Promise<{
    totalPolicies: number;
    totalPremium: number;
    averagePremium: number;
    newPolicies: number;
  }> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const [allPolicies, newPolicies] = await Promise.all([
        this.client
          .from(this.tableName)
          .select("annual_premium")
          .eq("status", "active")
          .lte("effective_date", formatDateForDB(endDate)),
        this.client
          .from(this.tableName)
          .select("annual_premium")
          .gte("effective_date", formatDateForDB(startDate))
          .lte("effective_date", formatDateForDB(endDate)),
      ]);

      if (allPolicies.error) {
        throw this.handleError(allPolicies.error, "getMonthlyMetrics");
      }

      if (newPolicies.error) {
        throw this.handleError(newPolicies.error, "getMonthlyMetrics");
      }

      const totalPolicies = allPolicies.data?.length || 0;
      const totalPremium =
        allPolicies.data?.reduce(
          (sum, p) => sum + parseFloat(p.annual_premium || "0"),
          0,
        ) || 0;
      const averagePremium =
        totalPolicies > 0 ? totalPremium / totalPolicies : 0;
      const newPolicyCount = newPolicies.data?.length || 0;

      return {
        totalPolicies,
        totalPremium,
        averagePremium,
        newPolicies: newPolicyCount,
      };
    } catch (error) {
      throw this.wrapError(error, "getMonthlyMetrics");
    }
  }

  /**
   * Get aggregate metrics for policies matching filters
   * Returns totals across ALL matching policies (not just current page)
   * @param filters - Optional filters to apply
   * @param currentUserId - CRITICAL: Current user's ID to filter to only their policies
   */
  async getAggregateMetrics(
    filters?: {
      status?: string;
      carrierId?: string;
      product?: string;
      dateFrom?: string;
      dateTo?: string;
      dateField?: "submit_date" | "effective_date";
      searchTerm?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
      [key: string]: any;
    },
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
    try {
      // Build base query with filters
      let query = this.client
        .from(this.tableName)
        .select("status, lifecycle_status, annual_premium, effective_date", {
          count: "exact",
        });

      // CRITICAL: Filter by current user ID when specified
      if (currentUserId) {
        query = query.eq("user_id", currentUserId);
      }

      // Apply filters (same logic as findAll)
      if (filters) {
        const { dateFrom, dateTo, dateField, searchTerm, ...equalityFilters } =
          filters;

        Object.entries(equalityFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const columnMap: { [key: string]: string } = {
              status: "status",
              carrierId: "carrier_id",
              product: "product",
            };
            const column = columnMap[key] || key;
            query = query.eq(column, value);
          }
        });

        // Date range filters — target column chosen by caller (default submit_date)
        const dateColumn: "submit_date" | "effective_date" =
          dateField === "effective_date" ? "effective_date" : "submit_date";
        if (dateFrom) {
          query = query.gte(dateColumn, dateFrom);
        }
        if (dateTo) {
          query = query.lte(dateColumn, dateTo);
        }

        // Apply search term filter (searches policy_number and client name)
        const searchFilter = await this.buildSearchFilter(
          searchTerm,
          currentUserId,
        );
        if (searchFilter) {
          query = query.or(searchFilter);
        }
      }

      const { data, count, error } = await query;

      if (error) {
        console.error("PolicyRepository.getAggregateMetrics error:", error);
        throw error;
      }

      // Calculate aggregates from returned data
      const currentYear = new Date().getFullYear();
      const policies = data || [];

      // Use lifecycle_status for active/lapsed/cancelled (issued policy lifecycle)
      // Use status for pending (application outcome)
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
        (sum, p) => sum + (parseFloat(p.annual_premium) || 0),
        0,
      );
      const avgPremium =
        policies.length > 0 ? totalPremium / policies.length : 0;

      const ytdPolicies = policies.filter(
        (p) =>
          p.effective_date &&
          parseLocalDate(p.effective_date).getFullYear() === currentYear,
      ).length;
      const ytdPremium = policies
        .filter(
          (p) =>
            p.effective_date &&
            parseLocalDate(p.effective_date).getFullYear() === currentYear,
        )
        .reduce((sum, p) => sum + (parseFloat(p.annual_premium) || 0), 0);

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
    } catch (error) {
      console.error("PolicyRepository.getAggregateMetrics error:", error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
  protected transformFromDB(dbRecord: any): Policy {
    // Handle joined client data from foreign key relationship
    let clientData;
    if (dbRecord.clients) {
      // Client was joined - parse address JSONB field for state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
      let address: any = {};
      if (dbRecord.clients.address) {
        if (typeof dbRecord.clients.address === "string") {
          try {
            address = JSON.parse(dbRecord.clients.address);
          } catch {
            // Silent fail - use defaults
          }
        } else {
          address = dbRecord.clients.address;
        }
      }

      // Calculate age from date_of_birth
      let age = 0;
      if (dbRecord.clients.date_of_birth) {
        const dob = new Date(dbRecord.clients.date_of_birth);
        const today = new Date();
        age = today.getFullYear() - dob.getFullYear();
        // Adjust if birthday hasn't occurred this year
        const monthDiff = today.getMonth() - dob.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < dob.getDate())
        ) {
          age--;
        }
      }

      clientData = {
        name: dbRecord.clients.name || "Unknown",
        state: address.state || "Unknown",
        // Use calculated age from DOB, fallback to legacy address.age for existing clients
        age: age || address.age || 0,
        dateOfBirth: dbRecord.clients.date_of_birth || undefined,
        email: dbRecord.clients.email,
        phone: dbRecord.clients.phone,
        street: address.street || undefined,
        city: address.city || undefined,
        zipCode: address.zipCode || undefined,
      };
    } else if (dbRecord.client) {
      // Fallback to JSONB client field for backward compatibility
      clientData = dbRecord.client;
    } else {
      // No client data - create minimal object
      clientData = {
        name: "Unknown",
        state: "Unknown",
        age: 0,
      };
    }

    const policy = {
      id: dbRecord.id,
      policyNumber: dbRecord.policy_number,
      status: dbRecord.status,
      lifecycleStatus: dbRecord.lifecycle_status || null,
      client: clientData,
      carrierId: dbRecord.carrier_id,
      productId: dbRecord.product_id,
      userId: dbRecord.user_id,
      product: dbRecord.product,
      productDetails: dbRecord.products || undefined,
      submitDate: dbRecord.submit_date || undefined,
      effectiveDate: dbRecord.effective_date,
      termLength: dbRecord.term_length,
      expirationDate: dbRecord.expiration_date || undefined,
      annualPremium:
        dbRecord.annual_premium != null
          ? parseFloat(String(dbRecord.annual_premium))
          : 0,
      monthlyPremium:
        dbRecord.monthly_premium != null
          ? parseFloat(String(dbRecord.monthly_premium))
          : 0,
      paymentFrequency: dbRecord.payment_frequency,
      commissionPercentage:
        dbRecord.commission_percentage != null
          ? parseFloat(String(dbRecord.commission_percentage))
          : 0,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
      created_at: dbRecord.created_at,
      updated_at: dbRecord.updated_at,
      createdBy: dbRecord.created_by,
      notes: dbRecord.notes,
      leadPurchaseId: dbRecord.lead_purchase_id,
      leadSourceType: dbRecord.lead_source_type,
    };
    return policy;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transform function requires flexible typing
  protected transformToDB(data: any, _isUpdate = false): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
    const dbData: any = {};

    if (data.policyNumber !== undefined)
      dbData.policy_number = data.policyNumber;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.lifecycleStatus !== undefined)
      dbData.lifecycle_status = data.lifecycleStatus;
    if (data.clientId !== undefined) dbData.client_id = data.clientId; // Use client_id foreign key
    if (data.carrierId !== undefined) dbData.carrier_id = data.carrierId;
    if (data.productId !== undefined) dbData.product_id = data.productId; // NEW: Product ID field
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
    // advanceMonths removed - now only in commissions table
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
