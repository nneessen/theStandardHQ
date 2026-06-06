// src/lib/string.ts

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getInitialsFromEmail(email: string): string {
  const namePart = email.split("@")[0];
  const parts = namePart.split(/[._-]/);

  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return namePart.slice(0, 2).toUpperCase();
}
