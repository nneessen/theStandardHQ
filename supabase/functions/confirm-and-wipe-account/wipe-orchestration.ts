// supabase/functions/confirm-and-wipe-account/wipe-orchestration.ts
//
// Pure, Deno-free orchestration helpers extracted from index.ts so vitest can
// exercise the two behaviours the local Supabase stack cannot (storage object
// DELETE is rejected locally; see the runbook §5):
//   - M1: the irreversible wipe RPC must run BEFORE the storage purge, so a
//         throw (e.g. the RPC refusing a non-revoked IMO) leaves storage intact
//         instead of producing an unhealable half-wipe.
//   - M4: the snapshot -> recovery archive resolution, including adopting an
//         orphaned recovery/ folder left by a prior crashed run, and the
//         all-or-nothing copy with partial-copy rollback.
// No Deno-specific imports here — index.ts injects the storage + wipe behaviour.

export interface StoragePort {
  // Mirrors listAllPaths(admin, RECOVERY_BUCKET, prefix).
  list(prefix: string): Promise<string[]>;
  // Mirrors admin.storage.from(RECOVERY_BUCKET).copy(src, dest).
  copy(
    src: string,
    dest: string,
  ): Promise<{ error: { message: string } | null }>;
  // Mirrors removeAll(admin, RECOVERY_BUCKET, paths).
  remove(paths: string[]): Promise<void>;
}

export interface RecoveryArchiveResult {
  recoveryPath: string | null;
  recoveryExpiresAt: string | null;
}

function expiry(now: number, ttlDays: number): string {
  return new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

// M4. Resolve the 30-day recovery archive from the frozen export snapshot.
// Returns the path + expiry to record on the audit row (or nulls when there is
// nothing to claim). recoveryExpiresAt is only set when this run actually owns a
// complete archive — the day-30 GC filters on it, so a path without an expiry
// would never be reclaimed.
export async function resolveRecoveryArchive(
  storage: StoragePort,
  snapPrefix: string,
  recPrefix: string,
  ttlDays: number,
  now: number = Date.now(),
): Promise<RecoveryArchiveResult> {
  const snapFiles = await storage.list(snapPrefix);

  if (snapFiles.length === 0) {
    // No staging snapshot. Either nothing was ever exported, OR a prior run
    // already moved it to recovery/ but crashed before writing the audit row,
    // leaving an orphan the GC can't see. Adopt an existing recovery folder so
    // the path + expiry get recorded.
    const existing = await storage.list(recPrefix);
    if (existing.length > 0) {
      return {
        recoveryPath: recPrefix,
        recoveryExpiresAt: expiry(now, ttlDays),
      };
    }
    return { recoveryPath: null, recoveryExpiresAt: null };
  }

  // All-or-nothing: a partial archive is worse than none — we'd claim a complete
  // copy the user doesn't actually have.
  const copiedDests: string[] = [];
  for (const src of snapFiles) {
    const dest = src.replace(snapPrefix, recPrefix);
    const { error } = await storage.copy(src, dest);
    if (error) {
      console.error(
        `[confirm-and-wipe-account] recovery copy ${src} -> ${dest} failed: ${error.message}`,
      );
      // Roll back the half-built recovery folder and KEEP the snapshot intact.
      if (copiedDests.length > 0) {
        console.error(
          `[confirm-and-wipe-account] partial recovery copy for ${recPrefix}; rolling back ${copiedDests.length} file(s), keeping snapshot`,
        );
        await storage.remove(copiedDests);
      }
      return { recoveryPath: null, recoveryExpiresAt: null };
    }
    copiedDests.push(dest);
  }

  // Every file copied: commit the archive, free the staging snapshot.
  await storage.remove(snapFiles);
  return { recoveryPath: recPrefix, recoveryExpiresAt: expiry(now, ttlDays) };
}

// Raised when a wipe is required but no distinct super-admin exists to inherit
// shared content. index.ts maps this to a 500 BEFORE any destructive step.
export class MissingReassignTargetError extends Error {
  constructor() {
    super("No distinct super-admin available to inherit shared content");
    this.name = "MissingReassignTargetError";
  }
}

// M1. Run the guarded wipe, THEN the storage purge — never the reverse. If the
// wipe throws (the RPC refuses a non-revoked/restored IMO, or any error), the
// purge thunk is never invoked, so the user's storage survives a bailout. When
// the profile is already gone (a prior partial run), the wipe is skipped but the
// purge still runs so retries finish cleaning up.
export async function wipeThenPurge(opts: {
  profileExists: boolean;
  reassignId: string | null;
  priorManifest: unknown;
  wipe: () => Promise<unknown>;
  purge: () => Promise<void>;
}): Promise<unknown> {
  let manifest: unknown = opts.priorManifest ?? { status: "noop" };

  if (opts.profileExists) {
    if (!opts.reassignId) throw new MissingReassignTargetError();
    manifest = await opts.wipe();
  }

  await opts.purge();
  return manifest;
}
