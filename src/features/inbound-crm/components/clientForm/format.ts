// src/features/inbound-crm/components/clientForm/format.ts
// Shared, pure formatting/parsing helpers for the client intake form (used by both the inbound
// call modal and the Clients detail page). No React — safe to import anywhere.

export const money = (n?: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;

// Parse a value as a LOCAL date. A bare `YYYY-MM-DD` (date-only column like date_of_birth) must NOT
// go through `new Date(str)` — that treats it as UTC midnight and shifts a day in negative offsets
// (the rail showed 4/11 while the field showed 04/12). Build it in local time instead.
export function toLocalDate(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const fmtDate = (d?: string | null) => {
  const dt = toLocalDate(d);
  return dt ? dt.toLocaleDateString() : "—";
};

export const fmtPhone = (raw?: string | null) => {
  if (!raw) return "";
  const m = raw.replace(/[^\d]/g, "").match(/^1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw;
};

export function ageFromDob(dob?: string | null): string {
  const d = toLocalDate(dob);
  if (!d) return "";
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? `${a} yrs` : "";
}

export const fmtDuration = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

export function parseJson<T>(s?: string | null): Partial<T> {
  if (!s) return {};
  try {
    const o = JSON.parse(s) as Partial<T>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}
