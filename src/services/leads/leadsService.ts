// src/services/leads/leadsService.ts
// Service for managing recruiting leads from public funnel
// Security-hardened with validation for public theme data

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import type {
  RecruitingLead,
  SubmitLeadInput,
  SubmitLeadResponse,
  PublicRecruiterInfo,
  LeadsFilters,
  PaginatedLeadsResponse,
  LeadsStats,
  LeadActionResponse,
  EnrichedLead,
  LeadStatus,
} from "../../types/leads.types";
import type { RecruitingPageTheme } from "../../types/recruiting-theme.types";
import { validateRecruitingTheme } from "@/lib/recruiting-validation";

/**
 * Service for managing recruiting leads
 */
export const leadsService = {
  // ============================================================================
  // PUBLIC METHODS (no auth required)
  // ============================================================================

  /**
   * Get public recruiter info for landing page (no auth required)
   */
  async getPublicRecruiterInfo(
    slug: string,
  ): Promise<PublicRecruiterInfo | null> {
    try {
      // Try RPC first (if migration is applied)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_public_recruiter_info",
        { p_slug: slug },
      );

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData[0] as PublicRecruiterInfo;
      }

      // Fallback: query directly if RPC doesn't exist or fails
      logger.info(
        `RPC fallback for slug ${slug}: ${rpcError?.message || "no data"}`,
        "leadsService",
      );

      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          `
          id,
          first_name,
          last_name,
          approval_status,
          custom_permissions,
          imo_id,
          imos!inner (
            id,
            name,
            logo_url,
            primary_color,
            description,
            is_active,
            is_listed
          )
        `,
        )
        .eq("recruiter_slug", slug)
        .single();

      if (error || !data) {
        logger.error(
          "Failed to get public recruiter info via fallback",
          error || "No data found",
          "leadsService",
        );
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imo = data.imos as any;
      if (!imo?.is_active || !imo?.is_listed) {
        return null;
      }

      return {
        recruiter_id: data.id,
        recruiter_first_name: data.first_name,
        recruiter_last_name: data.last_name,
        imo_name: imo?.name || null,
        imo_logo_url: imo?.logo_url || null,
        imo_primary_color: imo?.primary_color || null,
        imo_description: imo?.description || null,
        calendly_url:
          (data.custom_permissions as { calendly_url?: string })
            ?.calendly_url || null,
        is_active:
          imo?.is_active &&
          imo?.is_listed &&
          data.approval_status === "approved",
      };
    } catch (error) {
      logger.error(
        "Error getting public recruiter info",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return null;
    }
  },

  /**
   * Get public recruiting page theme by slug (no auth required)
   * Returns branding configuration with precedence: user -> IMO -> platform defaults
   * SECURITY: Validates theme data before returning to prevent malformed JSONB issues
   */
  async getPublicRecruitingTheme(
    slug: string,
  ): Promise<RecruitingPageTheme | null> {
    try {
      const { data, error } = await supabase.rpc(
        "get_public_recruiting_theme",
        {
          p_slug: slug,
        },
      );

      if (error) {
        logger.error(
          "Failed to get public recruiting theme",
          error,
          "leadsService",
        );
        return null;
      }

      // Validate and sanitize theme data
      if (!data) {
        return null;
      }

      return validateRecruitingTheme(data);
    } catch (error) {
      logger.error(
        "Error getting public recruiting theme",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return null;
    }
  },

  /**
   * Submit a new lead (public, no auth required)
   */
  async submitLead(input: SubmitLeadInput): Promise<SubmitLeadResponse> {
    try {
      // supabase client uses anon key so this works for public access
      const { data, error } = await supabase.rpc("submit_recruiting_lead", {
        p_recruiter_slug: input.recruiterSlug,
        p_first_name: input.firstName,
        p_last_name: input.lastName,
        p_email: input.email,
        p_phone: input.phone,
        p_city: input.city,
        p_state: input.state,
        p_availability: input.availability,
        p_income_goals: input.incomeGoals || null,
        p_why_interested: input.whyInterested,
        p_insurance_experience: input.insuranceExperience,
        p_utm_source: input.utmSource || null,
        p_utm_medium: input.utmMedium || null,
        p_utm_campaign: input.utmCampaign || null,
        p_referrer_url: input.referrerUrl || null,
        p_is_licensed: input.isLicensed || false,
        p_current_imo_name: input.currentImoName || null,
        p_specialties: input.specialties || null,
        p_tcpa_consent_text: input.tcpaConsentText || null,
        p_tcpa_consent_version: input.tcpaConsentVersion || null,
      });

      if (error) {
        logger.error("Failed to submit lead", error, "leadsService");
        return { success: false, error: error.message };
      }

      return data as SubmitLeadResponse;
    } catch (error) {
      logger.error(
        "Error submitting lead",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit lead",
      };
    }
  },

  /**
   * Update discovery call scheduled status (can be called from confirmation page)
   */
  async updateDiscoveryCallScheduled(
    leadId: string,
    scheduledAt: Date,
    callUrl?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc("update_lead_discovery_call", {
        p_lead_id: leadId,
        p_scheduled_at: scheduledAt.toISOString(),
        p_call_url: callUrl || null,
      });

      if (error) {
        logger.error("Failed to update discovery call", error, "leadsService");
        return { success: false, error: error.message };
      }

      return data as { success: boolean; error?: string };
    } catch (error) {
      logger.error(
        "Error updating discovery call",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update discovery call",
      };
    }
  },

  // ============================================================================
  // AUTHENTICATED METHODS (require login)
  // ============================================================================

  /**
   * Get leads for the current user (recruiter)
   * SECURITY: Always filters by recruiter_id to ensure users only see their own leads
   */
  async getMyLeads(
    filters?: LeadsFilters,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<PaginatedLeadsResponse> {
    try {
      // Get current user for security filter
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user?.id) throw new Error("Not authenticated");

      let query = supabase
        .from("recruiting_leads")
        .select("*", { count: "exact" });

      // SECURITY: Hard filter - "My Leads" must always be scoped to recruiter_id
      query = query.eq("recruiter_id", user.id);

      // Apply status filter
      if (filters?.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      // Apply date range filter
      if (filters?.dateRange) {
        if (filters.dateRange.start) {
          query = query.gte("submitted_at", filters.dateRange.start);
        }
        if (filters.dateRange.end) {
          query = query.lte("submitted_at", filters.dateRange.end);
        }
      }

      // Apply search filter
      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(
          `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},city.ilike.${searchTerm}`,
        );
      }

      // Order by submitted_at descending (newest first)
      query = query.order("submitted_at", { ascending: false });

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        logger.error("Failed to get leads", error, "leadsService");
        throw error;
      }

      const leads = (data || []) as EnrichedLead[];

      // Enrich with days since submitted
      const now = new Date();
      leads.forEach((lead) => {
        const submitted = new Date(lead.submitted_at);
        lead.days_since_submitted = Math.floor(
          (now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24),
        );
      });

      return {
        leads,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      logger.error(
        "Error getting leads",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      throw error;
    }
  },

  /**
   * Get a single lead by ID
   * SECURITY: Verifies the lead belongs to the current user or user is super admin
   */
  async getLeadById(leadId: string): Promise<RecruitingLead | null> {
    try {
      // Get current user for authorization check
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("recruiting_leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        logger.error("Failed to get lead by ID", error, "leadsService");
        throw error;
      }

      // SECURITY: Authorization check - verify ownership or super admin
      if (data.recruiter_id !== user.id) {
        // Check if user is super admin
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_super_admin")
          .eq("id", user.id)
          .single();

        if (!profile?.is_super_admin) {
          logger.warn(
            `Unauthorized access attempt to lead ${leadId} by user ${user.id}`,
            "leadsService",
          );
          return null; // Return null to avoid leaking lead existence
        }
      }

      return data;
    } catch (error) {
      logger.error(
        "Error getting lead by ID",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      throw error;
    }
  },

  /**
   * Get leads stats for the current user
   */
  async getLeadsStats(recruiterId?: string): Promise<LeadsStats> {
    try {
      const { data, error } = await supabase.rpc("get_recruiting_leads_stats", {
        p_recruiter_id: recruiterId || null,
      });

      if (error) {
        logger.error("Failed to get leads stats", error, "leadsService");
        throw error;
      }

      return (
        (data as LeadsStats) || {
          total: 0,
          pending: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
          this_week: 0,
          this_month: 0,
        }
      );
    } catch (error) {
      logger.error(
        "Error getting leads stats",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      throw error;
    }
  },

  /**
   * Accept a lead and create a recruit
   */
  async acceptLead(
    leadId: string,
    pipelineTemplateId?: string,
  ): Promise<LeadActionResponse> {
    try {
      const { data, error } = await supabase.rpc("accept_recruiting_lead", {
        p_lead_id: leadId,
        p_pipeline_template_id: pipelineTemplateId || null,
      });

      if (error) {
        logger.error("Failed to accept lead", error, "leadsService");
        return { success: false, error: error.message };
      }

      return data as LeadActionResponse;
    } catch (error) {
      logger.error(
        "Error accepting lead",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to accept lead",
      };
    }
  },

  /**
   * Reject a lead
   */
  async rejectLead(
    leadId: string,
    reason?: string,
  ): Promise<LeadActionResponse> {
    try {
      const { data, error } = await supabase.rpc("reject_recruiting_lead", {
        p_lead_id: leadId,
        p_reason: reason || null,
      });

      if (error) {
        logger.error("Failed to reject lead", error, "leadsService");
        return { success: false, error: error.message };
      }

      return data as LeadActionResponse;
    } catch (error) {
      logger.error(
        "Error rejecting lead",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject lead",
      };
    }
  },

  /**
   * Get leads by status (convenience method)
   */
  async getLeadsByStatus(
    status: LeadStatus,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<PaginatedLeadsResponse> {
    return this.getMyLeads({ status: [status] }, page, pageSize);
  },

  /**
   * Get pending leads count for the current user (for badge display)
   * SECURITY: Only counts leads owned by the current user
   */
  async getPendingLeadsCount(): Promise<number> {
    try {
      // Get current user for security filter
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user?.id) {
        return 0; // Not authenticated - return 0 instead of throwing
      }

      const { count, error } = await supabase
        .from("recruiting_leads")
        .select("*", { count: "exact", head: true })
        .eq("recruiter_id", user.id) // SECURITY: Only count user's own pending leads
        .eq("status", "pending");

      if (error) {
        logger.error(
          "Failed to get pending leads count",
          error,
          "leadsService",
        );
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error(
        "Error getting pending leads count",
        error instanceof Error ? error : String(error),
        "leadsService",
      );
      return 0;
    }
  },
};

export default leadsService;
