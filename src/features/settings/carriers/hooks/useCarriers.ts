// src/features/settings/carriers/hooks/useCarriers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { carrierService, type Carrier } from "@/services/settings/carriers";
import { type NewCarrierForm } from "@/types/carrier.types";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";

// Re-export the Carrier type for convenience
export type { Carrier };

// Local types that match NewCarrierForm
export interface CreateCarrierData {
  name: string;
  code?: string;
  is_active?: boolean;
  imo_id?: string;
  advance_cap?: number | null;
}

export interface UpdateCarrierData {
  name?: string;
  code?: string;
  is_active?: boolean;
  imo_id?: string;
  advance_cap?: number | null;
}

export function useCarriers(imoId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { imo } = useImo();
  const queryImoId = imoId ?? imo?.id;

  // Fetch all carriers
  const {
    data: carriers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["carriers", queryImoId ?? "default"],
    queryFn: async () => {
      const result = imoId
        ? await carrierService.getAllForImo(imoId)
        : await carrierService.getAll();
      if (!result.success) throw new Error(result.error?.message);
      return (result.data || []) as Carrier[];
    },
    enabled: options?.enabled ?? true,
  });

  // Create carrier mutation
  const createCarrier = useMutation({
    mutationFn: async (data: CreateCarrierData) => {
      const formData: NewCarrierForm = {
        name: data.name,
        code: data.code,
        is_active: data.is_active ?? true,
        imo_id: data.imo_id,
        advance_cap: data.advance_cap,
      };
      const result = await carrierService.createFromForm(formData);
      if (!result.success) throw new Error(result.error?.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Carrier created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create carrier: ${error.message}`);
    },
  });

  // Update carrier mutation
  const updateCarrier = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCarrierData;
    }) => {
      const formData: Partial<NewCarrierForm> = {
        name: data.name,
        code: data.code,
        is_active: data.is_active,
        imo_id: data.imo_id,
        advance_cap: data.advance_cap,
      };
      const result = await carrierService.updateFromForm(id, formData);
      if (!result.success) throw new Error(result.error?.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Carrier updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update carrier: ${error.message}`);
    },
  });

  // Delete carrier mutation
  const deleteCarrier = useMutation({
    mutationFn: async (id: string) => {
      const result = await carrierService.delete(id);
      if (!result.success) throw new Error(result.error?.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Carrier deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete carrier: ${error.message}`);
    },
  });

  return {
    carriers,
    isLoading,
    error,
    createCarrier,
    updateCarrier,
    deleteCarrier,
  };
}
