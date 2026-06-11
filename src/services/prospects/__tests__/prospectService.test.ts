import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../base/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("../../base/TenantContext", () => ({
  getCurrentTenantContext: vi.fn(),
}));

import { supabase } from "../../base/supabase";
import { getCurrentTenantContext } from "../../base/TenantContext";
import { prospectService } from "../prospectService";
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  type Prospect,
} from "@/types/prospect.types";

function makeProspect(overrides: Partial<Prospect>): Prospect {
  return {
    id: "p1",
    imo_id: "imo-1",
    agency_id: null,
    owner_id: "agent-1",
    first_name: "Jane",
    last_name: "Doe",
    email: null,
    phone: null,
    state: null,
    source: null,
    status: "new",
    notes: null,
    last_contacted_at: null,
    next_follow_up_at: null,
    converted_recruit_id: null,
    converted_at: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("prospect status maps", () => {
  it("has a label and color for every status", () => {
    for (const status of PROSPECT_STATUSES) {
      expect(PROSPECT_STATUS_LABELS[status]).toBeTruthy();
      expect(PROSPECT_STATUS_COLORS[status]).toMatchObject({
        bg: expect.any(String),
        text: expect.any(String),
        border: expect.any(String),
      });
    }
  });
});

describe("prospectService.createProspect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps owner/imo/agency from tenant context and normalizes email", async () => {
    vi.mocked(getCurrentTenantContext).mockResolvedValue({
      userId: "agent-1",
      imoId: "imo-1",
      agencyId: "agency-1",
    });

    let captured: Record<string, unknown> = {};
    const single = vi
      .fn()
      .mockResolvedValue({ data: makeProspect({ id: "new" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi
      .fn()
      .mockImplementation((payload: Record<string, unknown>) => {
        captured = payload;
        return { select };
      });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await prospectService.createProspect({
      first_name: "  Jane ",
      email: "  JANE@Example.COM ",
    });

    expect(captured.owner_id).toBe("agent-1");
    expect(captured.imo_id).toBe("imo-1");
    expect(captured.agency_id).toBe("agency-1");
    expect(captured.first_name).toBe("Jane");
    expect(captured.email).toBe("jane@example.com");
    expect(captured.status).toBe("new");
  });

  it("throws when there is no effective IMO in context", async () => {
    vi.mocked(getCurrentTenantContext).mockResolvedValue({
      userId: "agent-1",
      imoId: null,
      agencyId: null,
    });

    await expect(
      prospectService.createProspect({ first_name: "Jane" }),
    ).rejects.toThrow(/IMO/i);
  });
});
