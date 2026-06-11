// src/features/kpi/utils/recordingQuota.ts
// Per-IMO call-recording storage quota, read from imos.settings (jsonb).
// Quota is OPT-IN: absent/invalid ⇒ unlimited (null). GB are decimal (10^9).

import type { Imo } from "@/types/imo.types";

const BYTES_PER_GB = 1_000_000_000;

/** The IMO's call-recording quota in GB, or null when unlimited (not configured). */
export function readCallRecordingQuotaGb(
  imo: Imo | null | undefined,
): number | null {
  const raw = (imo?.settings as Record<string, unknown> | null | undefined)
    ?.call_recording_quota_gb;
  const gb = Number(raw);
  return Number.isFinite(gb) && gb > 0 ? gb : null;
}

export function quotaBytesFromGb(gb: number): number {
  return gb * BYTES_PER_GB;
}

/** Human-readable GB (1 decimal) for quota messaging. */
export function bytesToGb(bytes: number): string {
  return (bytes / BYTES_PER_GB).toFixed(1);
}
