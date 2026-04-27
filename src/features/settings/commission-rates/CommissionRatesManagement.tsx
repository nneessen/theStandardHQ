// src/features/settings/commission-rates/CommissionRatesManagement.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Upload, Percent } from "lucide-react";
import { toast } from "sonner";
import {
  useCommissionRates,
  ProductWithRates,
  CreateRateData,
} from "./hooks/useCommissionRates";
import { useCarriers } from "../carriers/hooks/useCarriers";
import { useProducts } from "../products/hooks/useProducts";
import { RateEditDialog } from "./components/RateEditDialog";
import { RateBulkImport } from "./components/RateBulkImport";
import type { Database } from "@/types/database.types";
import { useImo } from "@/contexts/ImoContext";
import { useAllActiveImos } from "@/hooks/imo";

type ProductType = Database["public"]["Enums"]["product_type"];

// NOTE: should PRODUCT_TYPES not already be a type thats stored in src/types/?
// why are creating types within files like this? this type literally is used throughout the app, and
// this is a concern for future bugs bc you're coding this in multiple places
const PRODUCT_TYPES: ProductType[] = [
  "term_life",
  "whole_life",
  "participating_whole_life",
  "universal_life",
  "indexed_universal_life",
  "variable_life",
  "health",
  "disability",
  "annuity",
];

// FFG IMO ID constant
const FFG_IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

export function CommissionRatesManagement() {
  const { isSuperAdmin, imo } = useImo();
  const { data: allImos = [] } = useAllActiveImos({ enabled: isSuperAdmin });

  // Default to FFG for super admins, otherwise use user's IMO
  const [filterImoId, setFilterImoId] = useState<string>("");

  // Set default IMO on mount
  useEffect(() => {
    if (isSuperAdmin) {
      // Default to FFG for super admins
      setFilterImoId(FFG_IMO_ID);
    } else if (imo?.id) {
      setFilterImoId(imo.id);
    }
  }, [isSuperAdmin, imo?.id]);

  const {
    productsWithRates,
    isLoading,
    createRate,
    updateRate,
    deleteRate,
    getProductRates,
  } = useCommissionRates({ imoId: filterImoId || undefined });

  const { carriers } = useCarriers();
  const { products } = useProducts();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCarrierId, setFilterCarrierId] = useState("");
  const [filterProductType, setFilterProductType] = useState<ProductType | "">(
    "",
  );
  const [showEmptyOnly, setShowEmptyOnly] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithRates | null>(null);

  // Filter products
  let filteredProducts = productsWithRates;

  if (filterCarrierId) {
    filteredProducts = filteredProducts.filter(
      (p) => p.carrierId === filterCarrierId,
    );
  }

  if (filterProductType) {
    filteredProducts = filteredProducts.filter(
      (p) => p.productType === filterProductType,
    );
  }

  if (showEmptyOnly) {
    filteredProducts = filteredProducts.filter(
      (p) => Object.keys(p.rates).length === 0,
    );
  }

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.productName.toLowerCase().includes(search) ||
        product.carrierName.toLowerCase().includes(search),
    );
  }

  const handleEditRates = (product: ProductWithRates) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleSaveRates = async (
    productId: string,
    rates: Record<number, number>,
  ) => {
    try {
      // Get existing rates for this product
      const existingRates = await getProductRates(productId);
      const existingRatesByLevel = new Map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rate data type
        existingRates.map((r: any) => [r.contract_level, r.id]),
      );

      const product = products.find((p) => p.id === productId);
      if (!product) {
        throw new Error("Product not found");
      }

      // Update or create rates
      const promises = Object.entries(rates).map(
        async ([level, percentage]) => {
          const contractLevel = Number(level);
          const existingRateId = existingRatesByLevel.get(contractLevel);

          if (existingRateId) {
            // Update existing rate
            await updateRate.mutateAsync({
              id: existingRateId,
              data: {
                commission_percentage: percentage / 100,
              },
            });
          } else {
            // Create new rate
            const newRate: CreateRateData = {
              carrier_id: product.carrier_id,
              product_id: productId,
              product_type: product.product_type,
              contract_level: contractLevel,
              commission_percentage: percentage / 100,
              effective_date: new Date().toISOString().split("T")[0],
            };
            await createRate.mutateAsync(newRate);
          }
        },
      );

      // Delete rates that were removed
      const levelsToKeep = new Set(Object.keys(rates).map(Number));
      const ratesToDelete = existingRates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rate data type
        (r: any) => !levelsToKeep.has(r.contract_level),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rate data type
      const deletePromises = ratesToDelete.map((r: any) =>
        deleteRate.mutateAsync(r.id),
      );

      await Promise.all([...promises, ...deletePromises]);

      // Show single success toast after all operations complete
      const totalChanges = promises.length + deletePromises.length;
      toast.success(
        `Successfully saved ${totalChanges} commission rate${totalChanges !== 1 ? "s" : ""}`,
      );

      setIsEditDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error("Failed to save rates:", error);
      toast.error("Failed to save some commission rates");
    }
  };

  const handleBulkImport = async (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const ratesToCreate: CreateRateData[] = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [productName, contractLevelStr, commissionStr] = line
          .split(",")
          .map((s) => s.trim());

        if (!productName || !contractLevelStr || !commissionStr) {
          alert(`Invalid data on line ${i + 1}: missing required fields`);
          return;
        }

        // Find product by name
        const product = products.find(
          (p) => p.name.toLowerCase() === productName.toLowerCase(),
        );

        if (!product) {
          alert(
            `Product "${productName}" not found on line ${i + 1}. Please create the product first.`,
          );
          return;
        }

        const contractLevel = parseInt(contractLevelStr);
        const commission = parseFloat(commissionStr);

        if (isNaN(contractLevel) || isNaN(commission)) {
          alert(`Invalid numbers on line ${i + 1}`);
          return;
        }

        if (commission < 0 || commission > 100) {
          alert(
            `Invalid commission percentage on line ${i + 1}: must be 0-100`,
          );
          return;
        }

        // Get existing rate for this product/level
        const existingRates = await getProductRates(product.id);
        const existingRate = existingRates.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rate data type
          (r: any) => r.contract_level === contractLevel,
        );

        if (existingRate) {
          // Update existing
          await updateRate.mutateAsync({
            id: existingRate.id,
            data: {
              commission_percentage: commission / 100,
            },
          });
        } else {
          // Create new
          ratesToCreate.push({
            carrier_id: product.carrier_id,
            product_id: product.id,
            product_type: product.product_type,
            contract_level: contractLevel,
            commission_percentage: commission / 100,
            effective_date: new Date().toISOString().split("T")[0],
          });
        }
      }

      // Create all new rates
      for (const rate of ratesToCreate) {
        await createRate.mutateAsync(rate);
      }

      // Show single success toast after all operations complete
      const totalImported = lines.length - 1; // Subtract header row
      toast.success(
        `Successfully imported ${totalImported} commission rate${totalImported !== 1 ? "s" : ""}`,
      );

      setIsBulkImportOpen(false);
    } catch (error) {
      console.error("Bulk import failed:", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading commission rates...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
          <div className="flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Commission Rates
              </h3>
              <p className="text-[10px] text-v2-ink-muted">
                Configure contract level commission percentages for each product
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setIsBulkImportOpen(true)}
          >
            <Upload className="h-3 w-3 mr-1" />
            Bulk Import
          </Button>
        </div>

        <div className="p-3 space-y-2">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* IMO Filter - Only for super admins */}
            {isSuperAdmin && allImos.length > 0 && (
              <Select
                value={filterImoId || "all"}
                onValueChange={(v) => setFilterImoId(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-48 h-7 text-[11px] bg-v2-card border-v2-ring">
                  <SelectValue placeholder="All IMOs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All IMOs</SelectItem>
                  {allImos.map((imoOption) => (
                    <SelectItem key={imoOption.id} value={imoOption.id}>
                      {imoOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-v2-ink-subtle" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
            <Select
              value={filterCarrierId || "all"}
              onValueChange={(v) => setFilterCarrierId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-36 h-7 text-[11px] bg-v2-card border-v2-ring">
                <SelectValue placeholder="All Carriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                {carriers.map((carrier) => (
                  <SelectItem key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterProductType || "all"}
              onValueChange={(v) =>
                setFilterProductType(v === "all" ? "" : (v as ProductType))
              }
            >
              <SelectTrigger className="w-36 h-7 text-[11px] bg-v2-card border-v2-ring">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PRODUCT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 px-2 h-7 border border-v2-ring rounded bg-v2-card">
              <Checkbox
                checked={showEmptyOnly}
                onCheckedChange={(checked) =>
                  setShowEmptyOnly(checked as boolean)
                }
                className="h-3 w-3"
              />
              <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Empty only
              </span>
            </label>
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden border border-v2-ring">
            <Table>
              <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                <TableRow className="border-b border-v2-ring hover:bg-transparent">
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                    Carrier
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                    Product
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                    Type
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px] text-center">
                    Rate Coverage
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[60px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-[11px] text-v2-ink-muted py-6"
                    >
                      {showEmptyOnly
                        ? "No products without rates found."
                        : searchTerm || filterCarrierId || filterProductType
                          ? "No products found matching your filters."
                          : "No products yet. Add products in the Products tab first."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const [filled, total] = product.rateCoverage
                      .split("/")
                      .map(Number);
                    const isComplete = filled === total;
                    const isEmpty = filled === 0;

                    return (
                      <TableRow
                        key={product.productId}
                        className="hover:bg-v2-canvas border-b border-v2-ring/60"
                      >
                        <TableCell className="py-1.5">
                          <span className="font-medium text-[11px] text-v2-ink">
                            {product.carrierName}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="text-[11px] text-v2-ink-muted">
                            {product.productName}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 border-v2-ring dark:border-v2-ring"
                          >
                            {product.productType.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Badge
                            variant={
                              isComplete
                                ? "default"
                                : isEmpty
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[10px] h-4 px-1"
                          >
                            {product.rateCoverage}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                            onClick={() => handleEditRates(product)}
                          >
                            <Edit className="h-2.5 w-2.5 mr-0.5" />
                            <span className="text-[10px]">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Edit Rates Dialog */}
      <RateEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={selectedProduct}
        onSave={handleSaveRates}
        isSaving={
          createRate.isPending || updateRate.isPending || deleteRate.isPending
        }
      />

      {/* Bulk Import Dialog */}
      <RateBulkImport
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImport={handleBulkImport}
        isImporting={createRate.isPending}
      />
    </>
  );
}
