// src/features/inbound-crm/hooks/useInboundCallDisposition.ts
// Dropdown data + the save mutation for in-call disposition on the screen-pop. The call types and
// carriers are fetched scoped to the popped call's imo_id directly (NOT via useImo/useCarriers,
// which depend on ImoContext — the pop renders above ImoProvider), keeping the pop self-contained.
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/services";

export interface DispositionOption {
  id: string;
  name: string;
}

/** Active call types for the call's tenant (kpi_call_types), for the call-type dropdown. */
export function useInboundCallTypes(imoId: string | null) {
  return useQuery({
    queryKey: ["inbound-call", "call-types", imoId],
    queryFn: async (): Promise<DispositionOption[]> => {
      const { data, error } = await supabase
        .from("kpi_call_types")
        .select("id, name")
        .eq("imo_id", imoId!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Active carriers for the call's tenant, for the "carrier calling in from" dropdown. */
export function useInboundCarriers(imoId: string | null) {
  return useQuery({
    queryKey: ["inbound-call", "carriers", imoId],
    queryFn: async (): Promise<DispositionOption[]> => {
      const { data, error } = await supabase
        .from("carriers")
        .select("id, name")
        .eq("imo_id", imoId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

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
