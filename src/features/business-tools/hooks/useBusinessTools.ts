// src/features/business-tools/hooks/useBusinessTools.ts
// TanStack Query hooks for Business Tools feature

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { businessToolsService } from "../services/businessToolsService";
import type {
  TransactionQuery,
  StatementQuery,
  PaginatedTransactions,
  InstitutionRequest,
} from "../types";

// ─── Query Keys ──────────────────────────────────────────────

export const businessToolsKeys = {
  all: ["business-tools"] as const,
  transactions: (q?: TransactionQuery) =>
    [...businessToolsKeys.all, "transactions", q ?? {}] as const,
  statements: (q?: StatementQuery) =>
    [...businessToolsKeys.all, "statements", q ?? {}] as const,
  categories: () => [...businessToolsKeys.all, "categories"] as const,
  institutions: () => [...businessToolsKeys.all, "institutions"] as const,
  batchInit: (q?: TransactionQuery) =>
    [...businessToolsKeys.all, "batchInit", q ?? {}] as const,
  job: (id: string) => [...businessToolsKeys.all, "job", id] as const,
  summary: () => [...businessToolsKeys.all, "summary"] as const,
};

// Shared config
const QUERY_DEFAULTS = { retry: 1, retryDelay: 5000 } as const;

// ─── Batch Init Hook (single call on page load) ─────────────

export function useBatchInit(query?: TransactionQuery) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: businessToolsKeys.batchInit(query),
    queryFn: async () => {
      const data = await businessToolsService.batchInit(query);
      // Seed individual caches from batch response
      qc.setQueryData(businessToolsKeys.categories(), data.categories);
      qc.setQueryData(businessToolsKeys.institutions(), data.institutions);
      return data;
    },
    placeholderData: keepPreviousData,
    ...QUERY_DEFAULTS,
  });
}

// ─── Individual Query Hooks ──────────────────────────────────

export function useTransactions(query?: TransactionQuery) {
  return useQuery({
    queryKey: businessToolsKeys.transactions(query),
    queryFn: () => businessToolsService.getTransactions(query),
    placeholderData: keepPreviousData,
    ...QUERY_DEFAULTS,
  });
}

export function useStatements(query?: StatementQuery) {
  return useQuery({
    queryKey: businessToolsKeys.statements(query),
    queryFn: () => businessToolsService.getStatements(query),
    placeholderData: keepPreviousData,
    ...QUERY_DEFAULTS,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: businessToolsKeys.categories(),
    queryFn: () => businessToolsService.getCategories(),
    staleTime: Infinity,
    ...QUERY_DEFAULTS,
  });
}

export function useInstitutions() {
  return useQuery({
    queryKey: businessToolsKeys.institutions(),
    queryFn: () => businessToolsService.getInstitutions(),
    staleTime: Infinity,
    ...QUERY_DEFAULTS,
  });
}

export function useStableMetadata() {
  const categories = useCategories();
  const institutions = useInstitutions();
  return {
    categories: categories.data,
    institutions: institutions.data,
    isLoading: categories.isLoading || institutions.isLoading,
  };
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: businessToolsKeys.job(jobId ?? ""),
    queryFn: () => businessToolsService.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "complete" || status === "failed") return false;
      return 2000;
    },
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────

export function useRunPipeline() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      files,
      filingMonth,
    }: {
      files: File[];
      filingMonth: string;
    }) => {
      const filesBase64 = await Promise.all(
        files.map(async (f) => {
          const buf = await f.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return { name: f.name, data: btoa(binary), type: f.type };
        }),
      );
      return businessToolsService.runPipeline(filesBase64, filingMonth);
    },
    onSuccess: () => {
      toast.success("Pipeline started");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to start pipeline");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: businessToolsKeys.all });
    },
  });
}

export function useCategorizeTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number;
      category: string;
      transaction_kind?: string;
      business_split_bps?: number;
      reason?: string;
    }) => businessToolsService.categorizeTransaction(id, payload),
    onMutate: async ({ id, category, business_split_bps }) => {
      await qc.cancelQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
      });
      await qc.cancelQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
      });
      // Optimistic update on any matching paginated query
      const queries = qc.getQueriesData<PaginatedTransactions>({
        queryKey: [...businessToolsKeys.all, "transactions"],
      });
      for (const [key, data] of queries) {
        if (data?.items) {
          qc.setQueryData(key, {
            ...data,
            items: data.items.map((t) =>
              t.id === id
                ? {
                    ...t,
                    category: category ?? t.category,
                    business_split_bps:
                      business_split_bps ?? t.business_split_bps,
                  }
                : t,
            ),
          });
        }
      }
    },
    onError: () => {
      toast.error("Failed to categorize transaction");
    },
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useApproveTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      businessToolsService.approveTransaction(id, reason),
    onSuccess: () => toast.success("Transaction approved"),
    onError: () => toast.error("Failed to approve transaction"),
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useExcludeTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      businessToolsService.excludeTransaction(id, reason),
    onSuccess: () => toast.success("Transaction excluded"),
    onError: () => toast.error("Failed to exclude transaction"),
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useBulkCategorize() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      ids,
      ...payload
    }: {
      ids: number[];
      category?: string;
      transaction_kind?: string;
      business_split_bps?: number;
      reason?: string;
    }) => businessToolsService.bulkCategorize(ids, payload),
    onSuccess: (data) =>
      toast.success(`Categorized ${data.updated.length} transactions`),
    onError: () => toast.error("Bulk categorize failed"),
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useBulkApprove() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, reason }: { ids: number[]; reason?: string }) =>
      businessToolsService.bulkApprove(ids, reason),
    onSuccess: (data) =>
      toast.success(`Approved ${data.updated.length} transactions`),
    onError: () => toast.error("Bulk approve failed"),
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useBulkExclude() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, reason }: { ids: number[]; reason?: string }) =>
      businessToolsService.bulkExclude(ids, reason),
    onSuccess: (data) =>
      toast.success(`Excluded ${data.updated.length} transactions`),
    onError: () => toast.error("Bulk exclude failed"),
    onSettled: () => {
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "transactions"],
        type: "active",
      });
      qc.refetchQueries({
        queryKey: [...businessToolsKeys.all, "batchInit"],
        type: "active",
      });
      qc.invalidateQueries({ queryKey: businessToolsKeys.summary() });
    },
  });
}

export function useTrustStatement() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      businessToolsService.trustStatement(id, reason),
    onSuccess: () => toast.success("Statement trusted"),
    onError: () => toast.error("Failed to trust statement"),
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: [...businessToolsKeys.all, "statements"],
      });
    },
  });
}

export function useExportWorkbook() {
  return useMutation({
    mutationFn: () => businessToolsService.exportWorkbook(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `business-workbook-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Workbook downloaded");
    },
    onError: () => toast.error("Failed to export workbook"),
  });
}

// ─── Summary / Dashboard Hooks ────────────────────────────────

export function useSummary() {
  return useQuery({
    queryKey: businessToolsKeys.summary(),
    queryFn: () => businessToolsService.getSummary(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...QUERY_DEFAULTS,
  });
}

export function useReviewWorkbook() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return businessToolsService.reviewWorkbook(btoa(binary), file.name);
    },
    onSuccess: (data) => {
      toast.success(
        `Workbook applied: ${data.applied_count} applied, ${data.categorized_count} categorized`,
      );
      qc.invalidateQueries({ queryKey: businessToolsKeys.all });
    },
    onError: () => toast.error("Failed to upload review workbook"),
  });
}

export function useRequestInstitution() {
  return useMutation({
    mutationFn: (req: InstitutionRequest) =>
      businessToolsService.requestInstitution(req),
    onSuccess: () => toast.success("Institution request submitted"),
    onError: () => toast.error("Failed to submit institution request"),
  });
}
