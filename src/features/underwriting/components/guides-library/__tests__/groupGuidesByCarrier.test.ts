import { describe, expect, it } from "vitest";
import {
  groupGuidesByCarrier,
  type GuideWithCarrier,
} from "../groupGuidesByCarrier";

function makeGuide(partial: {
  id: string;
  carrier_id: string;
  name: string;
  created_at?: string | null;
  carrierName?: string | null;
}): GuideWithCarrier {
  return {
    id: partial.id,
    carrier_id: partial.carrier_id,
    name: partial.name,
    created_at: partial.created_at ?? null,
    carrier:
      partial.carrierName === undefined
        ? { id: partial.carrier_id, name: "Carrier " + partial.carrier_id }
        : partial.carrierName === null
          ? null
          : { id: partial.carrier_id, name: partial.carrierName },
    // Remaining table columns are unused by the grouping logic.
    file_name: `${partial.name}.pdf`,
    storage_path: `imo/${partial.carrier_id}/${partial.id}.pdf`,
    file_size_bytes: 1024,
    imo_id: "imo-1",
    uploaded_by: null,
    version: null,
    effective_date: null,
    expiration_date: null,
    parsing_status: "pending",
    parsed_content: null,
    content_hash: null,
    parsing_error: null,
    updated_at: null,
  } as GuideWithCarrier;
}

describe("groupGuidesByCarrier", () => {
  it("returns an empty array for no guides", () => {
    expect(groupGuidesByCarrier([])).toEqual([]);
  });

  it("groups multiple guides under the same carrier", () => {
    const groups = groupGuidesByCarrier([
      makeGuide({
        id: "a",
        carrier_id: "c1",
        name: "Term",
        carrierName: "Americo",
      }),
      makeGuide({
        id: "b",
        carrier_id: "c1",
        name: "IUL",
        carrierName: "Americo",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].carrierId).toBe("c1");
    expect(groups[0].carrierName).toBe("Americo");
    expect(groups[0].guides).toHaveLength(2);
  });

  it("keeps a single-guide carrier as its own group", () => {
    const groups = groupGuidesByCarrier([
      makeGuide({
        id: "a",
        carrier_id: "c1",
        name: "Term",
        carrierName: "Americo",
      }),
      makeGuide({
        id: "b",
        carrier_id: "c2",
        name: "FE",
        carrierName: "Mutual",
      }),
    ]);
    const mutual = groups.find((g) => g.carrierId === "c2");
    expect(mutual?.guides).toHaveLength(1);
  });

  it("sorts carriers alphabetically (case-insensitive)", () => {
    const groups = groupGuidesByCarrier([
      makeGuide({ id: "a", carrier_id: "c1", name: "g", carrierName: "zebra" }),
      makeGuide({
        id: "b",
        carrier_id: "c2",
        name: "g",
        carrierName: "Americo",
      }),
      makeGuide({
        id: "c",
        carrier_id: "c3",
        name: "g",
        carrierName: "mutual",
      }),
    ]);
    expect(groups.map((g) => g.carrierName)).toEqual([
      "Americo",
      "mutual",
      "zebra",
    ]);
  });

  it("sorts guides within a carrier newest-first by created_at", () => {
    const groups = groupGuidesByCarrier([
      makeGuide({
        id: "old",
        carrier_id: "c1",
        name: "Old",
        carrierName: "Americo",
        created_at: "2026-01-01T00:00:00Z",
      }),
      makeGuide({
        id: "new",
        carrier_id: "c1",
        name: "New",
        carrierName: "Americo",
        created_at: "2026-06-01T00:00:00Z",
      }),
    ]);
    expect(groups[0].guides.map((g) => g.id)).toEqual(["new", "old"]);
  });

  it("falls back to 'Unknown carrier' when the carrier relation is missing", () => {
    const groups = groupGuidesByCarrier([
      makeGuide({ id: "a", carrier_id: "c1", name: "Term", carrierName: null }),
    ]);
    expect(groups[0].carrierName).toBe("Unknown carrier");
  });
});
