// src/features/inbound-crm/hooks/useInboundCallIntake.ts
// Data layer for the full-screen intake. Components must not touch services/Supabase directly
// (lint rule); they go through these hooks. Reads the client + policies; saves identity (clientService),
// the rich intake blob (crm_set_client_intake -> clients.intake jsonb), and the call disposition
// (crm_set_call_disposition) in one mutation.
import { useMutation, useQuery } from "@tanstack/react-query";
import { clientService } from "@/services/clients/client";
import { supabase } from "@/services";

/** The popped caller's client record + their existing policies (carrier join + stats). */
export function useInboundClientRecord(clientId: string | null) {
  return useQuery({
    queryKey: ["inbound-call", "record", clientId],
    queryFn: async () => {
      const res = await clientService.getWithPolicies(clientId!);
      if (!res.success || !res.data) {
        throw res.error ?? new Error("Client not found");
      }
      // getWithPolicies maps the client entity but DROPS the `intake` jsonb (not in the entity).
      // Pull it separately so the rich intake re-hydrates when the same caller pops again.
      const { data: extra } = await supabase
        .from("clients")
        .select("intake")
        .eq("id", clientId!)
        .maybeSingle();
      return {
        ...res.data,
        intake: (extra?.intake ?? {}) as Record<string, unknown>,
      };
    },
    enabled: !!clientId,
  });
}

/** One inbound-call row in the recent-call history (left context rail). */
export interface InboundCallHistoryRow {
  id: string;
  call_start: string | null;
  call_program: string | null;
  status: string;
  duration: number | null;
  billable: number | null;
  notes: string | null;
  // When the row landed. Used to timestamp a call that never captured a call_start (e.g. it never
  // rang through), so the rail shows when it came through instead of an unhelpful "In progress".
  created_at: string;
  // Caller name — populated for the agent-wide recent-calls feed (so the rail shows WHO called in).
  // Null/absent for the single-client history on the Clients detail page (every row is that client).
  client_name?: string | null;
}

/** Prior COMPLETED calls for this one caller (most recent first), excluding the live call. Used on
 *  the Clients detail page. A still-ringing/ongoing call is never "history", so it is excluded. */
export function useInboundCallHistory(
  clientId: string | null,
  excludeId?: string | null,
) {
  return useQuery({
    // excludeId is baked into the result, so it MUST be part of the key — otherwise the modal
    // (excludeId=live call id) and the detail page (no excludeId) collide on one cache entry.
    queryKey: ["inbound-call", "history", clientId, excludeId ?? null],
    queryFn: async (): Promise<InboundCallHistoryRow[]> => {
      const { data, error } = await supabase
        .from("inbound_calls")
        .select(
          "id, call_start, call_program, status, duration, billable, notes, created_at",
        )
        .eq("client_id", clientId!)
        .neq("status", "ringing") // a live/ongoing call is the current call, not history
        .order("call_start", { ascending: false, nullsFirst: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return ((data ?? []) as InboundCallHistoryRow[]).filter(
        (r) => r.id !== excludeId,
      );
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

/** The agent's RECENT inbound calls across ALL callers (most recent first), with the caller's name —
 *  the populated "who's been calling in" feed shown in the live-call rail. Excludes the live call and
 *  any still-ringing/ongoing call (those are not history). RLS already scopes inbound_calls + the
 *  embedded client to this agent's own records. */
export function useAgentRecentCalls(
  agentId: string | null,
  excludeId?: string | null,
) {
  return useQuery({
    // Stable key (NO excludeId) so a new call pop doesn't refetch — the live-call exclusion is a
    // client-side `select` over the SAME cached rows.
    queryKey: ["inbound-call", "agent-recent", agentId],
    queryFn: async (): Promise<InboundCallHistoryRow[]> => {
      const { data, error } = await supabase
        .from("inbound_calls")
        .select(
          "id, call_start, call_program, status, duration, billable, notes, created_at, clients(name)",
        )
        .eq("agent_id", agentId!)
        .neq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      type Raw = Omit<InboundCallHistoryRow, "client_name"> & {
        clients?: { name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map(({ clients, ...r }) => ({
        ...r,
        client_name: clients?.name ?? null,
      }));
    },
    // Drop the live call from the feed without a refetch when activeCall changes.
    select: (rows) => rows.filter((r) => r.id !== excludeId),
    enabled: !!agentId,
    staleTime: 15_000,
  });
}

export interface IntakeSavePayload {
  clientId: string | null;
  requestTag: string;
  identity: {
    name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    address: string;
  };
  intake: Record<string, unknown>;
  callTypeId: string | null;
  inquiryCarrierId: string | null;
  notes: string | null;
}

export interface ClientRecordSavePayload {
  clientId: string;
  identity: {
    name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    address: string;
  };
  intake: Record<string, unknown>;
}

/** Persist a client's identity + rich intake from the Clients detail page (NO call disposition —
 *  there's no live call). Same two writes the inbound save uses, minus crm_set_call_disposition. */
export function useSaveClientRecord() {
  return useMutation({
    mutationFn: async (p: ClientRecordSavePayload) => {
      const res = await clientService.update(p.clientId, p.identity);
      if (!res.success) throw res.error ?? new Error("Client update failed");
      const { data: intakeRows, error: ie } = await supabase.rpc(
        "crm_set_client_intake" as never,
        { p_client_id: p.clientId, p_intake: p.intake } as never,
      );
      if (ie) throw new Error((ie as { message: string }).message);
      // The RPC returns the row id, or NULL when the scoped UPDATE matched nothing (the client
      // isn't on the caller's book). A green toast on a no-op save would silently lose the work.
      if (!(intakeRows as { id: string | null }[] | null)?.[0]?.id) {
        throw new Error("Couldn't save: this client isn't on your book.");
      }
    },
  });
}

/** Persist identity + rich intake + call disposition for the popped call. */
export function useSaveInboundIntake() {
  return useMutation({
    mutationFn: async (p: IntakeSavePayload) => {
      if (p.clientId) {
        const res = await clientService.update(p.clientId, p.identity);
        if (!res.success) throw res.error ?? new Error("Client update failed");
        const { data: intakeRows, error: ie } = await supabase.rpc(
          "crm_set_client_intake" as never,
          { p_client_id: p.clientId, p_intake: p.intake } as never,
        );
        if (ie) throw new Error((ie as { message: string }).message);
        // NULL id => the scoped UPDATE matched nothing (client not on the caller's book).
        if (!(intakeRows as { id: string | null }[] | null)?.[0]?.id) {
          throw new Error("Couldn't save: this client isn't on your book.");
        }
      }
      const { data: dispoRows, error: de } = await supabase.rpc(
        "crm_set_call_disposition" as never,
        {
          p_request_tag: p.requestTag,
          p_call_type_id: p.callTypeId,
          p_inquiry_carrier_id: p.inquiryCarrierId,
          p_notes: p.notes,
        } as never,
      );
      if (de) throw new Error((de as { message: string }).message);
      // NULL id => the call isn't assigned to this agent (no row updated). Surface it.
      if (!(dispoRows as { id: string | null }[] | null)?.[0]?.id) {
        throw new Error(
          "Couldn't record the call disposition: call not assigned to you.",
        );
      }
    },
  });
}
