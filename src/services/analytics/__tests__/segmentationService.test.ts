import { describe, it, expect } from "vitest";
import { segmentClientsByValue } from "../segmentationService";
import type { Policy } from "@/types";

function policy(p: {
  id?: string;
  name?: string;
  premium?: number;
  effectiveDate?: string;
}): Policy {
  return {
    id: p.id ?? "p1",
    status: "approved",
    effectiveDate: p.effectiveDate ?? "2025-01-15",
    annualPremium: p.premium ?? 1000,
    product: "term_life",
    client: { id: p.id, name: p.name ?? "Client", state: "TX", age: 40 },
  } as unknown as Policy;
}

describe("segmentClientsByValue", () => {
  it("keys clients by id — two distinct clients sharing a name are NOT merged", () => {
    const result = segmentClientsByValue([
      policy({ id: "c1", name: "John Smith", premium: 1000 }),
      policy({ id: "c2", name: "John Smith", premium: 2000 }),
    ]);
    expect(result.totalClients).toBe(2);
  });

  it("falls back to name when client.id is absent (legacy rows)", () => {
    const noId = (name: string, premium: number) =>
      ({
        id: "p",
        status: "approved",
        effectiveDate: "2025-01-15",
        annualPremium: premium,
        product: "term_life",
        client: { name, state: "TX", age: 40 },
      }) as unknown as Policy;
    const result = segmentClientsByValue([
      noId("Jane Doe", 1000),
      noId("Jane Doe", 2000),
    ]);
    expect(result.totalClients).toBe(1); // same name, no id → merged
  });

  it("avgPremiumByTier is premium-per-client (total ÷ clients), not avg-of-avgs", () => {
    // One client, two policies totalling $4,000 of annual premium → lands in
    // the 'low' tier when it's the only client.
    const result = segmentClientsByValue([
      policy({ id: "c1", name: "Solo", premium: 1000 }),
      policy({ id: "c1", name: "Solo", premium: 3000 }),
    ]);
    expect(result.totalClients).toBe(1);
    expect(result.totalPremiumByTier.low).toBe(4000);
    // Per-client average = 4000 / 1 = 4000 (the old double-average gave 2000:
    // the client's own per-policy average of (1000+3000)/2).
    expect(result.avgPremiumByTier.low).toBe(4000);
  });
});
