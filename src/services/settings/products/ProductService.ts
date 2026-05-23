// src/services/settings/products/ProductService.ts
import { BaseService, type ServiceResponse } from "../../base/BaseService";
import { ProductRepository } from "./ProductRepository";
import type { Product, ProductFormData } from "@/types/product.types";
import type { Database } from "@/types/database.types";

// Type alias for product type enum from database
type ProductType = Database["public"]["Enums"]["product_type"];

// Type that combines Product with required fields from ProductFormData
type ProductEntity = Product;

/**
 * Service for product business logic
 * Extends BaseService for standard CRUD operations
 */
export class ProductService extends BaseService<
  ProductEntity,
  ProductFormData,
  Partial<ProductFormData>
> {
  constructor(repository: ProductRepository) {
    super(repository);
  }

  /**
   * Initialize validation rules for product data
   */
  protected initializeValidationRules(): void {
    this.validationRules = [
      {
        field: "carrier_id",
        validate: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "Carrier ID is required",
      },
      {
        field: "name",
        validate: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "Product name is required",
      },
      {
        field: "product_type",
        validate: (value) => {
          const validTypes: ProductType[] = [
            "term_life",
            "whole_life",
            "universal_life",
            "variable_life",
            "health",
            "disability",
            "annuity",
            "indexed_universal_life",
            "participating_whole_life",
          ];
          return validTypes.includes(value as ProductType);
        },
        message:
          "Invalid product type. Must be one of: term_life, whole_life, universal_life, variable_life, health, disability, annuity, indexed_universal_life, participating_whole_life",
      },
      {
        field: "min_premium",
        validate: (value, data) => {
          if (value === undefined || value === null) return true; // Optional field
          const minPremium = Number(value);
          const maxPremium = data?.max_premium
            ? Number(data.max_premium)
            : null;
          if (isNaN(minPremium) || minPremium < 0) return false;
          if (maxPremium !== null && minPremium > maxPremium) return false;
          return true;
        },
        message:
          "Min premium must be a non-negative number and less than or equal to max premium",
      },
      {
        field: "max_premium",
        validate: (value, data) => {
          if (value === undefined || value === null) return true; // Optional field
          const maxPremium = Number(value);
          const minPremium = data?.min_premium
            ? Number(data.min_premium)
            : null;
          if (isNaN(maxPremium) || maxPremium < 0) return false;
          if (minPremium !== null && maxPremium < minPremium) return false;
          return true;
        },
        message:
          "Max premium must be a non-negative number and greater than or equal to min premium",
      },
      {
        field: "min_age",
        validate: (value, data) => {
          if (value === undefined || value === null) return true; // Optional field
          const minAge = Number(value);
          const maxAge = data?.max_age ? Number(data.max_age) : null;
          if (isNaN(minAge) || minAge < 0 || minAge > 120) return false;
          if (maxAge !== null && minAge > maxAge) return false;
          return true;
        },
        message:
          "Min age must be between 0-120 and less than or equal to max age",
      },
      {
        field: "max_age",
        validate: (value, data) => {
          if (value === undefined || value === null) return true; // Optional field
          const maxAge = Number(value);
          const minAge = data?.min_age ? Number(data.min_age) : null;
          if (isNaN(maxAge) || maxAge < 0 || maxAge > 120) return false;
          if (minAge !== null && maxAge < minAge) return false;
          return true;
        },
        message:
          "Max age must be between 0-120 and greater than or equal to min age",
      },
      {
        field: "commission_percentage",
        validate: (value) => {
          if (value === undefined || value === null) return true; // Optional field
          const percentage = Number(value);
          return !isNaN(percentage) && percentage >= 0 && percentage <= 100;
        },
        message: "Commission percentage must be between 0 and 100",
      },
    ];
  }

  /**
   * Override create to set default is_active if not provided
   */
  async create(data: ProductFormData): Promise<ServiceResponse<ProductEntity>> {
    // Set default is_active to true if not provided
    const dataWithDefaults: ProductFormData = {
      ...data,
      is_active: data.is_active ?? true,
    };
    return super.create(dataWithDefaults);
  }

  /**
   * Get products by carrier (business logic)
   */
  async getByCarrier(
    carrierId: string,
  ): Promise<ServiceResponse<ProductEntity[]>> {
    try {
      const repo = this.repository as ProductRepository;
      const products = await repo.findByCarrier(carrierId);
      return { success: true, data: products };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get active products only (business logic)
   */
  async getActive(): Promise<ServiceResponse<ProductEntity[]>> {
    try {
      const repo = this.repository as ProductRepository;
      const products = await repo.findActive();
      return { success: true, data: products };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Search products by name (business logic)
   */
  async search(query: string): Promise<ServiceResponse<ProductEntity[]>> {
    try {
      const repo = this.repository as ProductRepository;
      const products = await repo.search(query);
      return { success: true, data: products };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get products for an explicit IMO. Used by super-admin settings views so
   * product counts/options follow the selected tenant.
   */
  async getAllForImo(imoId: string): Promise<ServiceResponse<ProductEntity[]>> {
    try {
      const repo = this.repository as ProductRepository;
      const products = await repo.findAllByTenant(imoId, {
        orderBy: "name",
        orderDirection: "asc",
      });
      return { success: true, data: products };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Bulk create products with default is_active
   * @deprecated Use createMany() inherited from BaseService instead
   */
  async bulkCreate(
    products: ProductFormData[],
  ): Promise<ServiceResponse<ProductEntity[]>> {
    // Apply defaults to all products
    const productsWithDefaults = products.map((p) => ({
      ...p,
      is_active: p.is_active ?? true,
    }));
    return this.createMany(productsWithDefaults);
  }

  // ============================================================================
  // INHERITED FROM BaseService (no code needed):
  // ============================================================================
  // - getAll(options?, filters?): Promise<ServiceResponse<ProductEntity[]>>
  // - getById(id: string): Promise<ServiceResponse<ProductEntity>>
  // - update(id: string, updates: Partial<ProductFormData>): Promise<ServiceResponse<ProductEntity>>
  // - delete(id: string): Promise<ServiceResponse<void>>
  // - createMany(items: ProductFormData[]): Promise<ServiceResponse<ProductEntity[]>>
  // - getPaginated(page, pageSize, filters?, orderBy?, orderDirection?): Promise<ServiceResponse<ListResponse<ProductEntity>>>
  // - exists(id: string): Promise<boolean>
  // - count(filters?): Promise<number>
}

// Singleton instance
const productRepository = new ProductRepository();
export const productService = new ProductService(productRepository);

// Export class for testing
export { ProductService as ProductServiceClass };
