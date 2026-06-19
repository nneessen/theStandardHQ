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
      return res.data;
    },
    enabled: !!clientId,
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
