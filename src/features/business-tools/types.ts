// src/features/business-tools/types.ts
// API response types matching paddle-parser API

export interface TransactionResponse {
  id: number;
  statement_id: number;
  transaction_date: string;
  post_date: string | null;
  description_raw: string;
  description_normalized: string | null;
  amount_cents: number;
  direction: "income" | "expense";
  transaction_kind: string;
  category: string;
  business_split_bps: number;
  business_amount_cents: number;
  personal_amount_cents: number;
  trust_state:
    | "auto_trusted"
    | "approved"
    | "needs_review"
    | "excluded"
    | "rejected";
  review_reason: string | null;
  excluded_from_totals: boolean;
}

export interface StatementResponse {
  id: number;
  source_file: string;
  institution_name: string;
  account_name: string;
  account_type: string;
  trust_state: "trusted" | "needs_review" | "rejected";
  statement_end_date: string | null;
}

export interface PipelineJob {
  job_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  progress_stage: number;
  progress_total: number;
  progress_message: string;
  result: unknown | null;
  error: string | null;
}

export interface CategoriesResponse {
  categories: string[];
  kinds: string[];
  quick_classifications: Array<{
    label: string;
    kind: string;
    category: string;
    split_bps: number;
  }>;
}

export interface InstitutionInfo {
  key: string;
  name: string;
  account_type: string;
  format: string;
}

export interface PaginatedTransactions {
  items: TransactionResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedStatements {
  items: StatementResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionQuery {
  limit?: number;
  offset?: number;
  trust_state?: string;
  category?: string;
}

export interface StatementQuery {
  limit?: number;
  offset?: number;
  trust_state?: string;
  account_type?: string;
}

export interface BulkResult {
  updated: TransactionResponse[];
  failed: Array<{ transaction_id: number; error: string }>;
}

export interface BatchInitResponse {
  transactions: PaginatedTransactions;
  categories: CategoriesResponse;
  institutions: { institutions: InstitutionInfo[] };
}

// ─── Summary / Dashboard Types ──────────────────────────────

export interface SummaryTotals {
  income_cents: number;
  expense_cents: number;
  business_expense_cents: number;
  personal_expense_cents: number;
  business_income_cents: number;
  net_business_cents: number;
  business_use_pct: number;
  transaction_count: number;
  needs_review_count: number;
  excluded_count: number;
  excluded_activity_cents: number;
  included_cash_flow_cents: number;
}

export interface CategoryBreakdown {
  category: string;
  biz_income_cents: number;
  biz_expense_cents: number;
  count: number;
}

export interface MonthlyBreakdown {
  month: string;
  income_cents: number;
  expense_cents: number;
  personal_cents: number;
  net_cents: number;
  cash_flow_cents: number;
  excluded_cents: number;
}

export interface KindBreakdown {
  kind: string;
  total_cents: number;
  count: number;
}

export interface FinancialSummary {
  totals: SummaryTotals;
  by_category: CategoryBreakdown[];
  by_month: MonthlyBreakdown[];
  by_kind: KindBreakdown[];
  recent_review: TransactionResponse[];
}

export interface ReviewWorkbookResponse {
  applied_count: number;
  categorized_count: number;
  excluded_count: number;
  skipped_count: number;
}

export interface InstitutionRequest {
  institution_name: string;
  account_type?: string;
  details?: string;
}

export type BusinessToolsTab =
  | "overview"
  | "upload"
  | "transactions"
  | "statements";
