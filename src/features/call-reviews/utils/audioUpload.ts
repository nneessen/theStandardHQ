// src/features/call-reviews/utils/audioUpload.ts
// Client-side audio-file validation for Call Reviews uploads. This is the FIRST
// of three layers and exists only to give the user an instant, clear rejection —
// the call-recordings storage bucket enforces the same MIME allowlist + 500 MB
// cap server-side, and the transcribe-call-recording edge function re-checks the
// extension and rejects empty files. Keep this list in sync with the bucket's
// allowed_mime_types and the edge function's ALLOWED_EXTENSIONS.

export const MAX_RECORDING_BYTES = 500 * 1024 * 1024; // 500 MB (bucket limit)

const ALLOWED_MIME = new Set<string>([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "video/mp4",
]);

const ALLOWED_EXT = new Set<string>([
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
  "aac",
  "ogg",
  "oga",
  "flac",
]);

// `accept` for the file <input> — narrows the picker to real audio formats
// (the HTML hint only; validateAudioFile is the actual gate).
export const AUDIO_ACCEPT =
  ".mp3,.m4a,.wav,.webm,.aac,.ogg,.oga,.flac,.mp4,.mpeg,audio/*";

function fileExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  return dot >= 0 && dot < name.length - 1
    ? name.slice(dot + 1).toLowerCase()
    : null;
}

/** Returns a user-facing error message, or null if the file is acceptable. */
export function validateAudioFile(file: File): string | null {
  if (file.size === 0) return "That file is empty (0 bytes).";
  if (file.size > MAX_RECORDING_BYTES) {
    return "File exceeds the 500 MB limit. Split long calls into shorter segments.";
  }
  const ext = fileExtension(file.name);
  const extOk = ext != null && ALLOWED_EXT.has(ext);
  // The EXTENSION is authoritative; the MIME type is only a secondary accept
  // signal (browsers report empty or non-standard MIME for some audio files, e.g.
  // a .mp3 served as audio/mpeg3). Reject ONLY when neither the extension nor the
  // MIME is recognized — never bounce a valid-extension file on an odd MIME. The
  // storage bucket re-validates the MIME server-side as the hard gate.
  const mimeOk = !!file.type && ALLOWED_MIME.has(file.type);
  if (!extOk && !mimeOk) {
    return "Unsupported file. Upload an audio recording (mp3, m4a, wav, webm, aac, ogg, or flac).";
  }
  return null;
}
