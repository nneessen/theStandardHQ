// src/features/hierarchy/components/analytics/TeamProductMatrix.tsx

import React from "react";
import { cn } from "@/lib/utils";
import type { TeamCarrierBreakdown } from "@/types/team-analytics.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamProductMatrixProps {
  data: TeamCarrierBreakdown[];
  isLoading?: boolean;
}

/**
 * TeamProductMatrix - Product performance matrix for team
 *
 * Shows product performance across the team with:
 * - Policy count per product
 * - Total and average premium
 * - Commission rates
 */
export function TeamProductMatrix({ data, isLoading }: TeamProductMatrixProps) {
  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Team Product Mix
        </div>
        <div className="p-3 text-center text-[10px] text-v2-ink-muted">
          Loading...
        </div>
      </div>
    );
  }

  // Aggregate products across all carriers
  const productMap = new Map<
    string,
    {
      name: string;
      policyCount: number;
      totalPremium: number;
      totalCommission: number;
      carriers: string[];
    }
  >();

  data.forEach((carrier) => {
    carrier.products.forEach((product) => {
      const existing = productMap.get(product.name) || {
        name: product.name,
        policyCount: 0,
        totalPremium: 0,
        totalCommission: 0,
        carriers: [],
      };
      existing.policyCount += product.policyCount;
      existing.totalPremium += product.totalPremium;
      existing.totalCommission += product.totalCommission;
      if (!existing.carriers.includes(carrier.carrierName)) {
        existing.carriers.push(carrier.carrierName);
      }
      productMap.set(product.name, existing);
    });
  });

  // Convert to array and sort by total premium
  const products = Array.from(productMap.values())
    .map((p) => ({
      ...p,
      avgPremium: p.policyCount > 0 ? p.totalPremium / p.policyCount : 0,
      avgCommissionRate:
        p.totalPremium > 0 ? (p.totalCommission / p.totalPremium) * 100 : 0,
    }))
    .sort((a, b) => b.totalPremium - a.totalPremium);

  // Calculate total premium for percentage
  const totalPremium = products.reduce((sum, p) => sum + p.totalPremium, 0);

  // Format product names
  const formatProductName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Team Product Mix
        </div>
        <span className="text-[10px] text-v2-ink-subtle">
          {products.length} products
        </span>
      </div>

      {products.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-v2-ring">
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                Product
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Total
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Avg
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Mix %
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.slice(0, 10).map((product, idx) => {
              const mixPercent =
                totalPremium > 0
                  ? (product.totalPremium / totalPremium) * 100
                  : 0;
              return (
                <TableRow
                  key={idx}
                  className="border-b border-v2-ring/60 hover:bg-v2-canvas"
                >
                  <TableCell className="p-1.5">
                    <div className="font-medium text-v2-ink">
                      {formatProductName(product.name)}
                    </div>
                    <div className="text-[9px] text-v2-ink-subtle truncate">
                      {product.carriers.slice(0, 2).join(", ")}
                      {product.carriers.length > 2 &&
                        ` +${product.carriers.length - 2}`}
                    </div>
                  </TableCell>
                  <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                    {product.policyCount}
                  </TableCell>
                  <TableCell className="p-1.5 text-right font-mono font-semibold text-v2-ink">
                    {formatCurrency(product.totalPremium)}
                  </TableCell>
                  <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                    {formatCurrency(product.avgPremium)}
                  </TableCell>
                  <TableCell className="p-1.5 text-right">
                    <span
                      className={cn(
                        "font-mono",
                        mixPercent >= 20
                          ? "text-success font-bold"
                          : mixPercent >= 10
                            ? "text-warning"
                            : "text-v2-ink-muted",
                      )}
                    >
                      {mixPercent.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-v2-ink-subtle">
          No product data available
        </div>
      )}
    </div>
  );
}
