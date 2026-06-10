// src/features/call-reviews/utils/__tests__/audioUpload.test.ts
// Unit tests for the client-side audio-upload gate. The key invariant under test:
// the file EXTENSION is authoritative and the MIME type is only a secondary
// signal, so a valid-extension file is never bounced on an odd/empty MIME (some
// browsers report empty or non-standard MIME for real audio), while a file with
// neither a recognized extension nor a recognized MIME is rejected.

import { describe, it, expect } from "vitest";
import { validateAudioFile, MAX_RECORDING_BYTES } from "../audioUpload";

// Build a File-like object with a controllable size without allocating real
// bytes (so we can exercise the 500 MB ceiling cheaply). validateAudioFile only
// reads .size / .name / .type.
function fakeFile(opts: { name: string; type: string; size: number }): File {
  return {
    name: opts.name,
    type: opts.type,
    size: opts.size,
  } as File;
}

describe("validateAudioFile", () => {
  it("accepts a valid extension with a valid MIME", () => {
    expect(
      validateAudioFile(
        fakeFile({ name: "call.mp3", type: "audio/mpeg", size: 1024 }),
      ),
    ).toBeNull();
  });

  it("accepts a valid extension with an odd/non-standard MIME", () => {
    // Some browsers report e.g. "audio/mpeg3" for an .mp3 — extension wins.
    expect(
      validateAudioFile(
        fakeFile({ name: "call.mp3", type: "audio/mpeg3", size: 1024 }),
      ),
    ).toBeNull();
  });

  it("accepts a valid extension with an empty MIME", () => {
    expect(
      validateAudioFile(fakeFile({ name: "call.wav", type: "", size: 1024 })),
    ).toBeNull();
  });

  it("accepts an unknown extension when the MIME is recognized", () => {
    // No usable extension, but a recognized audio MIME → allowed (the bucket
    // re-validates MIME as the hard gate).
    expect(
      validateAudioFile(
        fakeFile({ name: "recording", type: "audio/wav", size: 1024 }),
      ),
    ).toBeNull();
  });

  it("rejects a file with neither a recognized extension nor MIME", () => {
    const msg = validateAudioFile(
      fakeFile({ name: "notes.txt", type: "text/plain", size: 1024 }),
    );
    expect(msg).toMatch(/Unsupported file/i);
  });

  it("rejects an extensionless file with an unrecognized MIME", () => {
    const msg = validateAudioFile(
      fakeFile({
        name: "recording",
        type: "application/octet-stream",
        size: 1024,
      }),
    );
    expect(msg).toMatch(/Unsupported file/i);
  });

  it("rejects an empty (0-byte) file", () => {
    const msg = validateAudioFile(
      fakeFile({ name: "call.mp3", type: "audio/mpeg", size: 0 }),
    );
    expect(msg).toMatch(/empty/i);
  });

  it("rejects a file over the 500 MB ceiling", () => {
    const msg = validateAudioFile(
      fakeFile({
        name: "call.mp3",
        type: "audio/mpeg",
        size: MAX_RECORDING_BYTES + 1,
      }),
    );
    expect(msg).toMatch(/500 MB/i);
  });

  it("accepts a file exactly at the 500 MB ceiling", () => {
    expect(
      validateAudioFile(
        fakeFile({
          name: "call.mp3",
          type: "audio/mpeg",
          size: MAX_RECORDING_BYTES,
        }),
      ),
    ).toBeNull();
  });
});
