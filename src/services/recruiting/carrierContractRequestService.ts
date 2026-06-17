// src/services/recruiting/carrierContractRequestService.ts
import { supabase } from "../base/supabase";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import type { Database, Json } from "@/types/database.types";

type CarrierContractRequest =
  Database["public"]["Tables"]["carrier_contract_requests"]["Row"];
type CarrierContractRequestInsert =
  Database["public"]["Tables"]["carrier_contract_requests"]["Insert"];
type CarrierContractRequestUpdate =
  Database["public"]["Tables"]["carrier_contract_requests"]["Update"];

// Properly typed response for joined queries
interface CarrierContractRequestWithRelations extends CarrierContractRequest {
  carrier: {
    id: string;
    name: string;
    contracting_metadata: Json | null;
    commission_structure?: Json | null;
  } | null;
  recruit: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    contract_level?: number | null;
  } | null;
  contract_document: {
    id: string;
    document_name: string;
    file_name: string;
    storage_path: string;
  } | null;
}

interface ContractingDashboardRecruitRpcRow {
  recruit_id: string | null;
  recruit: Json | null;
  request_count: number | null;
  status_counts: Json | null;
  requested_latest: string | null;
  writing_received_latest: string | null;
  requests: Json | null;
  total_recruit_count: number;
  total_request_count: number;
}

interface ContractingDashboardRecruitGroup {
  recruitId: string;
  recruitName: string;
  recruitEmail: string;
  requests: CarrierContractRequestWithRelations[];
  statusCounts: Record<string, number>;
  requestedLatest: string | null;
  writingReceivedLatest: string | null;
}

function parseDashboardStatusCounts(
  value: Json | null,
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [key, Number(count || 0)]),
  );
}

function parseDashboardRequests(
  value: Json | null,
): CarrierContractRequestWithRelations[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as CarrierContractRequestWithRelations[];
}

function parseDashboardRecruit(value: Json | null): {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
}

// Local row shape for the getRecruitsWithContracts joined query
interface ContractQueryRow {
  recruit_id: string;
  carrier_id: string;
  status: string;
  requested_date: string | null;
  writing_received_date: string | null;
  writing_number: string | null;
  recruit: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    onboarding_status: string | null;
  };
  carrier: { id: string; name: string } | null;
}

interface RecruitWithContracts {
  recruit: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    onboarding_status: string | null;
  };
  contracts: Array<{
    carrier_id: string;
    carrier: { id: string; name: string } | null;
    status: string;
    requested_date: string | null;
    writing_received_date: string | null;
    writing_number: string | null;
  }>;
}

/**
 * Get current user's authenticated ID
 * @throws Error if user is not authenticated
 */
async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("User not authenticated");
  }
  return user.id;
}

/**
 * Get current date in local timezone (not UTC)
 * @returns Date string in YYYY-MM-DD format
 */
function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const carrierContractRequestService = {
  /**
   * Get all contract requests for a recruit
   * @param recruitId - UUID of the recruit
   * @returns Array of contract requests with joined carrier, recruit, and document data
   * @throws Error if query fails
   */
  async getRecruitContractRequests(
    recruitId: string,
  ): Promise<CarrierContractRequestWithRelations[]> {
    const { data, error } = await supabase
      .from("carrier_contract_requests")
      .select(
        `
        *,
        carrier:carriers(id, name, contracting_metadata),
        recruit:user_profiles!recruit_id(id, first_name, last_name, email),
        contract_document:user_documents(id, document_name, file_name, storage_path)
      `,
      )
      .eq("recruit_id", recruitId)
      .order("request_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch contract requests:", error);
      throw new Error(`Failed to fetch contract requests: ${error.message}`);
    }

    return (data || []) as CarrierContractRequestWithRelations[];
  },

  /**
   * Create a new contract request
   * Uses database sequence for request_order to prevent race conditions
   * @param data - Contract request data (without request_order)
   * @returns The newly created contract request
   * @throws Error if user not authenticated or insert fails
   */
  async createContractRequest(
    data: Omit<
      CarrierContractRequestInsert,
      "request_order" | "created_by" | "updated_by"
    >,
  ): Promise<CarrierContractRequest> {
    const currentUserId = await getCurrentUserId();

    // Get next request order using sequence (prevents race conditions)
    const { data: orderData, error: orderError } = await supabase.rpc(
      "nextval",
      {
        sequence_name: "carrier_contract_request_order_seq",
      },
    );

    if (orderError) {
      console.error("Failed to get next order number:", orderError);
      throw new Error(`Failed to get next order number: ${orderError.message}`);
    }

    const nextOrder = orderData as number;

    // Get carrier instructions from metadata
    const { data: carrier, error: carrierError } = await supabase
      .from("carriers")
      .select("contracting_metadata")
      .eq("id", data.carrier_id)
      .single();

    if (carrierError) {
      console.error("Failed to fetch carrier:", carrierError);
      throw new Error(`Failed to fetch carrier: ${carrierError.message}`);
    }

    const carrierInstructions =
      carrier?.contracting_metadata?.instructions || null;

    const { data: newRequest, error: insertError } = await supabase
      .from("carrier_contract_requests")
      .insert({
        ...data,
        request_order: nextOrder,
        carrier_instructions: carrierInstructions,
        created_by: currentUserId,
        updated_by: currentUserId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create contract request:", insertError);
      throw new Error(
        `Failed to create contract request: ${insertError.message}`,
      );
    }

    if (!newRequest) {
      throw new Error("Contract request created but no data returned");
    }

    // Emit contracting.request_created (non-fatal). recipientId = the recruit.
    await workflowEventEmitter.emit(
      WORKFLOW_EVENTS.CONTRACTING_REQUEST_CREATED,
      {
        recipientId: newRequest.recruit_id ?? undefined,
        requestId: newRequest.id,
        carrierId: newRequest.carrier_id ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );

    return newRequest;
  },

  /**
   * Update contract request
   * Auto-sets transition dates based on status changes
   * @param id - UUID of the contract request
   * @param updates - Fields to update
   * @returns Updated contract request
   * @throws Error if update fails
   */
  async updateContractRequest(
    id: string,
    updates: CarrierContractRequestUpdate,
  ): Promise<CarrierContractRequest> {
    // Auto-set dates based on status transitions (using local timezone)
    const enrichedUpdates = { ...updates };
    const currentDate = getCurrentLocalDate();

    if (updates.status === "in_progress" && !updates.in_progress_date) {
      enrichedUpdates.in_progress_date = currentDate;
    }
    if (
      updates.status === "writing_received" &&
      !updates.writing_received_date
    ) {
      enrichedUpdates.writing_received_date = currentDate;
    }
    if (updates.status === "completed" && !updates.completed_date) {
      enrichedUpdates.completed_date = currentDate;
    }

    // Capture the prior status so transition events fire only on a real change
    // (avoids double-emit when the same status is re-saved). Only fetch when a
    // transition we care about is requested.
    let priorStatus: string | null = null;
    if (
      updates.status === "writing_received" ||
      updates.status === "completed"
    ) {
      const { data: prev } = await supabase
        .from("carrier_contract_requests")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      priorStatus = prev?.status ?? null;
    }

    const { data, error } = await supabase
      .from("carrier_contract_requests")
      .update(enrichedUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update contract request:", error);
      throw new Error(`Failed to update contract request: ${error.message}`);
    }

    if (!data) {
      throw new Error("Contract request updated but no data returned");
    }

    // Emit contracting transition events (non-fatal). recipientId = the recruit.
    if (
      data.status === "writing_received" &&
      priorStatus !== "writing_received"
    ) {
      await workflowEventEmitter.emit(
        WORKFLOW_EVENTS.CONTRACTING_REQUEST_WRITING_RECEIVED,
        {
          recipientId: data.recruit_id ?? undefined,
          requestId: id,
          carrierId: data.carrier_id ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    }
    if (data.status === "completed" && priorStatus !== "completed") {
      await workflowEventEmitter.emit(
        WORKFLOW_EVENTS.CONTRACTING_REQUEST_COMPLETED,
        {
          recipientId: data.recruit_id ?? undefined,
          requestId: id,
          carrierId: data.carrier_id ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return data;
  },

  /**
   * Delete contract request
   * @param id - UUID of the contract request
   * @throws Error if delete fails
   */
  async deleteContractRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from("carrier_contract_requests")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete contract request:", error);
      throw new Error(`Failed to delete contract request: ${error.message}`);
    }
  },

  /**
   * Get all recruits with contract requests (for contracting dashboard)
   * SECURITY: Automatically filters by current user's IMO (RLS enforced)
   * @param filters - Optional status and search filters
   * @returns Recruits with their contract requests
   * @throws Error if query fails
   */
  async getRecruitsWithContracts(filters?: {
    status?: string[];
    searchQuery?: string;
  }): Promise<{
    recruits: RecruitWithContracts[];
    totalCount: number;
  }> {
    let query = supabase.from("carrier_contract_requests").select(
      `
        recruit_id,
        recruit:user_profiles!recruit_id(
          id,
          first_name,
          last_name,
          email,
          phone,
          onboarding_status
        ),
        carrier_id,
        carrier:carriers(id, name),
        status,
        requested_date,
        writing_received_date,
        writing_number
      `,
      { count: "exact" },
    );

    if (filters?.status?.length) {
      query = query.in("status", filters.status);
    }

    // Note: Search filtering is done client-side due to Supabase join limitations
    // RLS automatically filters by IMO, so we don't need to add it explicitly

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch contracts:", error);
      throw new Error(`Failed to fetch contracts: ${error.message}`);
    }

    // Group by recruit
    const recruitMap = new Map<string, RecruitWithContracts>();

    const rows = (data ?? []) as unknown as ContractQueryRow[];
    rows.forEach((row) => {
      if (!recruitMap.has(row.recruit_id)) {
        recruitMap.set(row.recruit_id, {
          recruit: row.recruit,
          contracts: [],
        });
      }
      recruitMap.get(row.recruit_id)!.contracts.push({
        carrier_id: row.carrier_id,
        carrier: row.carrier,
        status: row.status,
        requested_date: row.requested_date,
        writing_received_date: row.writing_received_date,
        writing_number: row.writing_number,
      });
    });

    // Client-side search filtering (after RLS filtering)
    let recruits = Array.from(recruitMap.values());

    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      recruits = recruits.filter(
        (item) =>
          item.recruit.first_name?.toLowerCase().includes(query) ||
          item.recruit.last_name?.toLowerCase().includes(query) ||
          item.recruit.email.toLowerCase().includes(query) ||
          item.contracts.some(
            (c) =>
              c.carrier?.name?.toLowerCase().includes(query) ||
              c.writing_number?.toLowerCase().includes(query),
          ),
      );
    }

    return {
      recruits,
      totalCount: count || 0,
    };
  },

  /**
   * Get available carriers for contracting (ordered by priority)
   * Calls RPC function which includes IMO isolation and auth checks
   * @param recruitId - UUID of the recruit
   * @returns Array of available carriers
   * @throws Error if RPC call fails
   */
  async getAvailableCarriers(recruitId: string): Promise<
    Array<{
      id: string;
      name: string;
      contracting_metadata: Json | null;
      priority: number;
      upline_has_contract: boolean;
    }>
  > {
    const { data, error } = await supabase.rpc(
      "get_available_carriers_for_recruit",
      {
        p_recruit_id: recruitId,
      },
    );

    if (error) {
      console.error("Failed to get available carriers:", error);
      throw new Error(`Failed to get available carriers: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Bulk update statuses for multiple contract requests
   * @param ids - Array of request IDs
   * @param status - New status to apply
   * @returns Updated contract requests
   * @throws Error if bulk update fails
   */
  async bulkUpdateStatus(
    ids: string[],
    status: CarrierContractRequestUpdate["status"],
  ): Promise<CarrierContractRequest[]> {
    const currentUserId = await getCurrentUserId();
    const currentDate = getCurrentLocalDate();

    // Build date updates based on status transition
    const dateUpdates: Record<string, string | null> = {};
    if (status === "in_progress") dateUpdates.in_progress_date = currentDate;
    if (status === "writing_received")
      dateUpdates.writing_received_date = currentDate;
    if (status === "completed") dateUpdates.completed_date = currentDate;

    const { data, error } = await supabase
      .from("carrier_contract_requests")
      .update({
        status,
        ...dateUpdates,
        updated_by: currentUserId,
      })
      .in("id", ids)
      .select();

    if (error) {
      console.error("Bulk update failed:", error);
      throw new Error(`Bulk update failed: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Bulk delete contract requests
   * @param ids - Array of request IDs to delete
   * @throws Error if bulk delete fails
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from("carrier_contract_requests")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("Bulk delete failed:", error);
      throw new Error(`Bulk delete failed: ${error.message}`);
    }
  },

  /**
   * Get contracting dashboard data grouped by recruit (agent) using RPC pagination.
   * This prevents the dashboard from exploding into one row per carrier request.
   */
  async getContractingDashboardRecruits(filters: {
    status?: string[];
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
    carrierId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    recruits: ContractingDashboardRecruitGroup[];
    totalRecruitCount: number;
    totalRequestCount: number;
    hasMore: boolean;
  }> {
    const page = Math.max(filters.page || 1, 1);
    const pageSize = Math.max(filters.pageSize || 50, 1);

    const { data, error } = await supabase.rpc(
      "get_contracting_dashboard_recruits",
      {
        p_status: filters.status?.length ? filters.status : null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_search_query: filters.searchQuery?.trim() || null,
        p_carrier_id: filters.carrierId || null,
        p_page: page,
        p_page_size: pageSize,
      },
    );

    if (error) {
      console.error("Grouped contracting dashboard query failed:", error);
      throw new Error(
        `Grouped contracting dashboard query failed: ${error.message}`,
      );
    }

    const rows = (data || []) as ContractingDashboardRecruitRpcRow[];
    const metadataRow = rows[0];
    const totalRecruitCount = metadataRow?.total_recruit_count || 0;
    const totalRequestCount = metadataRow?.total_request_count || 0;

    const recruits = rows
      .filter(
        (
          row,
        ): row is ContractingDashboardRecruitRpcRow & { recruit_id: string } =>
          !!row.recruit_id,
      )
      .map((row) => {
        const recruitJson = parseDashboardRecruit(row.recruit);
        const requests = parseDashboardRequests(row.requests);
        const firstName =
          recruitJson.first_name ?? requests[0]?.recruit?.first_name ?? null;
        const lastName =
          recruitJson.last_name ?? requests[0]?.recruit?.last_name ?? null;
        const recruitName =
          `${firstName || ""} ${lastName || ""}`.trim() || "Unknown Recruit";
        const recruitEmail =
          recruitJson.email ?? requests[0]?.recruit?.email ?? "-";

        return {
          recruitId: row.recruit_id,
          recruitName,
          recruitEmail,
          requests,
          statusCounts: parseDashboardStatusCounts(row.status_counts),
          requestedLatest: row.requested_latest,
          writingReceivedLatest: row.writing_received_latest,
        };
      });

    return {
      recruits,
      totalRecruitCount,
      totalRequestCount,
      hasMore: totalRecruitCount > page * pageSize,
    };
  },

  /**
   * Get contract requests with advanced filtering (server-side)
   * @param filters - Filter criteria
   * @returns Paginated requests with total count
   * @throws Error if query fails
   */
  async getContractRequestsWithFilters(filters: {
    status?: string[];
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
    carrierId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    requests: CarrierContractRequestWithRelations[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let query = supabase.from("carrier_contract_requests").select(
      `
        *,
        carrier:carriers(id, name, contracting_metadata, commission_structure),
        recruit:user_profiles!recruit_id(id, first_name, last_name, email, contract_level)
      `,
      { count: "exact" },
    );

    // Apply filters
    if (filters.status?.length) {
      query = query.in("status", filters.status);
    }
    if (filters.startDate) {
      query = query.gte("requested_date", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("requested_date", filters.endDate);
    }
    if (filters.carrierId) {
      query = query.eq("carrier_id", filters.carrierId);
    }

    // Text search (across recruit name, email, writing number)
    // Note: This is a simplified approach. For production, consider full-text search
    // or search across joined tables using RPC
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query = query.or(`writing_number.ilike.${searchTerm}`);
    }

    // Pagination
    query = query
      .order("requested_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Filter query failed:", error);
      throw new Error(`Filter query failed: ${error.message}`);
    }

    // Client-side filtering for recruit name/email (due to Supabase join limitations)
    let filteredData = (data || []) as CarrierContractRequestWithRelations[];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredData = filteredData.filter(
        (req) =>
          req.recruit?.first_name?.toLowerCase().includes(query) ||
          req.recruit?.last_name?.toLowerCase().includes(query) ||
          req.recruit?.email?.toLowerCase().includes(query) ||
          req.carrier?.name?.toLowerCase().includes(query) ||
          req.writing_number?.toLowerCase().includes(query),
      );
    }

    return {
      requests: filteredData,
      totalCount: count || 0,
      hasMore: (count || 0) > offset + pageSize,
    };
  },

  /**
   * Export contract requests to CSV
   * @param filters - Same filters as getContractRequestsWithFilters
   * @returns CSV string
   * @throws Error if export fails
   */
  async exportToCSV(
    filters: Parameters<typeof this.getContractRequestsWithFilters>[0],
  ): Promise<string> {
    // Get all matching records (no pagination limit for export)
    const { requests } = await this.getContractRequestsWithFilters({
      ...filters,
      page: 1,
      pageSize: 10000, // Max export size
    });

    // Build CSV headers
    const headers = [
      "Recruit Name",
      "Recruit Email",
      "Carrier",
      "Status",
      "Request Order",
      "Writing Number",
      "Requested Date",
      "In Progress Date",
      "Writing Received Date",
      "Completed Date",
    ];

    // Build CSV rows
    const rows = requests.map((r) => [
      `${r.recruit?.first_name || ""} ${r.recruit?.last_name || ""}`.trim(),
      r.recruit?.email || "",
      r.carrier?.name || "",
      r.status || "",
      String(r.request_order || ""),
      r.writing_number || "",
      r.requested_date || "",
      r.in_progress_date || "",
      r.writing_received_date || "",
      r.completed_date || "",
    ]);

    // Format as CSV (escape quotes)
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return csvContent;
  },
};
