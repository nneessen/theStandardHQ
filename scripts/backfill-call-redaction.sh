#!/usr/bin/env bash
# ============================================================================
# Call Reviews PII redaction — Phase 3 backfill for pre-Phase-1 recordings.
# ============================================================================
# The recordings that predate Phase 1 are redaction_status='pending'. They hold
# RAW PII in their transcript AND in AI-derived fields (ai_summary,
# ai_key_moments, objection_events, caller_existing_coverage) that were generated
# from the raw transcript — plus any kpi_word_track_detections (verbatim agent
# speech). This script makes them safe and re-arms them for the redaction pipeline.
#
# ⚠️ RUN ONLY AFTER the Phase 2 owner E2E passes (upload a fake-SSN call → confirm
#    the audio is actually muted). This re-processes real client recordings.
# ⚠️ Targets PROD (REMOTE_DATABASE_URL). Uses the sanctioned run-sql.sh (direct
#    Postgres via DATABASE_URL — NOT the legacy .env JWT keys, which are rejected).
#
# Modes:
#   (default)    report  — read-only: list the pending rows + a summary. SAFE.
#   --prepare            — null the PII-bearing AI fields, delete stale detections,
#                          and reset transcription_status='pending' so each row can
#                          be re-transcribed. Leaves redaction_status='pending'
#                          (still peer-locked). audio_deleted_at rows (no raw audio
#                          to re-transcribe) are set 'rejected' and flagged.
#   --retranscribe       — print the per-recording re-transcribe instructions
#                          (needs an admin session JWT — the gateway rejects
#                          service-role for transcribe-call-recording).
#
# After --prepare + re-transcribe, each row lands 'needs_review' for the owner to
# approve in the Review Queue (/call-reviews/review-queue).
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
SCRIPT="./scripts/migrations/run-sql.sh"
MODE="${1:-report}"

# shellcheck disable=SC1091
source .env
export DATABASE_URL="${REMOTE_DATABASE_URL:?REMOTE_DATABASE_URL not set in .env}"

echo "Target: PROD (${DATABASE_URL%%@*}@…)"
echo ""

case "$MODE" in
  report)
    echo "── Pending recordings (redaction_status='pending') ──"
    "$SCRIPT" "
      SELECT id, agent_id, transcription_status,
             (audio_deleted_at IS NOT NULL) AS audio_gone,
             (ai_summary IS NOT NULL OR ai_key_moments IS NOT NULL
              OR objection_events IS NOT NULL
              OR caller_existing_coverage IS NOT NULL) AS has_ai_pii
      FROM kpi_call_recordings
      WHERE redaction_status='pending'
      ORDER BY created_at;"
    echo ""
    echo "── Summary ──"
    "$SCRIPT" "
      SELECT count(*) AS total,
             count(*) FILTER (WHERE audio_deleted_at IS NOT NULL) AS audio_deleted,
             count(*) FILTER (WHERE ai_summary IS NOT NULL OR ai_key_moments IS NOT NULL
                              OR objection_events IS NOT NULL
                              OR caller_existing_coverage IS NOT NULL) AS has_ai_pii,
             (SELECT count(*) FROM kpi_word_track_detections d
                JOIN kpi_call_recordings r ON r.id=d.recording_id
                WHERE r.redaction_status='pending') AS detection_rows
      FROM kpi_call_recordings WHERE redaction_status='pending';"
    echo ""
    echo "Next: review the list, run the Phase-2 owner E2E, then '$0 --prepare'."
    ;;

  --prepare)
    echo "⚠️  This nulls AI fields + deletes detections + resets transcription on"
    echo "    the pending recordings on PROD. Ctrl-C within 5s to abort."
    sleep 5
    echo "── 1. Delete stale detections (verbatim speech, raw-derived) ──"
    "$SCRIPT" "
      DELETE FROM kpi_word_track_detections d
      USING kpi_call_recordings r
      WHERE d.recording_id = r.id AND r.redaction_status='pending';"
    echo "── 2a. audio_deleted_at rows: cannot re-transcribe → reject + null AI ──"
    # No raw audio means no muted copy is possible → never shareable. Null AI PII
    # and lock as rejected. (Transcript-only regex redaction of these is a manual
    # follow-up; flagged in the report. As of writing there are 0 such rows.)
    "$SCRIPT" "
      UPDATE kpi_call_recordings
      SET ai_summary=NULL, ai_key_moments=NULL, objection_events=NULL,
          caller_existing_coverage=NULL, redaction_status='rejected'
      WHERE redaction_status='pending' AND audio_deleted_at IS NOT NULL;"
    echo "── 2b. raw-audio rows: null AI fields + reset transcription to re-arm ──"
    "$SCRIPT" "
      UPDATE kpi_call_recordings
      SET ai_summary=NULL, ai_key_moments=NULL, objection_events=NULL,
          caller_existing_coverage=NULL,
          analysis_status='pending', transcription_status='pending'
      WHERE redaction_status='pending' AND audio_deleted_at IS NULL;"
    echo ""
    echo "✓ Prepared. AI-field PII cleared; rows armed for re-transcription."
    echo "  Next: '$0 --retranscribe' for the re-transcribe step."
    ;;

  --retranscribe)
    echo "Re-transcribe needs an ADMIN SESSION JWT (the gateway rejects"
    echo "service-role for transcribe-call-recording). Two options:"
    echo ""
    echo "A) In the app (simplest): as an admin, open each prepared recording and"
    echo "   click 'Retry transcription'. It re-transcribes from raw → redacts →"
    echo "   re-analyzes (clean AI) → mutes → lands 'needs_review'."
    echo ""
    echo "B) Scripted: export ADMIN_JWT (an admin's access_token) and PUBLISHABLE"
    echo "   (current sb_publishable_… key from Settings→API), then:"
    echo ""
    echo '   for id in $('"$SCRIPT"' "SELECT id FROM kpi_call_recordings WHERE redaction_status=\$\$pending\$\$ AND transcription_status=\$\$pending\$\$ AND audio_deleted_at IS NULL;" -t); do'
    echo '     curl -s -X POST "$SUPABASE_URL/functions/v1/transcribe-call-recording" \'
    echo '       -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $PUBLISHABLE" \'
    echo '       -H "Content-Type: application/json" -d "{\"recording_id\":\"$id\"}";'
    echo '     sleep 8;   # respect Deepgram/Anthropic + the 10/hr limiter'
    echo '   done'
    echo ""
    echo "Then review + approve each in /call-reviews/review-queue."
    ;;

  *)
    echo "Usage: $0 [report|--prepare|--retranscribe]"; exit 1;;
esac
