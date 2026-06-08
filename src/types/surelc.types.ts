// src/types/surelc.types.ts
// Types + DB transforms for SureLC access links (Licensing hub).
// NOTE: SureLcLink structurally satisfies the repository's BaseEntity
// (`id` required; created_at/updated_at optional), so the BaseRepository<T>
// generic accepts it without importing BaseEntity here.

/** Which list a link belongs to. `shared` = company link (super-admin); `personal` = owned by the agent. */
export type SureLcLinkScope = "shared" | "personal";

export interface SureLcLink {
  id: string;
  imoId: string;
  /** NULL for shared/company links; the owning agent's id for personal links. */
  ownerUserId: string | null;
  label: string;
  url: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSureLcLinkData {
  scope: SureLcLinkScope;
  label: string;
  url: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateSureLcLinkData {
  label?: string;
  url?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function transformSureLcLinkFromDB(row: {
  id: string;
  imo_id: string;
  owner_user_id: string | null;
  label: string;
  url: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): SureLcLink {
  return {
    id: row.id,
    imoId: row.imo_id,
    ownerUserId: row.owner_user_id,
    label: row.label,
    url: row.url,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map create/update fields to DB columns. Identity-bearing columns
 * (imo_id, owner_user_id, created_by) are set by the repository, not here.
 */
export function transformSureLcLinkToDB(
  data: CreateSureLcLinkData | UpdateSureLcLinkData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("label" in data && data.label !== undefined)
    out.label = data.label.trim();
  if ("url" in data && data.url !== undefined) out.url = data.url.trim();
  if ("description" in data && data.description !== undefined) {
    out.description =
      data.description === null
        ? null
        : String(data.description).trim() || null;
  }
  if ("sortOrder" in data && data.sortOrder !== undefined)
    out.sort_order = data.sortOrder;
  if ("isActive" in data && data.isActive !== undefined)
    out.is_active = data.isActive;
  return out;
}
