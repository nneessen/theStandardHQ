import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/services/base/supabase";
import { getCurrentTenantContext } from "../TenantContext";

// getCurrentTenantContext must be a faithful mirror of the DB RLS helper
// get_effective_imo_id(): super-admin -> acting_imo_id (from user_metadata),
// everyone else -> their home imo_id. This is what keeps the app layer from
// disagreeing with RLS and leaking another IMO's data.

vi.mock("@/services/base/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const HOME_IMO = "11111111-1111-1111-1111-111111111111";
const HOME_AGENCY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EPIC_LIFE = "2fd256e9-9abb-445e-b405-62436555648a";
const USER_ID = "d0d3edea-af6d-4990-80b8-1765ba829896";

function mockAuth(userMetadata: Record<string, unknown> = {}) {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: USER_ID, user_metadata: userMetadata } },
    error: null,
  } as never);
}

function mockProfile(profile: {
  imo_id: string | null;
  agency_id: string | null;
  is_super_admin: boolean;
}) {
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: profile, error: null }),
      }),
    }),
  } as never);
}

describe("getCurrentTenantContext (effective-IMO resolution)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("non-super-admin: resolves to home IMO and ignores any acting_imo_id", async () => {
    mockAuth({ acting_imo_id: EPIC_LIFE }); // stale metadata must be ignored
    mockProfile({
      imo_id: HOME_IMO,
      agency_id: HOME_AGENCY,
      is_super_admin: false,
    });

    const ctx = await getCurrentTenantContext();

    expect(ctx.imoId).toBe(HOME_IMO);
    expect(ctx.agencyId).toBe(HOME_AGENCY);
  });

  it("super-admin acting as another IMO: resolves to the acting IMO, agency null", async () => {
    mockAuth({ acting_imo_id: EPIC_LIFE });
    mockProfile({
      imo_id: HOME_IMO,
      agency_id: HOME_AGENCY,
      is_super_admin: true,
    });

    const ctx = await getCurrentTenantContext();

    expect(ctx.imoId).toBe(EPIC_LIFE);
    // No agency in a tenant you only act into.
    expect(ctx.agencyId).toBeNull();
  });

  it("super-admin acting as home IMO: resolves to home IMO and keeps home agency", async () => {
    mockAuth({ acting_imo_id: HOME_IMO });
    mockProfile({
      imo_id: HOME_IMO,
      agency_id: HOME_AGENCY,
      is_super_admin: true,
    });

    const ctx = await getCurrentTenantContext();

    expect(ctx.imoId).toBe(HOME_IMO);
    expect(ctx.agencyId).toBe(HOME_AGENCY);
  });

  it("super-admin with no acting_imo_id (explicit All-IMOs): resolves to null", async () => {
    mockAuth({}); // no acting_imo_id
    mockProfile({
      imo_id: HOME_IMO,
      agency_id: HOME_AGENCY,
      is_super_admin: true,
    });

    const ctx = await getCurrentTenantContext();

    // Mirrors get_effective_imo_id() returning NULL for a non-acting super-admin
    // (the explicit see-all hatch). Callers that need a single tenant must pass
    // one explicitly; TenantScopedRepository throws rather than guessing.
    expect(ctx.imoId).toBeNull();
    expect(ctx.agencyId).toBeNull();
  });

  it("empty-string acting_imo_id is normalised to null", async () => {
    mockAuth({ acting_imo_id: "" });
    mockProfile({
      imo_id: HOME_IMO,
      agency_id: HOME_AGENCY,
      is_super_admin: true,
    });

    const ctx = await getCurrentTenantContext();

    expect(ctx.imoId).toBeNull();
  });
});
