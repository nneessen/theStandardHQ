import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  canUseTool,
  confirmationRequired,
  effectiveActionClass,
} from "../guard.ts";
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

Deno.test(
  "guard enforces required permissions (super-admin bypasses read/draft)",
  () => {
    const m = { ...readMeta, requiredPermissions: ["policies.read.own"] };
    assertFalse(canUseTool(m, []).allowed);
    assert(canUseTool(m, ["policies.read.own"]).allowed);
    assert(canUseTool(m, [], { isSuperAdmin: true }).allowed);
  },
);

// --- Agentic-platform kernel additions ---

Deno.test(
  "effectiveActionClass derives from riskLevel when actionClass is absent",
  () => {
    assertEquals(effectiveActionClass(readMeta), "read");
    assertEquals(
      effectiveActionClass({ ...readMeta, riskLevel: "draft" }),
      "draft",
    );
    assertEquals(
      effectiveActionClass({ ...readMeta, riskLevel: "external_action" }),
      "outbound",
    );
    assertEquals(
      effectiveActionClass({ ...readMeta, riskLevel: "sensitive_write" }),
      "irreversible",
    );
    // explicit actionClass wins over the riskLevel derivation
    assertEquals(
      effectiveActionClass({ ...readMeta, actionClass: "local" }),
      "local",
    );
  },
);

Deno.test(
  "confirmationRequired is true only for outbound/local/irreversible",
  () => {
    assertFalse(confirmationRequired(readMeta));
    assertFalse(confirmationRequired({ ...readMeta, riskLevel: "draft" }));
    assert(confirmationRequired({ ...readMeta, actionClass: "outbound" }));
    assert(confirmationRequired({ ...readMeta, actionClass: "local" }));
    assert(confirmationRequired({ ...readMeta, actionClass: "irreversible" }));
  },
);

Deno.test("guard denies a tool whose requiredConnection is not linked", () => {
  const m: ToolMetadata = { ...readMeta, requiredConnection: "discord" };
  assertEquals(canUseTool(m, []).reason, "discord_not_connected");
  assertFalse(canUseTool(m, [], { connectedProviders: ["twilio"] }).allowed);
  assert(canUseTool(m, [], { connectedProviders: ["discord"] }).allowed);
});

Deno.test(
  "super-admin does NOT bypass permissions for privileged classes",
  () => {
    // outbound/local/irreversible must be explicitly granted regardless of role. Pass
    // hasApproval:true so we get PAST the approval gate and actually exercise the PERMISSION
    // gate (the approval gate is covered by the next test).
    const outbound: ToolMetadata = {
      ...readMeta,
      actionClass: "outbound",
      requiredPermissions: ["sms.send"],
    };
    const sa = { isSuperAdmin: true, hasApproval: true };
    assertFalse(canUseTool(outbound, [], sa).allowed);
    assertEquals(
      canUseTool(outbound, [], sa).reason,
      "missing_permissions:sms.send",
    );
    // ...but a super-admin still bypasses read/draft tools (unchanged behavior).
    const draft: ToolMetadata = {
      ...readMeta,
      riskLevel: "draft",
      requiredPermissions: ["x"],
    };
    assert(canUseTool(draft, [], { isSuperAdmin: true }).allowed);
    // an explicitly-granted + approved super-admin can use the privileged tool.
    assert(canUseTool(outbound, ["sms.send"], sa).allowed);
  },
);

Deno.test(
  "privileged actionClass requires approval even when requiresApproval is false",
  () => {
    // The docs promise outbound/local/irreversible 'require a human-confirmed approval row';
    // the guard must enforce that from actionClass, not only from the legacy flag.
    const outbound: ToolMetadata = {
      ...readMeta,
      actionClass: "outbound",
      requiresApproval: false,
    };
    assertEquals(canUseTool(outbound, []).reason, "requires_approval");
    assertFalse(canUseTool(outbound, [], { isSuperAdmin: true }).allowed);
    assert(canUseTool(outbound, [], { hasApproval: true }).allowed);
    // read/draft never require approval from actionClass.
    assert(canUseTool(readMeta, []).allowed);
    assert(canUseTool({ ...readMeta, riskLevel: "draft" }, []).allowed);
  },
);
