// supabase/functions/confirm-and-wipe-account/__tests__/wipe-orchestration.test.ts
//
// Exercises the wipe ordering (M1) + recovery-archive resolution (M4) that the
// local Supabase stack can't (storage object DELETE is rejected locally). The
// helpers carry no Deno imports, so vitest imports them directly under Node.

import { describe, it, expect, vi } from "vitest";
import {
  MissingReassignTargetError,
  resolveRecoveryArchive,
  wipeThenPurge,
  type StoragePort,
} from "../wipe-orchestration";

const TTL = 30;

// A fake StoragePort recording every call. `failCopyFor` makes copy() fail for
// a given source path so we can drive the partial-copy rollback branch.
function fakeStorage(opts: {
  byPrefix: Record<string, string[]>;
  failCopyFor?: string;
}): StoragePort & { copied: string[]; removed: string[][] } {
  const copied: string[] = [];
  const removed: string[][] = [];
  return {
    copied,
    removed,
    list: (prefix) => Promise.resolve(opts.byPrefix[prefix] ?? []),
    copy: (src) => {
      if (opts.failCopyFor && src === opts.failCopyFor) {
        return Promise.resolve({ error: { message: "boom" } });
      }
      copied.push(src);
      return Promise.resolve({ error: null });
    },
    remove: (paths) => {
      removed.push(paths);
      return Promise.resolve();
    },
  };
}

describe("resolveRecoveryArchive (M4)", () => {
  const snap = "snapshots/u1";
  const rec = "recovery/u1";

  it("copies a full snapshot to recovery, then frees the snapshot", async () => {
    const storage = fakeStorage({
      byPrefix: { [snap]: [`${snap}/a.xlsx`, `${snap}/b.zip`] },
    });
    const res = await resolveRecoveryArchive(storage, snap, rec, TTL, 0);

    expect(res.recoveryPath).toBe(rec);
    expect(res.recoveryExpiresAt).toBe(
      new Date(TTL * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(storage.copied).toEqual([`${snap}/a.xlsx`, `${snap}/b.zip`]);
    // staging snapshot freed after a complete copy
    expect(storage.removed).toEqual([[`${snap}/a.xlsx`, `${snap}/b.zip`]]);
  });

  it("adopts an orphaned recovery folder when no snapshot remains", async () => {
    // prior run moved files to recovery/ but crashed before writing the audit
    // row — snapshot is gone, recovery/ still has the files.
    const storage = fakeStorage({
      byPrefix: { [snap]: [], [rec]: [`${rec}/a.xlsx`] },
    });
    const res = await resolveRecoveryArchive(storage, snap, rec, TTL, 0);

    expect(res.recoveryPath).toBe(rec);
    expect(res.recoveryExpiresAt).not.toBeNull();
    expect(storage.copied).toEqual([]);
    expect(storage.removed).toEqual([]);
  });

  it("claims nothing when there is neither a snapshot nor a recovery folder", async () => {
    const storage = fakeStorage({ byPrefix: { [snap]: [], [rec]: [] } });
    const res = await resolveRecoveryArchive(storage, snap, rec, TTL, 0);

    expect(res).toEqual({ recoveryPath: null, recoveryExpiresAt: null });
  });

  it("rolls back a partial copy, keeps the snapshot, and claims nothing", async () => {
    const storage = fakeStorage({
      byPrefix: { [snap]: [`${snap}/a.xlsx`, `${snap}/b.zip`] },
      failCopyFor: `${snap}/b.zip`,
    });
    const res = await resolveRecoveryArchive(storage, snap, rec, TTL, 0);

    // never claim an archive we didn't fully create
    expect(res).toEqual({ recoveryPath: null, recoveryExpiresAt: null });
    // the one file that copied is rolled back; the snapshot is NOT removed
    expect(storage.removed).toEqual([[`${rec}/a.xlsx`]]);
  });
});

describe("wipeThenPurge (M1)", () => {
  it("runs the wipe before the purge and returns the manifest", async () => {
    const order: string[] = [];
    const wipe = vi.fn(async () => {
      order.push("wipe");
      return { status: "wiped" };
    });
    const purge = vi.fn(async () => {
      order.push("purge");
    });

    const manifest = await wipeThenPurge({
      profileExists: true,
      reassignId: "admin-1",
      priorManifest: undefined,
      wipe,
      purge,
    });

    expect(order).toEqual(["wipe", "purge"]);
    expect(manifest).toEqual({ status: "wiped" });
  });

  it("does NOT purge storage when the wipe throws (no half-wipe)", async () => {
    const wipe = vi.fn(async () => {
      throw new Error("wipe_user_business_data: IMO is not revoked");
    });
    const purge = vi.fn(async () => {});

    await expect(
      wipeThenPurge({
        profileExists: true,
        reassignId: "admin-1",
        priorManifest: undefined,
        wipe,
        purge,
      }),
    ).rejects.toThrow(/not revoked/);

    expect(purge).not.toHaveBeenCalled();
  });

  it("refuses (before any destructive step) when no reassign target exists", async () => {
    const wipe = vi.fn(async () => ({}));
    const purge = vi.fn(async () => {});

    await expect(
      wipeThenPurge({
        profileExists: true,
        reassignId: null,
        priorManifest: undefined,
        wipe,
        purge,
      }),
    ).rejects.toBeInstanceOf(MissingReassignTargetError);

    expect(wipe).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
  });

  it("skips the wipe but still purges when the profile is already gone", async () => {
    const wipe = vi.fn(async () => ({}));
    const purge = vi.fn(async () => {});

    const manifest = await wipeThenPurge({
      profileExists: false,
      reassignId: null,
      priorManifest: { status: "prior" },
      wipe,
      purge,
    });

    expect(wipe).not.toHaveBeenCalled();
    expect(purge).toHaveBeenCalledOnce();
    expect(manifest).toEqual({ status: "prior" });
  });
});
