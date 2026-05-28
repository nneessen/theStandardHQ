import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { canUseTool } from "../guard.ts";
import type { ToolMetadata } from "../types.ts";

const readMeta: ToolMetadata = {
  name: "r",
  description: "",
  category: "briefing",
  riskLevel: "read",
  requiredPermissions: [],
  requiresApproval: false,
  implemented: true,
};

Deno.test("guard denies an unknown tool", () => {
  assertFalse(canUseTool(undefined, []).allowed);
});

Deno.test("guard denies a not-implemented tool", () => {
  assertFalse(canUseTool({ ...readMeta, implemented: false }, []).allowed);
});

Deno.test("guard allows a read tool with no required permissions", () => {
  assert(canUseTool(readMeta, []).allowed);
});

Deno.test(
  "guard denies an approval-required tool unless approval is present",
  () => {
    const m = { ...readMeta, requiresApproval: true };
    assertFalse(canUseTool(m, []).allowed);
    assertEquals(canUseTool(m, []).reason, "requires_approval");
    assert(canUseTool(m, [], { hasApproval: true }).allowed);
  },
);

Deno.test("guard enforces required permissions (super-admin bypasses)", () => {
  const m = { ...readMeta, requiredPermissions: ["policies.read.own"] };
  assertFalse(canUseTool(m, []).allowed);
  assert(canUseTool(m, ["policies.read.own"]).allowed);
  assert(canUseTool(m, [], { isSuperAdmin: true }).allowed);
});
