import { assert, assertFalse } from "jsr:@std/assert@1";
import {
  canExecute,
  canTransition,
  isExpired,
  isTerminal,
} from "../state-machine.ts";

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
