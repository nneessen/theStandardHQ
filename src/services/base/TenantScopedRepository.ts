// src/services/base/TenantScopedRepository.ts
import {
  BaseRepository,
  type BaseEntity,
  type FilterOptions,
  type QueryOptions,
} from "./BaseRepository";
import { getCurrentTenantContext } from "./TenantContext";

export interface TenantScopedEntity extends BaseEntity {
  imo_id?: string | null;
}

/**
 * Base repository for tables owned by an IMO.
 *
 * RLS remains the primary security boundary. This class makes the application
 * default match that boundary so super-admin or broad RLS visibility does not
 * accidentally leak records into normal screens.
 */
export abstract class TenantScopedRepository<
  T extends TenantScopedEntity,
  CreateData = Partial<T>,
  UpdateData = Partial<T>,
> extends BaseRepository<T, CreateData, UpdateData> {
  protected tenantColumn = "imo_id";

  async getDefaultTenantId(): Promise<string> {
    const context = await getCurrentTenantContext();

    if (!context.imoId) {
      throw new Error("Current user is not assigned to an IMO");
    }

    return context.imoId;
  }

  protected async getTenantFilter(imoId?: string): Promise<FilterOptions> {
    return { [this.tenantColumn]: imoId ?? (await this.getDefaultTenantId()) };
  }

  override async findAll(
    options?: QueryOptions,
    filters?: FilterOptions,
  ): Promise<T[]> {
    return super.findAll(options, {
      ...(await this.getTenantFilter()),
      ...filters,
    });
  }

  async findAllByTenant(
    imoId: string,
    options?: QueryOptions,
    filters?: FilterOptions,
  ): Promise<T[]> {
    return super.findAll(options, {
      ...(await this.getTenantFilter(imoId)),
      ...filters,
    });
  }

  override async create(data: CreateData): Promise<T> {
    const dbData = this.transformToDB(data);

    if (
      dbData[this.tenantColumn] === undefined ||
      dbData[this.tenantColumn] === null
    ) {
      dbData[this.tenantColumn] = await this.getDefaultTenantId();
    }

    return super.create(dbData as CreateData);
  }

  override async createMany(items: CreateData[]): Promise<T[]> {
    const tenantId = await this.getDefaultTenantId();
    const scopedItems = items.map((item) => {
      const dbData = this.transformToDB(item);

      if (
        dbData[this.tenantColumn] === undefined ||
        dbData[this.tenantColumn] === null
      ) {
        dbData[this.tenantColumn] = tenantId;
      }

      return dbData as CreateData;
    });

    return super.createMany(scopedItems);
  }
}
