// src/features/inbound-crm/hooks/useInboundCallDisposition.ts
// In-call disposition mutation for the inbound screen-pop intake. The call-type and carrier
// DROPDOWN data is NOT fetched here — that duplicated the canonical service layer. The intake
// (which renders INSIDE ImoProvider) reuses `useActiveCallTypes` (@/features/kpi) and
// `useCarriers` (@/hooks/carriers) directly.
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/services";

export interface DispositionInput {
  requestTag: string;
  callTypeId: string | null;
  inquiryCarrierId: string | null;
  notes: string | null;
}

/** Persist the agent's in-call disposition onto their own inbound_calls row. */
export function useInboundCallDisposition() {
  return useMutation({
    mutationFn: async (input: DispositionInput) => {
      // crm_set_call_disposition is not in the generated DB types yet -> cast the rpc call.
      const { error } = await supabase.rpc(
        "crm_set_call_disposition" as never,
        {
          p_request_tag: input.requestTag,
          p_call_type_id: input.callTypeId,
          p_inquiry_carrier_id: input.inquiryCarrierId,
          p_notes: input.notes,
        } as never,
      );
      if (error) throw new Error((error as { message: string }).message);
    },
  });
}
