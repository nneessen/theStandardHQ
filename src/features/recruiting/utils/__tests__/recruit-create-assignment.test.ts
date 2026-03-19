import { describe, expect, it } from "vitest";
import { buildRecruitCreateAssignmentFields } from "../recruit-create-assignment";

describe("buildRecruitCreateAssignmentFields", () => {
  it("omits server-owned fields for standard agents creating self-managed recruits", () => {
    expect(
      buildRecruitCreateAssignmentFields({
        canManageUsers: false,
        currentUserId: "agent-1",
        selectedUplineId: "agent-1",
        imoId: "imo-1",
        agencyId: "agency-1",
      }),
    ).toEqual({});
  });

  it("omits assignment fields when no upline is selected", () => {
    expect(
      buildRecruitCreateAssignmentFields({
        canManageUsers: false,
        currentUserId: "agent-1",
        selectedUplineId: "",
      }),
    ).toEqual({});
  });

  it("preserves a non-self upline for standard agents", () => {
    expect(
      buildRecruitCreateAssignmentFields({
        canManageUsers: false,
        currentUserId: "agent-1",
        selectedUplineId: "trainer-1",
      }),
    ).toEqual({
      upline_id: "trainer-1",
    });
  });

  it("keeps explicit assignment metadata for managers", () => {
    expect(
      buildRecruitCreateAssignmentFields({
        canManageUsers: true,
        currentUserId: "admin-1",
        selectedUplineId: "trainer-1",
        imoId: "imo-1",
        agencyId: "agency-1",
      }),
    ).toEqual({
      recruiter_id: "admin-1",
      upline_id: "trainer-1",
      imo_id: "imo-1",
      agency_id: "agency-1",
    });
  });
});
