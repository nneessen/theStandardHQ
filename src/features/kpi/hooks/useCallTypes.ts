// src/features/kpi/hooks/useCallTypes.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callTypeService } from "@/services/settings/call-types";
import type {
  CallTypeCreateForm,
  CallTypeUpdateForm,
} from "@/services/settings/call-types";
// Re-export so UI/feature components consume these form types via the kpi barrel
// instead of importing the service layer directly (no-restricted-imports).
export type { CallTypeCreateForm, CallTypeUpdateForm };
import type { CallType } from "../types/kpi.types";
import { toast } from "sonner";

// ─── Management hook (all incl. inactive) ───────────────────────────────────

export function useCallTypes(imoId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["kpi-call-types", imoId] as const;

  const {
    data: callTypes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!imoId) return [] as CallType[];
      const result = await callTypeService.getAllForImo(imoId);
      if (!result.success) throw new Error(result.error?.message);
      return (result.data ?? []) as CallType[];
    },
    enabled: !!imoId,
  });

  const createCallType = useMutation({
    mutationFn: async (form: CallTypeCreateForm) => {
      const result = await callTypeService.createFromForm(form);
      if (!result.success) throw new Error(result.error?.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-call-types"] });
      toast.success("Call type created");
    },
    onError: (err: Error) => {
      toast.error(`Failed to create call type: ${err.message}`);
    },
  });

  const updateCallType = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CallTypeUpdateForm;
    }) => {
      const result = await callTypeService.updateFromForm(id, data);
      if (!result.success) throw new Error(result.error?.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-call-types"] });
      toast.success("Call type updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update call type: ${err.message}`);
    },
  });

  const deleteCallType = useMutation({
    mutationFn: async (id: string) => {
      const result = await callTypeService.delete(id);
      if (!result.success) throw new Error(result.error?.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-call-types"] });
      toast.success("Call type deleted");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete call type: ${err.message}`);
    },
  });

  return {
    callTypes,
    isLoading,
    error,
    createCallType,
    updateCallType,
    deleteCallType,
  };
}

// ─── Read-only active-only hook (for upload dropdowns etc.) ─────────────────

export function useActiveCallTypes(imoId?: string) {
  const { data: callTypes = [], isLoading } = useQuery({
    queryKey: ["kpi-call-types", "active", imoId] as const,
    queryFn: async () => {
      if (!imoId) return [] as CallType[];
      const result = await callTypeService.getActiveForImo(imoId);
      if (!result.success) throw new Error(result.error?.message);
      return (result.data ?? []) as CallType[];
    },
    enabled: !!imoId,
  });

  return { callTypes, isLoading };
}
