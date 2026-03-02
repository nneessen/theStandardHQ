import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAudiences,
  getAudience,
  createAudience,
  updateAudience,
  deleteAudience,
  getAudienceMembers,
  resolveAudienceContacts,
  getExternalContacts,
  createExternalContact,
  deleteExternalContact,
} from "../services/audienceService";

const AUDIENCES_KEY = ["marketing-audiences"];
const EXTERNAL_CONTACTS_KEY = ["marketing-external-contacts"];

export function useAudiences() {
  return useQuery({
    queryKey: AUDIENCES_KEY,
    queryFn: getAudiences,
  });
}

export function useAudience(id: string | null) {
  return useQuery({
    queryKey: [...AUDIENCES_KEY, id],
    queryFn: () => getAudience(id!),
    enabled: !!id,
  });
}

export function useCreateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAudience,
    onSuccess: () => qc.invalidateQueries({ queryKey: AUDIENCES_KEY }),
  });
}

export function useUpdateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updateAudience>[1];
    }) => updateAudience(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: AUDIENCES_KEY }),
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAudience,
    onSuccess: () => qc.invalidateQueries({ queryKey: AUDIENCES_KEY }),
  });
}

export function useAudienceMembers(audienceId: string | null) {
  return useQuery({
    queryKey: [...AUDIENCES_KEY, audienceId, "members"],
    queryFn: () => getAudienceMembers(audienceId!),
    enabled: !!audienceId,
  });
}

export function useResolveAudienceContacts(
  sourcePool: string | null,
  filters?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: [...AUDIENCES_KEY, "resolve", sourcePool, filters],
    queryFn: () => resolveAudienceContacts(sourcePool!, filters),
    enabled: !!sourcePool,
  });
}

export function useExternalContacts() {
  return useQuery({
    queryKey: EXTERNAL_CONTACTS_KEY,
    queryFn: getExternalContacts,
  });
}

export function useCreateExternalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExternalContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: EXTERNAL_CONTACTS_KEY }),
  });
}

export function useDeleteExternalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExternalContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: EXTERNAL_CONTACTS_KEY }),
  });
}
