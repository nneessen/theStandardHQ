// src/features/social-studio/photoRotation.ts
// Pure resolver for WHICH photo an agent graphic should display. Decoupled from React
// and from the data-URL fetch so the precedence rule has a single, unit-tested home and
// is identical in Phase C-A (single profile photo) and C-B (multi-photo rotation).
//
// Precedence (advisor fix #3):
//   1. manualOverride — an explicit per-post upload always wins.
//   2. rotation photo — photos[rotationIdx mod n], ONLY when the agent has photos
//      (n > 0); the modulo is negative-safe so a corrupt cursor can't throw.
//   3. profilePhotoUrl — the stable primary avatar fallback (the only source in C-A).
//   4. null — render the initials placeholder.
//
// Returns the CHOSEN source URL (which may be remote); the caller is responsible for
// turning it into a CORS-safe data URL before PNG export.

export interface ResolveDisplayPhotoInput {
  /** An explicit per-post photo override (e.g. a manual upload). Wins over everything. */
  manualOverride?: string | null;
  /** The agent's rotation set, in rotation (sort) order. Empty in Phase C-A. */
  photos?: string[];
  /** The rotation cursor (user_profiles.photo_rotation_idx). Any integer; wraps mod n. */
  rotationIdx?: number;
  /** The stable primary avatar (user_profiles.profile_photo_url) — the fallback. */
  profilePhotoUrl?: string | null;
}

export function resolveDisplayPhoto({
  manualOverride,
  photos,
  rotationIdx = 0,
  profilePhotoUrl,
}: ResolveDisplayPhotoInput): string | null {
  if (manualOverride) return manualOverride;
  const n = photos?.length ?? 0;
  if (n > 0) {
    // Negative-safe modulo: ((idx % n) + n) % n keeps the index in [0, n) even if the
    // cursor is negative or huge, so photos[idx] is always defined.
    const idx = ((rotationIdx % n) + n) % n;
    return photos![idx] ?? profilePhotoUrl ?? null;
  }
  return profilePhotoUrl ?? null;
}
