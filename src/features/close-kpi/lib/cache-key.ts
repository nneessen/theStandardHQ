// src/features/close-kpi/lib/cache-key.ts
// Deterministic hash of widget config + date range for cache dedup

/**
 * Generates a stable cache key from widget config.
 * Uses JSON.stringify with sorted keys so identical configs always produce the same key.
 */
export function generateCacheKey(
  widgetType: string,
  config: unknown,
  globalDateRange?: string,
): string {
  const normalized = {
    type: widgetType,
    config: sortObject(config),
    globalDateRange: globalDateRange ?? "default",
  };
  return btoa(JSON.stringify(normalized)).replace(/[=+/]/g, "");
}

function sortObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (typeof obj !== "object") return obj;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}
