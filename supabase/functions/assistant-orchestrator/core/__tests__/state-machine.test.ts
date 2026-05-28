import { assert, assertFalse } from "jsr:@std/assert@1";
import {
  canExecute,
  canTransition,
  isExpired,
  isTerminal,
  TERMINAL_STATUSES,
} from "../state-machine.ts";
import type { ActionStatus } from "../types.ts";

Deno.test("valid lifecycle transitions are allowed", () => {
  assert(canTransition("pending_approval", "approved"));
  assert(canTransition("pending_approval", "cancelled"));
  assert(canTransition("approved", "executing"));
  assert(canTransition("executing", "executed"));
  assert(canTransition("executing", "failed"));
});

Deno.test("illegal transitions are rejected", () => {
  assertFalse(canTransition("pending_approval", "executed"));
  assertFalse(canTransition("executed", "executing"));
  assertFalse(canTransition("cancelled", "approved"));
  assertFalse(canTransition("executing", "executing"));
});

Deno.test("isExpired handles past, future, and null", () => {
  assert(isExpired(new Date(Date.now() - 1000).toISOString()));
  assertFalse(isExpired(new Date(Date.now() + 100_000).toISOString()));
  assertFalse(isExpired(null));
});

Deno.test("canExecute is true only for approved + not expired", () => {
  const future = new Date(Date.now() + 100_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  assert(canExecute("approved", future));
  assertFalse(canExecute("approved", past));
  assertFalse(canExecute("executing", future));
  assertFalse(canExecute("pending_approval", future));
});

Deno.test("isTerminal classifies end states", () => {
  assert(isTerminal("executed"));
  assert(isTerminal("cancelled"));
  assertFalse(isTerminal("approved"));
});

// Mirrors the DB trigger in migration 20260528090704_assistant_action_status_guard:
// once a row is terminal it can never transition out, so an executed/cancelled
// action cannot be reset and re-sent. The trigger backstops this at the DB layer.
Deno.test("terminal statuses are immutable (no outgoing transition)", () => {
  const all: ActionStatus[] = [
    "draft",
    "pending_approval",
    "approved",
    "executing",
    "executed",
    "failed",
    "cancelled",
    "expired",
  ];
  for (const term of TERMINAL_STATUSES) {
    assert(isTerminal(term));
    for (const to of all) {
      assertFalse(
        canTransition(term, to),
        `terminal ${term} must not transition to ${to}`,
      );
    }
  }
});
