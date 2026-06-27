// pii-redaction — pure, dependency-free helpers that turn a diarized transcript
// (Deepgram utterances + words) plus an optional Claude PII pass into:
//   1. REDACTED segment text + a redacted flat transcript (PII removed), and
//   2. audio time-SPANS to mute later (Phase 2 ffmpeg worker).
//
// Design choices (see plan + advisor review):
//   • We REDACT THE EXISTING UTTERANCE TEXT IN PLACE — we never rebuild segments
//     from words (a word-grouping bug would corrupt the whole transcript, and
//     this path first runs on prod). Words are used ONLY for best-effort span
//     timing. The flat transcript is re-joined from the already-redacted segment
//     texts (segment-level join, not word regrouping) so it can never leak raw.
//   • Two detectors, unioned: (a) a Claude pass (contextual / spelled-out PII)
//     and (b) deterministic regex (formatted SSN, card groups, long digit runs).
//   • OVER-REDACT on ambiguity: if Claude flags a segment but we can't locate the
//     exact text, the whole segment's text + audio span are redacted.
//
// No Deno/Node APIs here — importable by the edge function AND by `deno test`.

export const REDACTION_TOKEN = "[redacted]";

export interface RedactWord {
  word: string;
  punctuated_word?: string;
  start: number | null;
  end: number | null;
  speaker?: number | null;
}

export interface RedactSegment {
  id?: number;
  start?: number | null;
  end?: number | null;
  text?: string;
  speaker?: number | null;
}

// One PII hit from the Claude verification pass: the verbatim substring as it
// appears in the transcript, and which segment id it occurs in.
export interface PiiItem {
  segment_id: number;
  text: string;
  type: string;
}

export interface RedactionSpan {
  start: number;
  end: number;
  type: string;
}

export interface RedactionInput {
  segments: RedactSegment[];
  words: RedactWord[];
  claudeItems?: PiiItem[];
  padSeconds?: number;
  durationSeconds?: number | null;
}

export interface RedactionResult {
  segments: RedactSegment[]; // same shape, text redacted
  transcriptText: string; // redacted flat transcript (re-joined from segments)
  spans: RedactionSpan[]; // merged + padded audio mute ranges
  redactedCount: number; // # of segments that had any redaction
}

const DEFAULT_PAD_SECONDS = 0.4;
// Adjacent spans closer than this (after padding) are merged into one.
const MERGE_GAP_SECONDS = 0.15;

// ── Regex detectors ─────────────────────────────────────────────────────────
// Tuned for SSN + banking, the stated concern. Deliberately NOT matching short
// numbers (ages, years, ZIPs, prices like "$50,000") to avoid bleeping every
// number — long/structured digit sequences only. Claude covers the rest.
const RE_SSN = /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/g; // 123-45-6789
const RE_CARD = /\b(?:\d[ -]?){13,19}\b/g; // 13–19 digit card / long account
const RE_LONG_DIGITS = /\b\d{7,}\b/g; // bare 7+ run: account / routing / MRN

interface RegexHit {
  value: string;
  type: string;
}

/** Find regex-detectable PII substrings in a single piece of text. Exported for
 *  unit testing. Order matters: more specific (SSN) before generic runs. */
export function regexPiiSubstrings(text: string): RegexHit[] {
  if (!text) return [];
  const hits: RegexHit[] = [];
  const seen = new Set<string>();
  const push = (value: string, type: string) => {
    const v = value.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      hits.push({ value: v, type });
    }
  };
  for (const m of text.matchAll(RE_SSN)) push(m[0], "ssn");
  for (const m of text.matchAll(RE_CARD)) {
    // A bare run of < 13 digits can sneak in via the separator class; require
    // at least 13 actual digits for the card/long-account class.
    if ((m[0].match(/\d/g)?.length ?? 0) >= 13) push(m[0], "card");
  }
  for (const m of text.matchAll(RE_LONG_DIGITS)) push(m[0], "number");
  return hits;
}

/** Best-effort regex-only redaction of a flat transcript string (used only when
 *  Deepgram returns no utterance segments to redact per-line). */
export function redactPlainText(text: string): {
  text: string;
  redacted: boolean;
} {
  let out = text;
  let redacted = false;
  for (const hit of regexPiiSubstrings(text)) {
    const r = replaceLiteral(out, hit.value);
    if (r.replaced) {
      out = r.text;
      redacted = true;
    }
  }
  return { text: out, redacted };
}

// Escape a literal string for use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Replace every (case-insensitive) occurrence of `needle` in `haystack` with the
// redaction token. Returns the new string and whether anything was replaced.
function replaceLiteral(
  haystack: string,
  needle: string,
): { text: string; replaced: boolean } {
  const trimmed = needle.trim();
  if (!trimmed) return { text: haystack, replaced: false };
  const re = new RegExp(escapeRegExp(trimmed), "gi");
  if (!re.test(haystack)) return { text: haystack, replaced: false };
  return { text: haystack.replace(re, REDACTION_TOKEN), replaced: true };
}

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

// Round to milliseconds so stored spans are clean (avoids float pad noise).
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Words whose start falls within a segment's [start, end] window.
function wordsInSegment(words: RedactWord[], seg: RedactSegment): RedactWord[] {
  const s = typeof seg.start === "number" ? seg.start : null;
  const e = typeof seg.end === "number" ? seg.end : null;
  if (s == null || e == null) return [];
  return words.filter(
    (w) =>
      typeof w.start === "number" && w.start >= s - 1e-6 && w.start <= e + 1e-6,
  );
}

// Contiguous runs of digit-bearing words → precise spans (SSN/card/account are
// read as digit sequences, so this pins the exact audio to mute).
function digitWordSpans(segWords: RedactWord[], type: string): RedactionSpan[] {
  const spans: RedactionSpan[] = [];
  let run: RedactWord[] = [];
  const flush = () => {
    if (run.length) {
      const start = run[0].start;
      const end = run[run.length - 1].end;
      if (
        typeof start === "number" &&
        typeof end === "number" &&
        end >= start
      ) {
        spans.push({ start, end, type });
      }
      run = [];
    }
  };
  for (const w of segWords) {
    const tok = w.punctuated_word ?? w.word ?? "";
    if (hasDigit(tok)) run.push(w);
    else flush();
  }
  flush();
  return spans;
}

/** Merge overlapping / near-adjacent spans and pad each side. Pure; exported for
 *  tests. Spans with non-finite bounds are dropped. Clamped to [0, maxEnd]. */
export function mergeAndPadSpans(
  spans: RedactionSpan[],
  padSeconds = DEFAULT_PAD_SECONDS,
  maxEnd: number | null = null,
): RedactionSpan[] {
  const clean = spans
    .filter(
      (s) =>
        Number.isFinite(s.start) && Number.isFinite(s.end) && s.end >= s.start,
    )
    .map((s) => ({
      start: round3(Math.max(0, s.start - padSeconds)),
      end: round3(
        maxEnd != null
          ? Math.min(maxEnd, s.end + padSeconds)
          : s.end + padSeconds,
      ),
      type: s.type,
    }))
    .sort((a, b) => a.start - b.start);

  const merged: RedactionSpan[] = [];
  for (const s of clean) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + MERGE_GAP_SECONDS) {
      last.end = Math.max(last.end, s.end);
      if (last.type !== s.type) last.type = "mixed";
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/**
 * Redact a diarized transcript in place and compute audio mute spans.
 * `segments` are the RAW Deepgram utterances; the returned segments carry the
 * same shape with PII removed from `.text`. Raw PII is never returned.
 */
export function buildRedaction(input: RedactionInput): RedactionResult {
  const pad = input.padSeconds ?? DEFAULT_PAD_SECONDS;
  const duration = input.durationSeconds ?? null;
  const words = Array.isArray(input.words) ? input.words : [];
  const claudeBySeg = new Map<number, PiiItem[]>();
  for (const it of input.claudeItems ?? []) {
    if (
      it &&
      typeof it.segment_id === "number" &&
      typeof it.text === "string"
    ) {
      const arr = claudeBySeg.get(it.segment_id) ?? [];
      arr.push(it);
      claudeBySeg.set(it.segment_id, arr);
    }
  }

  const rawSpans: RedactionSpan[] = [];
  let redactedCount = 0;

  const outSegments = input.segments.map((seg, idx) => {
    const segId = typeof seg.id === "number" ? seg.id : idx;
    let text = typeof seg.text === "string" ? seg.text : "";
    if (!text) return { ...seg, text };

    let numericRedaction = false;
    let nonNumericRedaction = false;
    let wholeSegment = false;

    // (a) Regex hits in this segment.
    for (const hit of regexPiiSubstrings(text)) {
      const r = replaceLiteral(text, hit.value);
      if (r.replaced) {
        text = r.text;
        numericRedaction = true;
      }
    }

    // (b) Claude-flagged PII in this segment.
    for (const item of claudeBySeg.get(segId) ?? []) {
      const r = replaceLiteral(text, item.text);
      if (r.replaced) {
        text = r.text;
        if (hasDigit(item.text)) numericRedaction = true;
        else nonNumericRedaction = true;
      } else {
        // Flagged but not locatable → over-redact the whole segment.
        wholeSegment = true;
      }
    }

    const changed = numericRedaction || nonNumericRedaction || wholeSegment;
    if (!changed) return { ...seg, text };
    redactedCount++;

    if (wholeSegment) text = REDACTION_TOKEN;

    // ── Spans (best-effort audio timing) ──
    const segWords = wordsInSegment(words, seg);
    let segSpans: RedactionSpan[] = [];
    if (numericRedaction && segWords.length) {
      segSpans = digitWordSpans(segWords, "number");
    }
    // Spelled-out / unlocatable / no word mapping → mute the whole utterance.
    if (
      wholeSegment ||
      (nonNumericRedaction && !segSpans.length) ||
      (numericRedaction && !segSpans.length)
    ) {
      if (typeof seg.start === "number" && typeof seg.end === "number") {
        segSpans.push({ start: seg.start, end: seg.end, type: "segment" });
      }
    }
    rawSpans.push(...segSpans);

    return { ...seg, text };
  });

  const transcriptText = outSegments
    .map((s) => (typeof s.text === "string" ? s.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const spans = mergeAndPadSpans(rawSpans, pad, duration);

  return { segments: outSegments, transcriptText, spans, redactedCount };
}
