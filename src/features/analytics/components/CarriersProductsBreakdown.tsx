// src/features/analytics/components/CarriersProductsBreakdown.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { useAnalyticsData } from "../../../hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CarrierProductData {
  carrier: string;
  products: {
    name: string;
    policyCount: number;
    totalPremium: number;
    avgCommissionRate: number;
    totalCommissions: number;
  }[];
  totalPolicies: number;
  totalPremium: number;
  totalCommissions: number;
  avgCommissionRate: number;
}

/**
 * CarriersProductsBreakdown - Compact table view of carriers and products
 * Ultra-compact display with shared components
 */
export function CarriersProductsBreakdown() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Carriers & Products
        </div>
        <div className="p-3 text-center text-[10px] text-v2-ink-muted">
          Loading...
        </div>
      </div>
    );
  }

  // Create a map of carrier IDs to names
  const carrierIdToName = new Map<string, string>();
  raw.carriers?.forEach((carrier) => {
    carrierIdToName.set(carrier.id, carrier.name);
  });

  // Helper function to format product names
  const formatProductName = (product: string): string => {
    return product
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Build commission totals map — sum ALL commissions per policy (not just first)
  const commissionsByPolicy = new Map<string, number>();
  raw.commissions.forEach((c) => {
    if (c.policyId) {
      commissionsByPolicy.set(
        c.policyId,
        (commissionsByPolicy.get(c.policyId) || 0) + (c.amount || 0),
      );
    }
  });

  // Group data by carrier and product
  const carrierMap = new Map<string, CarrierProductData>();

  raw.policies.forEach((policy) => {
    const carrierName = policy.carrierId
      ? carrierIdToName.get(policy.carrierId) || "Unknown Carrier"
      : "Unknown Carrier";
    const product = policy.product
      ? formatProductName(policy.product)
      : "Unknown Product";
    const commissionTotal = commissionsByPolicy.get(policy.id) || 0;

    if (!carrierMap.has(carrierName)) {
      carrierMap.set(carrierName, {
        carrier: carrierName,
        products: [],
        totalPolicies: 0,
        totalPremium: 0,
        totalCommissions: 0,
        avgCommissionRate: 0,
      });
    }

    const carrierData = carrierMap.get(carrierName)!;

    // Find or create product entry
    let productData = carrierData.products.find((p) => p.name === product);
    if (!productData) {
      productData = {
        name: product,
        policyCount: 0,
        totalPremium: 0,
        avgCommissionRate: 0,
        totalCommissions: 0,
      };
      carrierData.products.push(productData);
    }

    // Update product metrics
    productData.policyCount++;
    productData.totalPremium += policy.annualPremium || 0;
    productData.totalCommissions += commissionTotal;
    if (productData.totalPremium > 0) {
      productData.avgCommissionRate =
        (productData.totalCommissions / productData.totalPremium) * 100;
    }

    // Update carrier totals
    carrierData.totalPolicies++;
    carrierData.totalPremium += policy.annualPremium || 0;
    carrierData.totalCommissions += commissionTotal;
  });

  // Calculate carrier average commission rates
  carrierMap.forEach((carrier) => {
    if (carrier.totalPremium > 0) {
      carrier.avgCommissionRate =
        (carrier.totalCommissions / carrier.totalPremium) * 100;
    }
  });

  // Sort carriers by total premium
  const sortedCarriers = Array.from(carrierMap.values()).sort(
    (a, b) => b.totalPremium - a.totalPremium,
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare flattened data for table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table data shape
  const tableData: any[] = [];
  sortedCarriers.forEach((carrier) => {
    // Add carrier summary row
    tableData.push({
      isCarrier: true,
      name: carrier.carrier,
      policies: carrier.totalPolicies,
      premium: carrier.totalPremium,
      avgRate: carrier.avgCommissionRate,
      commission: carrier.totalCommissions,
    });

    // Add product rows (top 3 products per carrier)
    carrier.products
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .slice(0, 3)
      .forEach((product) => {
        tableData.push({
          isCarrier: false,
          name: `  → ${product.name}`,
          policies: product.policyCount,
          premium: product.totalPremium,
          avgRate: product.avgCommissionRate,
          commission: product.totalCommissions,
        });
      });
  });

  const totalPremiumAcrossCarriers = sortedCarriers.reduce(
    (s, c) => s + c.totalPremium,
    0,
  );

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Carriers & Products
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            {sortedCarriers.length} carriers active
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-tight text-v2-ink leading-none">
            {formatCurrency(totalPremiumAcrossCarriers)}
          </div>
          <div className="text-[10px] text-v2-ink-subtle mt-1">
            total premium
          </div>
        </div>
      </div>

      {tableData.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-v2-ring">
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                Carrier / Product
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Premium
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Rate
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Commission
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-b border-v2-ring/60 hover:bg-v2-canvas"
              >
                <TableCell className="p-1.5">
                  <span
                    className={cn(
                      row.isCarrier
                        ? "font-semibold text-v2-ink"
                        : "text-[9px] text-v2-ink-muted",
                    )}
                  >
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                  {row.policies}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink">
                  {formatCurrency(row.premium)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-success">
                  {row.avgRate.toFixed(1)}%
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono font-semibold text-v2-ink">
                  {formatCurrency(row.commission)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-v2-ink-subtle">
          No carrier data available
        </div>
      )}
    </div>
  );
}
