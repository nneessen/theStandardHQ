# audio-worker

Mutes spoken-PII time spans (SSN / banking) in Call Reviews recordings with
ffmpeg, so the shared copy is safe to listen to. Part of the Call Reviews PII
redaction pipeline (Phase 2).

## What it does

`POST /api/mute-audio` (header `X-API-Key`):
```json
{ "recording_id": "...", "storage_path": "agent/2026/06/123_call.mp3",
  "out_path": "agent/redacted/<recording_id>.mp3",
  "spans": [{ "start": 12.4, "end": 13.9 }] }
```
Downloads the raw audio from the `call-recordings` bucket (service-role), mutes
each span **in place** (`volume=enable='between(t,s,e)':volume=0` — never cuts, so
the timeline stays aligned with transcript/markers; duration is asserted),
re-encodes to CBR mp3, uploads to `call-recordings-redacted/<out_path>`, and writes
`redacted_storage_path` / `audio_redacted_at` / `audio_redaction_status` back onto
`kpi_call_recordings`. Buckets are hardcoded; the caller cannot pick them.

The `redact-call-audio` edge function dispatches this worker (fire-and-forget) and
no-ops gracefully until `AUDIO_WORKER_URL` is set — so the rest of the pipeline is
already live; only this deploy remains.

## Local test (real ffmpeg, via Docker)

```bash
docker build -t audio-worker .
docker run --rm -v "$(pwd)/test_app.py:/app/test_app.py" audio-worker python test_app.py
```
Generates a tone, mutes a span, asserts the span is silent (< -50 dB), the rest
is audible, and duration is preserved.

## Deploy to Railway (owner)

Mirrors `services/paddleocr-service`. From this directory:

```bash
railway login
railway init           # or: railway link  (to an existing project)
railway up             # builds the Dockerfile and deploys
```

Set these env vars on the Railway service (dashboard → Variables, or `railway variables set`):

| Var | Value |
| --- | --- |
| `SUPABASE_URL` | `https://pcyaqwodnyrpkaiojnpz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase → Project Settings → API → service_role) |
| `AUDIO_WORKER_KEY` | a long random secret you generate |

Grab the service's public URL, then point the edge function at it:

```bash
supabase secrets set \
  AUDIO_WORKER_URL=https://<your-railway-app>.up.railway.app \
  AUDIO_WORKER_KEY=<the same secret> \
  --project-ref pcyaqwodnyrpkaiojnpz
```

(`redact-call-audio` is already deployed; it starts dispatching as soon as those
two secrets exist.)

## Verify after deploy

1. `curl https://<railway-url>/health` → `{"status":"ok",...}`
2. In the app, re-transcribe a recording that has a spoken (fake) SSN.
3. Confirm on the row: `audio_redaction_status='done'`, `redacted_storage_path` set,
   and that the player audio has the SSN **silenced** at the detected span.
