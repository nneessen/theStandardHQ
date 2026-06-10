// src/features/contracting/services/contractingHubService.ts
// Data layer for the Contracting Hub (Concept C). All cross-agent reads/writes go
// through the SECURITY DEFINER RPCs added in the 2026-06-09 contracting migrations,
// since carrier_contracts RLS is own-row + staff only.
// NOTE: the shared supabase client is untyped (SupabaseClient, no Database generic),
// so results come back loose — we cast each to an explicit Raw* row shape here.

import { supabase } from "@/services/base/supabase";

export type ContractStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "denied"
  | "terminated";

export const STATUS_LABEL: Record<ContractStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  denied: "Denied",
  terminated: "Terminated",
};

export interface MyContractRow {
  carrierId: string;
  carrierName: string;
  status: string;
  writingNumber: string | null;
  requestedDate: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
  notes: string | null;
}

export interface NewlyEligibleCarrier {
  carrierId: string;
  carrierName: string;
  uplineId: string | null;
  approvedDate: string | null;
}

export interface DownlineContractRow {
  agentId: string;
  agentName: string;
  contractLevel: number | null;
  carrierId: string;
  carrierName: string;
  status: string;
  writingNumber: string | null;
  requestedDate: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
  updatedAt: string | null;
}

export interface SponsorOption {
  agentId: string;
  agentName: string;
  contractLevel: number | null;
}

export interface SponsorshipInboxRow {
  id: string;
  requestingAgentId: string;
  requesterName: string;
  carrierId: string;
  carrierName: string;
  alternateSponsorId: string;
  sponsorName: string;
  overallStatus: string;
  sponsorApprovalStatus: string;
  sponsorUplineApprovalStatus: string;
  reason: string | null;
  myStep: "sponsor" | "sponsor_upline" | null;
  createdAt: string;
}

export interface MySponsorshipRow {
  id: string;
  carrierId: string;
  carrierName: string;
  alternateSponsorId: string;
  sponsorName: string;
  overallStatus: string;
  sponsorApprovalStatus: string;
  sponsorUplineApprovalStatus: string;
  reason: string | null;
  createdAt: string;
  approvedAt: string | null;
}

// ── Raw row shapes returned by the (untyped) client ──────────────────────────
interface RawMyContract {
  carrier_id: string;
  status: string;
  writing_number: string | null;
  requested_date: string | null;
  submitted_date: string | null;
  approved_date: string | null;
  notes: string | null;
  carriers: { name: string } | { name: string }[] | null;
}
interface RawNewlyEligible {
  carrier_id: string;
  carrier_name: string;
  upline_id: string | null;
  approved_date: string | null;
}
interface RawDownlineContract {
  agent_id: string;
  agent_name: string;
  contract_level: number | null;
  carrier_id: string;
  carrier_name: string;
  status: string;
  writing_number: string | null;
  requested_date: string | null;
  submitted_date: string | null;
  approved_date: string | null;
  updated_at: string | null;
}
interface RawSponsorOption {
  agent_id: string;
  agent_name: string;
  contract_level: number | null;
}
interface RawInbox {
  id: string;
  requesting_agent_id: string;
  requester_name: string;
  carrier_id: string;
  carrier_name: string;
  alternate_sponsor_id: string;
  sponsor_name: string;
  overall_status: string;
  sponsor_approval_status: string;
  sponsor_upline_approval_status: string;
  reason: string | null;
  my_step: "sponsor" | "sponsor_upline" | null;
  created_at: string;
}
interface RawMySponsorship {
  id: string;
  carrier_id: string;
  carrier_name: string;
  alternate_sponsor_id: string;
  sponsor_name: string;
  overall_status: string;
  sponsor_approval_status: string;
  sponsor_upline_approval_status: string;
  reason: string | null;
  created_at: string;
  approved_at: string | null;
}

function carrierNameOf(c: RawMyContract["carriers"]): string {
  if (!c) return "Unknown carrier";
  return Array.isArray(c) ? (c[0]?.name ?? "Unknown carrier") : c.name;
}

async function currentUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export const contractingHubService = {
  async getMyContracts(): Promise<MyContractRow[]> {
    const uid = await currentUid();
    const { data, error } = await supabase
      .from("carrier_contracts")
      .select(
        "carrier_id, status, writing_number, requested_date, submitted_date, approved_date, notes, carriers(name)",
      )
      .eq("agent_id", uid);
    if (error) throw error;
    return ((data ?? []) as RawMyContract[]).map((r) => ({
      carrierId: r.carrier_id,
      carrierName: carrierNameOf(r.carriers),
      status: r.status,
      writingNumber: r.writing_number,
      requestedDate: r.requested_date,
      submittedDate: r.submitted_date,
      approvedDate: r.approved_date,
      notes: r.notes,
    }));
  },

  async getNewlyEligibleCarriers(): Promise<NewlyEligibleCarrier[]> {
    const { data, error } = await supabase.rpc("get_newly_eligible_carriers");
    if (error) throw error;
    return ((data ?? []) as RawNewlyEligible[]).map((r) => ({
      carrierId: r.carrier_id,
      carrierName: r.carrier_name,
      uplineId: r.upline_id,
      approvedDate: r.approved_date,
    }));
  },

  async setStatus(args: {
    agentId: string;
    carrierId: string;
    status: ContractStatus;
    writingNumber?: string | null;
  }): Promise<void> {
    const { error } = await supabase.rpc("set_carrier_contract_status", {
      p_agent_id: args.agentId,
      p_carrier_id: args.carrierId,
      p_status: args.status,
      p_writing_number: args.writingNumber ?? undefined,
    });
    if (error) throw error;
  },

  async getDownlineContracts(): Promise<DownlineContractRow[]> {
    const { data, error } = await supabase.rpc("get_my_downline_contracts");
    if (error) throw error;
    return ((data ?? []) as RawDownlineContract[]).map((r) => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      contractLevel: r.contract_level,
      carrierId: r.carrier_id,
      carrierName: r.carrier_name,
      status: r.status,
      writingNumber: r.writing_number,
      requestedDate: r.requested_date,
      submittedDate: r.submitted_date,
      approvedDate: r.approved_date,
      updatedAt: r.updated_at,
    }));
  },

  async getCarriers(): Promise<Array<{ id: string; name: string }>> {
    const uid = await currentUid();
    const { data: profile, error: pErr } = await supabase
      .from("user_profiles")
      .select("imo_id")
      .eq("id", uid)
      .maybeSingle();
    if (pErr) throw pErr;
    const imoId = (profile as { imo_id: string | null } | null)?.imo_id;
    if (!imoId) return [];
    const { data, error } = await supabase
      .from("carriers")
      .select("id, name")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string }>;
  },

  async getEligibleSponsors(carrierId: string): Promise<SponsorOption[]> {
    const { data, error } = await supabase.rpc("get_eligible_sponsors", {
      p_carrier_id: carrierId,
    });
    if (error) throw error;
    return ((data ?? []) as RawSponsorOption[]).map((r) => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      contractLevel: r.contract_level,
    }));
  },

  async getSponsorshipInbox(): Promise<SponsorshipInboxRow[]> {
    const { data, error } = await supabase.rpc("get_my_sponsorship_inbox");
    if (error) throw error;
    return ((data ?? []) as RawInbox[]).map((r) => ({
      id: r.id,
      requestingAgentId: r.requesting_agent_id,
      requesterName: r.requester_name,
      carrierId: r.carrier_id,
      carrierName: r.carrier_name,
      alternateSponsorId: r.alternate_sponsor_id,
      sponsorName: r.sponsor_name,
      overallStatus: r.overall_status,
      sponsorApprovalStatus: r.sponsor_approval_status,
      sponsorUplineApprovalStatus: r.sponsor_upline_approval_status,
      reason: r.reason,
      myStep: r.my_step,
      createdAt: r.created_at,
    }));
  },

  async getMySponsorships(): Promise<MySponsorshipRow[]> {
    const { data, error } = await supabase.rpc("get_my_sponsorships");
    if (error) throw error;
    return ((data ?? []) as RawMySponsorship[]).map((r) => ({
      id: r.id,
      carrierId: r.carrier_id,
      carrierName: r.carrier_name,
      alternateSponsorId: r.alternate_sponsor_id,
      sponsorName: r.sponsor_name,
      overallStatus: r.overall_status,
      sponsorApprovalStatus: r.sponsor_approval_status,
      sponsorUplineApprovalStatus: r.sponsor_upline_approval_status,
      reason: r.reason,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
    }));
  },

  async createSponsorship(args: {
    carrierId: string;
    alternateSponsorId: string;
    reason: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("create_sponsorship_request", {
      p_carrier_id: args.carrierId,
      p_alternate_sponsor_id: args.alternateSponsorId,
      p_reason: args.reason,
    });
    if (error) throw error;
  },

  async approveSponsorship(args: {
    requestId: string;
    approve: boolean;
  }): Promise<void> {
    const { error } = await supabase.rpc("approve_sponsorship_request", {
      p_request_id: args.requestId,
      p_approve: args.approve,
    });
    if (error) throw error;
  },

  async cancelSponsorship(requestId: string): Promise<void> {
    const { error } = await supabase.rpc("cancel_sponsorship_request", {
      p_request_id: requestId,
    });
    if (error) throw error;
  },
};
