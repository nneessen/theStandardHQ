import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  getCampaignRecipients,
  addCampaignRecipients,
} from "../services/campaignService";
import type { CampaignStatus } from "../types/marketing.types";

const CAMPAIGNS_KEY = ["marketing-campaigns"];

export function useCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: getCampaigns,
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updateCampaign>[1];
    }) => updateCampaign(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useUpdateCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) =>
      updateCampaignStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useCampaignRecipients(campaignId: string | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId, "recipients"],
    queryFn: () => getCampaignRecipients(campaignId!),
    enabled: !!campaignId,
  });
}

export function useAddCampaignRecipients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      recipients,
    }: {
      campaignId: string;
      recipients: { email: string; variables?: Record<string, string> }[];
    }) => addCampaignRecipients(campaignId, recipients),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}
