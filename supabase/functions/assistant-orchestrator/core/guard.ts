// Permission guard (pure). The canonical, server-enforced gate that decides
// whether a given tool may run for a given user. Called by the orchestrator
// before every tool handler. Unit-tested in core/__tests__/guard.test.ts.

import type { GuardDecision, ToolMetadata } from "./types.ts";

export interface GuardOptions {
  isSuperAdmin?: boolean;
  /** True only when an approved, human-confirmed action row backs this call. */
  hasApproval?: boolean;
}

export function canUseTool(
  meta: ToolMetadata | undefined,
  userPermissions: string[],
  opts: GuardOptions = {},
): GuardDecision {
  if (!meta) return { allowed: false, reason: "unknown_tool" };

  if (!meta.implemented) {
    return { allowed: false, reason: "not_implemented" };
  }

  // Tools flagged requiresApproval can never be invoked directly by the model;
  // they need an approved action row (executed out-of-band by
  // assistant-action-execute, not the orchestrator loop).
  if (meta.requiresApproval && !opts.hasApproval) {
    return { allowed: false, reason: "requires_approval" };
  }

  if (meta.requiredPermissions.length > 0 && !opts.isSuperAdmin) {
    const missing = meta.requiredPermissions.filter(
      (p) => !userPermissions.includes(p),
    );
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `missing_permissions:${missing.join(",")}`,
      };
    }
  }

  return { allowed: true };
}

/** Filter a list of tool names down to those the agent is allowed to expose. */
export function allowedToolNamesFor(
  agentAllowed: string[],
  registry: Record<string, ToolMetadata>,
): string[] {
  return agentAllowed.filter((name) => registry[name]?.implemented);
}
