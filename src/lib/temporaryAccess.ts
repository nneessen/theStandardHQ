// src/lib/temporaryAccess.ts

const PERMANENT_INSTAGRAM_ACCESS_EMAILS = ["meta-reviewer@thestandardhq.com"];

export function hasPermanentInstagramAccess(
  email: string | undefined | null,
): boolean {
  if (!email) return false;
  return PERMANENT_INSTAGRAM_ACCESS_EMAILS.includes(email.toLowerCase());
}
