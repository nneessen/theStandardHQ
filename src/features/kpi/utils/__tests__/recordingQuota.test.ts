import { describe, expect, it } from "vitest";
import {
  readCallRecordingQuotaGb,
  quotaBytesFromGb,
  bytesToGb,
} from "../recordingQuota";
import type { Imo } from "@/types/imo.types";

function imoWith(settings: unknown): Imo {
  return { settings } as unknown as Imo;
}

describe("readCallRecordingQuotaGb", () => {
  it("returns null (unlimited) when unset, zero, negative, or non-numeric", () => {
    expect(readCallRecordingQuotaGb(null)).toBeNull();
    expect(readCallRecordingQuotaGb(undefined)).toBeNull();
    expect(readCallRecordingQuotaGb(imoWith(null))).toBeNull();
    expect(readCallRecordingQuotaGb(imoWith({}))).toBeNull();
    expect(
      readCallRecordingQuotaGb(imoWith({ call_recording_quota_gb: 0 })),
    ).toBeNull();
    expect(
      readCallRecordingQuotaGb(imoWith({ call_recording_quota_gb: -5 })),
    ).toBeNull();
    expect(
      readCallRecordingQuotaGb(imoWith({ call_recording_quota_gb: "abc" })),
    ).toBeNull();
  });

  it("returns the configured GB when a positive number (or numeric string)", () => {
    expect(
      readCallRecordingQuotaGb(imoWith({ call_recording_quota_gb: 25 })),
    ).toBe(25);
    expect(
      readCallRecordingQuotaGb(imoWith({ call_recording_quota_gb: "10" })),
    ).toBe(10);
  });
});

describe("quota math", () => {
  it("converts GB to decimal bytes (10^9)", () => {
    expect(quotaBytesFromGb(1)).toBe(1_000_000_000);
    expect(quotaBytesFromGb(25)).toBe(25_000_000_000);
  });

  it("formats bytes to 1-decimal GB", () => {
    expect(bytesToGb(43_415_258)).toBe("0.0");
    expect(bytesToGb(1_500_000_000)).toBe("1.5");
  });

  it("blocks when used + incoming exceeds the cap", () => {
    const cap = quotaBytesFromGb(0.05); // 50 MB
    const used = 43_415_258; // ~43.4 MB (the demo IMO total)
    const incoming = 10_000_000; // 10 MB
    expect(used + incoming > cap).toBe(true);
    expect(used + 1_000 > cap).toBe(false);
  });
});
