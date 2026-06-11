// src/features/recruiting/hooks/useProspectMutations.ts
// Create / update / delete mutations for the "Prospects" follow-up list.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { prospectService } from "@/services/prospects";
import type {
  CreateProspectInput,
  UpdateProspectInput,
} from "@/types/prospect.types";
import { PROSPECTS_QUERY_KEYS } from "./useProspects";

export function useCreateProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProspectInput) =>
      prospectService.createProspect(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEYS.all });
      toast.success("Prospect added.");
    },
    onError: (error: Error) => {
      console.error("Failed to add prospect:", error);
      toast.error(error.message || "Failed to add prospect.");
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProspectInput }) =>
      prospectService.updateProspect(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEYS.all });
    },
    onError: (error: Error) => {
      console.error("Failed to update prospect:", error);
      toast.error(error.message || "Failed to update prospect.");
    },
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prospectService.deleteProspect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEYS.all });
      toast.success("Prospect removed.");
    },
    onError: (error: Error) => {
      console.error("Failed to delete prospect:", error);
      toast.error(error.message || "Failed to delete prospect.");
    },
  });
}
