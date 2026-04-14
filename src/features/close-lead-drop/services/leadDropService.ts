// src/features/close-lead-drop/services/leadDropService.ts
// Calls the close-lead-drop Supabase edge function.

import { supabase } from "@/services/base/supabase";
import type {
  DropJob,
  DropRecipient,
  DropResult,
  LeadPreviewResponse,
  RecipientSequence,
  SmartView,
} from "../types/lead-drop.types";

// ─── Auth helper ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  let token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    token = session?.access_token;
  }
  if (!token) throw new Error("Not authenticated");
  return token;
}

// ─── Edge function caller ──────────────────────────────────────────────────

async function leadDropApi<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessToken();

  const { data, error } = await supabase.functions.invoke("close-lead-drop", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { action, ...params },
  });

  if (error) {
    let msg = error.message || "Lead Drop API error";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      }
    } catch {
      // body already consumed
    }
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ─── Public API ────────────────────────────────────────────────────────────

export const leadDropService = {
  getSmartViews(): Promise<{ smart_views: SmartView[] }> {
    return leadDropApi("get_smart_views");
  },

  previewLeads(
    smartViewId: string,
    cursor: string | null = null,
    limit = 100,
  ): Promise<LeadPreviewResponse> {
    return leadDropApi("preview_leads", {
      smart_view_id: smartViewId,
      cursor,
      _limit: limit,
    });
  },

  getRecipients(): Promise<{ recipients: DropRecipient[] }> {
    return leadDropApi("get_recipients");
  },

  getRecipientSequences(
    recipientUserId: string,
  ): Promise<{ sequences: RecipientSequence[] }> {
    return leadDropApi("get_recipient_sequences", {
      recipient_user_id: recipientUserId,
    });
  },

  createDropJob(params: {
    smartViewId: string;
    smartViewName: string;
    leadIds: string[];
    recipientUserId: string;
    leadSourceLabel: string;
    recipientSmartViewName: string;
    sequenceId?: string;
    sequenceName?: string;
  }): Promise<{ job_id: string }> {
    return leadDropApi("create_drop_job", {
      smart_view_id: params.smartViewId,
      smart_view_name: params.smartViewName,
      lead_ids: params.leadIds,
      recipient_user_id: params.recipientUserId,
      lead_source_label: params.leadSourceLabel,
      recipient_smart_view_name: params.recipientSmartViewName,
      sequence_id: params.sequenceId ?? null,
      sequence_name: params.sequenceName ?? null,
    });
  },

  getJobStatus(jobId: string): Promise<{ job: DropJob }> {
    return leadDropApi("get_job_status", { job_id: jobId });
  },

  getHistory(): Promise<{ jobs: DropJob[] }> {
    return leadDropApi("get_history");
  },

  getJobResults(jobId: string): Promise<{ results: DropResult[] }> {
    return leadDropApi("get_job_results", { job_id: jobId });
  },
};
