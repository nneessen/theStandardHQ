// src/features/settings/products/components/ProductForm.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/types/product.types";
import { useCarriers } from "../../carriers/hooks/useCarriers";
import type { Database } from "@/types/database.types";
import { Check, ChevronsUpDown } from "lucide-react";
import { useImo } from "@/contexts/ImoContext";
import { useAllActiveImos } from "@/hooks/imo";
import { UnderwritingConstraintsEditor } from "./UnderwritingConstraintsEditor";
import { ProductBuildChartSelector } from "./ProductBuildTableEditor";
import type { ProductUnderwritingConstraints } from "@/features/underwriting";
import {
  VALID_TERM_LENGTHS,
  type TermCommissionModifiers,
  type ProductMetadata,
} from "@/types/product.types";

type ProductType = Database["public"]["Enums"]["product_type"];

const PRODUCT_TYPES: ProductType[] = [
  "term_life",
  "whole_life",
  "universal_life",
  "variable_life",
  "indexed_universal_life",
  "participating_whole_life",
  "health",
  "disability",
  "annuity",
];

const productFormSchema = z.object({
  carrier_id: z.string().min(1, "Please select a carrier"),
  name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Name is too long"),
  product_type: z.enum([
    "term_life",
    "whole_life",
    "universal_life",
    "variable_life",
    "indexed_universal_life",
    "participating_whole_life",
    "health",
    "disability",
    "annuity",
  ]),
  is_active: z.boolean(),
  imo_id: z.string().optional(),
  build_chart_id: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSubmit: (data: ProductFormValues) => void;
  isSubmitting?: boolean;
}

export function ProductForm({
  open,
  onOpenChange,
  product,
  onSubmit,
  isSubmitting = false,
}: ProductFormProps) {
  const { carriers } = useCarriers();
  const { isSuperAdmin, imo } = useImo();
  const { data: allImos = [] } = useAllActiveImos({ enabled: isSuperAdmin });
  const [carrierSearchOpen, setCarrierSearchOpen] = useState(false);
  const [underwritingConstraints, setUnderwritingConstraints] =
    useState<ProductUnderwritingConstraints | null>(null);
  const [termModifiers, setTermModifiers] =
    useState<TermCommissionModifiers | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      carrier_id: "",
      name: "",
      product_type: "term_life",
      is_active: true,
      imo_id: undefined,
      build_chart_id: null,
      metadata: null,
    },
  });

  // Reset form when product changes or dialog opens/closes
  useEffect(() => {
    if (product) {
      const existingMetadata = product.metadata as ProductMetadata | null;
      // Extract underwriting constraints (everything except termCommissionModifiers)
      const existingConstraints = existingMetadata
        ? {
            ageTieredFaceAmounts: existingMetadata.ageTieredFaceAmounts,
            knockoutConditions: existingMetadata.knockoutConditions,
            fullUnderwritingThreshold:
              existingMetadata.fullUnderwritingThreshold,
          }
        : null;
      setUnderwritingConstraints(
        existingConstraints as ProductUnderwritingConstraints | null,
      );
      // Extract term commission modifiers
      setTermModifiers(existingMetadata?.termCommissionModifiers || null);
      form.reset({
        carrier_id: product.carrier_id || "",
        name: product.name || "",
        product_type: product.product_type || "term_life",
        is_active: product.is_active ?? true,
        imo_id: product.imo_id || undefined,
        build_chart_id: product.build_chart_id || null,
        metadata: product.metadata || null,
      });
    } else {
      setUnderwritingConstraints(null);
      setTermModifiers(null);
      form.reset({
        carrier_id: "",
        name: "",
        product_type: "term_life",
        is_active: true,
        // Default to user's IMO for new products
        imo_id: imo?.id || undefined,
        build_chart_id: null,
        metadata: null,
      });
    }
  }, [product, open, form, imo?.id]);

  const handleSubmit = (data: ProductFormValues) => {
    // Merge underwriting constraints and term modifiers into metadata
    const hasConstraints =
      underwritingConstraints &&
      (underwritingConstraints.ageTieredFaceAmounts ||
        underwritingConstraints.knockoutConditions ||
        underwritingConstraints.fullUnderwritingThreshold);
    const hasTermModifiers =
      termModifiers &&
      Object.values(termModifiers).some((v) => v !== undefined && v !== 0);

    // Build metadata object with both constraints and term modifiers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metadata: Record<string, any> | null = null;

    if (hasConstraints || hasTermModifiers) {
      metadata = {};
      if (hasConstraints && underwritingConstraints) {
        // Copy underwriting constraints directly
        Object.assign(metadata, underwritingConstraints);
      }
      if (hasTermModifiers && termModifiers) {
        metadata.termCommissionModifiers = termModifiers;
      }
    }

    onSubmit({ ...data, metadata });
  };

  const selectedCarrier = carriers.find(
    (c) => c.id === form.watch("carrier_id"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-4 bg-v2-card border-v2-ring">
        <DialogHeader className="space-y-1 pb-3 border-b border-v2-ring/60">
          <DialogTitle className="text-sm font-semibold text-v2-ink">
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            {product
              ? "Update product information. Changes will affect commission calculations."
              : "Create a new insurance product under a carrier."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="max-h-[60vh] overflow-y-auto py-3 pr-2">
              {/* Two-column grid for basic fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="carrier_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-1">
                        <FormLabel className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                          Carrier *
                        </FormLabel>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={carrierSearchOpen}
                            className="w-full justify-between h-7 text-[11px] bg-v2-card border-v2-ring"
                            onClick={() =>
                              setCarrierSearchOpen(!carrierSearchOpen)
                            }
                          >
                            {selectedCarrier
                              ? selectedCarrier.name
                              : "Select carrier..."}
                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                          {carrierSearchOpen && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border border-v2-ring bg-v2-card p-0 shadow-md">
                              <Command>
                                <CommandInput
                                  placeholder="Search carriers..."
                                  className="h-7 text-[11px]"
                                />
                                <CommandEmpty className="text-[11px] py-2 text-center">
                                  No carrier found.
                                </CommandEmpty>
                                <CommandGroup className="max-h-48 overflow-auto">
                                  {carriers
                                    .filter((c) => c.is_active)
                                    .map((carrier) => (
                                      <CommandItem
                                        key={carrier.id}
                                        value={carrier.name}
                                        className="text-[11px]"
                                        onSelect={() => {
                                          form.setValue(
                                            "carrier_id",
                                            carrier.id,
                                          );
                                          setCarrierSearchOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-3 w-3 ${
                                            carrier.id === field.value
                                              ? "opacity-100"
                                              : "opacity-0"
                                          }`}
                                        />
                                        {carrier.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </Command>
                            </div>
                          )}
                        </div>
                        <FormDescription className="text-[10px] text-v2-ink-subtle">
                          The insurance carrier for this product
                        </FormDescription>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                          Product Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Whole Life 0-75"
                            {...field}
                            value={field.value || ""}
                            className="h-7 text-[11px] bg-v2-card border-v2-ring"
                          />
                        </FormControl>
                        <FormDescription className="text-[10px] text-v2-ink-subtle">
                          The specific product name
                        </FormDescription>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_type"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                          Product Type *
                        </FormLabel>
                        <div className="flex flex-wrap gap-1">
                          {PRODUCT_TYPES.map((type) => (
                            <Badge
                              key={type}
                              variant={
                                field.value === type ? "default" : "outline"
                              }
                              className="cursor-pointer text-[10px] h-5 px-1.5"
                              onClick={() => field.onChange(type)}
                            >
                              {type.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                        <FormDescription className="text-[10px] text-v2-ink-subtle">
                          Select the insurance product type
                        </FormDescription>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  {/* IMO Selector - Only shown for super admins */}
                  {isSuperAdmin && allImos.length > 0 && (
                    <FormField
                      control={form.control}
                      name="imo_id"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                            IMO *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-7 text-[11px] bg-v2-card border-v2-ring">
                                <SelectValue placeholder="Select IMO" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allImos.map((imoOption) => (
                                <SelectItem
                                  key={imoOption.id}
                                  value={imoOption.id}
                                  className="text-[11px]"
                                >
                                  {imoOption.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[10px] text-v2-ink-subtle">
                            Which IMO this product belongs to
                          </FormDescription>
                          <FormMessage className="text-[10px]" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-v2-ring p-2">
                        <div className="space-y-0.5">
                          <FormLabel className="text-[11px] font-medium text-v2-ink">
                            Active Status
                          </FormLabel>
                          <FormDescription className="text-[10px] text-v2-ink-muted">
                            Inactive products won't appear in dropdowns
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Build Chart Section */}
                  <ProductBuildChartSelector
                    carrierId={form.watch("carrier_id") || null}
                    carrierName={selectedCarrier?.name || "No Carrier"}
                    value={form.watch("build_chart_id") || null}
                    onChange={(chartId) =>
                      form.setValue("build_chart_id", chartId)
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Underwriting Constraints - Full width below grid */}
              <Separator className="my-4" />
              <UnderwritingConstraintsEditor
                value={underwritingConstraints}
                onChange={setUnderwritingConstraints}
                disabled={isSubmitting}
              />

              {/* Term Commission Modifiers - Only show for term_life products */}
              {form.watch("product_type") === "term_life" && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-semibold text-v2-ink">
                          Term Commission Modifiers
                        </h4>
                        <p className="text-[10px] text-v2-ink-muted">
                          Adjust commission rates based on term length (e.g.,
                          -0.10 for 10% reduction)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 p-3 bg-v2-canvas rounded-lg border border-v2-ring">
                      {VALID_TERM_LENGTHS.map((term) => (
                        <div key={term} className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-v2-ink-muted text-center">
                            {term} yr
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="-1"
                            max="1"
                            placeholder="0"
                            disabled={isSubmitting}
                            className="h-7 text-[11px] text-center bg-v2-card border-v2-ring"
                            value={termModifiers?.[term] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue =
                                value === "" ? undefined : parseFloat(value);
                              setTermModifiers((prev) => ({
                                ...prev,
                                [term]: numValue,
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-v2-ink-subtle italic">
                      Formula: Final Rate = Comp Guide Rate × (1 + modifier).
                      Example: -0.10 modifier with 95% rate = 85.5%
                    </p>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-1 pt-3 border-t border-v2-ring/60 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px] border-v2-ring"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px]"
              >
                {isSubmitting
                  ? "Saving..."
                  : product
                    ? "Update Product"
                    : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
