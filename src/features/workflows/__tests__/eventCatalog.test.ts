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

  it("active events are the 70 currently-emitted ones", () => {
    // If this changes, the seed migration AND emission wiring must change together.
    expect(ACTIVE_WORKFLOW_EVENTS.map((e) => e.eventName).sort()).toEqual(
      [
        "agency.created",
        "agency.ownership_transferred",
        "agency_request.approved",
        "agency_request.created",
        "agency_request.rejected",
        "agent.approved",
        "agent.contract_level_changed",
        "agent.denied",
        "agent.licensed",
        "chargeback.resolved",
        "client.created",
        "document.all_required_approved",
        "document.approved",
        "document.rejected",
        "document.uploaded",
        "instagram.lead_created",
        "invitation.accepted",
        "join_request.approved",
        "join_request.created",
        "join_request.rejected",
        "commission.cancelled",
        "commission.chargeback",
        "commission.chargeback_reversed",
        "commission.earned",
        "commission.paid",
        "contracting.carrier_approved",
        "contracting.carrier_denied",
        "contracting.carrier_submitted",
        "contracting.carrier_terminated",
        "contracting.held_under_set",
        "contracting.request_completed",
        "contracting.request_created",
        "contracting.request_writing_received",
        "lead.accepted",
        "lead.pack_purchased",
        "lead.rejected",
        "lead_pack.roi_updated",
        "override.paid",
        "prospect.converted",
        "prospect.status_changed",
        "recruit.checklist_item_awaiting_approval",
        "recruit.checklist_item_completed",
        "recruit.onboarding_completed",
        "recruit.phase_blocked",
        "recruit.phase_completed",
        "recruit.pipeline_enrolled",
        "recruit.quiz_failed",
        "recruit.quiz_passed",
        "training.assignment_created",
        "training.lesson_completed",
        "training.presentation_approved",
        "training.presentation_submitted",
        "training.quiz_failed",
        "training.quiz_passed",
        "training.roadmap_item_completed",
        "underwriting.rule_set_approved",
        "underwriting.rule_set_rejected",
        "underwriting.rule_set_submitted",
        "policy.active",
        "policy.approved",
        "policy.cancelled",
        "policy.created",
        "policy.denied",
        "policy.lapsed",
        "policy.renewed",
        "policy.withdrawn",
        "recruit.created",
        "recruit.dropped_out",
        "recruit.graduated_to_agent",
        "recruit.phase_changed",
      ].sort(),
    );
  });
});
