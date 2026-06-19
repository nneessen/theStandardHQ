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

/** One inbound-call row in the caller's recent-call history (left context rail). */
export interface InboundCallHistoryRow {
  id: string;
  call_start: string | null;
  call_program: string | null;
  status: string;
  duration: number | null;
  billable: number | null;
  notes: string | null;
}

/** Prior inbound calls for this caller (most recent first), excluding the live call. */
export function useInboundCallHistory(
  clientId: string | null,
  excludeId?: string | null,
) {
  return useQuery({
    queryKey: ["inbound-call", "history", clientId],
    queryFn: async (): Promise<InboundCallHistoryRow[]> => {
      const { data, error } = await supabase
        .from("inbound_calls")
        .select(
          "id, call_start, call_program, status, duration, billable, notes",
        )
        .eq("client_id", clientId!)
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

/** Persist identity + rich intake + call disposition for the popped call. */
export function useSaveInboundIntake() {
  return useMutation({
    mutationFn: async (p: IntakeSavePayload) => {
      if (p.clientId) {
        const res = await clientService.update(p.clientId, p.identity);
        if (!res.success) throw res.error ?? new Error("Client update failed");
        const { error: ie } = await supabase.rpc(
          "crm_set_client_intake" as never,
          { p_client_id: p.clientId, p_intake: p.intake } as never,
        );
        if (ie) throw new Error((ie as { message: string }).message);
      }
      const { error: de } = await supabase.rpc(
        "crm_set_call_disposition" as never,
        {
          p_request_tag: p.requestTag,
          p_call_type_id: p.callTypeId,
          p_inquiry_carrier_id: p.inquiryCarrierId,
          p_notes: p.notes,
        } as never,
      );
      if (de) throw new Error((de as { message: string }).message);
    },
  });
}
