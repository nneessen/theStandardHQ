-- ============================================================================
-- Expand presentation-recordings storage bucket to allow audio uploads
-- Adds MP3, WAV, OGG, and audio/mp4 alongside existing video + audio/webm types
-- Most presentation submissions are audio (MP3) recordings, not video
-- ============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Video
  'video/webm',
  'video/mp4',
  'video/quicktime',
  -- Audio
  'audio/webm',
  'audio/mpeg',  -- MP3
  'audio/mp4',   -- M4A
  'audio/wav',
  'audio/x-wav',
  'audio/ogg'
]
WHERE id = 'presentation-recordings';
