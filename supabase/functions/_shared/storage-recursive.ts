// ============================================================================
// Recursive Supabase Storage helpers (sunset flow).
// ============================================================================
// Supabase Storage `list()` returns a single level at a time; sub-folders come
// back as entries with `id === null`. These helpers walk a prefix fully and
// delete in chunks, which the wipe + recovery-GC paths both need.
// ============================================================================

// deno-lint-ignore no-explicit-any
type Admin = any;

/** Every object path under `prefix` in `bucket`, recursing into sub-folders. */
export async function listAllPaths(
  admin: Admin,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error || !data) return out;
  for (const entry of data) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      out.push(...(await listAllPaths(admin, bucket, full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Remove every path in `paths` from `bucket`, 100 at a time. */
export async function removeAll(
  admin: Admin,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    if (chunk.length > 0) await admin.storage.from(bucket).remove(chunk);
  }
}
