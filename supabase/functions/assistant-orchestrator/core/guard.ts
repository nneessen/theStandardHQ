// Permission guard (pure). The canonical, server-enforced gate that decides
// whether a given tool may run for a given user. Called by the orchestrator
// before every tool handler. Unit-tested in core/__tests__/guard.test.ts.

import type { ActionClass, GuardDecision, ToolMetadata } from "./types.ts";

export interface GuardOptions {
  isSuperAdmin?: boolean;
  /** True only when an approved, human-confirmed action row backs this call. */
  hasApproval?: boolean;
  /** Providers the user has linked (e.g. ["twilio","discord"]); gates `requiredConnection`. */
  connectedProviders?: string[];
}

/**
 * The tool's effective action class — explicit `actionClass`, else derived from `riskLevel`
 * so every existing tool keeps its current behavior without edits.
 */
export function effectiveActionClass(meta: ToolMetadata): ActionClass {
  if (meta.actionClass) return meta.actionClass;
  switch (meta.riskLevel) {
    case "read":
      return "read";
    case "draft":
      return "draft";
    case "external_action":
      return "outbound";
    case "sensitive_write":
      return "irreversible";
  }
}

/**
 * Privileged classes that must pass through human confirmation and do NOT receive the
 * super-admin permission bypass: anything that sends, touches the OS, or is irreversible.
 */
export function confirmationRequired(meta: ToolMetadata): boolean {
  const c = effectiveActionClass(meta);
  return c === "outbound" || c === "local" || c === "irreversible";
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

  // A tool that requires a linked external account (e.g. Discord/Twilio) can't run until
  // the user has connected it — surfaced as `<provider>_not_connected`.
  if (meta.requiredConnection) {
    const connected = opts.connectedProviders ?? [];
    if (!connected.includes(meta.requiredConnection)) {
      return {
        allowed: false,
        reason: `${meta.requiredConnection}_not_connected`,
      };
    }
  }

  // Super-admins bypass `requiredPermissions` for read/draft ONLY. Privileged classes
  // (outbound / local / irreversible) must be explicitly granted regardless of role — a
  // hijacked or prompt-injected brain running as a super-admin must NOT auto-clear the gate.
  if (meta.requiredPermissions.length > 0) {
    const superAdminBypass =
      opts.isSuperAdmin === true && !confirmationRequired(meta);
    if (!superAdminBypass) {
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
