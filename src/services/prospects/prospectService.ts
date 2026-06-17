// src/services/prospects/prospectService.ts
// Service for managing recruiting "Prospects" — lightweight, agent-owned
// follow-up contacts. Owner-private: every read/write is scoped to the calling
// agent (enforced again by RLS). Unlike recruits, prospects are inserted
// directly (no auth account, no create-auth-user edge function, no email).

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import { getCurrentTenantContext } from "../base/TenantContext";
import type {
  Prospect,
  CreateProspectInput,
  UpdateProspectInput,
  ProspectFilters,
} from "../../types/prospect.types";

const TABLE = "prospects";

export const prospectService = {
  /**
   * List the current agent's prospects (newest first).
   * SECURITY: hard-filtered to owner_id = auth.uid() (RLS also enforces).
   */
  async getMyProspects(filters?: ProspectFilters): Promise<Prospect[]> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user?.id) throw new Error("Not authenticated");

      let query = supabase
        .from(TABLE)
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(
          `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
        );
      }

      const { data, error } = await query;
      if (error) {
        logger.error("Failed to get prospects", error, "prospectService");
        throw error;
      }
      return (data || []) as Prospect[];
    } catch (error) {
      logger.error(
        "Error getting prospects",
        error instanceof Error ? error : String(error),
        "prospectService",
      );
      throw error;
    }
  },

  /**
   * Create a prospect owned by the current agent, in their effective tenant.
   */
  async createProspect(input: CreateProspectInput): Promise<Prospect> {
    try {
      const { userId, imoId, agencyId } = await getCurrentTenantContext();
      if (!imoId) {
        throw new Error(
          "Select an IMO before adding a prospect (no effective IMO in context).",
        );
      }

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          owner_id: userId,
          imo_id: imoId,
          agency_id: agencyId,
          first_name: input.first_name.trim(),
          last_name: input.last_name?.trim() || null,
          email: input.email?.toLowerCase().trim() || null,
          phone: input.phone?.trim() || null,
          state: input.state?.trim() || null,
          source: input.source?.trim() || null,
          status: input.status || "new",
          notes: input.notes?.trim() || null,
          last_contacted_at: input.last_contacted_at || null,
          next_follow_up_at: input.next_follow_up_at || null,
        })
        .select("*")
        .single();

      if (error) {
        logger.error("Failed to create prospect", error, "prospectService");
        throw error;
      }
      return data as Prospect;
    } catch (error) {
      logger.error(
        "Error creating prospect",
        error instanceof Error ? error : String(error),
        "prospectService",
      );
      throw error;
    }
  },

  /**
   * Update a prospect the current agent owns (RLS enforces ownership).
   */
  async updateProspect(
    id: string,
    patch: UpdateProspectInput,
  ): Promise<Prospect> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        logger.error("Failed to update prospect", error, "prospectService");
        throw error;
      }

      const prospect = data as Prospect;
      // Emit prospect workflow events (mutually exclusive, non-fatal). recipientId
      // = the prospect owner. Only fires when the status field was part of the patch.
      const ownerId =
        (prospect as { owner_id?: string | null }).owner_id ?? undefined;
      if (patch.status === "converted") {
        await workflowEventEmitter.emit(WORKFLOW_EVENTS.PROSPECT_CONVERTED, {
          recipientId: ownerId,
          prospectId: id,
          timestamp: new Date().toISOString(),
        });
      } else if (patch.status) {
        await workflowEventEmitter.emit(
          WORKFLOW_EVENTS.PROSPECT_STATUS_CHANGED,
          {
            recipientId: ownerId,
            prospectId: id,
            status: patch.status,
            timestamp: new Date().toISOString(),
          },
        );
      }
      return prospect;
    } catch (error) {
      logger.error(
        "Error updating prospect",
        error instanceof Error ? error : String(error),
        "prospectService",
      );
      throw error;
    }
  },

  /**
   * Delete a prospect the current agent owns (RLS enforces ownership).
   */
  async deleteProspect(id: string): Promise<void> {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) {
        logger.error("Failed to delete prospect", error, "prospectService");
        throw error;
      }
    } catch (error) {
      logger.error(
        "Error deleting prospect",
        error instanceof Error ? error : String(error),
        "prospectService",
      );
      throw error;
    }
  },
};

export default prospectService;
