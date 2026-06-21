// deleteTemplate must surface a 0-row delete (RLS-blocked or stale id) as an error
// instead of a false "Template deleted." — and scope by owner_id (defence-in-depth).

import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
// Mutable holder so each test can set what the terminal .select() resolves to.
const deleteResult: { value: { data: unknown; error: unknown } } = {
  value: { data: [{ id: "t1" }], error: null },
};
const eq = vi.fn((..._args: unknown[]) => {});
const select = vi.fn((..._args: unknown[]) =>
  Promise.resolve(deleteResult.value),
);

vi.mock("@/services/base/supabase", () => {
  const chain = {
    delete: vi.fn(() => chain),
    eq: (...a: unknown[]) => {
      eq(...a);
      return chain;
    },
    select: (...a: unknown[]) => select(...a),
  };
  return {
    supabase: {
      auth: { getUser: (...a: unknown[]) => getUser(...a) },
      from: vi.fn(() => chain),
    },
  };
});

import { socialTemplateService } from "../socialTemplateService";

beforeEach(() => {
  getUser.mockReset();
  eq.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  deleteResult.value = { data: [{ id: "t1" }], error: null };
});

describe("deleteTemplate", () => {
  it("resolves when exactly the owner's row is deleted", async () => {
    await expect(
      socialTemplateService.deleteTemplate("t1"),
    ).resolves.toBeUndefined();
    // scoped by both id AND owner_id (defence-in-depth)
    expect(eq).toHaveBeenCalledWith("id", "t1");
    expect(eq).toHaveBeenCalledWith("owner_id", "u1");
  });

  it("throws on a 0-row delete instead of reporting false success (#14 regression)", async () => {
    deleteResult.value = { data: [], error: null };
    await expect(socialTemplateService.deleteTemplate("t1")).rejects.toThrow(
      /not found|already deleted/i,
    );
  });

  it("throws when the user is not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(socialTemplateService.deleteTemplate("t1")).rejects.toThrow(
      /not authenticated/i,
    );
  });

  it("propagates a database error", async () => {
    deleteResult.value = { data: null, error: new Error("boom") };
    await expect(socialTemplateService.deleteTemplate("t1")).rejects.toThrow(
      "boom",
    );
  });
});
