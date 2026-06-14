// src/features/contracting/hooks/useContractingHub.ts
// TanStack Query hooks for the Contracting Hub.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import {
  contractingHubService,
  type ContractStatus,
} from "../services/contractingHubService";

export const hubKeys = {
  all: ["contracting-hub"] as const,
  myContracts: () => [...hubKeys.all, "my-contracts"] as const,
  newlyEligible: () => [...hubKeys.all, "newly-eligible"] as const,
  downlineContracts: () => [...hubKeys.all, "downline-contracts"] as const,
  carriers: () => [...hubKeys.all, "carriers"] as const,
  eligibleSponsors: (carrierId: string | null) =>
    [...hubKeys.all, "eligible-sponsors", carrierId] as const,
  inbox: () => [...hubKeys.all, "sponsorship-inbox"] as const,
  mySponsorships: () => [...hubKeys.all, "my-sponsorships"] as const,
  activity: () => [...hubKeys.all, "activity"] as const,
  downlineSponsorships: () =>
    [...hubKeys.all, "downline-sponsorships"] as const,
  overrideLedger: () => [...hubKeys.all, "override-ledger"] as const,
};

export function useMyUserId() {
  return useQuery({
    queryKey: [...hubKeys.all, "me"] as const,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: Infinity,
  });
}

export function useMyContracts() {
  return useQuery({
    queryKey: hubKeys.myContracts(),
    queryFn: () => contractingHubService.getMyContracts(),
    staleTime: 30_000,
  });
}

export function useNewlyEligibleCarriers() {
  return useQuery({
    queryKey: hubKeys.newlyEligible(),
    queryFn: () => contractingHubService.getNewlyEligibleCarriers(),
    staleTime: 30_000,
  });
}

export function useDownlineContracts(enabled = true) {
  return useQuery({
    queryKey: hubKeys.downlineContracts(),
    queryFn: () => contractingHubService.getDownlineContracts(),
    staleTime: 30_000,
    enabled,
  });
}

export function useHubCarriers() {
  return useQuery({
    queryKey: hubKeys.carriers(),
    queryFn: () => contractingHubService.getCarriers(),
    staleTime: 5 * 60_000,
  });
}

export function useEligibleSponsors(carrierId: string | null) {
  return useQuery({
    queryKey: hubKeys.eligibleSponsors(carrierId),
    queryFn: () => contractingHubService.getEligibleSponsors(carrierId!),
    enabled: !!carrierId,
    staleTime: 60_000,
  });
}

export function useSponsorshipInbox() {
  return useQuery({
    queryKey: hubKeys.inbox(),
    queryFn: () => contractingHubService.getSponsorshipInbox(),
    staleTime: 20_000,
  });
}

export function useMySponsorships() {
  return useQuery({
    queryKey: hubKeys.mySponsorships(),
    queryFn: () => contractingHubService.getMySponsorships(),
    staleTime: 30_000,
  });
}

export function useContractingActivity(enabled = true) {
  return useQuery({
    queryKey: hubKeys.activity(),
    queryFn: () => contractingHubService.getContractingActivity(50),
    staleTime: 20_000,
    enabled,
  });
}

export function useDownlineSponsorships(enabled = true) {
  return useQuery({
    queryKey: hubKeys.downlineSponsorships(),
    queryFn: () => contractingHubService.getDownlineSponsorships(),
    staleTime: 20_000,
    enabled,
  });
}

export function useHeldUnderCandidates(agentId: string | null) {
  return useQuery({
    queryKey: [...hubKeys.all, "held-under-candidates", agentId] as const,
    queryFn: () => contractingHubService.getHeldUnderCandidates(agentId!),
    enabled: !!agentId,
    staleTime: 60_000,
  });
}

export function useOverrideRedirectLedger(enabled = true) {
  return useQuery({
    queryKey: hubKeys.overrideLedger(),
    queryFn: () => contractingHubService.getOverrideRedirectLedger(),
    staleTime: 30_000,
    enabled,
  });
}

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Something went wrong";
}

export function useSetContractStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      agentId: string;
      carrierId: string;
      status: ContractStatus;
      writingNumber?: string | null;
    }) => contractingHubService.setStatus(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubKeys.myContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.downlineContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.newlyEligible() });
      qc.invalidateQueries({ queryKey: hubKeys.activity() });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useSetContractedUnder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      agentId: string;
      carrierId: string;
      heldUnderId?: string | null;
      heldUnderName?: string | null;
    }) => contractingHubService.setContractedUnder(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubKeys.myContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.downlineContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.overrideLedger() });
      toast.success("Updated");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCreateSponsorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      carrierId: string;
      alternateSponsorId: string;
      reason: string;
    }) => contractingHubService.createSponsorship(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubKeys.mySponsorships() });
      qc.invalidateQueries({ queryKey: hubKeys.downlineSponsorships() });
      toast.success("Sponsorship request sent");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useApproveSponsorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { requestId: string; approve: boolean }) =>
      contractingHubService.approveSponsorship(args),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: hubKeys.inbox() });
      qc.invalidateQueries({ queryKey: hubKeys.mySponsorships() });
      qc.invalidateQueries({ queryKey: hubKeys.downlineContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.myContracts() });
      qc.invalidateQueries({ queryKey: hubKeys.downlineSponsorships() });
      qc.invalidateQueries({ queryKey: hubKeys.activity() });
      toast.success(vars.approve ? "Approved" : "Denied");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCancelSponsorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      contractingHubService.cancelSponsorship(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubKeys.mySponsorships() });
      toast.success("Request cancelled");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}
