// Empirically verifies that per-carrier contracting instructions (carriers.contracting_metadata)
// survive the CarrierService form transform — the exact layer where the field was previously
// hardcoded to null on create AND silently dropped on update. Uses a stub repository that
// captures the payload BaseService forwards to the DB layer.

import { describe, it, expect, beforeEach } from "vitest";
import { CarrierService } from "../CarrierService";
import type { CarrierRepository } from "../CarrierRepository";
import type { CarrierContractingInstructions } from "@/types/carrier.types";

interface Captured {
  create: Record<string, unknown> | null;
  update: { id: string; data: Record<string, unknown> } | null;
}

function makeService() {
  const captured: Captured = { create: null, update: null };
  const stub = {
    async create(data: Record<string, unknown>) {
      captured.create = data;
      return { id: "new-id", ...data };
    },
    async update(id: string, data: Record<string, unknown>) {
      captured.update = { id, data };
      return { id, ...data };
    },
  } as unknown as CarrierRepository;
  return { service: new CarrierService(stub), captured };
}

const INSTRUCTIONS: CarrierContractingInstructions = {
  method: "surelc",
  instructions: "Submit through SureLC; writing number arrives in 3-5 days.",
  portal_url: "https://portal.example.com",
  contact_email: "contracting@carrier.test",
  processing_time_days: 5,
};

describe("CarrierService — contracting_metadata threading", () => {
  let svc: ReturnType<typeof makeService>;
  beforeEach(() => {
    svc = makeService();
  });

  it("createFromForm forwards contracting_metadata to the repository", async () => {
    const res = await svc.service.createFromForm({
      name: "Test Carrier",
      contracting_metadata: INSTRUCTIONS,
    });
    expect(res.success).toBe(true);
    expect(svc.captured.create?.contracting_metadata).toEqual(INSTRUCTIONS);
  });

  it("createFromForm stores null (not undefined) when no instructions given", async () => {
    await svc.service.createFromForm({ name: "Bare Carrier" });
    expect(svc.captured.create).toHaveProperty("contracting_metadata", null);
  });

  it("updateFromForm forwards contracting_metadata when present", async () => {
    // name is always sent by the form (BaseService.update validates the full ruleset).
    const res = await svc.service.updateFromForm("c-1", {
      name: "Test Carrier",
      contracting_metadata: INSTRUCTIONS,
    });
    expect(res.success).toBe(true);
    expect(svc.captured.update?.data.contracting_metadata).toEqual(
      INSTRUCTIONS,
    );
  });

  it("updateFromForm can clear instructions back to null", async () => {
    await svc.service.updateFromForm("c-1", {
      name: "Test Carrier",
      contracting_metadata: null,
    });
    expect(svc.captured.update?.data).toHaveProperty(
      "contracting_metadata",
      null,
    );
  });

  it("updateFromForm leaves contracting_metadata untouched when omitted", async () => {
    await svc.service.updateFromForm("c-1", { name: "Renamed" });
    expect(svc.captured.update?.data).not.toHaveProperty(
      "contracting_metadata",
    );
  });
});
