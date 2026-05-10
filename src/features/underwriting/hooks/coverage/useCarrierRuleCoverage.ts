import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";

export interface CarrierRuleCoverageRow {
  carrierId: string;
  carrierName: string;
  approvedRuleSets: number;
  pendingReviewRuleSets: number;
  guideCount: number;
  parsedGuideCount: number;
}

export const carrierRuleCoverageKeys = {
  byImo: (imoId: string | null | undefined) =>
    ["carrier-rule-coverage", imoId ?? "no-imo"] as const,
};

/**
 * Returns per-carrier rule-population stats so the admin can see at a glance
 * which carriers are at zero rules (need a UW guide upload + extract pass).
 *
 * Aggregates client-side across three small queries instead of an RPC because
 * carrier counts are bounded (~tens) and the queries hit narrow indexed columns.
 */
export function useCarrierRuleCoverage() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery<CarrierRuleCoverageRow[]>({
    queryKey: carrierRuleCoverageKeys.byImo(imoId),
    queryFn: async () => {
      if (!imoId) return [];

      // Active carriers visible to this IMO (org-specific OR global)
      const { data: carriers, error: carrierError } = await supabase
        .from("carriers")
        .select("id, name")
        .eq("is_active", true)
        .or(`imo_id.eq.${imoId},imo_id.is.null`);
      if (carrierError) throw carrierError;

      // Rule sets grouped client-side by carrier + status
      const { data: ruleSets, error: ruleSetsError } = await supabase
        .from("underwriting_rule_sets")
        .select("carrier_id, review_status, is_active")
        .eq("imo_id", imoId);
      if (ruleSetsError) throw ruleSetsError;

      // Guides grouped client-side by carrier + parsing status
      const { data: guides, error: guidesError } = await supabase
        .from("underwriting_guides")
        .select("carrier_id, parsing_status")
        .eq("imo_id", imoId);
      if (guidesError) throw guidesError;

      const approvedCounts = new Map<string, number>();
      const pendingCounts = new Map<string, number>();
      for (const rs of ruleSets ?? []) {
        if (!rs.carrier_id || rs.is_active === false) continue;
        if (rs.review_status === "approved") {
          approvedCounts.set(
            rs.carrier_id,
            (approvedCounts.get(rs.carrier_id) ?? 0) + 1,
          );
        } else if (rs.review_status === "pending_review") {
          pendingCounts.set(
            rs.carrier_id,
            (pendingCounts.get(rs.carrier_id) ?? 0) + 1,
          );
        }
      }

      const guideCounts = new Map<string, number>();
      const parsedGuideCounts = new Map<string, number>();
      for (const g of guides ?? []) {
        if (!g.carrier_id) continue;
        guideCounts.set(g.carrier_id, (guideCounts.get(g.carrier_id) ?? 0) + 1);
        if (g.parsing_status === "completed") {
          parsedGuideCounts.set(
            g.carrier_id,
            (parsedGuideCounts.get(g.carrier_id) ?? 0) + 1,
          );
        }
      }

      return (carriers ?? [])
        .map((c) => ({
          carrierId: c.id as string,
          carrierName: c.name as string,
          approvedRuleSets: approvedCounts.get(c.id as string) ?? 0,
          pendingReviewRuleSets: pendingCounts.get(c.id as string) ?? 0,
          guideCount: guideCounts.get(c.id as string) ?? 0,
          parsedGuideCount: parsedGuideCounts.get(c.id as string) ?? 0,
        }))
        .sort((a, b) => a.approvedRuleSets - b.approvedRuleSets);
    },
    enabled: !!imoId,
    staleTime: 60 * 1000,
  });
}
