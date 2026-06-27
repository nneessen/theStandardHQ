"""
audio-worker — mutes spoken-PII time spans in a call recording's audio.

Pipeline position (Call Reviews PII redaction, Phase 2):
  transcribe-call-recording detects PII + records redaction_spans →
  redact-call-audio (edge fn) dispatches THIS worker →
  worker downloads the RAW audio, ffmpeg-MUTES each span in place, re-encodes to
  mp3, uploads to the call-recordings-redacted bucket, and writes the result back
  onto kpi_call_recordings via service-role. The muted file is what peers hear
  once a human approves the recording (Phase 3).

Design invariants (see plan + advisor review):
  • MUTE IN PLACE, never cut: `volume=enable='between(t,s,e)':volume=0` zeroes
    samples without removing them, so output duration == input duration. We ASSERT
    this — transcript_segments + markers reference absolute timestamps, so any
    drift would desync the shared copy. Drift → fail the job.
  • Buckets are HARDCODED (input=call-recordings, output=call-recordings-redacted)
    and object paths validated. This box holds the service-role key; never let a
    caller pick an arbitrary bucket/path.
  • The WORKER writes the result row (decoupled from the edge-fn timeout): success
    → redacted_storage_path + audio_redacted_at + audio_redaction_status='done';
    failure → audio_redaction_status='failed' + audio_redaction_error.

PII: never log the audio bytes, signed URLs, or transcript. Status/ids only.
"""

import logging
import os
import subprocess
import tempfile
from datetime import datetime, timezone

import requests
from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audio-worker")

app = FastAPI(title="Call Audio Redaction Worker", version="1.0.0")

# ── Config (hardcoded buckets — never caller-supplied) ──────────────────────
INPUT_BUCKET = "call-recordings"
OUTPUT_BUCKET = "call-recordings-redacted"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
AUDIO_WORKER_KEY = os.environ.get("AUDIO_WORKER_KEY")

# Padding from the spans already happened upstream; this is a hard guard on cut/
# drift after re-encode (mp3 encoder delay is tens of ms — 0.5s is generous).
DURATION_TOLERANCE_S = float(os.environ.get("DURATION_TOLERANCE_S", "0.5"))
MAX_SPANS = int(os.environ.get("MAX_SPANS", "1000"))


def verify_api_key(request: Request):
    """X-API-Key gate. If AUDIO_WORKER_KEY is unset (local dev), skip."""
    if not AUDIO_WORKER_KEY:
        return
    if request.headers.get("x-api-key") != AUDIO_WORKER_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class Span(BaseModel):
    start: float
    end: float


class MuteRequest(BaseModel):
    recording_id: str
    storage_path: str  # in-bucket path within call-recordings (raw)
    out_path: str  # in-bucket path within call-recordings-redacted (muted)
    spans: list[Span] = []
    # The spans_version the edge fn asked us to mute. We echo it back as
    # muted_spans_version so Phase 3 approve can prove the muted file reflects the
    # current span set (muted_spans_version == spans_version) with no wall clocks.
    spans_version: int = 0


# ── Pure helpers (unit-tested) ──────────────────────────────────────────────
def is_safe_object_path(path: str) -> bool:
    """Reject empty, absolute, traversal, or bucket-prefixed paths."""
    if not path or not isinstance(path, str):
        return False
    if path.startswith("/") or ".." in path or "\\" in path:
        return False
    if path.startswith(f"{INPUT_BUCKET}/") or path.startswith(f"{OUTPUT_BUCKET}/"):
        return False
    return True


def build_volume_filter(spans: list[Span], max_t: float | None = None) -> str:
    """ffmpeg -af value that mutes each [start,end] span in place. '' if none.
    Spans are sanitized: finite, start<end, clamped to [0,max_t]."""
    parts = []
    for s in spans:
        a, b = float(s.start), float(s.end)
        if not (a == a and b == b):  # NaN guard
            continue
        a = max(0.0, a)
        if max_t is not None:
            b = min(b, max_t)
        if b <= a:
            continue
        parts.append(f"volume=enable='between(t,{a:.3f},{b:.3f})':volume=0")
    return ",".join(parts)


# ── ffmpeg / ffprobe ────────────────────────────────────────────────────────
def probe_duration(path: str) -> float:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", path,
        ],
        capture_output=True, text=True, timeout=120,
    )
    if out.returncode != 0:
        raise RuntimeError("ffprobe failed")
    try:
        return float(out.stdout.strip())
    except ValueError:
        raise RuntimeError("ffprobe returned no duration")


def run_ffmpeg_mute(in_path: str, out_path: str, vf: str) -> None:
    cmd = ["ffmpeg", "-hide_banner", "-y", "-i", in_path, "-vn"]
    if vf:
        cmd += ["-af", vf]
    # CBR mp3 so seek/scrub stays accurate on the re-encoded copy.
    cmd += ["-c:a", "libmp3lame", "-b:a", "128k", out_path]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if proc.returncode != 0:
        # stderr can be long; surface only the tail, never the audio.
        raise RuntimeError(f"ffmpeg failed (code {proc.returncode})")


# ── Supabase storage + table (service-role REST) ────────────────────────────
def _headers(extra: dict | None = None) -> dict:
    h = {"Authorization": f"Bearer {SERVICE_ROLE_KEY}", "apikey": SERVICE_ROLE_KEY}
    if extra:
        h.update(extra)
    return h


def download_object(bucket: str, path: str, dest: str) -> None:
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    with requests.get(url, headers=_headers(), stream=True, timeout=300) as r:
        if r.status_code != 200:
            raise RuntimeError(f"download failed ({r.status_code})")
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                f.write(chunk)


def upload_object(bucket: str, path: str, src: str, content_type: str) -> None:
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    with open(src, "rb") as f:
        data = f.read()
    r = requests.post(
        url,
        headers=_headers({"Content-Type": content_type, "x-upsert": "true"}),
        data=data,
        timeout=300,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"upload failed ({r.status_code})")


def patch_recording(recording_id: str, fields: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/kpi_call_recordings?id=eq.{recording_id}"
    r = requests.patch(
        url,
        headers=_headers(
            {"Content-Type": "application/json", "Prefer": "return=minimal"}
        ),
        json=fields,
        timeout=60,
    )
    if r.status_code not in (200, 204):
        raise RuntimeError(f"row update failed ({r.status_code})")


@app.get("/health")
def health():
    return {"status": "ok", "service": "audio-worker", "version": "1.0.0"}


@app.post("/api/mute-audio")
def mute_audio(req: MuteRequest, _auth=Depends(verify_api_key)):
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Worker not configured")
    if not is_safe_object_path(req.storage_path) or not is_safe_object_path(
        req.out_path
    ):
        raise HTTPException(status_code=400, detail="Invalid object path")
    if len(req.spans) > MAX_SPANS:
        raise HTTPException(status_code=400, detail="Too many spans")

    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw_input")
        out = os.path.join(tmp, "redacted.mp3")
        try:
            download_object(INPUT_BUCKET, req.storage_path, raw)
            in_dur = probe_duration(raw)
            vf = build_volume_filter(req.spans, max_t=in_dur)
            run_ffmpeg_mute(raw, out, vf)
            out_dur = probe_duration(out)
            # Duration invariant: muting must not shift the timeline.
            if abs(out_dur - in_dur) > DURATION_TOLERANCE_S:
                raise RuntimeError(
                    f"duration drift {abs(out_dur - in_dur):.3f}s exceeds tolerance"
                )
            upload_object(OUTPUT_BUCKET, req.out_path, out, "audio/mpeg")
            patch_recording(
                req.recording_id,
                {
                    "redacted_storage_path": req.out_path,
                    "audio_redacted_at": datetime.now(timezone.utc).isoformat(),
                    "audio_redaction_status": "done",
                    "audio_redaction_error": None,
                    "muted_spans_version": req.spans_version,
                },
            )
            logger.info("muted recording %s (%d spans)", req.recording_id, len(req.spans))
            return {"ok": True, "recording_id": req.recording_id, "spans": len(req.spans)}
        except Exception as e:  # noqa: BLE001 — always record a terminal status
            msg = str(e)[:300]
            logger.error("mute failed for %s: %s", req.recording_id, msg)
            try:
                patch_recording(
                    req.recording_id,
                    {"audio_redaction_status": "failed", "audio_redaction_error": msg},
                )
            except Exception:  # noqa: BLE001
                logger.error("could not mark %s failed", req.recording_id)
            raise HTTPException(status_code=500, detail="Muting failed")
