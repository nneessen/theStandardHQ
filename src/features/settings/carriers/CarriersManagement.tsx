// src/features/settings/carriers/CarriersManagement.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState, useMemo } from "react";
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
import { Plus, Search, Edit, Trash2, Building2, Ruler } from "lucide-react";
import { useCarriers, Carrier } from "./hooks/useCarriers";
import { useProducts } from "../products/hooks/useProducts";
import { CarrierForm } from "./components/CarrierForm";
import { CarrierDeleteDialog } from "./components/CarrierDeleteDialog";
import { BuildTableEditor } from "./components/BuildTableEditor";
import { NewCarrierForm } from "../../../types/carrier.types";

export function CarriersManagement() {
  const { carriers, isLoading, createCarrier, updateCarrier, deleteCarrier } =
    useCarriers();
  const { products } = useProducts();

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBuildTableOpen, setIsBuildTableOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  // Filter carriers based on search
  let filteredCarriers = carriers;

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filteredCarriers = carriers.filter(
      (carrier) =>
        carrier.name.toLowerCase().includes(search) ||
        carrier.code?.toLowerCase().includes(search),
    );
  }

  // Compute product counts per carrier
  const productCountByCarrier = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const product of products) {
      counts[product.carrier_id] = (counts[product.carrier_id] || 0) + 1;
    }
    return counts;
  }, [products]);

  // Count products per carrier
  const getProductCount = (carrierId: string) => {
    return productCountByCarrier[carrierId] || 0;
  };

  const handleAddCarrier = () => {
    setSelectedCarrier(null);
    setIsFormOpen(true);
  };

  const handleEditCarrier = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setIsDeleteDialogOpen(true);
  };

  const handleBuildTableClick = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setIsBuildTableOpen(true);
  };

  const handleFormSubmit = async (data: NewCarrierForm) => {
    if (selectedCarrier) {
      await updateCarrier.mutateAsync({ id: selectedCarrier.id, data });
    } else {
      await createCarrier.mutateAsync(data);
    }
    setIsFormOpen(false);
    setSelectedCarrier(null);
  };

  const handleDeleteConfirm = async () => {
    if (selectedCarrier) {
      await deleteCarrier.mutateAsync(selectedCarrier.id);
      setIsDeleteDialogOpen(false);
      setSelectedCarrier(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading carriers...
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
            <Building2 className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Carriers
              </h3>
              <p className="text-[10px] text-v2-ink-muted">
                Manage insurance carriers and their information
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={handleAddCarrier}
          >
            <Plus className="h-3 w-3 mr-1" />
            New Carrier
          </Button>
        </div>

        <div className="p-3 space-y-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-v2-ink-subtle" />
            <Input
              type="text"
              placeholder="Search carriers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-[11px] bg-v2-card border-v2-ring"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden border border-v2-ring">
            <Table>
              <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                <TableRow className="border-b border-v2-ring hover:bg-transparent">
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                    Carrier Name
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[120px]">
                    Short Name
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[80px]">
                    # Products
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
                {filteredCarriers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-[11px] text-v2-ink-muted py-6"
                    >
                      {searchTerm
                        ? "No carriers found matching your search."
                        : 'No carriers yet. Click "New Carrier" to add one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCarriers.map((carrier) => (
                    <TableRow
                      key={carrier.id}
                      className="hover:bg-v2-canvas border-b border-v2-ring/60"
                    >
                      <TableCell className="py-1.5">
                        <span className="font-medium text-[11px] text-v2-ink">
                          {carrier.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-[11px] text-v2-ink-muted">
                          {carrier.code || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-[11px] text-v2-ink-muted">
                          {getProductCount(carrier.id)}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge
                          variant={carrier.is_active ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1"
                        >
                          {carrier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                            onClick={() => handleBuildTableClick(carrier)}
                            title="Edit build table for rating class determination"
                          >
                            <Ruler className="h-2.5 w-2.5 mr-0.5" />
                            <span className="text-[10px]">Build</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                            onClick={() => handleEditCarrier(carrier)}
                          >
                            <Edit className="h-2.5 w-2.5 mr-0.5" />
                            <span className="text-[10px]">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                            onClick={() => handleDeleteClick(carrier)}
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

      {/* Form Sheet */}
      <CarrierForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        carrier={selectedCarrier}
        onSubmit={handleFormSubmit}
        isSubmitting={createCarrier.isPending || updateCarrier.isPending}
      />

      {/* Delete Dialog */}
      <CarrierDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        carrier={selectedCarrier}
        productCount={selectedCarrier ? getProductCount(selectedCarrier.id) : 0}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteCarrier.isPending}
      />

      {/* Build Table Editor */}
      <BuildTableEditor
        open={isBuildTableOpen}
        onOpenChange={setIsBuildTableOpen}
        carrier={selectedCarrier}
      />
    </>
  );
}
