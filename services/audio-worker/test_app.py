"""Worker tests — run inside the Docker image (has ffmpeg): `python test_app.py`.

Covers the pure helpers AND a real ffmpeg mute: generate a tone, mute a span,
and assert that span is silent while the rest is audible and duration is intact.
"""
import os
import re
import subprocess
import sys
import tempfile

from app import build_volume_filter, is_safe_object_path, probe_duration, run_ffmpeg_mute, Span


def check(name, cond):
    print(("PASS" if cond else "FAIL"), name)
    if not cond:
        sys.exit(1)


# ── pure: build_volume_filter ───────────────────────────────────────────────
check("empty spans → empty filter", build_volume_filter([]) == "")
f = build_volume_filter([Span(start=1.0, end=2.0)])
check("single span filter", f == "volume=enable='between(t,1.000,2.000)':volume=0")
f2 = build_volume_filter([Span(start=1.0, end=2.0), Span(start=5.0, end=6.5)])
check("two spans chained with comma", f2.count("volume=enable") == 2 and "," in f2)
check("inverted span dropped", build_volume_filter([Span(start=3.0, end=1.0)]) == "")
check("span clamped to max_t", "between(t,4.000,5.000)" in build_volume_filter([Span(start=4.0, end=99.0)], max_t=5.0))

# ── pure: is_safe_object_path ───────────────────────────────────────────────
check("valid path ok", is_safe_object_path("agent/2026/06/file.mp3"))
check("traversal rejected", not is_safe_object_path("../etc/passwd"))
check("absolute rejected", not is_safe_object_path("/etc/passwd"))
check("bucket-prefixed rejected", not is_safe_object_path("call-recordings/x.mp3"))
check("empty rejected", not is_safe_object_path(""))


# ── real ffmpeg: mute the middle of a tone ──────────────────────────────────
def mean_volume_db(path, start, dur):
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(dur), "-i", path,
         "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True, timeout=120,
    )
    m = re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB", p.stderr)
    if not m:
        m = re.search(r"mean_volume:\s*(-inf)", p.stderr)
        return -120.0 if m else 0.0
    return float(m.group(1))


with tempfile.TemporaryDirectory() as tmp:
    tone = os.path.join(tmp, "tone.mp3")
    out = os.path.join(tmp, "out.mp3")
    # 5s 440Hz tone
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-y", "-f", "lavfi", "-i",
         "sine=frequency=440:duration=5", "-c:a", "libmp3lame", "-b:a", "128k", tone],
        capture_output=True, text=True, timeout=120, check=True,
    )
    in_dur = probe_duration(tone)
    run_ffmpeg_mute(tone, out, build_volume_filter([Span(start=2.0, end=3.0)], max_t=in_dur))
    out_dur = probe_duration(out)

    check("duration preserved (no cut/shift)", abs(out_dur - in_dur) <= 0.5)
    muted = mean_volume_db(out, 2.2, 0.6)
    audible = mean_volume_db(out, 0.2, 0.6)
    print(f"  muted region mean_volume={muted}dB, audible region={audible}dB")
    check("muted region is silent (< -50 dB)", muted < -50.0)
    check("unmuted region is audible (> -50 dB)", audible > -50.0)

print("\nALL TESTS PASSED")
