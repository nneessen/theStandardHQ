// Action-request lifecycle (pure). The single source of truth for which status
// transitions are legal. assistant-action-execute and the frontend approve/cancel
// mutations both validate against this. Unit-tested in core/__tests__.

import type { ActionStatus } from "./types.ts";

const TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled", "expired"],
  approved: ["executing", "cancelled"],
  executing: ["executed", "failed"],
  executed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export const TERMINAL_STATUSES: ActionStatus[] = [
  "executed",
  "failed",
  "cancelled",
  "expired",
];

export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: ActionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/**
 * Whether an action row is eligible to be executed right now: it must be exactly
 * `approved` (so executing->executing is rejected) and not past its expiry.
 */
export function canExecute(
  status: ActionStatus,
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return status === "approved" && !isExpired(expiresAt, now);
}
