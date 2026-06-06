// src/lib/temporaryAccess.ts

export const SUPER_ADMIN_EMAIL = "nickneessen@thestandardhq.com";

const PERMANENT_INSTAGRAM_ACCESS_EMAILS = ["meta-reviewer@thestandardhq.com"];

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function hasPermanentInstagramAccess(
  email: string | undefined | null,
): boolean {
  if (!email) return false;
  return PERMANENT_INSTAGRAM_ACCESS_EMAILS.includes(email.toLowerCase());
}
