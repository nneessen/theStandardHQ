// src/services/surelc/__tests__/SureLcLinkService.test.ts
// Unit tests for SureLcLinkService validation + delegation. The repository is
// mocked so these run without a database.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SureLcLinkService } from "../SureLcLinkService";
import type { SureLcLinkRepository } from "../SureLcLinkRepository";
import type { SureLcLink } from "@/types/surelc.types";

function makeLink(overrides: Partial<SureLcLink> = {}): SureLcLink {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    imoId: "imo-1",
    ownerUserId: null,
    label: "SureLC Producer Portal",
    url: "https://surelc.surancebay.com/",
    description: null,
    sortOrder: 0,
    isActive: true,
    createdBy: "user-1",
    createdAt: "2026-06-07T00:00:00Z",
    updatedAt: "2026-06-07T00:00:00Z",
    ...overrides,
  };
}

describe("SureLcLinkService", () => {
  let repo: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findShared: ReturnType<typeof vi.fn>;
    findMine: ReturnType<typeof vi.fn>;
  };
  let service: SureLcLinkService;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findShared: vi.fn(),
      findMine: vi.fn(),
    };
    service = new SureLcLinkService(repo as unknown as SureLcLinkRepository);
  });

  describe("create validation", () => {
    it("rejects an empty label", async () => {
      const res = await service.create({
        scope: "shared",
        label: "   ",
        url: "https://surelc.surancebay.com/",
      });
      expect(res.success).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a non-http(s) url", async () => {
      const res = await service.create({
        scope: "personal",
        label: "My link",
        url: "javascript:alert(1)",
      });
      expect(res.success).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a malformed url", async () => {
      const res = await service.create({
        scope: "personal",
        label: "My link",
        url: "not a url",
      });
      expect(res.success).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("creates a valid shared link (scope passed through)", async () => {
      repo.create.mockResolvedValue(makeLink());
      const res = await service.create({
        scope: "shared",
        label: "SureLC Producer Portal",
        url: "https://surelc.surancebay.com/",
      });
      expect(res.success).toBe(true);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "shared" }),
      );
    });

    it("creates a valid personal link", async () => {
      repo.create.mockResolvedValue(
        makeLink({ ownerUserId: "user-1", scope: undefined } as never),
      );
      const res = await service.create({
        scope: "personal",
        label: "My SureLC",
        url: "https://accounts.surancebay.com/oauth/authorize",
      });
      expect(res.success).toBe(true);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "personal" }),
      );
    });
  });

  describe("update validation (partial)", () => {
    it("allows updating only sortOrder without label/url", async () => {
      repo.update.mockResolvedValue(makeLink({ sortOrder: 5 }));
      const res = await service.update("id-1", { sortOrder: 5 });
      expect(res.success).toBe(true);
      expect(repo.update).toHaveBeenCalledWith("id-1", { sortOrder: 5 });
    });

    it("validates url when it IS being changed", async () => {
      const res = await service.update("id-1", { url: "ftp://nope" });
      expect(res.success).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("validates label when it IS being changed", async () => {
      const res = await service.update("id-1", { label: "" });
      expect(res.success).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("reads + delete delegate to repository", () => {
    it("getShared returns repository rows", async () => {
      repo.findShared.mockResolvedValue([makeLink()]);
      const res = await service.getShared();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });

    it("getMine passes the user id through", async () => {
      repo.findMine.mockResolvedValue([]);
      await service.getMine("user-9");
      expect(repo.findMine).toHaveBeenCalledWith("user-9");
    });

    it("delete returns success", async () => {
      repo.delete.mockResolvedValue(undefined);
      const res = await service.delete("id-1");
      expect(res.success).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith("id-1");
    });

    it("surfaces repository errors as failed responses", async () => {
      repo.findShared.mockRejectedValue(new Error("boom"));
      const res = await service.getShared();
      expect(res.success).toBe(false);
      expect(res.error?.message).toBe("boom");
    });
  });
});
