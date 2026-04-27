// src/features/settings/products/ProductsManagement.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Upload, Package } from "lucide-react";
import { useProducts } from "./hooks/useProducts";
import { useCarriers } from "../carriers/hooks/useCarriers";
import { ProductForm } from "./components/ProductForm";
import { ProductBulkImport } from "./components/ProductBulkImport";
import type { Product, ProductFormData } from "@/types/product.types";

export function ProductsManagement() {
  const {
    products,
    isLoading,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkImportProducts,
  } = useProducts();
  const { carriers } = useCarriers();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCarrierId, setFilterCarrierId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filter products based on search and carrier filter
  let filteredProducts = products;

  if (filterCarrierId) {
    filteredProducts = filteredProducts.filter(
      (p) => p.carrier_id === filterCarrierId,
    );
  }

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter((product) =>
      product.name.toLowerCase().includes(search),
    );
  }

  // Get carrier name by ID
  const getCarrierName = (carrierId: string) => {
    return carriers.find((c) => c.id === carrierId)?.name || "Unknown";
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (data: ProductFormData) => {
    if (selectedProduct) {
      await updateProduct.mutateAsync({ id: selectedProduct.id, data });
    } else {
      await createProduct.mutateAsync(data);
    }
    setIsFormOpen(false);
    setSelectedProduct(null);
  };

  const handleDeleteConfirm = async () => {
    if (selectedProduct) {
      await deleteProduct.mutateAsync(selectedProduct.id);
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const handleBulkImport = async (productsData: ProductFormData[]) => {
    await bulkImportProducts.mutateAsync(productsData);
    setIsBulkImportOpen(false);
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading products...
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
            <Package className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Products
              </h3>
              <p className="text-[10px] text-v2-ink-muted">
                Manage insurance products and their details
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] border-v2-ring"
              onClick={() => setIsBulkImportOpen(true)}
            >
              <Upload className="h-3 w-3 mr-1" />
              Bulk Import
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleAddProduct}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Product
            </Button>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
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
              <SelectTrigger className="w-48 h-7 text-[11px] bg-v2-card border-v2-ring">
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
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden border border-v2-ring">
            <Table>
              <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                <TableRow className="border-b border-v2-ring hover:bg-transparent">
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                    Product Name
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[150px]">
                    Carrier
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[120px]">
                    Type
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[80px]">
                    Status
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[80px] text-right">
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
                      {searchTerm || filterCarrierId
                        ? "No products found matching your filters."
                        : 'No products yet. Click "New Product" to add one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-v2-canvas border-b border-v2-ring/60"
                    >
                      <TableCell className="py-1.5">
                        <span className="font-medium text-[11px] text-v2-ink">
                          {product.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-[11px] text-v2-ink-muted">
                          {getCarrierName(product.carrier_id)}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1 border-v2-ring dark:border-v2-ring"
                        >
                          {product.product_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge
                          variant={product.is_active ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1"
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-2.5 w-2.5 mr-0.5" />
                            <span className="text-[10px]">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <ProductForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={selectedProduct}
        onSubmit={handleFormSubmit}
        isSubmitting={createProduct.isPending || updateProduct.isPending}
      />

      {/* Bulk Import Dialog */}
      <ProductBulkImport
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImport={handleBulkImport}
        isImporting={bulkImportProducts.isPending}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-sm p-3 bg-v2-card border-v2-ring">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-sm font-semibold text-v2-ink">
              Delete Product?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-[11px]">
              <p className="text-v2-ink-muted dark:text-v2-ink-subtle">
                Are you sure you want to delete{" "}
                <strong className="text-v2-ink">{selectedProduct?.name}</strong>
                ?
              </p>
              <p className="text-[10px] text-v2-ink-muted">
                This will also delete all associated commission rates. This
                action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1 pt-3">
            <AlertDialogCancel
              disabled={deleteProduct.isPending}
              className="h-7 px-2 text-[10px] border-v2-ring bg-v2-card"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={deleteProduct.isPending}
              className="h-7 px-2 text-[10px] bg-red-600 text-white hover:bg-red-700"
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
