// Pure grouping helper for the Underwriting Guides library page.
// Turns the flat list returned by `useUnderwritingGuides` into per-carrier
// groups, sorted for stable display. Kept dependency-free so it is trivially
// unit-testable.

import type { UnderwritingGuide } from "../../types/underwriting.types";

/** A guide row with the carrier relation joined (as `useUnderwritingGuides` returns it). */
export interface GuideWithCarrier extends UnderwritingGuide {
  carrier?: { id: string; name: string } | null;
}

export interface CarrierGuideGroup {
  carrierId: string;
  carrierName: string;
  guides: GuideWithCarrier[];
}

function createdAtMs(value: string | null): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Group guides by carrier. Carriers with no guides are naturally absent (the
 * input only contains uploaded guides). Within each carrier guides are sorted
 * newest-first; carriers are sorted alphabetically (case-insensitive).
 */
export function groupGuidesByCarrier(
  guides: GuideWithCarrier[],
): CarrierGuideGroup[] {
  const byCarrier = new Map<string, CarrierGuideGroup>();

  for (const guide of guides) {
    const carrierId = guide.carrier_id;
    const carrierName = guide.carrier?.name?.trim() || "Unknown carrier";

    let group = byCarrier.get(carrierId);
    if (!group) {
      group = { carrierId, carrierName, guides: [] };
      byCarrier.set(carrierId, group);
    }
    group.guides.push(guide);
  }

  for (const group of byCarrier.values()) {
    group.guides.sort(
      (a, b) => createdAtMs(b.created_at) - createdAtMs(a.created_at),
    );
  }

  return Array.from(byCarrier.values()).sort((a, b) =>
    a.carrierName.localeCompare(b.carrierName, undefined, {
      sensitivity: "base",
    }),
  );
}
