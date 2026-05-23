import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/settings/products";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";
import type { Product, ProductFormData } from "@/types/product.types";

export function useProducts(imoId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { imo } = useImo();
  const queryImoId = imoId ?? imo?.id;

  // Fetch all products
  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products", queryImoId ?? "default"],
    queryFn: async (): Promise<Product[]> => {
      const result = imoId
        ? await productService.getAllForImo(imoId)
        : await productService.getAll();
      if (!result.success) throw result.error;
      return result.data || [];
    },
    enabled: options?.enabled ?? true,
  });

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const result = await productService.create(data);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Product created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });

  // Update product mutation
  const updateProduct = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ProductFormData>;
    }) => {
      const result = await productService.update(id, data);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Product updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const result = await productService.delete(id);
      if (!result.success) throw result.error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success("Product deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });

  // Bulk import products
  const bulkImportProducts = useMutation({
    mutationFn: async (products: ProductFormData[]) => {
      const result = await productService.bulkCreate(products);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success(`Successfully imported ${data?.length || 0} products`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import products: ${error.message}`);
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkImportProducts,
  };
}
