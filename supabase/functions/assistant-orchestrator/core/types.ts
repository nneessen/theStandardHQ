// Pure, dependency-free types for the assistant orchestrator.
// IMPORTANT: this module (and everything else under core/) must NOT import
// supabase-js, the Anthropic SDK, or any esm.sh/Deno-specific module, so the
// safety logic stays unit-testable offline via `deno test`. Effectful handlers
// that need those imports live under ../tools/.

export type RiskLevel =
  | "read"
  | "draft"
  | "external_action"
  | "sensitive_write";

/**
 * Data-driven action class — the lever that drives confirmation policy, rate-limit
 * bucket selection, and the super-admin-bypass narrowing, WITHOUT per-tool special-casing.
 * Distinct from `riskLevel` (kept for audit). When a tool omits `actionClass`, it is
 * derived from `riskLevel` (see effectiveActionClass in guard.ts), so existing tools are
 * unchanged:
 *   read -> read, draft -> draft, external_action -> outbound, sensitive_write -> irreversible.
 *   "local" is OS-executor only (desktop companion); never derived.
 */
export type ActionClass =
  | "read"
  | "draft"
  | "outbound"
  | "local"
  | "irreversible";

export type ToolCategory =
  | "briefing"
  | "production"
  | "policy"
  | "lead"
  | "crm"
  | "close"
  | "messaging"
  | "calendar"
  | "slack"
  | "recruiting"
  | "coaching"
  | "compliance"
  | "workflow"
  | "data_quality"
  | "underwriting"
  | "general";

// Lifecycle for assistant_action_requests. Enforced in state-machine.ts; the DB
// column is plain TEXT (project convention: no CHECK constraints on enums).
export type ActionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled"
  | "expired";

export type ActionChannel = "email" | "sms" | "close_note" | "close_task";

export type AgentKey =
  | "executive-briefing"
  | "production-analyst"
  | "policy-risk"
  | "lead-priority"
  | "crm"
  | "close"
  | "sms-email-copy"
  | "compliance"
  | "recruiting"
  | "coaching"
  | "calendar"
  | "slack"
  | "workflow"
  | "data-quality"
  | "underwriting";

export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  /** Permission codes the caller must hold (empty = any authenticated user). */
  requiredPermissions: string[];
  /**
   * True only for tools the model must NOT invoke without an approved, human-
   * confirmed action row. MVP external sends are NOT exposed as model tools at
   * all (they run in assistant-action-execute), so the MVP read/draft tools are
   * all false. The flag + guard logic exist for future sensitive_write tools.
   */
  requiresApproval: boolean;
  /** False => registered but not implemented; handler returns a clear "unavailable" result. */
  implemented: boolean;
  // --- Agentic-platform kernel fields (all OPTIONAL + backward-compatible). ---
  /**
   * Confirmation/gating class. Omit to derive from `riskLevel` (see effectiveActionClass).
   * `outbound`/`local`/`irreversible` require a human-confirmed approval row and do NOT get
   * the super-admin permission bypass.
   */
  actionClass?: ActionClass;
  /** Where the handler runs. Omit => "cloud" (the edge fn). "local" => the desktop companion. */
  target?: "cloud" | "local";
  /**
   * A per-user external account that must be linked first (e.g. "twilio", "discord").
   * The guard denies with reason `<provider>_not_connected` when it isn't.
   */
  requiredConnection?: string;
  /** True => an admin must explicitly enable this tool for the user (defaults on for privileged classes). */
  adminGrantRequired?: boolean;
}

export interface AgentConfig {
  key: AgentKey;
  name: string;
  description: string;
  systemPrompt: string;
  /** Tool names this agent is allowed to call. */
  allowedToolNames: string[];
  allowedCategories: ToolCategory[];
  /**
   * Optional Anthropic model id for this agent. Omitted => the orchestrator's
   * default (ORCHESTRATOR_MODEL). Draft-only agents use a faster model. Stored as
   * a literal here (core/ stays esm-free and cannot import anthropic.ts).
   */
  model?: string;
  /** Optional per-agent output cap. Omitted => MAX_TOKENS_PER_TURN default. */
  maxTokens?: number;
}

export interface GuardDecision {
  allowed: boolean;
  reason?: string;
}
