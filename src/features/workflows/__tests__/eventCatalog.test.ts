import { describe, expect, it } from "vitest";
import { WORKFLOW_EVENTS } from "@/lib/workflow-event-names";
import { TEMPLATE_VARIABLE_KEYS } from "@/lib/templateVariables";
import {
  ACTIVE_WORKFLOW_EVENTS,
  WORKFLOW_EVENT_CATALOG,
} from "@/features/workflows";

describe("workflow event catalog drift guard", () => {
  it("is a bijection with WORKFLOW_EVENTS (no missing or extra events)", () => {
    const emitterValues = new Set<string>(Object.values(WORKFLOW_EVENTS));
    const catalogNames = new Set<string>(
      WORKFLOW_EVENT_CATALOG.map((e) => e.eventName),
    );

    const missingFromCatalog = [...emitterValues].filter(
      (v) => !catalogNames.has(v),
    );
    const extraInCatalog = [...catalogNames].filter(
      (v) => !emitterValues.has(v),
    );

    expect(missingFromCatalog, "WORKFLOW_EVENTS not in catalog").toEqual([]);
    expect(extraInCatalog, "catalog events not in WORKFLOW_EVENTS").toEqual([]);
  });

  it("has no duplicate event names", () => {
    const names = WORKFLOW_EVENT_CATALOG.map((e) => e.eventName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only references real template variables in availableVariables", () => {
    const valid = new Set(TEMPLATE_VARIABLE_KEYS);
    for (const e of WORKFLOW_EVENT_CATALOG) {
      for (const v of e.availableVariables) {
        expect(
          valid.has(v),
          `${e.eventName} references unknown tag "${v}"`,
        ).toBe(true);
      }
    }
  });

  it("every ACTIVE (selectable) event has at least one tag", () => {
    for (const e of ACTIVE_WORKFLOW_EVENTS) {
      expect(
        e.availableVariables.length,
        `${e.eventName} (active) must expose tags`,
      ).toBeGreaterThan(0);
    }
  });

  it("active events are the 11 currently-emitted ones", () => {
    // If this changes, the seed migration AND emission wiring must change together.
    expect(ACTIVE_WORKFLOW_EVENTS.map((e) => e.eventName).sort()).toEqual(
      [
        "commission.chargeback",
        "commission.earned",
        "commission.paid",
        "lead.pack_purchased",
        "policy.cancelled",
        "policy.created",
        "policy.renewed",
        "recruit.created",
        "recruit.dropped_out",
        "recruit.graduated_to_agent",
        "recruit.phase_changed",
      ].sort(),
    );
  });
});
