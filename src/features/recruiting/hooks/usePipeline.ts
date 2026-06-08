// src/features/recruiting/hooks/usePipeline.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelineService } from "@/services/recruiting/pipelineService";
import { useImo } from "@/contexts/ImoContext";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreatePhaseInput,
  UpdatePhaseInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from "@/types/recruiting.types";

// ========================================
// TEMPLATES
// ========================================

export function useTemplates() {
  // Key by the effective IMO so switching tenants (super-admin acting-IMO, or
  // a fresh login) invalidates the cache instead of serving the prior IMO's
  // templates. invalidateQueries(["pipeline-templates"]) still prefix-matches.
  const { effectiveImoId } = useImo();
  return useQuery({
    queryKey: ["pipeline-templates", effectiveImoId],
    queryFn: () => pipelineService.getTemplates(),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-template", id],
    queryFn: () => pipelineService.getTemplate(id!),
    enabled: !!id,
  });
}

export function useActiveTemplate() {
  const { effectiveImoId } = useImo();
  return useQuery({
    queryKey: ["pipeline-template", "active", effectiveImoId],
    queryFn: () => pipelineService.getActiveTemplate(),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateInput) =>
      pipelineService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateTemplateInput;
    }) => pipelineService.updateTemplate(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", data.id],
      });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pipelineService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
    },
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pipelineService.setDefaultTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", "active"],
      });
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      newName,
    }: {
      templateId: string;
      newName: string;
    }) => pipelineService.duplicateTemplate(templateId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
    },
  });
}

// ========================================
// PHASES
// ========================================

export function usePhases(templateId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-phases", templateId],
    queryFn: () => pipelineService.getPhases(templateId!),
    enabled: !!templateId,
  });
}

export function usePhase(phaseId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-phase", phaseId],
    queryFn: () => pipelineService.getPhase(phaseId!),
    enabled: !!phaseId,
  });
}

export function useCreatePhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string;
      data: CreatePhaseInput;
    }) => pipelineService.createPhase(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phases", variables.templateId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", variables.templateId],
      });
    },
  });
}

export function useUpdatePipelinePhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      updates,
    }: {
      phaseId: string;
      updates: UpdatePhaseInput;
    }) => pipelineService.updatePhase(phaseId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-phase", data.id] });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phases", data.template_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", data.template_id],
      });
    },
  });
}

export function useDeletePhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      templateId: _templateId,
    }: {
      phaseId: string;
      templateId: string;
    }) => pipelineService.deletePhase(phaseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phases", variables.templateId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", variables.templateId],
      });
    },
  });
}

export function useReorderPhases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      phaseIds,
    }: {
      templateId: string;
      phaseIds: string[];
    }) => pipelineService.reorderPhases(templateId, phaseIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phases", variables.templateId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-template", variables.templateId],
      });
    },
  });
}

// ========================================
// CHECKLIST ITEMS
// ========================================

export function useChecklistItems(phaseId: string | undefined) {
  return useQuery({
    queryKey: ["checklist-items", phaseId],
    queryFn: () => pipelineService.getChecklistItems(phaseId!),
    enabled: !!phaseId,
  });
}

export function useChecklistItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ["checklist-item", itemId],
    queryFn: () => pipelineService.getChecklistItem(itemId!),
    enabled: !!itemId,
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      data,
    }: {
      phaseId: string;
      data: CreateChecklistItemInput;
    }) => pipelineService.createChecklistItem(phaseId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["checklist-items", data.phase_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phase", data.phase_id],
      });
    },
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: UpdateChecklistItemInput;
    }) => pipelineService.updateChecklistItem(itemId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-item", data.id] });
      queryClient.invalidateQueries({
        queryKey: ["checklist-items", data.phase_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phase", data.phase_id],
      });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      phaseId: _phaseId,
    }: {
      itemId: string;
      phaseId: string;
    }) => pipelineService.deleteChecklistItem(itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["checklist-items", variables.phaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phase", variables.phaseId],
      });
    },
  });
}

export function useReorderChecklistItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      itemIds,
    }: {
      phaseId: string;
      itemIds: string[];
    }) => pipelineService.reorderChecklistItems(phaseId, itemIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["checklist-items", variables.phaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pipeline-phase", variables.phaseId],
      });
    },
  });
}
