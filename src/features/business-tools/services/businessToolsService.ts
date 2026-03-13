// src/features/business-tools/services/businessToolsService.ts
// Service layer calling the business-tools-proxy edge function

import { supabase } from "@/services/base/supabase";
import type {
  TransactionResponse,
  StatementResponse,
  PipelineJob,
  CategoriesResponse,
  InstitutionInfo,
  BulkResult,
  PaginatedTransactions,
  PaginatedStatements,
  TransactionQuery,
  StatementQuery,
  BatchInitResponse,
  FinancialSummary,
  ReviewWorkbookResponse,
  InstitutionRequest,
} from "../types";

async function invoke<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "business-tools-proxy",
    {
      body: { action, params },
    },
  );
  if (error) {
    const detail =
      typeof data === "object" && data?.error
        ? String(data.error)
        : error.message;
    throw new Error(detail);
  }
  if (typeof data === "object" && data?.error && !Array.isArray(data)) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const businessToolsService = {
  // Batch init: loads transactions (paginated) + categories + institutions in 1 call
  batchInit: (query?: TransactionQuery) =>
    invoke<BatchInitResponse>("batchInit", {
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
      trust_state: query?.trust_state,
      category: query?.category,
    }),

  getTransactions: (query?: TransactionQuery) =>
    invoke<PaginatedTransactions>("getTransactions", {
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
      trust_state: query?.trust_state,
      category: query?.category,
    }),

  getStatements: (query?: StatementQuery) =>
    invoke<PaginatedStatements>("getStatements", {
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
      trust_state: query?.trust_state,
      account_type: query?.account_type,
    }),

  getCategories: () => invoke<CategoriesResponse>("getCategories"),

  getInstitutions: () =>
    invoke<{ institutions: InstitutionInfo[] }>("getInstitutions"),

  runPipeline: (
    filesBase64: Array<{ name: string; data: string; type: string }>,
    filingMonth: string,
  ) =>
    invoke<{ job_id: string }>("runPipeline", {
      files: filesBase64,
      filing_month: filingMonth,
    }),

  getJobStatus: (jobId: string) =>
    invoke<PipelineJob>("getJobStatus", { job_id: jobId }),

  categorizeTransaction: (
    id: number,
    payload: {
      category: string;
      transaction_kind?: string;
      business_split_bps?: number;
      reason?: string;
    },
  ) => invoke<TransactionResponse>("categorize", { id, ...payload }),

  approveTransaction: (id: number, reason?: string) =>
    invoke<TransactionResponse>("approve", { id, reason }),

  excludeTransaction: (id: number, reason?: string) =>
    invoke<TransactionResponse>("exclude", { id, reason }),

  bulkCategorize: (
    ids: number[],
    payload: {
      category?: string;
      transaction_kind?: string;
      business_split_bps?: number;
      reason?: string;
    },
  ) =>
    invoke<BulkResult>("bulkCategorize", {
      transaction_ids: ids,
      ...payload,
    }),

  bulkApprove: (ids: number[], reason?: string) =>
    invoke<BulkResult>("bulkApprove", { transaction_ids: ids, reason }),

  bulkExclude: (ids: number[], reason?: string) =>
    invoke<BulkResult>("bulkExclude", { transaction_ids: ids, reason }),

  trustStatement: (id: number, reason?: string) =>
    invoke<StatementResponse>("trustStatement", { id, reason }),

  getSummary: () => invoke<FinancialSummary>("getSummary"),

  reviewWorkbook: (fileBase64: string, fileName: string) =>
    invoke<ReviewWorkbookResponse>("reviewWorkbook", {
      file_data: fileBase64,
      file_name: fileName,
    }),

  requestInstitution: (req: InstitutionRequest) =>
    invoke<{ status: string }>("requestInstitution", { ...req }),

  exportWorkbook: async (): Promise<Blob> => {
    const { data, error } = await supabase.functions.invoke(
      "business-tools-proxy",
      {
        body: { action: "exportWorkbook" },
      },
    );
    if (error) throw new Error(error.message);
    return data as Blob;
  },
};
