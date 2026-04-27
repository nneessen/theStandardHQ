// src/features/underwriting/components/RateEntry/RateEntryTab.tsx
// Tab for managing premium matrix entries (age × face amount grid)

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, CheckCircle2, Upload } from "lucide-react";
import { RateImportDialog } from "./RateImportDialog";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";
import { useProductsWithPremiumMatrix } from "../../hooks/rates/usePremiumMatrix";
import { PremiumMatrixGrid } from "./PremiumMatrixGrid";
import type { CarrierWithProducts } from "../../types/underwriting.types";

export function RateEntryTab() {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const {
    data: carriers,
    isLoading: loadingCarriers,
    refetch: refetchCarriers,
  } = useCarriersWithProducts();
  const { data: productsWithPremiums, refetch: refetchPremiums } =
    useProductsWithPremiumMatrix();

  // Handle import complete
  const handleImportComplete = () => {
    refetchCarriers();
    refetchPremiums();
  };

  // Filter to carriers that have products
  const carriersWithProducts = useMemo(() => {
    if (!carriers) return [];
    return carriers.filter((c) => c.products && c.products.length > 0);
  }, [carriers]);

  // Get selected carrier
  const selectedCarrier = useMemo(() => {
    return carriersWithProducts.find((c) => c.id === selectedCarrierId);
  }, [carriersWithProducts, selectedCarrierId]);

  // Get selected product
  const selectedProduct = useMemo(() => {
    return selectedCarrier?.products.find((p) => p.id === selectedProductId);
  }, [selectedCarrier, selectedProductId]);

  // Check if a product has premiums
  const productHasPremiums = (productId: string) => {
    return productsWithPremiums?.includes(productId) || false;
  };

  // Count products with premiums per carrier
  const getCarrierPremiumCount = (carrier: CarrierWithProducts) => {
    if (!productsWithPremiums) return 0;
    return carrier.products.filter((p) => productsWithPremiums.includes(p.id))
      .length;
  };

  // Handle carrier change
  const handleCarrierChange = (carrierId: string) => {
    setSelectedCarrierId(carrierId);
    setSelectedProductId(""); // Reset product selection
  };

  if (loadingCarriers) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[11px] font-medium text-v2-ink dark:text-v2-ink flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Premium Rate Entry
          </h3>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5">
            Enter monthly premium amounts for each age and face amount
            combination
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="h-3 w-3 mr-1.5" />
          Import CSV
        </Button>
      </div>

      {/* Carrier & Product Selectors */}
      <div className="flex items-end gap-3">
        {/* Carrier */}
        <div className="flex-1 max-w-[200px]">
          <label className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1 block">
            Carrier
          </label>
          <Select value={selectedCarrierId} onValueChange={handleCarrierChange}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Select carrier..." />
            </SelectTrigger>
            <SelectContent>
              {carriersWithProducts.map((carrier) => {
                const premiumCount = getCarrierPremiumCount(carrier);
                return (
                  <SelectItem
                    key={carrier.id}
                    value={carrier.id}
                    className="text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span>{carrier.name}</span>
                      {premiumCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4"
                        >
                          {premiumCount}/{carrier.products.length}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Product */}
        <div className="flex-1 max-w-[250px]">
          <label className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1 block">
            Product
          </label>
          <Select
            value={selectedProductId}
            onValueChange={setSelectedProductId}
            disabled={!selectedCarrierId}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue
                placeholder={
                  selectedCarrierId
                    ? "Select product..."
                    : "Select carrier first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {selectedCarrier?.products.map((product) => {
                const hasPremiums = productHasPremiums(product.id);
                return (
                  <SelectItem
                    key={product.id}
                    value={product.id}
                    className="text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span>{product.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        {product.product_type.replace("_", " ")}
                      </Badge>
                      {hasPremiums && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Progress Badge */}
        {productsWithPremiums && productsWithPremiums.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle pb-0.5">
            <span className="font-medium text-v2-ink dark:text-v2-ink-muted">
              {productsWithPremiums.length}
            </span>
            products with rates
          </div>
        )}
      </div>

      {/* Premium Matrix Grid */}
      {selectedProduct && selectedCarrier ? (
        <PremiumMatrixGrid
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          productType={selectedProduct.product_type}
          carrierName={selectedCarrier.name}
        />
      ) : (
        <div className="border border-v2-ring dark:border-v2-ring rounded-md py-8 text-center">
          <DollarSign className="h-8 w-8 mx-auto mb-2 text-v2-ink-subtle dark:text-v2-ink" />
          <p className="text-[11px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
            Select a carrier and product to enter rates
          </p>
          <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted mt-1">
            Or use{" "}
            <button
              onClick={() => setImportDialogOpen(true)}
              className="text-blue-500 hover:underline"
            >
              Import CSV
            </button>{" "}
            to bulk import from Insurance Toolkits
          </p>
        </div>
      )}

      {/* Import Dialog */}
      <RateImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
