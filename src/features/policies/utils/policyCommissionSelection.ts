// src/features/policies/utils/policyCommissionSelection.ts
//
// Canonical "which commission represents this policy?" logic. A single policy
// can have multiple commission rows (e.g. an original advance plus a later
// terminal `charged_back`/`clawback` row). The list view, mobile view, and CSV/
// Excel export must all agree on the ONE commission they surface per policy —
// otherwise the table shows one amount and the export shows another.

import type { Commission } from "@/types/commission.types";
import { isCollectibleCommissionStatus } from "@/types/commission.types";

/**
 * Returns true if `candidate` should replace `current` as a policy's primary
 * commission. Ordering, highest priority first:
 *   1. Collectible status beats terminal status.
 *   2. Within the same priority bucket, the higher `amount` wins.
 *   3. Deterministic tie-break: lower `id` (lexicographic) wins, so the result
 *      is stable regardless of input array order.
 */
function isBetterPrimary(candidate: Commission, current: Commission): boolean {
  const candidateCollectible = isCollectibleCommissionStatus(candidate.status);
  const currentCollectible = isCollectibleCommissionStatus(current.status);

  if (candidateCollectible !== currentCollectible) {
    return candidateCollectible;
  }

  const candidateAmount = candidate.amount || 0;
  const currentAmount = current.amount || 0;
  if (candidateAmount !== currentAmount) {
    return candidateAmount > currentAmount;
  }

  return candidate.id < current.id;
}

/**
 * Builds a `policyId -> primary Commission` map using the canonical selection
 * rules above. Commissions with no `policyId` are skipped (they can't be tied to
 * a row in the table). Policies without any commission are simply absent from
 * the map.
 */
export function selectPrimaryCommissionsByPolicy(
  commissions: Commission[],
): Map<string, Commission> {
  const byPolicy = new Map<string, Commission>();

  for (const commission of commissions) {
    if (!commission.policyId) continue;

    const existing = byPolicy.get(commission.policyId);
    if (!existing || isBetterPrimary(commission, existing)) {
      byPolicy.set(commission.policyId, commission);
    }
  }

  return byPolicy;
}
